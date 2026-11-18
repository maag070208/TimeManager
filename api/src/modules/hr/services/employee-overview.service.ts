import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { DEFAULT_TIMEZONE, endOfLocalDay, isValidDateKey, localDateKey, startOfLocalDay } from "@core/utils/timezone";
import { tenantTimezone } from "@core/utils/tenant-timezone";
import { openLocation } from "@modules/nom/services/punch-location";

const DAY_MS = 86_400_000;
const HISTORY_DEFAULT_DAYS = 14;
const HISTORY_MAX_DAYS = 92;

const ADJUSTMENT_SELECT = {
  id: true,
  status: true,
  reason: true,
  newState: true,
  decisionNote: true,
  createdAt: true,
  decidedAt: true,
} as const;

type AdjustmentRow = {
  id: string;
  status: string;
  reason: string;
  newState: unknown;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
};

const adjustmentDto = (row: AdjustmentRow) => {
  const proposed = (row.newState ?? {}) as { occurredAt?: unknown };
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    proposedAt: typeof proposed.occurredAt === "string" ? proposed.occurredAt : null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
};

const fullName = (user: {
  name: string;
  middleName: string | null;
  paternalSurname: string | null;
  maternalSurname: string | null;
}): string =>
  [user.name, user.middleName, user.paternalSurname, user.maternalSurname]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Resumen de actividad de una persona para la pestaña "Actividad" de su
 * expediente (L-13): qué tiene cargado, qué le falta y qué ha marcado.
 *
 * Todo corre en el contexto de la petición, así que la extensión de tenancy
 * limita al cliente del usuario; un id de otro cliente responde 404.
 */
export class EmployeeOverviewService {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  async overview(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        middleName: true,
        paternalSurname: true,
        maternalSurname: true,
        employeeNumber: true,
        jobTitle: true,
        active: true,
        department: { select: { name: true } },
      },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");

    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const sinceYear = new Date(now.getTime() - 365 * DAY_MS);

