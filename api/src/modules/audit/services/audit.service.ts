import type { Prisma } from "@prisma/client";
import { decodeCursor, encodeCursor } from "@core/utils/table";
import { prismaClient } from "@core/config/database";
import { currentTenantId } from "@core/tenancy";
import { currentRequestContext } from "@core/observability/request-context";
import { HttpError } from "@core/middlewares/error.middleware";
import type {
  AuditLogInput,
  AuditLogListResult,
  ListAuditLogsParams,
} from "../models/entity/audit.entity";

const toJson = (v?: Record<string, any> | null): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : v;

export class AuditService {
  constructor(private readonly db = prismaClient) {}

  // Acepta opcionalmente un cliente de transacción (tx) para que el registro
  // de auditoría quede atado a la misma transacción que la operación que
  // audita: si la transacción falla, el log tampoco se escribe.
  createLog(input: AuditLogInput, client?: Prisma.TransactionClient) {
    const db = client ?? this.db;
    const ctx = currentRequestContext();
    return db.auditLog.create({
      data: {
        tenantId: input.tenantId ?? currentTenantId() ?? ctx?.tenantId ?? null,
        module: input.module ?? input.entityType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? ctx?.userId ?? null,
        userName: input.userName ?? null,
        permissions: toJson(input.permissions ?? (ctx?.permissions ? { exceptions: ctx.permissions } : undefined)),
        roles: toJson(input.roles ?? (ctx?.roles ? { roles: ctx.roles } : undefined)),
        ipAddress: input.ipAddress ?? ctx?.ip ?? null,
        userAgent: input.userAgent ?? ctx?.userAgent ?? null,
        previousState: toJson(input.previousState),
        newState: toJson(input.newState),
        metadata: toJson(input.metadata),
      },
    });
  }

  async list(params: ListAuditLogsParams): Promise<AuditLogListResult> {
    const where: any = {};

    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.module) where.module = params.module;
    if (params.action) where.action = params.action;
    if (params.entityType) where.entityType = params.entityType;
    if (params.q) {
      where.OR = [
        { action: { contains: params.q, mode: "insensitive" } },
        { module: { contains: params.q, mode: "insensitive" } },
        { entityType: { contains: params.q, mode: "insensitive" } },
        { userName: { contains: params.q, mode: "insensitive" } },
      ];
    }
    if (params.entityId) where.entityId = params.entityId;
    if (params.userId) where.userId = params.userId;

    if (params.start || params.end) {
      where.createdAt = {};
      if (params.start) where.createdAt.gte = new Date(params.start);
      if (params.end) where.createdAt.lte = new Date(params.end);
    }

    const page = params.page ?? 1;
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
    const cursor = decodeCursor<{ c: string; i: string }>(params.cursor);
    if (cursor) {
      const createdAt = new Date(cursor.c);
      const scopedWhere = {
        AND: [where, { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.i } }] }],
      } as Prisma.AuditLogWhereInput;
      const data = await this.db.auditLog.findMany({
        where: scopedWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      const last = data[data.length - 1];
      const nextCursor =
        last && data.length === limit ? encodeCursor({ c: last.createdAt.toISOString(), i: last.id }) : null;
      // `total` no se paga al paginar por cursor (el cliente ya avanzó).
      return { data, total: 0, page, limit, nextCursor };
    }

    const [total, data] = await this.db.$transaction([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const last = data[data.length - 1];
    const nextCursor =
      last && data.length === limit ? encodeCursor({ c: last.createdAt.toISOString(), i: last.id }) : undefined;

    return { data, total, page, limit, ...(nextCursor !== undefined ? { nextCursor } : {}) };
  }

  async getById(id: string) {
    const log = await this.db.auditLog.findUnique({ where: { id } });
    if (!log) throw new HttpError(404, "AUDIT_LOG_NOT_FOUND");
    return log;
  }
}