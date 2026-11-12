import { tenantCalendar } from "@core/utils/tenant-timezone";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { currentTenantId } from "@core/tenancy";
import { ci, paginatedTable, type ITDataTableFetchParams, type TableFilters } from "@core/utils/table";
import {
  assertDateKey,
  isReportPeriod,
  localDateKey,
  resolveReportRange,
  resolveTimezoneWithConfig,
  resolveWeekStartWithConfig,
} from "@core/utils/timezone";
import type {
  AccessIncidentCode,
  AccessReportPerson,
  AccessReportRange as ReportRange,
  AccessReportSession,
  AccessReportSessions,
  AccessReportSummary,
} from "@modules/access/models/entity/access.entity";
import { filterSessionRows } from "@modules/access/services/session-row-filters";
import { applyApprovedAdjustments, loadApprovedAdjustments } from "@core/utils/adjusted-punches";
import type {
  TimeClockReportResult,
  TimeClockReportSessionRow,
  TimeClockSessionSource,
} from "../models/entity/time-clock.entity";

type SysConfigReader = (key: string) => Promise<string | null>;

/**
 * Dos checadas del mismo empleado con menos de esto entre sí son la misma
 * checada repetida (en el reloj ~17% de los huecos entre checadas son < 1 min;
 * también quien checa en dos relojes al pasar). Así una checada repetida nunca
 * se vuelve una salida de minutos.
 */
const DUPLICATE_MS = 5 * 60 * 1000;

/**
 * Tope de una jornada: la salida es la última checada antes de que pase esto
 * desde la entrada; si no hay ninguna, la entrada queda sin salida. En los
 * relojes las jornadas duran 3–13 h y los descansos 13–16 h; ver CHECADOR.md §6.
 */
const MAX_WORKDAY_MS = 13 * 60 * 60 * 1000;

/** Días previos que se leen para no empezar a emparejar a media jornada. */
const LOOKBACK_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const universeSelect = {
  id: true,
  name: true,
  employeeNumber: true,
  jobTitle: true,
  active: true,
  department: { select: { id: true, name: true } },
} as const;

/** Persona del reporte: un usuario vinculado o un empleado del reloj sin vincular. */
interface Person extends AccessReportPerson {
  linked: boolean;
  /** Números del reloj de la persona (un usuario puede tener más de uno). */
  clockNumbers: string[];
}

/** Canal de una checada dentro del timeline mezclado. */
type PunchKind = "CLOCK" | "WEB" | "APP";

/**
 * Evento del timeline único de la persona: las checadas del reloj no traen tipo
 * (actúan como toggle) y las web/app sí (ENTRY/LUNCH_END abren, LUNCH_START/EXIT
 * cierran).
 */
interface TimelineEvent {
  at: Date;
  kind: PunchKind;
  /** `null` en las checadas del reloj, que no dicen si son entrada o salida. */
  type: string | null;
}

/** Sesión ya armada con su origen, antes de atribuirla a una fila. */
interface TimelineSession extends AccessReportSession {
  source: TimeClockSessionSource;
}

const OPENING_TYPES = new Set(["ENTRY", "LUNCH_END"]);
const CLOSING_TYPES = new Set(["LUNCH_START", "EXIT"]);

/** `MIXED` cuando la sesión combina canales; si no, el único canal que la formó. */
const sessionSourceOf = (kinds: Iterable<PunchKind>): TimeClockSessionSource => {
  const unique = new Set(kinds);
  if (unique.size === 0) return "CLOCK";
  return unique.size === 1 ? ([...unique][0] as PunchKind) : "MIXED";
};

/**
 * Quita los eventos repetidos del timeline mezclado: los que llegan a menos de
 * `DUPLICATE_MS` del anterior son la misma checada (el reloj repite, o la
 * persona checa en dos relojes / en el reloj y la web al llegar).
 *
 * Solo se descartan cuando participa una checada del RELOJ: no trae tipo, así
 * que un duplicado suyo cerraría/abriría el tramo equivocado. Los marcajes
 * web/app sí traen tipo y ya vienen validados por secuencia e idempotencia
 * (`clientEventId`), así que se respetan aunque estén cerca: una entrada y una
 * salida seguidas son una salida real, no un duplicado.
 */
