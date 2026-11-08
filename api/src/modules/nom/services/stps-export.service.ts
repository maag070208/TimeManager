import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { assertDateKey, isReportPeriod, localDateKey } from "@core/utils/timezone";
import { applyApprovedAdjustments, loadApprovedAdjustments } from "@core/utils/adjusted-punches";
import type {
  StpsExportParams,
  StpsExportResult,
  StpsRemotePunchRow,
} from "../models/entity/nom.entity";
import type { WorkdayCalculator } from "./workday-alerts.service";
import type { WeeklyOvertimeService } from "./weekly-overtime.service";
import type { AuditLogger } from "@modules/users/services/user.service";

const SCHEMA_VERSION = "stps-registro-jornada-v2";

const csvCell = (value: string | number | boolean | null): string => {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Export formal del registro de jornada (F2-01/F2-02, requisito 4 del
 * checklist LFT 2027): por periodo y persona, con minutos trabajados,
 * programados, extra e incidencias, más un hash SHA-256 del contenido para
 * demostrar integridad. El formato de la disposición STPS aún no se publica:
 * este layout es versionado (`stps-registro-jornada-v0`) y se ajustará cuando
 * salga la disposición oficial (F2-06, validación legal).
 */
export class StpsExportService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly calculator: WorkdayCalculator,
    private readonly weekly?: WeeklyOvertimeService,
    private readonly audit?: AuditLogger
  ) {}

  /** Exporta y deja constancia en la bitácora: el archivo lleva marcajes y ubicación. */
  async export(tenantId: string, params: StpsExportParams): Promise<StpsExportResult> {
    const result = await this.build(tenantId, params);
    await this.audit?.({
      action: "STPS_EXPORT_DOWNLOADED",
      entityType: "StpsExport",
      entityId: tenantId,
      userId: params.actorId ?? undefined,
      metadata: { period: params.period, date: params.date, format: params.format, filename: result.filename, sha256: result.sha256 },
    });
    return result;
  }

  private async build(tenantId: string, params: StpsExportParams): Promise<StpsExportResult> {
    if (!isReportPeriod(params.period)) {
      throw new HttpError(400, "INVALID_REPORT_PERIOD");
    }
    assertDateKey(params.date, "INVALID_REPORT_DATE");
    const { days, range } = await this.calculator.computeOvertimeDays({
      page: 1,
      limit: 100000,
      filters: { period: params.period, date: params.date },
      sort: undefined,
    });

    // Asegura el ledger semanal del periodo para exportar las bolsas.
    if (this.weekly) {
      for (
        let cursor = new Date(range.start.getTime());
        cursor.getTime() < range.end.getTime();
        cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
      ) {
        await this.weekly.computeWeek(tenantId, localDateKey(cursor, range.timezone));
      }
    }

    type LedgerDay = {
      date: string;
      doubleMin: number;
      tripleMin: number;
      illegalMin: number;
      restDayWorkedMin: number;
      holidayWorkedMin: number;
      sunday: boolean;
      violations: string[];
    };
    const buckets = new Map<string, LedgerDay>();
    const minorByDay = new Map<string, boolean>();
    if (this.weekly) {
      const ledgers = await this.db.weeklyOvertimeLedger.findMany({
        where: {
          tenantId,
          weekStart: {
            gte: new Date(range.start.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: range.end,
          },
        },
        select: { userId: true, days: true, minor: true },
      });
      for (const ledger of ledgers) {
        for (const day of ledger.days as unknown as LedgerDay[]) {
          buckets.set(`${ledger.userId}|${day.date}`, day);
          minorByDay.set(`${ledger.userId}|${day.date}`, ledger.minor);
        }
      }
    }

    const rows = days
      .map((day) => ({
        userId: day.userId,
        firstEntryAt: null as string | null,
        origin: null as "RELOJ" | "REMOTO" | "MIXTO" | null,
        date: day.date,
        employeeNumber: day.employeeNumber,
        name: day.employeeName,
        department: day.departmentName,
        scheduleName: day.scheduleName,
        shift: day.shift,
        workedMinutes: day.workedMin,
        scheduledMinutes: day.scheduledMin,
        extraMinutes: day.extraMin,
        extraDoubleMinutes: buckets.get(`${day.userId}|${day.date}`)?.doubleMin ?? 0,
        extraTripleMinutes: buckets.get(`${day.userId}|${day.date}`)?.tripleMin ?? 0,
        illegalExtraMinutes: buckets.get(`${day.userId}|${day.date}`)?.illegalMin ?? 0,
        restDayWorkedMinutes: buckets.get(`${day.userId}|${day.date}`)?.restDayWorkedMin ?? 0,
        holidayWorkedMinutes: buckets.get(`${day.userId}|${day.date}`)?.holidayWorkedMin ?? 0,
        sundayWorked: buckets.get(`${day.userId}|${day.date}`)?.sunday ?? false,
        minor: false,
        violations: buckets.get(`${day.userId}|${day.date}`)?.violations ?? [],
        restDay: day.restDay,
        withoutSchedule: day.withoutSchedule,
        lastExitAt: day.exitAt,
      }))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.employeeNumber ?? a.name).localeCompare(b.employeeNumber ?? b.name)
      );

    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, timezone: true },
    });
    if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND");

    // Marcajes remotos (F2-07): también son registro de jornada y viajan en el export.
    const remote = await this.db.remotePunch.findMany({
      where: { tenantId, occurredAt: { gte: range.start, lt: range.end } },
      orderBy: { occurredAt: "asc" },
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
    // R-02: el export también lee las tablas de archivo (art. 804).
    type ArchivedPunch = {
      occurredAt: Date;
      employeeNumber: string | null;
      name: string | null;
      method: string;
    };
    let archivedPunchRows: ArchivedPunch[] = [];
    let archivedRemoteRows: Array<{
      occurredAt: Date;
      userId: string;
      type: string;
      workMode: string;
      employeeNumber?: string | null;
      name?: string | null;
    }> = [];
    if (typeof (this.db as { $queryRawUnsafe?: unknown }).$queryRawUnsafe === "function") {
      archivedPunchRows = await this.db.$queryRawUnsafe<ArchivedPunch[]>(
        `SELECT "occurredAt", "employeeNumber", "name", "method"
         FROM "nom_archived_time_clock_punches"
         WHERE "tenantId" = $1 AND "occurredAt" >= $2 AND "occurredAt" < $3
         ORDER BY "occurredAt" ASC`,
        tenantId,
        range.start,
        range.end
      );
      archivedRemoteRows = await this.db.$queryRawUnsafe<
        Array<{ occurredAt: Date; userId: string; type: string; workMode: string }>
      >(
        `SELECT "occurredAt", "userId", "type", "workMode"
         FROM "nom_archived_remote_punches"
         WHERE "tenantId" = $1 AND "occurredAt" >= $2 AND "occurredAt" < $3
         ORDER BY "occurredAt" ASC`,
        tenantId,
        range.start,
        range.end
      );
      const names = archivedRemoteRows.length
        ? await this.db.user.findMany({
            where: { id: { in: [...new Set(archivedRemoteRows.map((row) => row.userId))] } },
            select: { id: true, name: true, employeeNumber: true },
          })
        : [];
      const byId = new Map(names.map((row) => [row.id, row]));
      archivedRemoteRows = archivedRemoteRows.map((row) => ({
        ...row,
        employeeNumber: byId.get(row.userId)?.employeeNumber ?? null,
        name: byId.get(row.userId)?.name ?? null,
      }));
    }

    const remoteRows: StpsRemotePunchRow[] = remote.map((punch) => ({
      date: localDateKey(punch.occurredAt, range.timezone),
      employeeNumber: punch.user?.employeeNumber ?? null,
      name: punch.user?.name ?? "—",
      type: punch.type,
      workMode: punch.workMode,
      occurredAt: punch.occurredAt.toISOString(),
      hasGeolocation: punch.latitude !== null && punch.longitude !== null,
    }));

    const generatedAt = new Date().toISOString();
    const archived = {
      punches: archivedPunchRows.map((row) => ({
        occurredAt: row.occurredAt.toISOString(),
        employeeNumber: row.employeeNumber,
        name: row.name,
        method: row.method,
      })),
      remotePunches: archivedRemoteRows.map((row) => ({
        occurredAt: row.occurredAt.toISOString(),
        employeeNumber: row.employeeNumber,
        name: row.name,
        type: row.type,
        workMode: row.workMode,
      })),
    };
    // Detalle de marcajes (RJ-06): reloj vigente (con ajustes aprobados) + remoto + archivo.
    const clockPunches = await this.db.timeClockPunch.findMany({
      where: { occurredAt: { gte: range.start, lt: range.end } },
      orderBy: [{ occurredAt: "asc" }, { serialNo: "asc" }],
      select: { id: true, employeeNumber: true, name: true, method: true, occurredAt: true },
    });
    const clockAdjustments = await loadApprovedAdjustments(
      this.db,
      clockPunches.map((punch) => punch.id)
    );
    const effectiveClock = applyApprovedAdjustments(clockPunches, clockAdjustments);
    const links = await this.db.timeClockEmployee.findMany({
      select: { employeeNumber: true, userId: true },
    });
    const userByNumber = new Map(links.map((link) => [link.employeeNumber, link.userId]));
    type DetailPunch = {
      occurredAt: string;
      date: string;
      employeeNumber: string | null;
      name: string | null;
      type: string;
      method: string;
      source: "RELOJ" | "REMOTO" | "ARCHIVO";
      userId: string | null;
    };
    const detail: DetailPunch[] = [
      ...effectiveClock.map((punch) => ({
        occurredAt: punch.occurredAt.toISOString(),
        date: localDateKey(punch.occurredAt, range.timezone),
        employeeNumber: punch.employeeNumber,
        name: punch.name,
        type: "MARCA",
        method: punch.method,
        source: "RELOJ" as const,
        userId: userByNumber.get(punch.employeeNumber) ?? null,
      })),
      ...remoteRows.map((row) => ({
        occurredAt: row.occurredAt,
        date: row.date,
        employeeNumber: row.employeeNumber ?? null,
        name: row.name ?? null,
        type: row.type,
        method: row.workMode,
        source: "REMOTO" as const,
        userId: null,
      })),
      ...archived.punches.map((row) => ({
        occurredAt: row.occurredAt,
        date: localDateKey(new Date(row.occurredAt), range.timezone),
        employeeNumber: row.employeeNumber ?? null,
        name: row.name ?? null,
        type: "MARCA",
        method: row.method ?? "",
        source: "ARCHIVO" as const,
        userId: null,
      })),
      ...archived.remotePunches.map((row) => ({
        occurredAt: row.occurredAt,
        date: localDateKey(new Date(row.occurredAt), range.timezone),
        employeeNumber: row.employeeNumber ?? null,
        name: row.name ?? null,
        type: row.type,
        method: row.workMode,
        source: "ARCHIVO" as const,
        userId: null,
      })),
    ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    // Primer/último marcaje por persona/día y origen de la jornada.
    const dayAgg = new Map<string, { first: string; last: string; sources: Set<string> }>();
    for (const punch of detail) {
      const key = `${punch.userId ?? punch.employeeNumber ?? punch.name}|${punch.date}`;
      const current = dayAgg.get(key);
      if (!current) {
        dayAgg.set(key, { first: punch.occurredAt, last: punch.occurredAt, sources: new Set([punch.source]) });
      } else {
        if (punch.occurredAt < current.first) current.first = punch.occurredAt;
        if (punch.occurredAt > current.last) current.last = punch.occurredAt;
        current.sources.add(punch.source);
      }
    }
    for (const row of rows) {
      const agg = dayAgg.get(`${row.userId}|${row.date}`) ?? dayAgg.get(`${row.employeeNumber ?? row.name}|${row.date}`);
      row.firstEntryAt = agg?.first ?? null;
      row.lastExitAt = agg?.last ?? row.lastExitAt;
      const live = [...(agg?.sources ?? [])].filter((source) => source !== "ARCHIVO");
      row.origin =
        live.length === 0
          ? null
          : live.includes("RELOJ") && live.includes("REMOTO")
            ? "MIXTO"
            : live.includes("RELOJ")
              ? "RELOJ"
              : "REMOTO";
      row.minor = minorByDay.get(`${row.userId}|${row.date}`) ?? row.minor;
    }

    const body = { rows, punches: detail, remotePunches: remoteRows, archived };
    const from = localDateKey(range.start, range.timezone);
    const to = localDateKey(new Date(range.end.getTime() - 1), range.timezone);
    const totals = {
      rows: rows.length,
      workedMinutes: rows.reduce((sum, row) => sum + row.workedMinutes, 0),
      scheduledMinutes: rows.reduce((sum, row) => sum + row.scheduledMinutes, 0),
      extraMinutes: rows.reduce((sum, row) => sum + row.extraMinutes, 0),
      extraDoubleMinutes: rows.reduce((sum, row) => sum + row.extraDoubleMinutes, 0),
      extraTripleMinutes: rows.reduce((sum, row) => sum + row.extraTripleMinutes, 0),
      illegalExtraMinutes: rows.reduce((sum, row) => sum + row.illegalExtraMinutes, 0),
      restDayWorkedMinutes: rows.reduce((sum, row) => sum + row.restDayWorkedMinutes, 0),
      holidayWorkedMinutes: rows.reduce((sum, row) => sum + row.holidayWorkedMinutes, 0),
      people: new Set(rows.map((row) => row.employeeNumber ?? row.name)).size,
      incidents: rows.filter((row) => row.restDay || row.withoutSchedule).length,
      remotePunches: remoteRows.length,
      archivedPunches: archived.punches.length,
      archivedRemotePunches: archived.remotePunches.length,
    };
    const filename = `registro-jornada_${tenant.slug}_${from}_${to}.${params.format}`;
    const header = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      generatedById: params.actorId ?? null,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, timezone: tenant.timezone },
      period: params.period,
      from,
      to,
      timezone: range.timezone,
      totals,
    };

    if (params.format === "json") {
      // El hash cubre el documento SIN la línea sha256, para que el receptor
      // pueda recalcularlo sobre el archivo que recibió.
      const unsigned = JSON.stringify({ ...header, ...body }, null, 2);
      const digest = createHash("sha256").update(unsigned).digest("hex");
      return {
        contentType: "application/json; charset=utf-8",
        filename,
        body: JSON.stringify({ ...header, sha256: digest, ...body }, null, 2),
        sha256: digest,
        rowCount: rows.length + detail.length,
      };
    }

    const lines = [
      "# CheckLab — Registro electrónico de jornada (LFT art. 132 fr. XXXIV)",
      `# schema: ${SCHEMA_VERSION}`,
      `# cliente: ${tenant.name} (${tenant.id})`,
      `# periodo: ${params.period} ${from}..${to} (${range.timezone})`,
      `# generado: ${generatedAt}`,
      `# filas: ${rows.length} · personas: ${totals.people} · minutos trabajados: ${totals.workedMinutes} · marcajes remotos: ${remoteRows.length}`,
      "fecha,numeroEmpleado,nombre,departamento,horario,turno,minutosTrabajados,minutosProgramados,minutosExtra,extraDoble,extraTriple,excedenteIlegal,descansoLaborado,festivoLaborado,domingo,menor,infracciones,descanso,sinHorario,primeraEntrada,ultimaSalida,origen",
      ...rows.map((row) =>
        [
          row.date,
          row.employeeNumber,
          row.name,
          row.department,
          row.scheduleName,
          row.shift,
          row.workedMinutes,
          row.scheduledMinutes,
          row.extraMinutes,
          row.extraDoubleMinutes,
          row.extraTripleMinutes,
          row.illegalExtraMinutes,
          row.restDayWorkedMinutes,
          row.holidayWorkedMinutes,
          row.sundayWorked ? "si" : "no",
          row.minor ? "si" : "no",
          row.violations.join("|"),
          row.restDay ? "si" : "no",
          row.withoutSchedule ? "si" : "no",
          row.firstEntryAt,
          row.lastExitAt,
          row.origin,
        ]
          .map(csvCell)
          .join(",")
      ),
      ...(remoteRows.length
        ? [
            "",
            "# marcajes remotos (sin reloj físico; hora del servidor)",
            "fecha,numeroEmpleado,nombre,tipo,modalidad,marcajeISO,geolocalizacion",
            ...remoteRows.map((row) =>
              [
                row.date,
                row.employeeNumber ?? null,
                row.name ?? null,
                row.type,
                row.workMode,
                row.occurredAt,
                row.hasGeolocation ? "si" : "no",
              ]
                .map(csvCell)
                .join(",")
            ),
          ]
        : []),
      "",
      "# marcajes (detalle: fecha, hora, tipo, método, fuente)",
      "fecha,hora,tipo,metodo,fuente,numeroEmpleado,nombre",
      ...detail.map((punch) =>
        [punch.date, punch.occurredAt, punch.type, punch.method, punch.source, punch.employeeNumber, punch.name]
          .map(csvCell)
          .join(",")
      ),
      ...(archived.punches.length
        ? [
            "",
            "# registros archivados (retención art. 804; mismo contenido, tabla de archivo)",
            "fecha,hora,numeroEmpleado,nombre,metodo",
            ...archived.punches.map((row) =>
              [
                row.occurredAt.slice(0, 10),
                row.occurredAt.slice(11, 19),
                row.employeeNumber ?? null,
                row.name ?? null,
                row.method,
              ]
                .map(csvCell)
                .join(",")
            ),
          ]
        : []),
      ...(archived.remotePunches.length
        ? [
            "",
            "# marcajes remotos archivados (retención art. 804)",
            "fecha,hora,numeroEmpleado,nombre,tipo,modalidad",
            ...archived.remotePunches.map((row) =>
              [
                row.occurredAt.slice(0, 10),
                row.occurredAt.slice(11, 19),
                row.employeeNumber ?? null,
                row.name ?? null,
                row.type,
                row.workMode,
              ]
                .map(csvCell)
                .join(",")
            ),
          ]
        : []),
    ];

    // Hash sobre el texto final (sin la propia línea sha256, para que el
    // receptor pueda recalcularlo sobre el archivo entregado).
    const csvDigest = createHash("sha256").update(lines.join("\n")).digest("hex");
    lines.splice(6, 0, `# sha256: ${csvDigest}`);
    return {
      contentType: "text/csv; charset=utf-8",
      filename,
      body: `${lines.join("\n")}\n`,
      sha256: csvDigest,
      rowCount: rows.length + detail.length,
    };
  }
}
