import type { Prisma } from "@prisma/client";

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  userName?: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ListAuditLogsParams {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  start?: string;
  end?: string;
  page?: number;
  limit?: number;
  /** Cursor opaco (F4-02) para continuar por keyset (createdAt desc, id desc). */
  cursor?: string;
}

export interface AuditLogListResult {
  data: any[];
  total: number;
  page: number;
  limit: number;
  /** Siguiente página por cursor cuando aplica. */
  nextCursor?: string | null;
}

export type AuditTransactionClient = Prisma.TransactionClient;

// Puerto que consume inventory (DIP): el módulo de auditoría no es importado
// directamente por otros módulos; solo se inyecta su operación de escritura.
export interface AuditPort {
  createLog(input: AuditLogInput, client?: Prisma.TransactionClient): Promise<unknown>;
}