import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { staffRoleKeys } from "@core/permissions";
import { currentTenantId } from "@core/tenancy";
import { TABLE_MAX_LIMIT } from "@core/utils/table";
import {
  assertDateKey,
  localDateKey,
  resolveReportRange,
  resolveTimezoneWithConfig,
  resolveWeekStartWithConfig,
} from "@core/utils/timezone";
import { TimeClockReportService } from "@modules/time-clock/services/time-clock-report.service";
import { loadScheduleAssignments, scheduleOn } from "./schedule-assignments";
import { computeWorkday, dateKeyOf, scheduledStartAt, shiftOf, toUtcDate } from "./workday-rules";
import type {
  WeeklyAttendanceDay,
  WeeklyAttendanceDayStatus,
  WeeklyAttendanceReport,
  WeeklyAttendanceRow,
  WeeklyAttendanceTotals,
} from "../models/entity/schedule.entity";

type SysConfigReader = (key: string) => Promise<string | null>;

/** Roles con expediente de personal (los que checan y cobran tiempo extra). */
const personalRoles = (): string[] => staffRoleKeys();

/** Incidencias que dejan el día incompleto (la entrada abierta de hoy es "en sitio", no incompleta). */
const INCOMPLETE_INCIDENTS = new Set(["ENTRY_WITHOUT_EXIT", "EXIT_WITHOUT_ENTRY"]);

export interface WeeklyAttendanceParams {
  /** Cualquier día de la semana a consultar (`YYYY-MM-DD`). */
  date: string;
  departmentId?: string;
  /** Busca por nombre, número de empleado o número del reloj. */
  q?: string;
  /** Ignora la caché corta (botón «Actualizar» / pruebas). */
  refresh?: boolean;
}