const withoutDuplicates = (events: TimelineEvent[]): TimelineEvent[] => {
  const unique: TimelineEvent[] = [];
  for (const event of events) {
    const previous = unique[unique.length - 1];
    const closeTogether = previous && event.at.getTime() - previous.at.getTime() < DUPLICATE_MS;
    if (closeTogether && (previous.kind === "CLOCK" || event.kind === "CLOCK")) continue;
    unique.push(event);
  }
  return unique;
};

/**
 * Entradas/salidas a partir de TODAS las checadas de la persona —reloj físico y
 * marcajes web/app— con el MISMO contrato que el reporte de acceso
 * (`/access/report`): una fila por sesión y un resumen por persona.
 *
 * Las checadas de todos los relojes de asistencia se juntan por persona: se
 * puede entrar por uno y salir por otro. Los relojes marcados sin asistencia
 * (puertas de oficina, que se checan varias veces por turno) no cuentan. La
 * relación con los usuarios es por número de empleado del reloj vía
 * `checador_empleados`; quien checa sin estar vinculado sale igual, con el
 * nombre del reloj y `linked: false`.
 *
 * Este reporte es la fuente única de asistencia: la asistencia semanal, la
 * pre-nómina y las horas extra lo consumen en lugar de leer `remote_punches`
 * por su cuenta.
 */
