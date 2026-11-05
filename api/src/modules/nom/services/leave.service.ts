import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";

const toUtcDate = (dayKey: string): Date => new Date(`${dayKey}T00:00:00.000Z`);
const dateKeyOf = (date: Date): string => date.toISOString().slice(0, 10);

/** Días completos de antigüedad entre dos fechas. */
const completedYears = (from: Date, at: Date): number => {
  let years = at.getUTCFullYear() - from.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - from.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < from.getUTCDate())) years -= 1;
  return Math.max(0, years);
};

/**
 * Vacaciones devengadas conforme al art. 76 LFT (reforma 2023): 12 días el
 * primer año, +2 por año hasta 20 y después +2 por cada 5 años adicionales.
 */
export const vacationEntitlementDays = (hireDate: Date, at: Date): number => {
  const years = completedYears(hireDate, at);
  if (years <= 0) return 0;
  if (years <= 5) return Math.min(20, 12 + 2 * (years - 1));
  return 20 + 2 * Math.floor((years - 5) / 5);
};

/** Días hábiles (lunes a viernes) de un rango inclusivo; base simple de nómina. */
const businessDays = (start: Date, end: Date): number => {
  let count = 0;
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
};

export const DEFAULT_LEAVE_TYPES = [
  { key: "VACACIONES", name: "Vacaciones", kind: "VACATION", paid: true },
  { key: "PERMISO_PAGADO", name: "Permiso con goce de sueldo", kind: "PAID_LEAVE", paid: true },
  { key: "PERMISO_SIN_GOCE", name: "Permiso sin goce de sueldo", kind: "UNPAID_LEAVE", paid: false },
  { key: "INCAPACIDAD", name: "Incapacidad", kind: "SICK_LEAVE", paid: true },
] as const;

/**
 * Vacaciones y permisos: tipos configurables por cliente, saldo devengado,
 * solicitud del trabajador y aprobación de RH. El goce de sueldo se marca en
 * el tipo para que la prenómina lo distinga.
 */
export class LeaveService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  private async ensureTypes(tenantId: string) {
    for (const type of DEFAULT_LEAVE_TYPES) {
      await this.db.leaveType.upsert({
        where: { tenantId_key: { tenantId, key: type.key } },
        create: { tenantId, ...type },
        update: {},
      });
    }
  }

  async listTypes(tenantId: string) {
    await this.ensureTypes(tenantId);
    return this.db.leaveType.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
    });
  }

  async createType(
    tenantId: string,
    input: { key: string; name: string; kind?: string; paid?: boolean },
    actor: { id: string; name?: string }
  ) {
    const key = input.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (key.length < 3 || input.name.trim().length < 3) throw new HttpError(400, "INVALID_LEAVE_TYPE");
    const exists = await this.db.leaveType.findFirst({ where: { tenantId, key } });
    if (exists) throw new HttpError(409, "LEAVE_TYPE_TAKEN");
    const created = await this.db.leaveType.create({
      data: {
        tenantId,
        key,
        name: input.name.trim(),
        kind: (["VACATION", "PAID_LEAVE", "UNPAID_LEAVE", "SICK_LEAVE", "OTHER"].includes(String(input.kind))
          ? input.kind
          : "OTHER") as never,
        paid: input.paid ?? false,
      },
    });
    await this.audit?.({
      action: "LEAVE_TYPE_CREATED",
      entityType: "LeaveType",
      entityId: created.id,
      userId: actor.id,
      userName: actor.name,
      newState: { key, paid: created.paid },
    });
    return created;
  }

  /** Saldo de vacaciones de la persona para el año indicado. */
  async balance(tenantId: string, userId: string, year: number) {
    const user = await this.db.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, hireDate: true },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    const entitlement = user.hireDate
      ? vacationEntitlementDays(user.hireDate, new Date(Date.UTC(year, 11, 31)))
      : 0;
    const requests = await this.db.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        type: { kind: "VACATION" },
        startDate: { lte: toUtcDate(`${year}-12-31`) },
        endDate: { gte: toUtcDate(`${year}-01-01`) },
      },
      select: { days: true, status: true, startDate: true, endDate: true },
    });
    const approved = requests.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + row.days, 0);
    const pending = requests.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + row.days, 0);
    return {
      year,
      entitlementDays: entitlement,
      usedDays: approved,
      pendingDays: pending,
      availableDays: Math.max(0, entitlement - approved),
      hireDate: user.hireDate ? dateKeyOf(user.hireDate) : null,
    };
  }

  async myRequests(userId: string) {
    return this.db.leaveRequest.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      take: 100,
      include: { type: true },
    });
  }

  async list(tenantId: string, status?: string) {
    const valid = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(String(status));
    return this.db.leaveRequest.findMany({
      where: { tenantId, ...(valid ? { status: status as never } : {}) },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 500,
      include: {
        type: true,
        user: { select: { name: true, employeeNumber: true } },
      },
    });
  }

  async createRequest(
    tenantId: string,
    userId: string,
    input: { typeId: string; startDate: string; endDate: string; reason?: string | null }
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
      throw new HttpError(400, "INVALID_LEAVE_RANGE");
    }
    const start = toUtcDate(input.startDate);
    const end = toUtcDate(input.endDate);
    if (end < start) throw new HttpError(400, "INVALID_LEAVE_RANGE");
    const days = businessDays(start, end);
    if (days <= 0) throw new HttpError(400, "INVALID_LEAVE_RANGE");

    const type = await this.db.leaveType.findFirst({
      where: { id: input.typeId, tenantId, active: true },
    });
    if (!type) throw new HttpError(404, "LEAVE_TYPE_NOT_FOUND");

    const overlap = await this.db.leaveRequest.findFirst({
      where: {
        tenantId,
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) throw new HttpError(409, "LEAVE_OVERLAP");

    if (type.kind === "VACATION") {
      const balance = await this.balance(tenantId, userId, Number(input.startDate.slice(0, 4)));
      if (days > balance.availableDays) {
        throw new HttpError(400, "INSUFFICIENT_VACATION_DAYS", {
          requested: days,
          available: balance.availableDays,
        });
      }
    }

    return this.db.leaveRequest.create({
      data: {
        tenantId,
        userId,
        typeId: type.id,
        startDate: start,
        endDate: end,
        days,
        reason: input.reason?.trim() || null,
      },
      include: { type: true },
    });
  }

  async decide(
    tenantId: string,
    id: string,
    input: { approve: boolean; note?: string | null },
    actor: { id: string; name?: string }
  ) {
    const request = await this.db.leaveRequest.findFirst({ where: { id, tenantId } });
    if (!request) throw new HttpError(404, "LEAVE_NOT_FOUND");
    if (request.status !== "PENDING") throw new HttpError(409, "LEAVE_ALREADY_DECIDED");
    const updated = await this.db.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: input.approve ? "APPROVED" : "REJECTED",
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: input.note?.trim() || null,
      },
      include: { type: true },
    });
    await this.audit?.({
      action: input.approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      entityType: "LeaveRequest",
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      previousState: { status: request.status },
      newState: { status: updated.status, days: updated.days },
    });
    return updated;
  }

  async cancel(userId: string, id: string) {
    const request = await this.db.leaveRequest.findFirst({ where: { id, userId } });
    if (!request) throw new HttpError(404, "LEAVE_NOT_FOUND");
    if (request.status !== "PENDING") throw new HttpError(409, "LEAVE_ALREADY_DECIDED");
    return this.db.leaveRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });
  }
}