    const [
      documents,
      documentsCount,
      requiredTypes,
      deliveredTypes,
      disciplines,
      assignment,
      clockLink,
    ] = await Promise.all([
        this.db.employeeDocument.findMany({
          where: { userId },
          select: {
            id: true,
            originalName: true,
            createdAt: true,
            documentType: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        this.db.employeeDocument.count({ where: { userId } }),
        this.db.documentType.findMany({
          where: { required: true, active: true },
          select: { id: true },
        }),
        this.db.employeeDocument.findMany({
          where: { userId },
          select: { documentTypeId: true },
          distinct: ["documentTypeId"],
        }),
        this.db.disciplinaryReport.count({
          where: { userId, incidentDate: { gte: sinceYear } },
        }),
        this.db.scheduleAssignment.findFirst({
          where: {
            userId,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
          select: { schedule: { select: { id: true, name: true } }, validFrom: true },
          orderBy: { validFrom: "desc" },
        }),
        this.db.timeClockEmployee.findFirst({
          where: { userId },
          select: { employeeNumber: true },
        }),
      ]);

    const employeeNumber = clockLink?.employeeNumber ?? user.employeeNumber ?? null;
    // Checadas web/app y del reloj forman un solo flujo: las recientes también se mezclan.
    const [clockPunches, clockPunchesLast30Days, remotePunches, remotePunchesLast30Days] = await Promise.all([
      employeeNumber
        ? this.db.timeClockPunch.findMany({
            where: { employeeNumber },
            select: { id: true, occurredAt: true, method: true, clockSerial: true },
            orderBy: { occurredAt: "desc" },
            take: 8,
          })
        : [],
      employeeNumber
        ? this.db.timeClockPunch.count({ where: { employeeNumber, occurredAt: { gte: since30 } } })
        : 0,
      this.db.remotePunch.findMany({
        where: { userId },
        select: { id: true, occurredAt: true, source: true },
        orderBy: { occurredAt: "desc" },
        take: 8,
      }),
      this.db.remotePunch.count({ where: { userId, occurredAt: { gte: since30 } } }),
    ]);
    const punchesLast30Days = clockPunchesLast30Days + remotePunchesLast30Days;

    const serials = [...new Set(clockPunches.map((punch) => punch.clockSerial))];
    const clocks =
      serials.length > 0
        ? await this.db.timeClock.findMany({
            where: { serialNumber: { in: serials } },
            select: { serialNumber: true, name: true },
          })
        : [];
    const clockName = new Map(clocks.map((clock) => [clock.serialNumber, clock.name]));

    // Timeline reciente mezclado: reloj + web/app, lo más nuevo primero.
    const punches = [
      ...clockPunches.map((punch) => ({
        id: punch.id,
        occurredAt: punch.occurredAt,
        method: punch.method as string,
        clock: clockName.get(punch.clockSerial) ?? null,
        source: "CLOCK" as const,
      })),
      ...remotePunches.map((punch) => ({
        id: punch.id,
        occurredAt: punch.occurredAt,
        method: "OTHER",
        clock: null,
        source: punch.source,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 8);

    const delivered = new Set(deliveredTypes.map((row) => row.documentTypeId));

    return {
      employee: {
        id: user.id,
        name: fullName(user),
        employeeNumber,
        jobTitle: user.jobTitle,
        department: user.department?.name ?? null,
        active: user.active,
      },
      summary: {
        documents: documentsCount,
        missingRequiredDocuments: requiredTypes.filter((type) => !delivered.has(type.id)).length,
        punchesLast30Days,
        disciplinaryReportsLastYear: disciplines,
      },
      schedule: assignment
        ? {
            id: assignment.schedule.id,
            name: assignment.schedule.name,
            validFrom: assignment.validFrom.toISOString(),
          }
        : null,
      documents: documents.map((document) => ({
        id: document.id,
        name: document.originalName,
        type: document.documentType.name,
        uploadedAt: document.createdAt.toISOString(),
      })),
      punches: punches.map((punch) => ({
        id: punch.id,
        occurredAt: punch.occurredAt.toISOString(),
        method: punch.method,
        clock: punch.clock,
        source: punch.source,
      })),
    };
  }

  /**
   * Historial detallado de checadas de una persona en `[from, to]` (días
   * locales del cliente): reloj, web y app mezclados, con tipo, modalidad,
   * ubicación descifrada, hora del dispositivo y correcciones. Por defecto los
   * últimos 14 días; máximo 92.
   */
  async punchHistory(userId: string, query: { from?: unknown; to?: unknown }) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, employeeNumber: true } });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");

    const timezone = (await tenantTimezone()) ?? DEFAULT_TIMEZONE;
    const today = localDateKey(new Date(), timezone);
    const to = isValidDateKey(query.to) ? query.to : today;
    const from = isValidDateKey(query.from)
      ? query.from
      : localDateKey(new Date(startOfLocalDay(to, timezone).getTime() - (HISTORY_DEFAULT_DAYS - 1) * DAY_MS + DAY_MS / 2), timezone);
    if (from > to) throw new HttpError(400, "INVALID_RANGE");
    const start = startOfLocalDay(from, timezone);
    const end = endOfLocalDay(to, timezone);
    if (end.getTime() - start.getTime() > HISTORY_MAX_DAYS * DAY_MS) throw new HttpError(400, "PUNCH_HISTORY_RANGE_TOO_LONG");

    const clockLink = await this.db.timeClockEmployee.findFirst({ where: { userId }, select: { employeeNumber: true } });
    const employeeNumber = clockLink?.employeeNumber ?? user.employeeNumber ?? null;

    const [clockPunches, remotePunches] = await Promise.all([
      employeeNumber
        ? this.db.timeClockPunch.findMany({
            where: { employeeNumber, occurredAt: { gte: start, lt: end } },
            select: {
              id: true,
              occurredAt: true,
              method: true,
              clockSerial: true,
              createdAt: true,
              adjustments: { select: ADJUSTMENT_SELECT, orderBy: { createdAt: "desc" } },
            },
            orderBy: { occurredAt: "desc" },
          })
        : [],
      this.db.remotePunch.findMany({
        where: { userId, occurredAt: { gte: start, lt: end } },
        select: {
          id: true,
          type: true,
          source: true,
          workMode: true,
          occurredAt: true,
          clientReportedAt: true,
          location: true,
          latitude: true,
          longitude: true,
          gpsAccuracyMeters: true,
          note: true,
          createdAt: true,
          adjustments: { select: ADJUSTMENT_SELECT, orderBy: { createdAt: "desc" } },
        },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    const serials = [...new Set(clockPunches.map((punch) => punch.clockSerial))];
    const clocks =
      serials.length > 0
        ? await this.db.timeClock.findMany({ where: { serialNumber: { in: serials } }, select: { serialNumber: true, name: true } })
        : [];
    const clockName = new Map(clocks.map((clock) => [clock.serialNumber, clock.name]));

    const punches = [
      ...clockPunches.map((punch) => ({
        id: punch.id,
        occurredAt: punch.occurredAt.toISOString(),
        source: "CLOCK" as const,
        type: null,
        method: punch.method as string,
        clock: clockName.get(punch.clockSerial) ?? punch.clockSerial,
        workMode: null,
        location: null,
        clientReportedAt: null,
        note: null,
        receivedAt: punch.createdAt.toISOString(),
        adjustments: punch.adjustments.map(adjustmentDto),
      })),
      ...remotePunches.map((punch) => ({
        id: punch.id,
        occurredAt: punch.occurredAt.toISOString(),
        source: punch.source,
        type: punch.type,
        method: null,
        clock: null,
        workMode: punch.workMode,
        location: openLocation(punch),
        clientReportedAt: punch.clientReportedAt?.toISOString() ?? null,
        note: punch.note,
        receivedAt: punch.createdAt.toISOString(),
        adjustments: punch.adjustments.map(adjustmentDto),
      })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    return { range: { from, to, timezone }, punches };
  }
}
