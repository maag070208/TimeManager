/**
 * Roles y permisos (PLAT-06, tabs Roles y Matriz): verbos de un permiso, nivel
 * de acceso por módulo, alcances concedibles y agrupación/orden del catálogo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PermissionCatalog } from "@entities/permission";
import type { PermissionScope } from "@entities/user";
import {
  grantableScopes,
  groupByModule,
  isScopedPermission,
  matchesPermission,
  moduleCoverage,
  moduleLevel,
  normalizeText,
  permissionVerb,
} from "./access-levels.ts";

const permission = (
  key: string,
  module: string,
  options: { scopes?: PermissionScope[]; active?: boolean; name?: string; description?: string | null } = {}
): PermissionCatalog => ({
  key,
  module,
  name: options.name ?? key,
  description: options.description ?? null,
  scopes: options.scopes ?? ["NONE", "ALL"],
  sensitive: false,
  active: options.active ?? true,
  sortOrder: 0,
});

const scopeMap = (map: Record<string, PermissionScope>) => (key: string): PermissionScope =>
  map[key] ?? "NONE";

test("[PLAT-06] permissionVerb reconoce el ciclo de vida y deja el resto como other", () => {
  assert.equal(permissionVerb("users.view"), "view");
  assert.equal(permissionVerb("users.create"), "create");
  assert.equal(permissionVerb("users.edit"), "edit");
  assert.equal(permissionVerb("users.delete"), "delete");
  assert.equal(permissionVerb("time_clock.sync"), "other");
  assert.equal(permissionVerb("sinpunto"), "other");
});

test("[PLAT-06] moduleLevel clasifica Completo / Solo lectura / Parcial / Sin acceso", () => {
  const catalog = [
    permission("users.view", "users"),
    permission("users.create", "users"),
    permission("users.edit", "users"),
  ];
  assert.equal(moduleLevel(catalog, scopeMap({ "users.view": "ALL", "users.create": "ALL", "users.edit": "ALL" })), "FULL");
  assert.equal(moduleLevel(catalog, scopeMap({ "users.view": "ALL" })), "READ");
  assert.equal(moduleLevel(catalog, scopeMap({ "users.view": "ALL", "users.create": "OWN" })), "PARTIAL");
  assert.equal(moduleLevel(catalog, scopeMap({})), "NONE");
  assert.equal(moduleLevel([], scopeMap({})), "NONE");
});

test("[PLAT-06] moduleLevel ignora permisos inactivos y moduleCoverage cuenta solo activos", () => {
  const catalog = [
    permission("users.view", "users"),
    permission("users.create", "users", { active: false }),
  ];
  assert.equal(moduleLevel(catalog, scopeMap({ "users.view": "ALL" })), "FULL");
  assert.deepEqual(moduleCoverage(catalog, scopeMap({ "users.view": "ALL" })), { granted: 1, total: 1 });
});

test("[PLAT-06] alcances concedibles: sin NONE, en orden canónico, y flags de alcance", () => {
  assert.deepEqual(grantableScopes(permission("a.view", "a", { scopes: ["NONE", "ALL", "OWN"] })), ["OWN", "ALL"]);
  assert.equal(isScopedPermission(permission("a.view", "a", { scopes: ["NONE", "OWN"] })), true);
  assert.equal(isScopedPermission(permission("a.view", "a", { scopes: ["NONE", "ALL"] })), false);
});

test("[PLAT-06] groupByModule respeta recursos y orden Ver→Crear→Editar→Eliminar→otras", () => {
  const catalog = [
    permission("users.edit", "users"),
    permission("users.view", "users"),
    permission("users.delete", "users"),
    permission("users.create", "users"),
    permission("users.export", "users"),
    permission("roles.view", "roles"),
  ];
  const groups = groupByModule(catalog);
  assert.deepEqual(groups.map(([module]) => module), ["users", "roles"]);
  assert.deepEqual(
    groups[0][1].map((entry) => entry.key),
    ["users.view", "users.create", "users.edit", "users.delete", "users.export"]
  );
});

test("[PLAT-06] búsqueda de catálogo sin acentos ni mayúsculas", () => {
  assert.equal(normalizeText("Recursos Humanos"), "recursos humanos");
  assert.equal(normalizeText("Edición"), "edicion");
  const entry = permission("users.edit", "users", { name: "Editar personal", description: "Alta y baja" });
  assert.equal(matchesPermission(entry, ""), true);
  assert.equal(matchesPermission(entry, "EDITAR"), true);
  assert.equal(matchesPermission(entry, "users"), true);
  assert.equal(matchesPermission(entry, "roles"), false);
  assert.equal(matchesPermission(entry, "nomina"), false);
  assert.equal(matchesPermission(entry, "alta"), true, "también busca en la descripción");
});