export class TimeClockReportService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly sysConfig?: SysConfigReader
  ) {}

  async report(params: ITDataTableFetchParams) {
    const { rows, summary } = await this.compute(params);
    const from = (params.page - 1) * params.limit;
    return { ...paginatedTable(params, rows.slice(from, from + params.limit), rows.length), summary };
  }

  async reportExport(params: ITDataTableFetchParams) {
    const { rows, summary } = await this.compute(params);
    return { data: rows, total: rows.length, summary };
  }

  /** Universo y sesiones del periodo, sin filtros de columna: la base de la vista por persona. */
  async sessions(params: ITDataTableFetchParams): Promise<AccessReportSessions> {
    const { rows, people, range } = await this.compute(params);
    return { people, rows, range };
  }

  // ── Cálculo ────────────────────────────────────────────────────────────────

  private async compute(
    params: ITDataTableFetchParams
  ): Promise<TimeClockReportResult & { people: Person[]; range: ReportRange }> {
    const { filters } = params;
    const range = await this.resolveRange(filters);
    const includeInactive = filters.includeInactive === true || filters.includeInactive === "true";
    const tenantId = currentTenantId();
    // Lo que no depende de nada más se pide junto: cada viaje a la BD cuenta.
    const [nomSettings, fromAttendance] = await Promise.all([
      tenantId
        ? this.db.nomSettings.findUnique({
            where: { tenantId },
            select: { remoteCountsForWorkday: true },
          })
        : null,
      this.onlyAttendanceClocks(),
    ]);
    const remoteCountsForWorkday = nomSettings?.remoteCountsForWorkday ?? true;
    const people = this.filter(await this.universe(range, includeInactive, fromAttendance), filters);

    const clockNumbers = [...new Set(people.flatMap((p) => p.clockNumbers))];
    // Un solo flujo de checadas por persona: reloj y web/app se mezclan por hora.
    // `remoteCountsForWorkday=false` es el único opt-out de leer `remote_punches`.
    const remoteUserIds = people.map((person) => person.id).filter((id) => !id.startsWith("reloj:"));
    const [punches, remotePunches] = await Promise.all([
      clockNumbers.length === 0
        ? []
        : this.db.timeClockPunch.findMany({
            where: {
              ...fromAttendance,
              employeeNumber: { in: clockNumbers },
              // `OTRO` no es una checada válida (p. ej. minor 104, intento fallido).
              method: { not: "OTHER" },
              occurredAt: {
                gte: new Date(range.start.getTime() - LOOKBACK_DAYS * MS_PER_DAY),
                // Un turno nocturno cierra después del fin del periodo.
                lt: new Date(range.end.getTime() + MS_PER_DAY),
              },
            },
            orderBy: [{ occurredAt: "asc" }, { serialNo: "asc" }],
            select: { id: true, employeeNumber: true, occurredAt: true },
          }),
      remoteCountsForWorkday && remoteUserIds.length > 0
        ? this.db.remotePunch.findMany({
            where: { userId: { in: remoteUserIds }, occurredAt: { gte: range.start, lt: range.end } },
            orderBy: { occurredAt: "asc" },
            select: { id: true, userId: true, type: true, source: true, occurredAt: true },
          })
        : [],
    ]);

    // RJ-03/RJ-04: valor VIGENTE de cada checada (original + ajustes aprobados), reloj y web/app juntos.
    const [adjustments, remoteAdjustments] = await Promise.all([
      loadApprovedAdjustments(
        this.db,
        punches.map((punch) => punch.id)
      ),
      remotePunches.length === 0
        ? []
        : this.db.punchAdjustment.findMany({
            where: {
              targetType: "REMOTE",
              targetId: { in: remotePunches.map((punch) => punch.id) },
              status: "APPROVED",
            },
            orderBy: [{ decidedAt: "asc" }, { createdAt: "asc" }],
            select: { targetId: true, newState: true },
          }),
    ]);

    const effectivePunches = applyApprovedAdjustments(punches, adjustments);
    const byNumber = new Map<string, Date[]>();
    for (const c of effectivePunches) {
      const list = byNumber.get(c.employeeNumber);
      if (list) list.push(c.occurredAt);
      else byNumber.set(c.employeeNumber, [c.occurredAt]);
    }

    const remoteStateById = new Map<string, { occurredAt?: string; type?: string }>();
    for (const adjustment of remoteAdjustments) {
      const state = adjustment.newState as Record<string, unknown>;
      const current = remoteStateById.get(adjustment.targetId) ?? {};
      if (typeof state.occurredAt === "string") current.occurredAt = state.occurredAt;
      if (typeof state.type === "string") current.type = state.type;
      remoteStateById.set(adjustment.targetId, current);
    }

    const remoteByUser = new Map<string, TimelineEvent[]>();
    for (const punch of remotePunches) {
      const list = remoteByUser.get(punch.userId) ?? [];
      const adjusted = remoteStateById.get(punch.id);
      list.push({
        kind: punch.source,
        type: adjusted?.type ?? punch.type,
        at: adjusted?.occurredAt ? new Date(adjusted.occurredAt) : punch.occurredAt,
      });
      remoteByUser.set(punch.userId, list);
    }

    const rows: TimeClockReportSessionRow[] = [];
    const totals = { withRecords: 0, inSite: 0, minutes: 0, incidents: 0 };
    for (const person of people) {
      const clockEvents: TimelineEvent[] = person.clockNumbers
        .flatMap((number) => byNumber.get(number) ?? [])
        .map((at) => ({ at, kind: "CLOCK" as const, type: null }));
      const events = withoutDuplicates(
        [...clockEvents, ...(remoteByUser.get(person.id) ?? [])].sort(
          (a, b) => a.at.getTime() - b.at.getTime()
        )
      );
      const sessions = this.timeline(person.id, events, range);

      sessions.forEach((s, i) => rows.push(this.row(person, s, i, range)));
      const incidents = new Set(sessions.map((s) => s.incident).filter((i): i is AccessIncidentCode => i !== null));
      if (sessions.length > 0) totals.withRecords += 1;
      if (incidents.has("OPEN_ENTRY")) totals.inSite += 1;
      totals.minutes += sessions.reduce((acc, s) => acc + s.workedMinutes, 0);
      totals.incidents += incidents.size;
    }

    const summary: AccessReportSummary = {
      peopleTotal: people.length,
      peopleWithRecords: totals.withRecords,
      peopleWithoutRecords: people.length - totals.withRecords,
      peopleInside: totals.inSite,
      totalWorkedMinutes: totals.minutes,
      totalIncidents: totals.incidents,
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        timezone: range.timezone,
        period: range.period,
      },
    };
    return { rows: this.sort(filterSessionRows(rows, filters), params.sort), summary, people, range };
  }

  /** Resuelve `[start, end)` igual que el reporte de acceso (o lanza 400). */
  private async resolveRange(filters: TableFilters): Promise<ReportRange> {
    const period = filters.period;
    if (!isReportPeriod(period)) throw new HttpError(400, "INVALID_REPORT_PERIOD");
    const dateKey = assertDateKey(filters.date, "INVALID_REPORT_DATE");
    const explicitTz = typeof filters.tz === "string" && filters.tz !== "" ? filters.tz : undefined;
    const timezone = await resolveTimezoneWithConfig(explicitTz, this.sysConfig);
    const { start, end } = resolveReportRange(
      period,
      dateKey,
      timezone,
      await (async () => {
        const tenantId = currentTenantId();
        const tenant = tenantId
          ? await tenantCalendar(tenantId, this.db as never)
          : null;
        return tenant?.weekStartDay ?? (await resolveWeekStartWithConfig(this.sysConfig));
      })()
    );
    return { start, end, timezone, period };
  }

  /**
   * Filtro de checadas que cuentan para entradas/salidas: todas menos las de
   * relojes marcados sin asistencia (una serie sin registro sí cuenta).
   */
  private async onlyAttendanceClocks(): Promise<Prisma.TimeClockPunchWhereInput> {
    const doors = await this.db.timeClock.findMany({
      where: { countsAttendance: false },
      select: { serialNumber: true },
    });
    return doors.length > 0
      ? { clockSerial: { notIn: doors.map((r) => r.serialNumber) } }
      : {};
  }

  /**
   * Universo = usuarios vinculados (activos, o todos con `includeInactive`, o
   * cualquiera que haya checado en el periodo) ∪ empleados del reloj sin
   * vincular que checaron en el periodo.
   */
  private async universe(
    range: ReportRange,
    includeInactive: boolean,
    fromAttendance: Prisma.TimeClockPunchWhereInput
  ): Promise<Person[]> {
    const [links, inPeriod, remotePeople] = await Promise.all([
      this.db.timeClockEmployee.findMany({
        select: { employeeNumber: true, user: { select: universeSelect } },
      }),
      this.db.timeClockPunch.groupBy({
        by: ["employeeNumber"],
        where: { ...fromAttendance, method: { not: "OTHER" }, occurredAt: { gte: range.start, lt: range.end } },
      }),
      // Quien checó por web/app en el periodo (un solo viaje con la relación).
      this.db.user.findMany({
        where: {
          remotePunches: { some: { occurredAt: { gte: range.start, lt: range.end } } },
          active: includeInactive ? undefined : true,
        },
        select: universeSelect,
      }),
    ]);
    const punched = new Set(inPeriod.map((c) => c.employeeNumber));

    const byUser = new Map<string, Person>();
    for (const { employeeNumber, user } of links) {
      const person = byUser.get(user.id) ?? {
        id: user.id,
        name: user.name,
        employeeNumber: user.employeeNumber,
        jobTitle: user.jobTitle,
        department: user.department,
        active: user.active,
        linked: true,
        clockNumbers: [],
      };
      person.clockNumbers.push(employeeNumber);
      byUser.set(user.id, person);
    }
    for (const user of remotePeople) {
      if (byUser.has(user.id)) continue;
      byUser.set(user.id, {
        id: user.id,
        name: user.name,
        employeeNumber: user.employeeNumber,
        jobTitle: user.jobTitle,
        department: user.department,
        active: user.active,
        linked: true,
        clockNumbers: [],
      });
    }
    const linkedCount = [...byUser.values()].filter(
      (p) => p.active || includeInactive || p.clockNumbers.some((n) => punched.has(n))
    );

    const withLink = new Set(links.map((v) => v.employeeNumber));
    const withoutLink = [...punched].filter((n) => !withLink.has(n));
    const names = await this.clockNames(withoutLink);
    const fromClock: Person[] = withoutLink.map((n) => ({
      id: `reloj:${n}`,
      name: names.get(n) ?? n,
      employeeNumber: n,
      jobTitle: null,
      department: null,
      active: true,
      linked: false,
      clockNumbers: [n],
    }));

    return [...linkedCount, ...fromClock];
  }

  /** Nombre más reciente de cada número en el reloj. */
  private async clockNames(numbers: string[]): Promise<Map<string, string>> {
    if (numbers.length === 0) return new Map();
    // `$queryRaw` no pasa por la extensión de tenancy: el filtro de cliente va
    // explícito. Sin contexto (workers) se conserva el barrido global.
    const tenantId = currentTenantId();
    const tenantFilter = tenantId ? Prisma.sql`AND "tenantId" = ${tenantId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<{ employeeNumber: string; name: string }[]>`
      SELECT "employeeNumber", (array_agg("name" ORDER BY "occurredAt" DESC))[1] AS "name"
      FROM "time_clock_punches"
      WHERE "employeeNumber" IN (${Prisma.join(numbers)})
      ${tenantFilter}
      GROUP BY "employeeNumber"`;
    return new Map(rows.map((f) => [f.employeeNumber, f.name]));
  }

  private filter(people: Person[], filters: TableFilters): Person[] {
    const employeeId = typeof filters.employeeId === "string" ? filters.employeeId : undefined;
    const departmentId = typeof filters.departmentId === "string" ? filters.departmentId : undefined;
    const q = ci(filters.q)?.contains.toLowerCase();

    return people.filter((p) => {
      if (employeeId && p.id !== employeeId) return false;
      if (departmentId && p.department?.id !== departmentId) return false;
      if (q) {
        const text = [p.name, p.employeeNumber, ...p.clockNumbers].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  /**
   * Arma las sesiones de una persona con UN solo timeline: checadas del reloj y
   * marcajes web/app mezclados por hora.
   *
   * - La checada del reloj no trae tipo: funciona como toggle sobre el tramo
   *   abierto (si no hay, abre; si lo hay, cierra). El reloj separa jornadas por
   *   el tope de 13 h: un evento posterior al tope no cierra el tramo abierto,
   *   lo deja sin salida y abre el siguiente.
   * - Las web/app sí traen tipo: ENTRY/LUNCH_END abren y LUNCH_START/EXIT
   *   cierran. Así la comida de la app no se cuenta como tiempo trabajado.
   * - Un cierre sin tramo abierto (p. ej. la entrada quedó en un día anterior) es
   *   `EXIT_WITHOUT_ENTRY`; un tramo que queda abierto es `OPEN_ENTRY` (en sitio)
   *   o `ENTRY_WITHOUT_EXIT` si ya pasó el tope.
   */
  private timeline(id: string, events: TimelineEvent[], range: ReportRange): TimelineSession[] {
    const sessions: TimelineSession[] = [];
    let open: { entryAt: Date; kinds: PunchKind[] } | null = null;

    const dangling = (entryAt: Date, kinds: PunchKind[]): TimelineSession => {
      const incident: AccessIncidentCode =
        Date.now() < entryAt.getTime() + MAX_WORKDAY_MS ? "OPEN_ENTRY" : "ENTRY_WITHOUT_EXIT";
      return {
        ...this.session(id, entryAt, null, incident, range.timezone),
        source: sessionSourceOf(kinds),
      };
    };

    for (const event of events) {
      if (event.type === null) {
        // Checada del reloj: toggle sobre el tramo abierto.
        if (open === null) {
          open = { entryAt: event.at, kinds: [event.kind] };
          continue;
        }
        if (event.at.getTime() - open.entryAt.getTime() > MAX_WORKDAY_MS) {
          // Pasó el tope: el tramo anterior queda sin salida y esta checada abre otro.
          sessions.push(dangling(open.entryAt, open.kinds));
          open = { entryAt: event.at, kinds: [event.kind] };
          continue;
        }
        open.kinds.push(event.kind);
        sessions.push({
          ...this.session(id, open.entryAt, event.at, null, range.timezone),
          source: sessionSourceOf(open.kinds),
        });
        open = null;
        continue;
      }

      if (OPENING_TYPES.has(event.type)) {
        // Un nuevo inicio con un tramo abierto deja el anterior sin salida.
        if (open !== null) sessions.push(dangling(open.entryAt, open.kinds));
        open = { entryAt: event.at, kinds: [event.kind] };
        continue;
      }

      if (CLOSING_TYPES.has(event.type)) {
        if (open !== null) {
          open.kinds.push(event.kind);
          sessions.push({
            ...this.session(id, open.entryAt, event.at, null, range.timezone),
            source: sessionSourceOf(open.kinds),
          });
          open = null;
        } else {
          sessions.push({
            ...this.session(id, null, event.at, "EXIT_WITHOUT_ENTRY", range.timezone),
            source: sessionSourceOf([event.kind]),
          });
        }
      }
    }

    if (open !== null) sessions.push(dangling(open.entryAt, open.kinds));
    return sessions.filter((session) => this.inWindow(session, range));
  }

  private session(
    employeeId: string,
    entryAt: Date | null,
    exitAt: Date | null,
    incident: AccessIncidentCode | null,
    tz: string
  ): AccessReportSession {
    const workedMinutes =
      entryAt && exitAt ? Math.round((exitAt.getTime() - entryAt.getTime()) / MS_PER_MINUTE) : 0;
    const crossesMidnight = Boolean(
      entryAt && exitAt && localDateKey(entryAt, tz) !== localDateKey(exitAt, tz)
    );
    return { employeeId, entryAt, exitAt, workedMinutes, incident, crossesMidnight };
  }

  /** Se atribuye al día local de la entrada (como el reporte de acceso). */
  private inWindow(session: AccessReportSession, range: ReportRange): boolean {
    const anchor = session.entryAt ?? session.exitAt;
    return anchor !== null && anchor >= range.start && anchor < range.end;
  }

  private row(
    person: Person,
    session: TimelineSession,
    index: number,
    range: ReportRange
  ): TimeClockReportSessionRow {
    const anchor = session.entryAt ?? session.exitAt;
    return {
      id: `${person.id}-${anchor?.getTime() ?? 0}-${index}`,
      employeeId: person.id,
      employeeName: person.name,
      employeeNumber: person.employeeNumber,
      jobTitle: person.jobTitle,
      departmentId: person.department?.id ?? null,
      departmentName: person.department?.name ?? null,
      active: person.active,
      date: anchor ? localDateKey(anchor, range.timezone) : "",
      entryAt: session.entryAt?.toISOString() ?? null,
      exitAt: session.exitAt?.toISOString() ?? null,
      workedMinutes: session.workedMinutes,
      incident: session.incident,
      crossesMidnight: session.crossesMidnight,
      linked: person.linked,
      source: session.source,
    };
  }

  /** Mismas llaves de orden que el reporte de acceso. */
  private sort(
    rows: TimeClockReportSessionRow[],
    sort: ITDataTableFetchParams["sort"]
  ): TimeClockReportSessionRow[] {
    const sorters: Record<string, (a: TimeClockReportSessionRow, b: TimeClockReportSessionRow) => number> = {
      employeeName: (a, b) => a.employeeName.localeCompare(b.employeeName),
      employeeNumber: (a, b) => (a.employeeNumber ?? "").localeCompare(b.employeeNumber ?? ""),
      departmentName: (a, b) => (a.departmentName ?? "").localeCompare(b.departmentName ?? ""),
      jobTitle: (a, b) => (a.jobTitle ?? "").localeCompare(b.jobTitle ?? ""),
      date: (a, b) => a.date.localeCompare(b.date),
      day: (a, b) => a.date.localeCompare(b.date),
      employeeId: (a, b) => a.employeeName.localeCompare(b.employeeName),
      departmentId: (a, b) => (a.departmentName ?? "").localeCompare(b.departmentName ?? ""),
      entryAt: (a, b) => (a.entryAt ?? "").localeCompare(b.entryAt ?? ""),
      exitAt: (a, b) => (a.exitAt ?? "").localeCompare(b.exitAt ?? ""),
      workedMinutes: (a, b) => a.workedMinutes - b.workedMinutes,
      incident: (a, b) => (a.incident ?? "").localeCompare(b.incident ?? ""),
    };
    const fallback = (a: TimeClockReportSessionRow, b: TimeClockReportSessionRow): number =>
      a.employeeName.localeCompare(b.employeeName) || (a.entryAt ?? "").localeCompare(b.entryAt ?? "");

    const comparator = (sort ? sorters[sort.key] : undefined) ?? fallback;
    const sorted = [...rows].sort(comparator);
    return sort?.direction === "desc" ? sorted.reverse() : sorted;
  }
}
