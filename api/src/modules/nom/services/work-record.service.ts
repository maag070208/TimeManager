import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";

const toUtcDate = (dayKey: string): Date => new Date(`${dayKey}T00:00:00.000Z`);
const dateKeyOf = (date: Date): string => date.toISOString().slice(0, 10);
const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const RECORD_METHODS = ["CLOCK", "REMOTE", "ACCESS"] as const;
export type RecordMethod = (typeof RECORD_METHODS)[number];

const isRecordMethod = (value: unknown): value is RecordMethod =>
  typeof value === "string" && (RECORD_METHODS as readonly string[]).includes(value);

/**
 * Prueba plena del registro (art. 132 fr. XXXIV): acuerdo del método de
 * registro por trabajador y conformidad periódica con el resumen de jornada.
 * Todo queda firmado con hash para demostrar que el trabajador lo conoció y
 * aceptó (o abrió una discrepancia).
 */
export class WorkRecordService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  async agreementFor(userId: string) {
    return this.db.workRecordAgreement.findUnique({ where: { userId } });
  }

  async acceptAgreement(
    tenantId: string,
    userId: string,
    input: {
      methods: unknown;
      roundingPolicy?: string | null;
      correctionRules?: string | null;
    },
    actor: { id: string; name?: string; ip?: string | null }
  ) {
    const rawMethods = Array.isArray(input.methods) ? input.methods : [];
    const methods = rawMethods.filter(isRecordMethod);
    if (methods.length === 0 || methods.length !== rawMethods.length) {
      throw new HttpError(400, "INVALID_RECORD_METHODS");
    }
    if (input.roundingPolicy != null && input.roundingPolicy.length > 500) {
      throw new HttpError(400, "INVALID_RECORD_METHODS");
    }

    const existing = await this.db.workRecordAgreement.findUnique({ where: { userId } });
    const changed =
      !existing ||
      JSON.stringify(existing.methods) !== JSON.stringify(methods) ||
      (existing.roundingPolicy ?? null) !== (input.roundingPolicy ?? null) ||
      (existing.correctionRules ?? null) !== (input.correctionRules ?? null);
    const textVersion = changed ? (existing?.textVersion ?? 0) + 1 : existing?.textVersion ?? 1;
    const acceptedAt = new Date();
    const acceptedHash = sha256({
      userId,
      methods,
      roundingPolicy: input.roundingPolicy ?? null,
      correctionRules: input.correctionRules ?? null,
      textVersion,
      acceptedAt: acceptedAt.toISOString(),
    });

    const agreement = await this.db.workRecordAgreement.upsert({
      where: { userId },
      create: {
        tenantId,
        userId,
        methods,
        roundingPolicy: input.roundingPolicy ?? null,
        correctionRules: input.correctionRules ?? null,
        textVersion,
        acceptedAt,
        acceptedIp: actor.ip ?? null,
        acceptedHash,
      },
      update: {
        methods,
        roundingPolicy: input.roundingPolicy ?? null,
        correctionRules: input.correctionRules ?? null,
        textVersion,
        acceptedAt,
        acceptedIp: actor.ip ?? null,
        acceptedHash,
      },
    });

    // Historial append-only: cada aceptación conserva el texto/métodos firmados.
    await this.db.workRecordAgreementVersion.create({
      data: {
        tenantId,
        agreementId: agreement.id,
        userId,
        methods: agreement.methods as never,
        roundingPolicy: agreement.roundingPolicy,
        correctionRules: agreement.correctionRules,
        textVersion: agreement.textVersion,
        acceptedAt: agreement.acceptedAt,
        acceptedIp: agreement.acceptedIp,
        acceptedHash: agreement.acceptedHash,
      },
    });

    await this.audit?.({
      action: "WORK_RECORD_AGREEMENT_ACCEPTED",
      entityType: "WorkRecordAgreement",
      entityId: agreement.id,
      userId: actor.id,
      userName: actor.name,
      newState: { textVersion, methods, acceptedHash },
    });
    return agreement;
  }

  /** Firma patronal del acuerdo (RJ-07): cierra la prueba de dos partes. */
  async employerSign(
    agreementId: string,
    actor: { id: string; name?: string | null; ip?: string | null }
  ) {
    const agreement = await this.db.workRecordAgreement.findUnique({ where: { id: agreementId } });
    if (!agreement) throw new HttpError(404, "AGREEMENT_NOT_FOUND");
    if (!agreement.acceptedAt) throw new HttpError(409, "AGREEMENT_NOT_ACCEPTED_BY_WORKER");
    const employerAcceptedAt = new Date();
    const employerAcceptedHash = sha256({
      agreementId,
      textVersion: agreement.textVersion,
      methods: agreement.methods,
      acceptedHash: agreement.acceptedHash,
      employerAcceptedAt: employerAcceptedAt.toISOString(),
      employerAcceptedById: actor.id,
    });
    const updated = await this.db.workRecordAgreement.update({
      where: { id: agreementId },
      data: {
        employerAcceptedAt,
        employerAcceptedById: actor.id,
        employerAcceptedIp: actor.ip ?? null,
        employerAcceptedHash,
      },
    });
    await this.db.workRecordAgreementVersion.updateMany({
      where: { agreementId, textVersion: agreement.textVersion },
      data: {
        employerAcceptedAt,
        employerAcceptedById: actor.id,
        employerAcceptedIp: actor.ip ?? null,
        employerAcceptedHash,
      },
    });
    await this.audit?.({
      action: "WORK_RECORD_AGREEMENT_EMPLOYER_SIGNED",
      entityType: "WorkRecordAgreement",
      entityId: agreementId,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: { employerAcceptedHash, textVersion: agreement.textVersion },
    });
    return updated;
  }

  async versions(agreementId: string) {
    return this.db.workRecordAgreementVersion.findMany({
      where: { agreementId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async listAgreements(tenantId: string) {
    return this.db.workRecordAgreement.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }

  /** Resumen legal de la persona entre dos fechas (ledgers semanales). */
  private async summarize(userId: string, periodStart: string, periodEnd: string) {
    const ledgers = await this.db.weeklyOvertimeLedger.findMany({
      where: {
        userId,
        weekStart: { gte: toUtcDate(periodStart), lte: toUtcDate(periodEnd) },
      },
      orderBy: { weekStart: "asc" },
      select: {
        weekStart: true,
        ordinaryMin: true,
        otDoubleMin: true,
        otTripleMin: true,
        otIllegalMin: true,
        restDayWorkedMin: true,
        holidayWorkedMin: true,
        violations: true,
        status: true,
      },
    });
    return {
      periodStart,
      periodEnd,
      weeks: ledgers.map((ledger) => ({
        weekStart: dateKeyOf(ledger.weekStart),
        ordinaryMin: ledger.ordinaryMin,
        otDoubleMin: ledger.otDoubleMin,
        otTripleMin: ledger.otTripleMin,
        otIllegalMin: ledger.otIllegalMin,
        restDayWorkedMin: ledger.restDayWorkedMin,
        holidayWorkedMin: ledger.holidayWorkedMin,
        violations: ledger.violations,
        status: ledger.status,
      })),
      totals: {
        weeks: ledgers.length,
        ordinaryMin: ledgers.reduce((sum, row) => sum + row.ordinaryMin, 0),
        otDoubleMin: ledgers.reduce((sum, row) => sum + row.otDoubleMin, 0),
        otTripleMin: ledgers.reduce((sum, row) => sum + row.otTripleMin, 0),
        otIllegalMin: ledgers.reduce((sum, row) => sum + row.otIllegalMin, 0),
      },
    };
  }

  async acknowledge(
    tenantId: string,
    userId: string,
    input: {
      periodStart: string;
      periodEnd: string;
      accept: boolean;
      note?: string | null;
    },
    actor: { id: string; name?: string; ip?: string | null }
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)) {
      throw new HttpError(400, "INVALID_ACK_PERIOD");
    }
    if (input.periodEnd < input.periodStart) throw new HttpError(400, "INVALID_ACK_PERIOD");
    if (!input.accept && !input.note?.trim()) throw new HttpError(400, "DISCREPANCY_NOTE_REQUIRED");

    const summary = await this.summarize(userId, input.periodStart, input.periodEnd);
    const summaryHash = sha256(summary);
    const status = input.accept ? "ACCEPTED" : "DISCREPANCY";

    const row = await this.db.workRecordAcknowledgment.upsert({
      where: {
        tenantId_userId_periodStart_periodEnd: {
          tenantId,
          userId,
          periodStart: toUtcDate(input.periodStart),
          periodEnd: toUtcDate(input.periodEnd),
        },
      },
      create: {
        tenantId,
        userId,
        periodStart: toUtcDate(input.periodStart),
        periodEnd: toUtcDate(input.periodEnd),
        summary: summary as unknown as object,
        summaryHash,
        status,
        acceptedAt: new Date(),
        workerIp: actor.ip ?? null,
        discrepancyNote: input.note ?? null,
      },
      update: {
        summary: summary as unknown as object,
        summaryHash,
        status,
        acceptedAt: new Date(),
        workerIp: actor.ip ?? null,
        discrepancyNote: input.note ?? null,
      },
    });

    await this.audit?.({
      action: status === "ACCEPTED" ? "WORK_RECORD_ACKNOWLEDGED" : "WORK_RECORD_DISCREPANCY",
      entityType: "WorkRecordAcknowledgment",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name,
      newState: { periodStart: input.periodStart, periodEnd: input.periodEnd, status, summaryHash },
    });
    return row;
  }

  async myAcknowledgments(userId: string) {
    return this.db.workRecordAcknowledgment.findMany({
      where: { userId },
      orderBy: { periodStart: "desc" },
      take: 50,
    });
  }

  async listAcknowledgments(tenantId: string) {
    return this.db.workRecordAcknowledgment.findMany({
      where: { tenantId, status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }
}
