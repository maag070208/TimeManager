/**
 * Módulos que la plataforma puede apagar por cliente (PLAT-04, tab Módulos):
 * visibilidad de rutas del menú cuando un módulo está deshabilitado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TENANT_MODULES,
  isPathInDisabledModule,
  isTenantModuleDisabled,
} from "./tenant-modules.ts";

test("[PLAT-04] un módulo deshabilitado se detecta por id", () => {
  assert.equal(isTenantModuleDisabled(undefined, "employees"), false);
  assert.equal(isTenantModuleDisabled([], "employees"), false);
  assert.equal(isTenantModuleDisabled(["employees"], "employees"), true);
  assert.equal(isTenantModuleDisabled(["employees"], "attendance"), false);
});

test("[PLAT-04] una ruta de un módulo apagado queda bloqueada, incluida sus subrutas", () => {
  assert.equal(isPathInDisabledModule("/employees", ["employees"]), true);
  assert.equal(isPathInDisabledModule("/employees/123/edit", ["employees"]), true);
  assert.equal(isPathInDisabledModule("/departments", ["employees"]), true);
  assert.equal(isPathInDisabledModule("/hr/time-clock", ["employees"]), false);
});

test("[PLAT-04] el bloqueo respeta el límite de ruta (no bloquea prefijos parciales)", () => {
  assert.equal(isPathInDisabledModule("/employeesX", ["employees"]), false);
  assert.equal(isPathInDisabledModule("/time-clocks", []), false);
});

test("[PLAT-04] cada módulo tiene id único, rutas y grupo válido", () => {
  const ids = TENANT_MODULES.map((module) => module.id);
  assert.equal(new Set(ids).size, ids.length, "ids duplicados");
  assert.ok(ids.includes("employees") && ids.includes("attendance"));
  for (const module of TENANT_MODULES) {
    assert.ok(module.paths.length > 0, `${module.id} sin rutas`);
    for (const path of module.paths) assert.match(path, /^\//, `${module.id}: ruta no absoluta`);
  }
});