const addDays = (dayKey: string, days: number) => {
  const d = toUtcDate(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKeyOf(d);
};

const emptyTotals = (): WeeklyAttendanceTotals => ({
  workedMin: 0,
  scheduledMin: 0,
  extraMin: 0,
  approvedExtraMin: 0,
  pendingExtraMin: 0,
  rejectedExtraMin: 0,
  missingMin: 0,
  absences: 0,
  incompleteDays: 0,
});

/**
 * Reporte semanal de asistencia (el control que RH llevaba en Excel): por
 * persona de un departamento, los 7 días con entrada, salida, horas trabajadas,
 * tiempo extra y faltas, más el total de la semana contra lo aprobado.
 *
 * - Fuente: checadas de los relojes de asistencia (mismo emparejamiento que
 *   entradas/salidas); solo cuentan las personas vinculadas al reloj.
 * - Tiempo extra: la regla de `computeWorkday`, la misma que aprueban los jefes.
 *   Se muestra SIEMPRE lo calculado, con su decisión (aprobado, rechazado o
 *   pendiente = no aprobado).
 * - Universo: el personal del departamento (activo, o con checadas en la
 *   semana), aunque no haya checado: así se ven las faltas.
 */
export class WeeklyAttendanceService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly timeClockReport: TimeClockReportService = new TimeClockReportService(prismaClient),
    private readonly sysConfig?: SysConfigReader
  ) {}

  /** Caché corta por tenant (el dashboard pide el mismo reporte 2 veces). */
  private readonly cache = new Map<string, { at: number; report: WeeklyAttendanceReport }>();

  async report(params: WeeklyAttendanceParams): Promise<WeeklyAttendanceReport> {
    const cacheKey = `${currentTenantId() ?? "platform"}|${params.date}|${params.departmentId ?? ""}|${params.q ?? ""}`;
    const cached = params.refresh ? undefined : this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < 30_000) return cached.report;
    const report = await this.computeReport(params);
    this.cache.set(cacheKey, { at: Date.now(), report });
    if (this.cache.size > 200) {
      for (const [key, entry] of this.cache) if (Date.now() - entry.at >= 30_000) this.cache.delete(key);
    }
    return report;
  }

  private async computeReport(params: WeeklyAttendanceParams): Promise<WeeklyAttendanceReport> {
    const dateKey = assertDateKey(params.date, "INVALID_REPORT_DATE");
    const timezone = await resolveTimezoneWithConfig(undefined, this.sysConfig);
    const weekStart = await (async () => {
        const tenantId = currentTenantId();
        const tenant = tenantId
          ? await this.db.tenant.findUnique({ where: { id: tenantId }, select: { weekStartDay: true } })
          : null;
        return tenant?.weekStartDay ?? (await resolveWeekStartWithConfig(this.sysConfig));
      })();
    const range = resolveReportRange("WEEK", dateKey, timezone, weekStart);
    const firstDay = localDateKey(range.start, timezone);
    const days = Array.from({ length: 7 }, (_, i) => addDays(firstDay, i));
    const today = localDateKey(new Date(), timezone);

    // Sesiones del reloj de la semana (una fila por sesión), por persona y día.
    // `reportExport` ya trae el periodo completo (el cálculo no pagina): se pide
    // el tope de tabla, no un `limit: 100000` decorativo (F1C-05).
    const sessions = (
      await this.timeClockReport.reportExport({
        page: 1,
        limit: TABLE_MAX_LIMIT,
        filters: {
          period: "WEEK",
          date: dateKey,
          includeInactive: true,
          ...(params.departmentId && { departmentId: params.departmentId }),
        },
        sort: undefined,
      })
    ).data.filter((s) => s.linked === true);
    const sessionsByKey = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const key = `${s.employeeId}|${s.date}`;
      sessionsByKey.set(key, [...(sessionsByKey.get(key) ?? []), s]);
    }
    const withSessions = [...new Set(sessions.map((s) => s.employeeId))];

    const people = await this.db.user.findMany({
      where: {
        role: { in: personalRoles() },
        ...(params.departmentId && { departmentId: params.departmentId }),
        OR: [{ active: true }, { id: { in: withSessions } }],
      },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        jobTitle: true,
        active: true,
        department: { select: { id: true, name: true } },
        payrollPosition: { select: { name: true, dailySalary: true, sbcDaily: true } },
        timeClockEmployees: { select: { employeeNumber: true } },
      },
      orderBy: { name: "asc" },
    });
    const userIds = people.map((p) => p.id);

    // Checadas web/app (sin reloj): cuentan igual que las del reloj para
    // asistencia, horas trabajadas y pre-nómina.
    const remotePunches = await this.db.remotePunch.findMany({
      where: {
        userId: { in: userIds },
        occurredAt: { gte: range.start, lt: range.end },
      },
      orderBy: { occurredAt: "asc" },
      select: { id: true, userId: true, type: true, occurredAt: true },
    });
    const remoteSessionsByKey = new Map<string, Array<{ entryAt: string; exitAt: string | null; workedMinutes: number }>>();
    const remoteOpenByUser = new Map<string, Date>();
    for (const punch of remotePunches) {
      const key = `${punch.userId}|${localDateKey(punch.occurredAt, timezone)}`;
      const list = remoteSessionsByKey.get(key) ?? [];
      const open = remoteOpenByUser.get(punch.userId);
      if (punch.type === "ENTRY" || punch.type === "LUNCH_END") {
        remoteOpenByUser.set(punch.userId, punch.occurredAt);
      } else if (open) {
        list.push({
          entryAt: open.toISOString(),
          exitAt: punch.occurredAt.toISOString(),
          workedMinutes: Math.max(0, Math.round((punch.occurredAt.getTime() - open.getTime()) / 60_000)),
        });
        remoteOpenByUser.delete(punch.userId);
      }
      remoteSessionsByKey.set(key, list);
    }

    const agreements = await this.db.workdayDistributionAgreement.findMany({
      where: {
        userId: { in: userIds },
        acceptedAt: { not: null },
        effectiveFrom: { lte: range.end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.start } }],
      },
      select: { userId: true },
    });
    const agreementUsers = new Set(agreements.map((row) => row.userId).filter(Boolean) as string[]);

    const [assignments, approvals] = await Promise.all([
      loadScheduleAssignments(this.db, userIds, range),
      this.db.overtimeApproval.findMany({
        where: { userId: { in: userIds }, date: { gte: toUtcDate(days[0]), lte: toUtcDate(days[6]) } },
      }),
    ]);
    const approvalByKey = new Map(approvals.map((a) => [`${a.userId}|${dateKeyOf(a.date)}`, a]));

    // Vacaciones y permisos aprobados: el día no es falta.
    const leaves = await this.db.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: "APPROVED",
        startDate: { lte: toUtcDate(days[6]) },
        endDate: { gte: toUtcDate(days[0]) },
      },
      select: { userId: true, startDate: true, endDate: true },
    });
    const onLeave = (userId: string, dayKey: string) =>
      leaves.some((l) => l.userId === userId && dateKeyOf(l.startDate) <= dayKey && dayKey <= dateKeyOf(l.endDate));

    const rows: WeeklyAttendanceRow[] = people.map((person) => {
      const clockNumbers = person.timeClockEmployees.map((t) => t.employeeNumber);
      // RJ-02: con checadas web/app la persona también tiene registro ese día.
      const remoteDays = days.filter((day) => remoteSessionsByKey.has(`${person.id}|${day}`));
      const linked = clockNumbers.length > 0 || withSessions.includes(person.id) || remoteDays.length > 0;
      const totals = emptyTotals();
      let scheduleName: string | null = null;

      const personDays = days.map((dayKey): WeeklyAttendanceDay => {
        const schedule = scheduleOn(assignments, person.id, dayKey);
        scheduleName = schedule?.name ?? scheduleName;
        // El reporte de sesiones ya trae las checadas web/app (con sus ajustes);
        // aquí solo se ordenan, para no contarlas dos veces.
        const daySessions = [...(sessionsByKey.get(`${person.id}|${dayKey}`) ?? [])].sort((a, b) =>
          (a.entryAt ?? "").localeCompare(b.entryAt ?? "")
        );
        const workday = computeWorkday(
          dayKey,
          daySessions,
          schedule,
          timezone,
          agreementUsers.has(person.id)
        );
        const incomplete = daySessions.some((s) => s.incident !== null && INCOMPLETE_INCIDENTS.has(s.incident));

        let status: WeeklyAttendanceDayStatus;
        if (dayKey > today) status = "FUTURE";
        else if (!linked) status = "NO_INFO";
        else if (daySessions.length > 0) {
          status = incomplete ? "INCOMPLETE" : workday.restDay ? "REST_WORKED" : workday.extraMin > 0 ? "OVERTIME" : "WORKED";
        } else if (workday.restDay) status = "REST";
        else if (onLeave(person.id, dayKey)) status = "LEAVE";
        // Hoy sin checadas todavía, o sin horario (no se sabe si le tocaba): sin información.
        else if (dayKey === today || workday.withoutSchedule) status = "NO_INFO";
        else status = "ABSENCE";

        const decision = approvalByKey.get(`${person.id}|${dayKey}`);
        const approval = decision ? decision.status : workday.extraMin > 0 ? "PENDING" : null;
        const approvedExtraMin = decision?.status === "APPROVED" ? decision.extraMin : 0;

        const counts = status !== "FUTURE" && status !== "NO_INFO";
        if (counts) {
          totals.workedMin += workday.workedMin;
          totals.scheduledMin += workday.scheduledMin;
          totals.extraMin += workday.extraMin;
          if (status !== "LEAVE") totals.missingMin += workday.missingMin;
        }
        totals.approvedExtraMin += approvedExtraMin;
        if (approval === "PENDING") totals.pendingExtraMin += workday.extraMin;
        if (approval === "REJECTED") totals.rejectedExtraMin += workday.extraMin;
        if (status === "ABSENCE") totals.absences += 1;
        if (status === "INCOMPLETE") totals.incompleteDays += 1;

        const entries = daySessions.map((s) => s.entryAt).filter((v): v is string => v !== null).sort();
        const exits = daySessions.map((s) => s.exitAt).filter((v): v is string => v !== null).sort();
        return {
          date: dayKey,
          status,
          entryAt: entries[0] ?? null,
          exitAt: exits[exits.length - 1] ?? null,
          sessions: daySessions.map((s) => ({
            entryAt: s.entryAt,
            exitAt: s.exitAt,
            workedMinutes: s.workedMinutes,
            incident: s.incident,
          })),
          workedMin: workday.workedMin,
          scheduledMin: workday.scheduledMin,
          extraMin: workday.extraMin,
          missingMin: workday.missingMin,
          lateMin: workday.lateMin,
          shift: shiftOf(schedule, dayKey),
          scheduledStartAt: scheduledStartAt(schedule, dayKey, timezone)?.toISOString() ?? null,
          approval,
          approvedExtraMin,
        };
      });

      return {
        userId: person.id,
        employeeNumber: person.employeeNumber,
        clockNumbers,
        name: person.name,
        jobTitle: person.jobTitle,
        departmentId: person.department?.id ?? null,
        departmentName: person.department?.name ?? null,
        payrollPosition: person.payrollPosition
          ? {
              name: person.payrollPosition.name,
              dailySalary: Number(person.payrollPosition.dailySalary),
              sbcDaily: person.payrollPosition.sbcDaily == null ? null : Number(person.payrollPosition.sbcDaily),
            }
          : null,
        active: person.active,
        linked,
        scheduleName,
        withoutSchedule: scheduleName === null,
        days: personDays,
        totals,
      };
    });

    const q = params.q?.trim().toLowerCase();
    const visible = q
      ? rows.filter((r) =>
          [r.name, r.employeeNumber, ...r.clockNumbers].some((v) => (v ?? "").toLowerCase().includes(q))
        )
      : rows;

    const summary = {
      ...emptyTotals(),
      people: visible.length,
      unlinked: 0,
      withoutSchedule: 0,
      dailySalaryTotal: 0,
      weeklySalaryCost: 0,
      withSalary: 0,
    };
    for (const r of visible) {
      for (const key of Object.keys(r.totals) as Array<keyof WeeklyAttendanceTotals>) summary[key] += r.totals[key];
      if (!r.linked) summary.unlinked += 1;
      if (r.withoutSchedule) summary.withoutSchedule += 1;
      if (r.payrollPosition) {
        summary.dailySalaryTotal += r.payrollPosition.dailySalary;
        summary.withSalary += 1;
      }
    }
    summary.weeklySalaryCost = summary.dailySalaryTotal * 7;

    return {
      range: { start: range.start.toISOString(), end: range.end.toISOString(), timezone, days },
      rows: visible,
      summary,
    };
  }
}
