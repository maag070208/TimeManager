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
  /**
   * true dentro de una transacción que ya fijó `app.tenant_id` (RLS): las
   * queries no vuelven a abrir su propia transacción.
   */
  rlsTransaction?: boolean;
  /** true en lookups de sistema previos al contexto (login, token de agente). */
  rlsBypass?: boolean;
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
export function runWithTenant<T>(tenantId: string | null, fn: () => T, platform = false): Promise<Awaited<T>> {
  return storage.run({ tenantId, platform }, async (): Promise<Awaited<T>> => await fn());
}

export function currentTenant(): TenantContext | null {
  return storage.getStore() ?? null;
}

export function currentTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

/** Dentro de una transacción tenant-aware (la RLS ya está fijada en la sesión). */
export function insideRlsTransaction(): boolean {
  return storage.getStore()?.rlsTransaction === true;
}

/** Lookup de sistema que necesita ver filas antes de conocer el cliente. */
export function currentRlsBypass(): boolean {
  return storage.getStore()?.rlsBypass === true;
}

/**
 * Ejecuta `fn` con bypass de RLS (solo para lookups PRE-contexto: login de
 * usuario y token de agente). Nunca se deriva de datos del request: lo llaman
 * rutas de sistema concretas.
 */
export function runWithRlsBypass<T>(fn: () => T): Promise<Awaited<T>> {
  const store = storage.getStore();
  if (!store) {
    return storage.run({ tenantId: null, platform: true, rlsBypass: true }, async (): Promise<Awaited<T>> => await fn());
  }
  return storage.run({ ...store, rlsBypass: true }, async (): Promise<Awaited<T>> => await fn());
}

/** Marca el callback como ejecutado dentro de la transacción con `app.tenant_id`. */
export function runInsideRlsTransaction<T>(fn: () => T): Promise<Awaited<T>> {
  const store = storage.getStore();
  if (!store) return Promise.resolve(fn() as Awaited<T>);
  return storage.run({ ...store, rlsTransaction: true }, async (): Promise<Awaited<T>> => await fn());
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
