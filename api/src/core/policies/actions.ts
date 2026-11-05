/**
 * Catálogo de acciones que admiten políticas ABAC dinámicas. Cada acción declara
 * los **campos del recurso** que un administrador puede usar en las condiciones.
 *
 * El ERP traía acciones de compras y facturas (`purchase_orders.*`,
 * `invoices.register`); el producto de checadas no tiene acciones ABAC todavía,
 * así que el catálogo queda vacío (L-13). Para exponer una acción nueva se
 * agrega aquí y el servicio que la ejecuta entrega su contexto al motor
 * (`evaluateActionPolicies`).
 */
export type PolicyFieldType = "string" | "number" | "boolean" | "enum" | "user";

export interface PolicyFieldDef {
  key: string;
  label: string;
  type: PolicyFieldType;
  /** Valores permitidos cuando `type = "enum"`. */
  options?: string[];
}

export interface PolicyActionDef {
  /** Clave de permiso de la acción (coincide con `requiresPermission`). */
  key: string;
  label: string;
  module: string;
  fields: PolicyFieldDef[];
}

export const POLICY_ACTIONS: readonly PolicyActionDef[] = [];

export const policyAction = (key: string): PolicyActionDef | undefined =>
  POLICY_ACTIONS.find((action) => action.key === key);
