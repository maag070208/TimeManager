import type { PermissionCatalog } from "@entities/permission";
import type { PermissionScope } from "@entities/user";

/**
 * Verbo de un permiso según su clave (`modulo.accion`). La convención del
 * catálogo usa `view · create · edit · delete` para el ciclo de vida de un
 * recurso; cualquier otro sufijo es una acción de negocio (`close`, `approve`,
 * `export`, `register`…).
 */
export type PermissionVerb = "view" | "create" | "edit" | "delete" | "other";

const VERBS: readonly PermissionVerb[] = ["view", "create", "edit", "delete"];

export const permissionVerb = (key: string): PermissionVerb => {
  const action = key.slice(key.lastIndexOf(".") + 1);
  return (VERBS as readonly string[]).includes(action) ? (action as PermissionVerb) : "other";
};

const VERB_RANK: Record<PermissionVerb, number> = { view: 0, create: 1, edit: 2, delete: 3, other: 4 };

/** Nivel de acceso de un rol (o persona) en un módulo. */
export type AccessLevel = "FULL" | "PARTIAL" | "READ" | "NONE";

/** ¿Admite alcance de datos (Propio/Área) además de sí/no? */
export const isScopedPermission = (permission: PermissionCatalog): boolean =>
  permission.scopes.some((scope) => scope === "OWN" || scope === "AREA");

/** Alcances concedibles de un permiso, sin NONE y en orden canónico. */
export const grantableScopes = (permission: PermissionCatalog): PermissionScope[] =>
  (["OWN", "AREA", "ALL"] as const).filter((scope) => permission.scopes.includes(scope));

/**
 * Nivel de un módulo a partir de lo concedido (solo permisos activos):
 * todo → Completo; nada → Sin acceso; solo `*.view` → Solo lectura; si no, Parcial.
 */
export const moduleLevel = (
  permissions: readonly PermissionCatalog[],
  scopeOf: (key: string) => PermissionScope
): AccessLevel => {
  const active = permissions.filter((permission) => permission.active);
  const granted = active.filter((permission) => scopeOf(permission.key) !== "NONE");
  if (active.length === 0 || granted.length === 0) return "NONE";
  if (granted.length === active.length) return "FULL";
  if (granted.every((permission) => permissionVerb(permission.key) === "view")) return "READ";
  return "PARTIAL";
};

/** Concedidos / total de los permisos activos de un módulo. */
export const moduleCoverage = (
  permissions: readonly PermissionCatalog[],
  scopeOf: (key: string) => PermissionScope
): { granted: number; total: number } => {
  const active = permissions.filter((permission) => permission.active);
  return {
    granted: active.filter((permission) => scopeOf(permission.key) !== "NONE").length,
    total: active.length,
  };
};

export type ModuleGroup = [module: string, permissions: PermissionCatalog[]];

/**
 * Agrupa el catálogo por módulo, respetando el orden de la API (módulo y
 * `sortOrder`) y, dentro de cada módulo, el ciclo de vida Ver → Crear →
 * Editar → Eliminar → acciones de negocio.
 */
export const groupByModule = (catalog: readonly PermissionCatalog[]): ModuleGroup[] => {
  const map = new Map<string, PermissionCatalog[]>();
  for (const permission of catalog) {
    const list = map.get(permission.module) ?? [];
    list.push(permission);
    map.set(permission.module, list);
  }
  const resourceOf = (key: string): string => key.slice(0, key.indexOf("."));
  return [...map.entries()].map(([module, list]) => {
    // Recursos en el orden en que aparecen (el `sortOrder` de la API).
    const resources = [...new Set(list.map((permission) => resourceOf(permission.key)))];
    return [
      module,
      list
        .map((permission, index) => ({ permission, index }))
        .sort(
          (a, b) =>
            resources.indexOf(resourceOf(a.permission.key)) - resources.indexOf(resourceOf(b.permission.key)) ||
            VERB_RANK[permissionVerb(a.permission.key)] - VERB_RANK[permissionVerb(b.permission.key)] ||
            a.index - b.index
        )
        .map(({ permission }) => permission),
    ];
  });
};

/** Búsqueda sin acentos ni mayúsculas. */
export const normalizeText = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const matchesPermission = (permission: PermissionCatalog, needle: string): boolean => {
  if (!needle) return true;
  const n = normalizeText(needle);
  return (
    normalizeText(permission.name).includes(n) ||
    permission.key.toLowerCase().includes(n) ||
    normalizeText(permission.module).includes(n) ||
    normalizeText(permission.description ?? "").includes(n)
  );
};
