import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";

const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * Convenio de distribución de jornada (art. 58 LFT). Es la evidencia de que un
 * horario o una semana se acordó con la persona trabajadora o su representación
 * sindical; sin convenio el motor no reconoce días por encima del estándar del
 * turno como ordinarios (RJ-01/RJ-08).
 */
export class DistributionAgreementService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  async list(filters: { userId?: string; scheduleId?: string } = {}) {
    return this.db.workdayDistributionAgreement.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.scheduleId && { scheduleId: filters.scheduleId }),
      },
      orderBy: { effectiveFrom: "desc" },
      take: 200,
      include: {
        user: { select: { name: true, employeeNumber: true } },
        acceptedBy: { select: { name: true } },
      },
    });
  }

  /** Convenios que le tocan a la persona: los suyos y los de sus horarios. */
  async mine(userId: string) {
    const assignments = await this.db.scheduleAssignment.findMany({
      where: { userId },
      select: { scheduleId: true },
    });
    const scheduleIds = [...new Set(assignments.map((row) => row.scheduleId))];
    return this.db.workdayDistributionAgreement.findMany({
      where: { OR: [{ userId }, ...(scheduleIds.length ? [{ scheduleId: { in: scheduleIds } }] : [])] },
      orderBy: { effectiveFrom: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        party: true,
        effectiveFrom: true,
        effectiveTo: true,
        evidenceText: true,
        acceptedAt: true,
      },
    });
  }

  async create(
    tenantId: string,
    actor: { id: string; name?: string | null },
    input: {
      userId?: string | null;
      scheduleId?: string | null;
      kind?: "INDIVIDUAL" | "COLECTIVO";
      party?: "WORKER" | "UNION";
      effectiveFrom: string;
      effectiveTo?: string | null;
      evidenceText: string;
    }
  ) {
    if (!input.userId && !input.scheduleId) throw new HttpError(400, "AGREEMENT_TARGET_REQUIRED");
    // D-1: el convenio colectivo se firma con la representación sindical.
    const settings = await this.db.nomSettings.findUnique({ where: { tenantId } });
    if (
      (input.kind ?? "INDIVIDUAL") === "COLECTIVO" &&
      (input.party ?? "WORKER") !== "UNION" &&
      (settings?.requireUnionForCollective ?? true)
    ) {
      throw new HttpError(400, "AGREEMENT_UNION_REQUIRED");
    }
    if (input.evidenceText.trim().length < 20) throw new HttpError(400, "AGREEMENT_EVIDENCE_TOO_SHORT");
    if (input.userId && !(await this.db.user.findFirst({ where: { id: input.userId, tenantId }, select: { id: true } }))) {
      throw new HttpError(404, "USER_NOT_FOUND");
    }
    if (
      input.scheduleId &&
      !(await this.db.schedule.findFirst({ where: { id: input.scheduleId, tenantId }, select: { id: true } }))
    ) {
      throw new HttpError(404, "SCHEDULE_NOT_FOUND");
    }
    const from = new Date(`${input.effectiveFrom}T00:00:00.000Z`);
    const to = input.effectiveTo ? new Date(`${input.effectiveTo}T00:00:00.000Z`) : null;
    if (Number.isNaN(from.getTime()) || (to && to < from)) throw new HttpError(400, "AGREEMENT_INVALID_RANGE");

    const created = await this.db.workdayDistributionAgreement.create({
      data: {
        tenantId,
        userId: input.userId ?? null,
        scheduleId: input.scheduleId ?? null,
        kind: input.kind ?? "INDIVIDUAL",
        party: input.party ?? "WORKER",
        effectiveFrom: from,
        effectiveTo: to,
        evidenceText: input.evidenceText.trim(),
        acceptedHash: hashOf(
          `${input.evidenceText.trim()}|${input.effectiveFrom}|${input.effectiveTo ?? ""}|${input.userId ?? input.scheduleId}`
        ),
        createdById: actor.id,
      },
    });

    await this.audit?.({
      action: "WORKDAY_DISTRIBUTION_AGREEMENT_CREATED",
      entityType: "WorkdayDistributionAgreement",
      entityId: created.id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: { userId: created.userId, scheduleId: created.scheduleId, kind: created.kind, party: created.party },
    });
    return created;
  }

  /** Aceptación del trabajador (o de su representación sindical). */
  async accept(
    id: string,
    actor: { id: string; name?: string | null },
    ip?: string | null
  ) {
    const agreement = await this.db.workdayDistributionAgreement.findUnique({ where: { id } });
    if (!agreement) throw new HttpError(404, "AGREEMENT_NOT_FOUND");
    // Solo acepta la persona del convenio individual, o quien tiene asignado el
    // horario del colectivo; para cualquier otra el convenio no existe.
    const own = agreement.userId
      ? agreement.userId === actor.id
      : Boolean(
          agreement.scheduleId &&
            (await this.db.scheduleAssignment.findFirst({
              where: { scheduleId: agreement.scheduleId, userId: actor.id },
              select: { id: true },
            }))
        );
    if (!own) throw new HttpError(404, "AGREEMENT_NOT_FOUND");
    if (agreement.acceptedAt) throw new HttpError(409, "AGREEMENT_ALREADY_ACCEPTED");
    const updated = await this.db.workdayDistributionAgreement.update({
      where: { id },
      data: { acceptedAt: new Date(), acceptedById: actor.id, acceptedIp: ip ?? null },
    });
    await this.audit?.({
      action: "WORKDAY_DISTRIBUTION_AGREEMENT_ACCEPTED",
      entityType: "WorkdayDistributionAgreement",
      entityId: id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: { acceptedAt: updated.acceptedAt, acceptedIp: updated.acceptedIp },
    });
    return updated;
  }

  /** Usuarios con convenio vigente en el periodo (para alimentar el motor). */
  async activeUserIds(userIds: string[], from: Date, to: Date): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.db.workdayDistributionAgreement.findMany({
      where: {
        userId: { in: userIds },
        acceptedAt: { not: null },
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId).filter((id): id is string => id !== null));
  }
}
