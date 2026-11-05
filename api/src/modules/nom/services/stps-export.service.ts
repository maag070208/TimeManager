import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { assertDateKey, isReportPeriod, localDateKey } from "@core/utils/timezone";
import type {
  StpsExportParams,
  StpsExportResult,
  StpsExportRow,
  StpsRemotePunchRow,
} from "../models/entity/nom.entity";
import type { WorkdayCalculator } from "./workday-alerts.service";

const SCHEMA_VERSION = "stps-registro-jornada-v0";

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
    private readonly calculator: WorkdayCalculator
  ) {}

  async export(tenantId: string, params: StpsExportParams): Promise<StpsExportResult> {
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

    const rows: StpsExportRow[] = days
      .map((day) => ({
        date: day.date,
        employeeNumber: day.employeeNumber,
        name: day.employeeName,
        department: day.departmentName,
        scheduleName: day.scheduleName,
        shift: day.shift,
        workedMinutes: day.workedMin,
        scheduledMinutes: day.scheduledMin,
        extraMinutes: day.extraMin,
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
    const sha256 = createHash("sha256")
      .update(JSON.stringify({ rows, remotePunches: remoteRows }))
      .digest("hex");
    const from = localDateKey(range.start, range.timezone);
    const to = localDateKey(new Date(range.end.getTime() - 1), range.timezone);
    const totals = {
      rows: rows.length,
      workedMinutes: rows.reduce((sum, row) => sum + row.workedMinutes, 0),
      scheduledMinutes: rows.reduce((sum, row) => sum + row.scheduledMinutes, 0),
      extraMinutes: rows.reduce((sum, row) => sum + row.extraMinutes, 0),
      people: new Set(rows.map((row) => row.employeeNumber ?? row.name)).size,
      incidents: rows.filter((row) => row.restDay || row.withoutSchedule).length,
      remotePunches: remoteRows.length,
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
      sha256,
    };

    if (params.format === "json") {
      return {
        contentType: "application/json; charset=utf-8",
        filename,
        body: JSON.stringify({ ...header, rows, remotePunches: remoteRows }, null, 2),
        sha256,
        rowCount: rows.length + remoteRows.length,
      };
    }

    const lines = [
      "# TimeManager — Registro electrónico de jornada (LFT art. 132 fr. XXXIV)",
      `# schema: ${SCHEMA_VERSION}`,
      `# cliente: ${tenant.name} (${tenant.id})`,
      `# periodo: ${params.period} ${from}..${to} (${range.timezone})`,
      `# generado: ${generatedAt}`,
      `# filas: ${rows.length} · personas: ${totals.people} · minutos trabajados: ${totals.workedMinutes} · marcajes remotos: ${remoteRows.length}`,
      `# sha256: ${sha256}`,
      "fecha,numeroEmpleado,nombre,departamento,horario,turno,minutosTrabajados,minutosProgramados,minutosExtra,descanso,sinHorario,ultimaSalida",
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
          row.restDay ? "si" : "no",
          row.withoutSchedule ? "si" : "no",
          row.lastExitAt,
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
                row.employeeNumber,
                row.name,
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
    ];

    return {
      contentType: "text/csv; charset=utf-8",
      filename,
      body: `${lines.join("\n")}\n`,
      sha256,
      rowCount: rows.length + remoteRows.length,
    };
  }
}
