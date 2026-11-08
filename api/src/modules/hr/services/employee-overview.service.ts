import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";

const DAY_MS = 86_400_000;

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
    const [punches, clockPunchesLast30Days] = employeeNumber
      ? await Promise.all([
          this.db.timeClockPunch.findMany({
            where: { employeeNumber },
            select: { id: true, occurredAt: true, method: true, clockSerial: true },
            orderBy: { occurredAt: "desc" },
            take: 8,
          }),
          this.db.timeClockPunch.count({
            where: { employeeNumber, occurredAt: { gte: since30 } },
          }),
        ])
      : [[], 0];
    // Las checadas de la app cuentan igual que las del reloj.
    const remotePunchesLast30Days = await this.db.remotePunch.count({
      where: { userId, occurredAt: { gte: since30 } },
    });
    const punchesLast30Days = clockPunchesLast30Days + remotePunchesLast30Days;

    const serials = [...new Set(punches.map((punch) => punch.clockSerial))];
    const clocks =
      serials.length > 0
        ? await this.db.timeClock.findMany({
            where: { serialNumber: { in: serials } },
            select: { serialNumber: true, name: true },
          })
        : [];
    const clockName = new Map(clocks.map((clock) => [clock.serialNumber, clock.name]));

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
        clock: clockName.get(punch.clockSerial) ?? null,
      })),
    };
  }
}
