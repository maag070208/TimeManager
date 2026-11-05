import { isTenantModel } from "./models";

type Args = Record<string, unknown>;

const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  // "upsert" NO va aquí: tiene su propia rama (where + create) más abajo.
]);

/**
 * Inyecta el aislamiento por cliente en los argumentos de una operación de
 * Prisma. Función pura (sin Prisma ni contexto) para poder probarla sola:
 *
 * - Lecturas/escrituras con `where`: agrega `tenantId` (gana sobre el que
 *   viniera en `where`; así un `where` manipulado no puede saltar el aislamiento).
 * - `create`: agrega `tenantId` al `data`.
 * - `createMany`: a cada elemento del `data`.
 * - `upsert`: al `where` y al `create` (el `update` es data puro).
 * - No entra a escrituras anidadas (`create` dentro de otro `data`): ahí el
 *   default de BD (`current_setting`) o un `requireTenantId()` explícito.
 *
 * Modelos que no son de cliente, o `tenantId` null, devuelven `args` intacto.
 */
export function scopeArgs(
  model: string,
  operation: string,
  args: Args | undefined,
  tenantId: string | null
): Args {
  if (!tenantId || !isTenantModel(model)) return args ?? {};
  const a = args ?? {};

  if (READ_OPS.has(operation)) {
    const where = (a.where ?? {}) as Args;
    return { ...a, where: { ...where, tenantId } };
  }

  if (operation === "create") {
    const data = (a.data ?? {}) as Args;
    return { ...a, data: { ...data, tenantId } };
  }

  if (operation === "createMany") {
    const list = (Array.isArray(a.data) ? a.data : a.data ? [a.data] : []) as Args[];
    return { ...a, data: list.map((d) => ({ ...d, tenantId })) };
  }

  if (operation === "upsert") {
    const where = (a.where ?? {}) as Args;
    const create = (a.create ?? {}) as Args;
    return { ...a, where: { ...where, tenantId }, create: { ...create, tenantId } };
  }

  return a;
}
