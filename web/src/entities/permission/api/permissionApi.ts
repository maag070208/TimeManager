import type { PermissionScope } from "@entities/user";
import { api } from "@shared/api/client";
import { tableRequest, type ITDataTableFetchParamsPost } from "@shared/api/table";

/** Permiso del catálogo tal como lo expone la administración (incluye inactivos). */
export interface PermissionCatalog {
  key: string;
  module: string;
  name: string;
  description: string | null;
  scopes: PermissionScope[];
  sensitive: boolean;
  active: boolean;
  sortOrder: number;
}

/** Celda vigente de la matriz rol → permiso → alcance. */
export interface MatrixCell {
  role: string;
  permission: string;
  scope: PermissionScope;
}

/** Payload de `GET /permisos/admin`. */
export interface RolesAdminData {
  roles: string[];
  catalog: PermissionCatalog[];
  matrix: MatrixCell[];
}

/** Cambio de una celda de la matriz (`PUT /permisos/matriz`). */
export interface MatrixChange {
  role: string;
  permission: string;
  scope: PermissionScope;
}

/** Body de `POST /permisos/catalogo`. */
export interface CatalogCreateDto {
  key: string;
  module: string;
  name: string;
  description?: string;
  scopes: PermissionScope[];
  sensitive?: boolean;
  sortOrder?: number;
}

/** Body de `PATCH /permisos/catalogo/:clave`. */
export interface CatalogUpdateDto {
  module?: string;
  name?: string;
  description?: string | null;
  scopes?: PermissionScope[];
  sensitive?: boolean;
  active?: boolean;
  sortOrder?: number;
}

/** Rol del sistema tal como lo expone la administración. */
export interface RoleAdmin {
  key: string;
  name: string;
  description: string | null;
  module: string | null;
  staff: boolean;
  system: boolean;
  active: boolean;
  sortOrder: number;
  userCount: number;
}

/** Body de `POST /permissions/roles`. */
export interface RoleCreateDto {
  key: string;
  name: string;
  description?: string;
  module?: string;
  staff?: boolean;
  sortOrder?: number;
  /** Duplicar: el rol nuevo arranca con la matriz de este rol. */
  copyFrom?: string;
}

/** Body de `PATCH /permissions/roles/:key`. */
export interface RoleUpdateDto {
  name?: string;
  description?: string | null;
  module?: string | null;
  staff?: boolean;
  active?: boolean;
  sortOrder?: number;
}

// --- Políticas ABAC dinámicas --------------------------------------------

export type PolicyEffect = "ALLOW" | "DENY";

export interface PolicyCondition {
  field: string;
  operator: string;
  value: string | null;
}

export interface PolicyAdmin {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  action: string;
  effect: PolicyEffect;
  priority: number;
  active: boolean;
  roles: string[];
  conditions: PolicyCondition[];
  createdAt: string;
}

export type PolicyFieldType = "string" | "number" | "boolean" | "enum" | "user";

export interface PolicyFieldDef {
  key: string;
  label: string;
  type: PolicyFieldType;
  options?: string[];
}

export interface PolicyActionDef {
  key: string;
  label: string;
  module: string;
  fields: PolicyFieldDef[];
}

export interface PolicyListData {
  policies: PolicyAdmin[];
  actions: PolicyActionDef[];
}

export interface PolicyCreateDto {
  name: string;
  description?: string;
  action: string;
  effect: PolicyEffect;
  priority?: number;
  active?: boolean;
  roles?: string[];
  conditions?: PolicyCondition[];
}

export interface PolicyUpdateDto {
  name?: string;
  description?: string | null;
  action?: string;
  effect?: PolicyEffect;
  priority?: number;
  active?: boolean;
  roles?: string[];
  conditions?: PolicyCondition[];
}

// --- Consola de acceso: personas, acceso efectivo, probador y actividad -------

/** Persona con sus roles (`GET /permissions/members`). */
export interface AccessMember {
  id: string;
  name: string;
  username: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  active: boolean;
  /** Rol principal. */
  role: string;
  /** Roles adicionales (sin el principal). */
  extraRoles: string[];
  /** Excepciones de permiso vigentes. */
  exceptions: number;
}

export interface AccessException {
  scope: PermissionScope;
  reason: string | null;
  expiresAt: string | null;
}

export interface AccessPermissionView {
  key: string;
  effective: PermissionScope;
  /** Alcance que aporta cada rol (solo ≠ NONE). */
  byRole: Record<string, PermissionScope>;
  exception: AccessException | null;
}

/** `GET /permissions/members/:userId/access`. */
export interface UserAccessView {
  user: AccessMember;
  roles: Array<{ key: string; primary: boolean; active: boolean }>;
  permissions: AccessPermissionView[];
}

export interface ConditionTrace extends PolicyCondition {
  actual: unknown;
  expected: unknown;
  matches: boolean;
}

export interface RuleTrace {
  id: string;
  key: string | null;
  name: string;
  effect: PolicyEffect;
  priority: number;
  active: boolean;
  roles: string[];
  appliesToUser: boolean;
  conditions: ConditionTrace[];
  matches: boolean;
}

export interface PolicyExplanation {
  decision: { allowed: boolean; code?: string; reason?: string };
  decidedBy: RuleTrace | null;
  rules: RuleTrace[];
}

