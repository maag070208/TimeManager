import { Prisma, type PrismaClient, type PunchAdjustmentStatus } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { localDayRange, localDateKey } from "@core/utils/timezone";
import type { AuditLogger } from "@modules/users/services/user.service";
import type {
  AdjustmentCreateInput,
  AdjustmentDto,
  MyPunch,
  PunchHistory,
  PunchSnapshot,
} from "../models/entity/nom.entity";

type Actor = { id: string; name?: string | null };

type AdjustmentRow = Prisma.PunchAdjustmentGetPayload<{
  include: {
    requestedBy: { select: { name: true } };
    decidedBy: { select: { name: true } };
  };
}>;

const adjustmentInclude = {
  requestedBy: { select: { name: true } },
  decidedBy: { select: { name: true } },
} as const;

/**
 * Correcciones de checadas (F2-01/F2-02).
 *
 * La checada NUNCA se edita ni se borra (trigger append-only en la BD): cada
 * corrección es un `PunchAdjustment` con quién/cuándo/por qué, snapshot del
 * valor anterior, valor propuesto y aprobador. El valor vigente se calcula al
 * vuelo aplicando los ajustes APROBADOS, y cada paso queda en `audit_logs`.
 */
export class PunchAdjustmentsService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  private async loadTarget(targetId: string) {
    const clock = await this.db.timeClockPunch.findUnique({ where: { id: targetId } });
    if (clock) return { kind: "CLOCK" as const, punch: clock };
    const remote = await this.db.remotePunch.findUnique({
      where: { id: targetId },
      include: { user: { select: { id: true, name: true, employeeNumber: true } } },
    });
    if (remote) return { kind: "REMOTE" as const, punch: remote };
    throw new HttpError(404, "PUNCH_NOT_FOUND");
  }

  private snapshotOf(target: Awaited<ReturnType<PunchAdjustmentsService["loadTarget"]>>): PunchSnapshot {
    if (target.kind === "REMOTE") {
      const remote = target.punch;
      return {
        occurredAt: remote.occurredAt.toISOString(),
        method: remote.workMode as PunchSnapshot["method"],
        minor: 0,
        clockSerial: "REMOTO",
        serialNo: 0,
        employeeNumber: remote.user.employeeNumber ?? "",
        name: remote.user.name,
      };
    }
    const clock = target.punch;
    return {
      occurredAt: clock.occurredAt.toISOString(),
      method: clock.method as PunchSnapshot["method"],
      minor: clock.minor,
      clockSerial: clock.clockSerial,
      serialNo: clock.serialNo,
      employeeNumber: clock.employeeNumber,
      name: clock.name,
    };
  }

  private toDto(row: AdjustmentRow): AdjustmentDto {
    return {
      id: row.id,
      punchId: row.punchId ?? row.targetId,
      status: row.status,
      reason: row.reason,
      previousState: row.previousState as Record<string, unknown>,
      newState: row.newState as Record<string, unknown>,
      requestedById: row.requestedById,
      requestedByName: row.requestedBy?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      decidedById: row.decidedById ?? null,
      decidedByName: row.decidedBy?.name ?? null,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decisionNote: row.decisionNote ?? null,
    };
  }

  async create(
    punchId: string,
    input: AdjustmentCreateInput,
    actor: Actor,
    source: "HR" | "EMPLOYEE" = "HR"
  ): Promise<AdjustmentDto> {
    const target = await this.loadTarget(punchId);

    const newState: Record<string, unknown> = {};
    if (input.occurredAt !== undefined) {
      const occurredAt = new Date(input.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) throw new HttpError(400, "INVALID_ADJUSTMENT_DATE");
      newState.occurredAt = occurredAt.toISOString();
    }
    if (target.kind === "CLOCK") {
      if (input.method !== undefined) newState.method = input.method;
      if (input.minor !== undefined) newState.minor = input.minor;
    } else {
      if (input.punchType !== undefined) newState.type = input.punchType;
      if (input.workMode !== undefined) newState.workMode = input.workMode;
    }
    if (input.note !== undefined) newState.note = input.note;
    if (Object.keys(newState).length === 0) {
      throw new HttpError(400, "PUNCH_ADJUSTMENT_NO_CHANGES");
    }

    const previousState = this.snapshotOf(target);
    const row = await this.db.punchAdjustment.create({
      data: {
        targetType: target.kind,
        targetId: punchId,
        punchId: target.kind === "CLOCK" ? punchId : null,
        remotePunchId: target.kind === "REMOTE" ? punchId : null,
        requestedById: actor.id,
        reason: input.reason,
        previousState: previousState as unknown as Record<string, any>,
        newState: newState as unknown as Record<string, any>,
      },
      include: adjustmentInclude,
    });

    await this.audit?.({
      action: source === "EMPLOYEE" ? "PUNCH_DISCREPANCY_REPORTED" : "PUNCH_ADJUSTMENT_REQUESTED",
      entityType: target.kind === "CLOCK" ? "TimeClockPunch" : "RemotePunch",
      entityId: punchId,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: previousState as unknown as Record<string, any>,
      newState: newState as unknown as Record<string, any>,
      metadata: { adjustmentId: row.id, reason: input.reason, source },
    });

    return this.toDto(row);
  }

  /** Historial visible de una checada: ajustes + pista de auditoría. */
  async history(punchId: string): Promise<PunchHistory> {
    const target = await this.loadTarget(punchId);
    if (target.kind === "REMOTE") {
      const adjustments = await this.db.punchAdjustment.findMany({
        where: { targetType: "REMOTE", targetId: punchId },
        orderBy: { createdAt: "asc" },
        include: adjustmentInclude,
      });
      const effective = { occurredAt: target.punch.occurredAt.toISOString(), type: target.punch.type };
      const appliedAdjustmentIds: string[] = [];
      for (const adjustment of adjustments) {
        if (adjustment.status !== "APPROVED") continue;
        const state = adjustment.newState as Record<string, unknown>;
        if (typeof state.occurredAt === "string") effective.occurredAt = state.occurredAt;
        if (typeof state.type === "string") effective.type = state.type as typeof effective.type;
        appliedAdjustmentIds.push(adjustment.id);
      }
      return {
        punch: {
          id: target.punch.id,
          clockSerial: "REMOTO",
          serialNo: 0,
          employeeNumber: target.punch.user.employeeNumber ?? "",
          name: target.punch.user.name,
          method: target.punch.workMode as PunchHistory["punch"]["method"],
          minor: 0,
          occurredAt: target.punch.occurredAt.toISOString(),
          createdAt: target.punch.createdAt.toISOString(),
        },
        effective: {
          occurredAt: effective.occurredAt,
          method: target.punch.workMode as PunchHistory["effective"]["method"],
          minor: 0,
          appliedAdjustmentIds,
        },
        adjustments: adjustments.map((a) => this.toDto(a)),
        audit: [],
      } as unknown as PunchHistory;
    }
    const punch = target.punch;
    const adjustments = await this.db.punchAdjustment.findMany({
      where: { targetType: "CLOCK", targetId: punchId },
      orderBy: { createdAt: "asc" },
      include: adjustmentInclude,
    });

    const audit = await this.db.auditLog.findMany({
      where: {
        OR: [
          { entityType: "TimeClockPunch", entityId: punchId },
          {
            entityType: "PunchAdjustment",
            entityId: { in: adjustments.map((a) => a.id) },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // Valor vigente: se aplican solo los ajustes aprobados, en orden de captura.
    const effective = {
      occurredAt: punch.occurredAt.toISOString(),
      method: punch.method as string,
      minor: punch.minor,
    };
    const appliedAdjustmentIds: string[] = [];
    for (const adjustment of adjustments) {
      if (adjustment.status !== "APPROVED") continue;
      const state = adjustment.newState as Record<string, unknown>;
      if (typeof state.occurredAt === "string") effective.occurredAt = state.occurredAt;
      if (typeof state.method === "string") effective.method = state.method;
      if (typeof state.minor === "number") effective.minor = state.minor;
      appliedAdjustmentIds.push(adjustment.id);
    }

    return {
      punch: {
        id: punch.id,
        clockSerial: punch.clockSerial,
        serialNo: punch.serialNo,
        employeeNumber: punch.employeeNumber,
        name: punch.name,
        method: punch.method,
        minor: punch.minor,
        occurredAt: punch.occurredAt.toISOString(),
        createdAt: punch.createdAt.toISOString(),
      },
      effective: {
        occurredAt: effective.occurredAt,
        method: effective.method as PunchHistory["effective"]["method"],
        minor: effective.minor,
        appliedAdjustmentIds,
      },
      adjustments: adjustments.map((a) => this.toDto(a)),
      audit: audit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        userName: entry.userName,
        previousState: (entry.previousState as Record<string, unknown> | null) ?? null,
        newState: (entry.newState as Record<string, unknown> | null) ?? null,
        metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async list(params: {
    status?: PunchAdjustmentStatus;
    limit?: number;
  }): Promise<AdjustmentDto[]> {
    const rows = await this.db.punchAdjustment.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 100,
      include: adjustmentInclude,
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Aprobar/rechazar. Un usuario no puede decidir su propio ajuste. */
  async decide(
    adjustmentId: string,
    decision: "APPROVE" | "REJECT",
    note: string | undefined,
    actor: Actor
  ): Promise<AdjustmentDto> {
    const adjustment = await this.db.punchAdjustment.findUnique({ where: { id: adjustmentId } });
    if (!adjustment) throw new HttpError(404, "PUNCH_ADJUSTMENT_NOT_FOUND");
    if (adjustment.status !== "PENDING") throw new HttpError(409, "PUNCH_ADJUSTMENT_NOT_PENDING");
    if (adjustment.requestedById === actor.id) {
      throw new HttpError(403, "SELF_APPROVAL_FORBIDDEN");
    }

    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const result = await this.db.punchAdjustment.updateMany({
      where: { id: adjustmentId, status: "PENDING" },
      data: {
        status,
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      },
    });
    if (result.count === 0) throw new HttpError(409, "PUNCH_ADJUSTMENT_ALREADY_DECIDED");

    const row = await this.db.punchAdjustment.findUniqueOrThrow({
      where: { id: adjustmentId },
      include: adjustmentInclude,
    });

    await this.audit?.({
      action: decision === "APPROVE" ? "PUNCH_ADJUSTMENT_APPROVED" : "PUNCH_ADJUSTMENT_REJECTED",
      entityType: adjustment.targetType === "REMOTE" ? "RemotePunch" : "TimeClockPunch",
      entityId: adjustment.targetId,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: { status: "PENDING" },
      newState: { status, decisionNote: note ?? null, adjustmentId },
      metadata: { adjustmentId, reason: adjustment.reason },
    });

    return this.toDto(row);
  }

  // ── Flujo del trabajador (consulta de sus marcajes y discrepancias) ──────

  private async employeeNumbersOf(userId: string): Promise<{ numbers: string[]; user: { id: string; name: string; employeeNumber: string | null; tenantId: string | null } }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, employeeNumber: true, tenantId: true },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    const links = await this.db.timeClockEmployee.findMany({
      where: { userId },
      select: { employeeNumber: true },
    });
    const numbers = [
      ...(user.employeeNumber ? [user.employeeNumber] : []),
      ...links.map((link) => link.employeeNumber),
    ];
    return { numbers: [...new Set(numbers)], user };
  }

  private async timezoneOf(tenantId: string | null): Promise<string> {
    if (!tenantId) return "America/Mexico_City";
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    return tenant?.timezone ?? "America/Mexico_City";
  }

  /** Marcajes propios del trabajador (reloj + eventos de acceso). */
  async myPunches(
    userId: string,
    params: { from?: string; to?: string; limit?: number }
  ): Promise<MyPunch[]> {
    const { numbers, user } = await this.employeeNumbersOf(userId);
    const timezone = await this.timezoneOf(user.tenantId);
    const today = localDateKey(new Date(), timezone);
    const fromKey = params.from ?? today;
    const toKey = params.to ?? today;
    const from = localDayRange(fromKey, timezone).start;
    const to = localDayRange(toKey, timezone).end;
    const limit = params.limit ?? 200;

    const [punches, events] = await Promise.all([
      numbers.length
        ? this.db.timeClockPunch.findMany({
            where: { employeeNumber: { in: numbers }, occurredAt: { gte: from, lt: to } },
            orderBy: { occurredAt: "desc" },
            take: limit,
            select: {
              id: true,
              occurredAt: true,
              method: true,
              clockSerial: true,
            },
          })
        : Promise.resolve([]),
      this.db.accessEvent.findMany({
        where: { employeeId: userId, occurredAt: { gte: from, lt: to } },
        orderBy: { occurredAt: "desc" },
        take: limit,
        select: { id: true, occurredAt: true, method: true, type: true },
      }),
    ]);
    const remotePunches = await this.db.remotePunch.findMany({
      where: { userId, occurredAt: { gte: from, lt: to } },
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: { id: true, occurredAt: true, type: true, workMode: true, latitude: true, longitude: true },
    });

    const merged: MyPunch[] = [
      ...punches.map((punch) => ({
        id: punch.id,
        source: "CLOCK" as const,
        type: null,
        occurredAt: punch.occurredAt.toISOString(),
        method: punch.method,
        clockSerial: punch.clockSerial,
      })),
      ...events.map((event) => ({
        id: event.id,
        source: "ACCESS" as const,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        method: event.method,
        clockSerial: null,
      })),
      ...remotePunches.map((punch) => ({
        id: punch.id,
        source: "REMOTE" as const,
        type: punch.type,
        occurredAt: punch.occurredAt.toISOString(),
        method: punch.workMode,
        clockSerial: null,
        latitude: punch.latitude,
        longitude: punch.longitude,
      })),
    ];
    merged.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return merged.slice(0, limit);
  }

  /** El trabajador reporta una discrepancia sobre una checada propia. */
  async reportDiscrepancy(
    userId: string,
    input: { punchId: string; reason: string; expectedOccurredAt?: string }
  ): Promise<AdjustmentDto> {
    const { numbers, user } = await this.employeeNumbersOf(userId);
    const target = await this.loadTarget(input.punchId);
    if (target.kind === "REMOTE") {
      if (target.punch.userId !== userId) throw new HttpError(403, "NOT_YOUR_PUNCH");
    } else if (!numbers.includes(target.punch.employeeNumber)) {
      throw new HttpError(403, "NOT_YOUR_PUNCH");
    }
    return this.create(
      input.punchId,
      {
        reason: input.reason,
        occurredAt: input.expectedOccurredAt,
        note: "Discrepancia reportada por el trabajador",
      },
      { id: user.id, name: user.name },
      "EMPLOYEE"
    );
  }

  /** Discrepancias/reportes del propio trabajador con su estado. */
  async myDiscrepancies(userId: string): Promise<AdjustmentDto[]> {
    const rows = await this.db.punchAdjustment.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: adjustmentInclude,
    });
    return rows.map((row) => this.toDto(row));
  }
}
