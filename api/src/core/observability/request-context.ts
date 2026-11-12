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
  /** Roles efectivos al momento de la petición. */
  roles?: string[];
  /** Excepciones/permisos adicionales vigentes al momento. */
  permissions?: Array<{ permission: string; scope: string; expiresAt?: Date | null }>;
  ip?: string | null;
  userAgent?: string | null;
  /** Operaciones de Prisma de la petición (cada una es al menos un viaje a la BD). */
  queries?: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

export const currentRequestContext = (): RequestContext | null => storage.getStore() ?? null;

/** Id de correlación (`X-Request-Id`); genera uno si la petición no lo trae. */
export const newRequestId = (): string => randomUUID();

/** Cuenta una operación de BD en la petición en curso (no hace nada fuera de una petición). */
export const countQuery = (): void => {
  const context = storage.getStore();
  if (context) context.queries = (context.queries ?? 0) + 1;
};

/** Añade usuario/cliente al contexto cuando `authenticate` los resuelve. */
export const setRequestPrincipal = (principal: {
  userId?: string | null;
  tenantId?: string | null;
  roles?: string[];
  permissions?: Array<{ permission: string; scope: string; expiresAt?: Date | null }>;
}): void => {
  const context = storage.getStore();
  if (!context) return;
  if (principal.userId !== undefined) context.userId = principal.userId;
  if (principal.tenantId !== undefined) context.tenantId = principal.tenantId;
  if (principal.roles !== undefined) context.roles = principal.roles;
  if (principal.permissions !== undefined) context.permissions = principal.permissions;
};
