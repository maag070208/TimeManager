import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Contexto de la petición para correlación (F4-03): request-id, usuario y
 * cliente. Lo leen el logger (logs JSON) y las métricas; se propaga solo por
 * `AsyncLocalStorage`, sin pasarlo a mano por los servicios.
 */
export interface RequestContext {
  requestId: string;
  userId?: string | null;
  tenantId?: string | null;
  /** Ruta normalizada (sin ids) para las métricas. */
  route?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

export const currentRequestContext = (): RequestContext | null => storage.getStore() ?? null;

/** Id de correlación (`X-Request-Id`); genera uno si la petición no lo trae. */
export const newRequestId = (): string => randomUUID();

/** Añade usuario/cliente al contexto cuando `authenticate` los resuelve. */
export const setRequestPrincipal = (principal: { userId?: string | null; tenantId?: string | null }): void => {
  const context = storage.getStore();
  if (!context) return;
  if (principal.userId !== undefined) context.userId = principal.userId;
  if (principal.tenantId !== undefined) context.tenantId = principal.tenantId;
};
