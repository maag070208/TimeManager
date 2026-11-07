/**
 * Matriz RBAC/ABAC (PLAT-06): catálogo activo + matriz rol→permiso→alcance,
 * unión de roles, excepciones por persona con vencimiento y fail-closed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogFromRows, setCatalog } from "./catalog";
import { getMatrix, matrixFromRows, setMatrix } from "./matrix";
import { maxScope, permissionsOf, rolesOf, scopeOf, type UserPermissions } from "./resolver";
import { isRoleAllowedFor } from "./roles";

const CATALOG = catalogFromRows([
  { key: "hr.records", module: "Personal", name: "Expediente", scopes: ["NONE", "ALL"], sortOrder: 1 },
  { key: "time_clock.view", module: "Reloj", name: "Ver reloj", scopes: ["NONE", "OWN", "AREA", "ALL"], sortOrder: 2 },
  { key: "payroll.view", module: "Nómina", name: "Ver nómina", scopes: ["NONE", "ALL"], sortOrder: 3 },
  { key: "roles.manage", module: "Plataforma", name: "Roles", scopes: ["NONE", "ALL"], sortOrder: 4 },
  { key: "disabled.permission", module: "X", name: "Inactivo", scopes: ["NONE", "ALL"], active: false, sortOrder: 5 },
]);

const ROWS = [
  { role: "CLIENT_ADMIN", permission: "hr.records", scope: "ALL" },
  { role: "CLIENT_ADMIN", permission: "time_clock.view", scope: "ALL" },
  { role: "HUMAN_RESOURCES", permission: "time_clock.view", scope: "AREA" },
  { role: "HUMAN_RESOURCES", permission: "hr.records", scope: "ALL" },
  { role: "CLIENT_STAFF", permission: "time_clock.view", scope: "OWN" },
  // Fila vieja de un permiso inactivo: no debe resolver.
  { role: "CLIENT_ADMIN", permission: "disabled.permission", scope: "ALL" },
  // Fila de alcance inválido: se descarta.
  { role: "CLIENT_ADMIN", permission: "payroll.view", scope: "SUPER" },
];

const load = () => {
  setCatalog(CATALOG);
  setMatrix(matrixFromRows(ROWS, CATALOG));
};

const user = (overrides: Partial<UserPermissions> = {}): UserPermissions => ({
  id: "user-1",
  role: "CLIENT_STAFF",
  ...overrides,
});

test("[PLAT-06][PLAT-06-T2][ACT-09] la matriz filtra permisos inactivos y alcances inválidos", () => {
  load();
  const matrix = getMatrix();
  assert.equal(matrix.CLIENT_ADMIN?.["hr.records"], "ALL");
  assert.equal(matrix.CLIENT_ADMIN?.["disabled.permission"], undefined, "permiso inactivo fuera");
  assert.equal(matrix.CLIENT_ADMIN?.["payroll.view"], undefined, "alcance inválido fuera");
});

test("[PLAT-06][PLAT-06-T3][ACT-08] alcance efectivo por rol y unión multi-rol", () => {
  load();
  assert.equal(scopeOf(user(), "time_clock.view"), "OWN");
  assert.equal(scopeOf(user({ role: "HUMAN_RESOURCES" }), "time_clock.view"), "AREA");
  assert.equal(scopeOf(user({ role: "CLIENT_STAFF", roles: ["HUMAN_RESOURCES"] }), "time_clock.view"), "AREA", "gana el mayor");
  assert.equal(scopeOf(user({ role: "CLIENT_STAFF", roles: ["CLIENT_ADMIN"] }), "hr.records"), "ALL");
  assert.deepEqual(rolesOf(user({ role: "A", roles: ["A", "B"] })), ["A", "B"], "sin duplicados");
  assert.equal(scopeOf(user(), "payroll.view"), "NONE");
});

test("[PLAT-06][PLAT-06-T4][PLAT-M15][PLAT-M16][ACT-10] excepciones por persona ganan y vencen", () => {
  load();
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  assert.equal(
    scopeOf(user({ exceptions: [{ permission: "hr.records", scope: "ALL", expiresAt: future }] }), "hr.records"),
    "ALL"
  );
  assert.equal(
    scopeOf(user({ exceptions: [{ permission: "hr.records", scope: "ALL", expiresAt: past }] }), "hr.records"),
    "NONE",
    "una excepción vencida se ignora"
  );
  assert.equal(
    scopeOf(user({ role: "CLIENT_ADMIN", exceptions: [{ permission: "hr.records", scope: "NONE" }] }), "hr.records"),
    "NONE",
    "la excepción puede quitar el permiso del rol"
  );
});

test("[PLAT-06][ACT-09] fail-closed: permiso desconocido y catálogo vacío resuelven NONE", () => {
  load();
  const perms = permissionsOf(user({ role: "CLIENT_ADMIN" }));
  assert.equal(perms["hr.records"], "ALL");
  assert.equal(perms["payroll.view"], undefined);
  assert.equal(scopeOf(user({ role: "CLIENT_ADMIN" }), "no.existe"), "NONE");

  setCatalog([]);
  setMatrix({ CLIENT_ADMIN: { "hr.records": "ALL" } });
  assert.equal(scopeOf(user({ role: "CLIENT_ADMIN" }), "hr.records"), "NONE");
  load();
});

test("[PLAT-06][PLAT-M08][ACT-08] combinación de alcances y roles reservados", () => {
  assert.equal(maxScope("NONE", "OWN"), "OWN");
  assert.equal(maxScope("OWN", "AREA"), "AREA");
  assert.equal(maxScope("AREA", "ALL"), "ALL");
  assert.equal(maxScope("ALL", "NONE"), "ALL");
  assert.equal(isRoleAllowedFor("ADMIN", "tenant-1"), false, "roles de plataforma no van a un cliente");
  assert.equal(isRoleAllowedFor("ADMIN", null), true);
  assert.equal(isRoleAllowedFor("CLIENT_ADMIN", "tenant-1"), true);
});
