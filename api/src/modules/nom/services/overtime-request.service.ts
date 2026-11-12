import { localDateKey } from "@core/utils/timezone";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";

const ageAt = (birthDate: Date | null, at: Date): number | null => {
  if (!birthDate) return null;
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
};

/**
 * Autorización previa + consentimiento del trabajador (arts. 66 y 68 LFT).
 * El patrón pide la extra; el trabajador acepta o rechaza. El registro de lo
 * trabajado no cambia por el rechazo: solo se documenta la voluntad.
 */
export class OvertimeRequestService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  async create(
    tenantId: string,
    actor: { id: string; name?: string },
    input: { userId: string; reason: string; plannedMin: number; days?: string[] }
  ) {
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) throw new HttpError(400, "INVALID_OVERTIME_REQUEST");
    if (!Number.isInteger(input.plannedMin) || input.plannedMin < 1) {
      throw new HttpError(400, "INVALID_OVERTIME_REQUEST");
    }

    const user = await this.db.user.findFirst({
      where: { id: input.userId },
      select: { id: true, birthDate: true, active: true },
    });
    if (!user || !user.active) throw new HttpError(404, "USER_NOT_FOUND");

    const days = (input.days ?? []).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day));
    if (days.length === 0 && input.plannedMin > 240) throw new HttpError(400, "INVALID_OVERTIME_REQUEST");
    if (days.length > 0 && input.plannedMin > 240 * days.length) {
      throw new HttpError(400, "INVALID_OVERTIME_REQUEST");
    }

    // La autorización es previa: no se pide para días que ya pasaron.
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const today = localDateKey(new Date(), tenant?.timezone ?? "America/Mexico_City");
    if (days.some((day) => day < today)) throw new HttpError(400, "OVERTIME_DAY_IN_PAST");

    if (ageAt(user.birthDate, new Date()) != null && ageAt(user.birthDate, new Date())! < 18) {
      throw new HttpError(400, "MINOR_OVERTIME_FORBIDDEN");
    }

    const created = await this.db.overtimeRequest.create({
      data: {
        tenantId,
        userId: user.id,
        requestedById: actor.id,
        reason,
        plannedMin: input.plannedMin,
        days: days as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit?.({
      action: "OVERTIME_REQUESTED",
      entityType: "OvertimeRequest",
      entityId: created.id,
      userId: actor.id,
      userName: actor.name,
      newState: { userId: user.id, plannedMin: input.plannedMin, days },
    });
    return created;
  }

  async myRequests(userId: string) {
    return this.db.overtimeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async list(tenantId: string, status?: string) {
    const valid = status === "PENDING" || status === "ACCEPTED" || status === "REJECTED" || status === "CANCELLED";
    return this.db.overtimeRequest.findMany({
      where: {
        tenantId,
        ...(valid ? { status } : {}),
      },
      // Por defecto, la solicitud más reciente primero (la fecha manda sobre el estado).
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
      include: {
        user: { select: { name: true, employeeNumber: true } },
        requestedBy: { select: { name: true } },
      },
    });
  }

  async decide(
    tenantId: string,
    userId: string,
    id: string,
    input: { accept: boolean; note?: string | null },
    actor: { id: string; name?: string }
  ) {
    const request = await this.db.overtimeRequest.findFirst({ where: { id, userId, tenantId } });
    if (!request) throw new HttpError(404, "OVERTIME_REQUEST_NOT_FOUND");
    if (request.status !== "PENDING") throw new HttpError(409, "OVERTIME_REQUEST_ALREADY_DECIDED");

    const updated = await this.db.overtimeRequest.update({
      where: { id: request.id },
      data: {
        status: input.accept ? "ACCEPTED" : "REJECTED",
        workerNote: input.note?.trim() || null,
        workerDecidedAt: new Date(),
      },
    });

    await this.audit?.({
      action: input.accept ? "OVERTIME_ACCEPTED" : "OVERTIME_REJECTED",
      entityType: "OvertimeRequest",
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      previousState: { status: request.status },
      newState: { status: updated.status, workerNote: updated.workerNote },
    });
    return updated;
  }

  async cancel(tenantId: string, id: string, actor: { id: string; name?: string }) {
    const request = await this.db.overtimeRequest.findFirst({ where: { id, tenantId } });
    if (!request) throw new HttpError(404, "OVERTIME_REQUEST_NOT_FOUND");
    if (request.status !== "PENDING") throw new HttpError(409, "OVERTIME_REQUEST_ALREADY_DECIDED");
    const updated = await this.db.overtimeRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });
    await this.audit?.({
      action: "OVERTIME_REQUEST_CANCELLED",
      entityType: "OvertimeRequest",
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
    });
    return updated;
  }
}
