import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto de cliente vigente durante una petición o un trabajo. `tenantId`
 * null = sin cliente elegido (plataforma sin selección, o procesos globales):
 * la extensión de Prisma no toca nada y las queries corren como antes.
 */
export interface TenantContext {
  tenantId: string | null;
  /** true cuando lo ejecuta personal de plataforma (ADMIN/SUPPORT). */
  platform: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Ejecuta `fn` con el contexto de cliente activo (se hereda en awaited).
 *
 * El callback puede devolver la promesa de Prisma directamente: el wrapper
 * async hace el primer `await` DENTRO del contexto, que es lo que necesitan
 * las PrismaPromise (perezosas — su cadena interna se engancha en el primer
 * `.then`; si ese primer await ocurre fuera del scope se pierde el tenant).
 * Por eso siempre devuelve Promise: jamás devolver la promesa cruda de `fn`.
 */
export function runWithTenant<T>(tenantId: string | null, fn: () => T, platform = false): Promise<T> {
  return storage.run({ tenantId, platform }, async () => fn());
}

export function currentTenant(): TenantContext | null {
  return storage.getStore() ?? null;
}

export function currentTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

/**
 * tenantId del contexto o excepción. Para escrituras anidadas
 * (`create: { … }` dentro de otro create), donde la extensión no entra y el
 * valor hay que pasarlo a mano (F1A-05).
 */
export function requireTenantId(): string {
  const id = currentTenantId();
  if (!id) throw new Error("TenantId requerido: no hay contexto de cliente activo");
  return id;
}
