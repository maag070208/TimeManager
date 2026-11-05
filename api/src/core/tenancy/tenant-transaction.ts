import type { Prisma, PrismaClient } from "@prisma/client";
import { env } from "@core/config/env.config";
import { currentTenantId, runInsideRlsTransaction } from "./context";
import { SET_TENANT_SQL } from "./extension";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/**
 * Transacción de Prisma con el cliente del contexto fijado para RLS (F1B-01).
 *
 * Sin RLS activo (desarrollo, E2E) o sin contexto de cliente es exactamente
 * `db.$transaction(fn)`. Con RLS hace lo mismo, pero la primera sentencia de la
 * transacción es `set_config('app.tenant_id', …, true)`: dentro del callback las
 * políticas ven solo las filas del cliente y las queries no se envuelven otra
 * vez (la extensión consulta `insideRlsTransaction()`).
 */
export const tenantTransaction = async <T>(
  db: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> => {
  const tenantId = currentTenantId();
  if (!env.RLS_ENABLED || !tenantId) {
    return db.$transaction(fn as never, options) as unknown as Promise<T>;
  }
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(SET_TENANT_SQL, tenantId);
    return runInsideRlsTransaction(() => fn(tx as unknown as TransactionClient));
  }, options) as unknown as Promise<T>;
};
