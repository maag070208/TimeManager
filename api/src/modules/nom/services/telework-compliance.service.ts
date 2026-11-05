import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";

const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * Brechas NOM-037 (F4): % de teletrabajo, validación del checklist por la
 * Comisión, equipo entregado con acuse, capacitación anual, avisos escritos y
 * reversibilidad a presencial.
 */
export class TeleworkComplianceService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  async updateDetails(
    tenantId: string,
    registrationId: string,
    input: {
      teleworkPercent?: number | null;
      activities?: string | null;
      position?: string | null;
      workPlaces?: string[] | null;
    },
    actor: { id: string; name?: string }
  ) {
    const registration = await this.db.teleworkRegistration.findFirst({
      where: { id: registrationId, tenantId },
    });
    if (!registration) throw new HttpError(404, "TELEWORK_NOT_REGISTERED");
    if (
      input.teleworkPercent != null &&
      (!Number.isInteger(input.teleworkPercent) ||
        input.teleworkPercent < 0 ||
        input.teleworkPercent > 100)
    ) {
      throw new HttpError(400, "INVALID_TELEWORK_PERCENT");
    }

    const updated = await this.db.teleworkRegistration.update({
      where: { id: registration.id },
      data: {
        ...(input.teleworkPercent !== undefined ? { teleworkPercent: input.teleworkPercent } : {}),
        ...(input.activities !== undefined ? { activities: input.activities } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.workPlaces !== undefined
          ? { workPlaces: input.workPlaces as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.audit?.({
      action: "TELEWORK_DETAILS_UPDATED",
      entityType: "TeleworkRegistration",
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      newState: { teleworkPercent: updated.teleworkPercent },
    });
    return updated;
  }

  /** Comisión de Seguridad e Higiene valida el checklist (APTO/NO_APTO). */
  async validateChecklist(
    tenantId: string,
    checklistId: string,
    input: { result: "APTO" | "NO_APTO"; notes?: string | null },
    actor: { id: string; name?: string }
  ) {
    const checklist = await this.db.teleworkChecklist.findFirst({
      where: { id: checklistId, tenantId },
    });
    if (!checklist) throw new HttpError(404, "TELEWORK_CHECKLIST_NOT_FOUND");
    const updated = await this.db.teleworkChecklist.update({
      where: { id: checklist.id },
      data: {
        result: input.result,
        validationNotes: input.notes?.trim() || null,
        validatedById: actor.id,
        validatedAt: new Date(),
      },
    });
    await this.audit?.({
      action: "TELEWORK_CHECKLIST_VALIDATED",
      entityType: "TeleworkChecklist",
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      newState: { result: input.result },
    });
    return updated;
  }

  async deliverEquipment(
    tenantId: string,
    userId: string,
    input: { items: string[]; notes?: string | null },
    actor: { id: string; name?: string }
  ) {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new HttpError(400, "INVALID_EQUIPMENT");
    }
    const row = await this.db.teleworkEquipmentDelivery.create({
      data: {
        tenantId,
        userId,
        items: input.items as unknown as Prisma.InputJsonValue,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
      },
    });
    await this.audit?.({
      action: "TELEWORK_EQUIPMENT_DELIVERED",
      entityType: "TeleworkEquipmentDelivery",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name,
      newState: { items: input.items },
    });
    return row;
  }

  async acceptEquipment(tenantId: string, userId: string, id: string) {
    const row = await this.db.teleworkEquipmentDelivery.findFirst({ where: { id, tenantId, userId } });
    if (!row) throw new HttpError(404, "TELEWORK_EQUIPMENT_NOT_FOUND");
    const acceptedAt = row.acceptedAt ?? new Date();
    const acceptedHash = row.acceptedHash ?? sha256({ id: row.id, userId, items: row.items, acceptedAt });
    return this.db.teleworkEquipmentDelivery.update({
      where: { id: row.id },
      data: { acceptedAt, acceptedHash },
    });
  }

  async listEquipment(tenantId: string) {
    return this.db.teleworkEquipmentDelivery.findMany({
      where: { tenantId },
      orderBy: { deliveredAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }

  async createTraining(
    tenantId: string,
    userId: string,
    input: { completedAt: string; expiresAt: string; evidence?: string | null },
    actor: { id: string; name?: string }
  ) {
    const completedAt = new Date(input.completedAt);
    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(completedAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= completedAt) {
      throw new HttpError(400, "INVALID_TRAINING");
    }
    const row = await this.db.teleworkTraining.create({
      data: {
        tenantId,
        userId,
        kind: "ANNUAL",
        completedAt,
        expiresAt,
        evidence: input.evidence?.trim() || null,
        createdById: actor.id,
      },
    });
    await this.audit?.({
      action: "TELEWORK_TRAINING_REGISTERED",
      entityType: "TeleworkTraining",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name,
      newState: { userId, expiresAt: row.expiresAt.toISOString() },
    });
    return row;
  }

  async listTrainings(tenantId: string) {
    return this.db.teleworkTraining.findMany({
      where: { tenantId },
      orderBy: { expiresAt: "asc" },
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }

  async createNotice(
    tenantId: string,
    userId: string,
    input: { kind: string; occurredAt: string; description: string }
  ) {
    const kind =
      input.kind === "ADDRESS_CHANGE" || input.kind === "RISK_CONDITION" ? input.kind : "OTHER";
    if (input.description.trim().length < 5) throw new HttpError(400, "INVALID_NOTICE");
    const occurredAt = new Date(`${input.occurredAt}T00:00:00.000Z`);
    if (Number.isNaN(occurredAt.getTime())) throw new HttpError(400, "INVALID_NOTICE");
    return this.db.teleworkNotice.create({
      data: { tenantId, userId, kind, occurredAt, description: input.description.trim() },
    });
  }

  async listNotices(tenantId: string) {
    return this.db.teleworkNotice.findMany({
      where: { tenantId },
      orderBy: { occurredAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }

  async requestReversal(tenantId: string, userId: string, input: { reason: string }) {
    if (input.reason.trim().length < 5) throw new HttpError(400, "INVALID_REVERSAL");
    return this.db.teleworkReversalRequest.create({
      data: { tenantId, userId, reason: input.reason.trim() },
    });
  }

  async listReversals(tenantId: string) {
    return this.db.teleworkReversalRequest.findMany({
      where: { tenantId },
      orderBy: { requestedAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }

  async decideReversal(
    tenantId: string,
    id: string,
    input: { approve: boolean; note?: string | null },
    actor: { id: string; name?: string }
  ) {
    const request = await this.db.teleworkReversalRequest.findFirst({ where: { id, tenantId } });
    if (!request) throw new HttpError(404, "REVERSAL_NOT_FOUND");
    if (request.status !== "REQUESTED") throw new HttpError(409, "REVERSAL_ALREADY_DECIDED");
    const updated = await this.db.teleworkReversalRequest.update({
      where: { id: request.id },
      data: {
        status: input.approve ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        decidedById: actor.id,
        decisionNote: input.note?.trim() || null,
      },
    });
    if (input.approve) {
      await this.db.teleworkRegistration.updateMany({
        where: { tenantId, userId: request.userId, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      });
    }
    await this.audit?.({
      action: "TELEWORK_REVERSAL_DECIDED",
      entityType: "TeleworkReversalRequest",
      entityId: updated.id,
      userId: actor.id,
      userName: actor.name,
      newState: { status: updated.status },
    });
    return updated;
  }
}