/** Body de `POST /permissions/simulate`. */
export interface SimulationDto {
  userId: string;
  permission: string;
  resource?: Record<string, string | number | boolean | null>;
}

/** Resultado del probador (Identidad → RBAC → ABAC). */
export interface AccessSimulation {
  allowed: boolean;
  identity: { ok: boolean; active: boolean };
  rbac: {
    ok: boolean;
    permissionActive: boolean;
    scope: PermissionScope;
    byRole: Record<string, PermissionScope>;
    exception: AccessException | null;
  };
  abac: {
    evaluated: boolean;
    ok: boolean;
    hasRules: boolean;
    supportsContext: boolean;
    explanation: PolicyExplanation | null;
  };
}

/** Renglón de la bitácora del control de acceso. */
export interface AccessActivityRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { id: string | null; name: string | null; username: string | null };
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

/** Acciones de la bitácora del control de acceso (mismo orden que la API). */
export const ACCESS_ACTIVITY_ACTIONS = [
  "ROLE_CREATED",
  "ROLE_UPDATED",
  "ROLE_DELETED",
  "ROLE_PERMISSIONS_UPDATED",
  "PERMISSION_CREATED",
  "PERMISSION_UPDATED",
  "POLICY_CREATED",
  "POLICY_UPDATED",
  "POLICY_DELETED",
  "PERMISSION_EXCEPTION_SET",
  "PERMISSION_EXCEPTION_REMOVED",
  "USER_ROLE_ADDED",
  "USER_ROLE_REMOVED",
  "ACCESS_DENIED",
] as const;

export const permissionApi = {
  /** Roles, catálogo completo y matriz (requiere `roles.manage`). */
  getAdmin: () => api.get<RolesAdminData>("/permissions/admin"),
  /** Roles con conteo de cuentas (cualquier sesión). */
  listRoles: () => api.get<RoleAdmin[]>("/permissions/roles"),
  /** Alta de un rol (requiere `roles.manage`). */
  createRole: (dto: RoleCreateDto) => api.post<RoleAdmin>("/permissions/roles", dto),
  /** Edita metadatos, personal, orden o activo de un rol. */
  updateRole: (key: string, dto: RoleUpdateDto) =>
    api.patch<RoleAdmin>(`/permissions/roles/${encodeURIComponent(key)}`, dto),
  /** Elimina un rol (solo roles no base y sin cuentas). */
  deleteRole: (key: string) =>
    api.delete<void>(`/permissions/roles/${encodeURIComponent(key)}`),
  /** Catálogo activo, para resolver nombres de permiso (cualquier sesión). */
  getCatalog: () => api.get<PermissionCatalog[]>("/permissions/catalog"),
  /** Políticas ABAC + catálogo de acciones con sus campos. */
  getPolicies: () => api.get<PolicyListData>("/permissions/policies"),
  createPolicy: (dto: PolicyCreateDto) => api.post<PolicyAdmin>("/permissions/policies", dto),
  updatePolicy: (id: string, dto: PolicyUpdateDto) =>
    api.patch<PolicyAdmin>(`/permissions/policies/${encodeURIComponent(id)}`, dto),
  deletePolicy: (id: string) =>
    api.delete<void>(`/permissions/policies/${encodeURIComponent(id)}`),
  /** Personas con sus roles y excepciones vigentes. */
  listMembers: () => api.get<AccessMember[]>("/permissions/members"),
  /** Acceso efectivo explicado de una persona. */
  getMemberAccess: (userId: string) =>
    api.get<UserAccessView>(`/permissions/members/${encodeURIComponent(userId)}/access`),
  /** Agrega el rol a una persona como adicional. */
  addRoleMember: (role: string, userId: string) =>
    api.put<AccessMember>(
      `/permissions/roles/${encodeURIComponent(role)}/members/${encodeURIComponent(userId)}`,
      {}
    ),
  /** Quita un rol adicional a una persona. */
  removeRoleMember: (role: string, userId: string) =>
    api.delete<AccessMember>(
      `/permissions/roles/${encodeURIComponent(role)}/members/${encodeURIComponent(userId)}`
    ),
  /** Probador: Identidad → RBAC → ABAC. */
  simulate: (dto: SimulationDto) => api.post<AccessSimulation>("/permissions/simulate", dto),
  /** Bitácora del control de acceso (tabla server-side). */
  activity: (params: ITDataTableFetchParamsPost) =>
    tableRequest<AccessActivityRow>("/permissions/activity/query", params),
  /** Aplica un lote de celdas de la matriz. */
  saveMatrix: (changes: MatrixChange[]) =>
    api.put<{ updated: number }>("/permissions/matrix", { changes }),
  /** Alta de un permiso del catálogo. */
  createCatalog: (dto: CatalogCreateDto) =>
    api.post<PermissionCatalog>("/permissions/catalog", dto),
  /** Edita metadatos, alcances, sensibilidad, orden o activo de un permiso. */
  updateCatalog: (key: string, dto: CatalogUpdateDto) =>
    api.patch<PermissionCatalog>(
      `/permissions/catalog/${encodeURIComponent(key)}`,
      dto
    ),
};
