/**
 * Catálogo de pantallas y visibilidad por permisos (PLAT-06, tab "Qué ve cada
 * rol" y menú): requisitos anyOf/allOf, rol fijo, grupos y acciones.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PermissionScope } from "@entities/user";
import {
  APP_SCREENS,
  isScreenVisible,
  isScreenVisibleForChannels,
  isScreenVisibleInGroup,
  referencedPermissions,
  screenActions,
  screenHasPermission,
  screenLeaves,
  screenRequirementKeys,
  screenScopeOf,
  type AppScreen,
} from "./screens.ts";

const scopeMap = (map: Record<string, PermissionScope>) => map;

const screen = (patch: Partial<AppScreen>): AppScreen => patch as AppScreen;

test("[PLAT-06] screenHasPermission y screenScopeOf distinguen NONE de un alcance real", () => {
  const permissions = scopeMap({ "users.view": "OWN", "roles.manage": "NONE" });
  assert.equal(screenHasPermission(permissions, "users.view"), true);
  assert.equal(screenHasPermission(permissions, "roles.manage"), false);
  assert.equal(screenHasPermission(undefined, "users.view"), false);
  assert.equal(screenScopeOf(permissions, "users.view"), "OWN");
  assert.equal(screenScopeOf(permissions, "roles.manage"), "NONE");
  assert.equal(screenScopeOf(undefined, "users.view"), "NONE");
});

test("[PLAT-06] isScreenVisible respeta anyOf, allOf, rol fijo y grupos", () => {
  const anyOf = screen({ id: "a", requirement: { anyOf: ["users.view", "hr.records"] } });
  assert.equal(isScreenVisible(scopeMap({ "hr.records": "ALL" }), anyOf), true);
  assert.equal(isScreenVisible(scopeMap({}), anyOf), false);

  const allOf = screen({ id: "b", requirement: { allOf: ["users.view", "users.edit"] } });
  assert.equal(isScreenVisible(scopeMap({ "users.view": "ALL" }), allOf), false);
  assert.equal(isScreenVisible(scopeMap({ "users.view": "ALL", "users.edit": "OWN" }), allOf), true);

  const fixed = screen({ id: "c", fixedRole: "CLIENT_STAFF" });
  assert.equal(isScreenVisible(scopeMap({}), fixed, "CLIENT_STAFF"), true);
  assert.equal(isScreenVisible(scopeMap({}), fixed, "CLIENT_ADMIN"), false);

  const group = screen({
    id: "d",
    children: [screen({ id: "d1", requirement: { anyOf: ["time_clock.view"] } })],
  });
  assert.equal(isScreenVisible(scopeMap({ "time_clock.view": "ALL" }), group), true);
  assert.equal(isScreenVisible(scopeMap({}), group), false);
});

test("[PLAT-06] isScreenVisibleInGroup oculta el hijo si el grupo no es visible", () => {
  const parent = screen({ id: "p", requirement: { anyOf: ["hr.records"] } });
  const child = screen({ id: "c", requirement: { anyOf: ["users.view"] } });
  const permissions = scopeMap({ "users.view": "ALL" });
  assert.equal(isScreenVisible(permissions, child), true);
  assert.equal(isScreenVisibleInGroup(permissions, child, parent), false);
  assert.equal(
    isScreenVisibleInGroup(scopeMap({ "users.view": "ALL", "hr.records": "ALL" }), child, parent),
    true
  );
});

test("[PLAT-06] screenLeaves y referencedPermissions recorren el catálogo real sin duplicados", () => {
  const leaves = screenLeaves();
  assert.ok(leaves.length > 0);
  assert.equal(new Set(leaves.map((leaf) => leaf.screen.id)).size, leaves.length, "ids duplicados");
  assert.ok(APP_SCREENS.length > 0, "catálogo vacío");
  const contains = (nodes: readonly AppScreen[] | undefined, target: AppScreen): boolean =>
    !!nodes?.some((node) => node === target || contains(node.children, target));
  for (const leaf of leaves) {
    if (leaf.parent) assert.ok(contains(leaf.parent.children, leaf.screen), "parent no es su grupo");
  }
  const referenced = referencedPermissions();
  assert.ok(referenced.has("users.view"));
  assert.ok(referenced.size >= 5);
});

test("[PLAT-06] screenActions usa las acciones declaradas o las deriva del catálogo", () => {
  const declared = screen({ id: "x", actions: ["plans.manage"] });
  assert.deepEqual(screenActions(declared, ["plans.view", "plans.manage"]), ["plans.manage"]);

  const derived = screen({ id: "y", requirement: { anyOf: ["users.view"] } });
  assert.deepEqual(
    screenActions(derived, ["users.view", "users.create", "users.edit", "roles.manage"]),
    ["users.create", "users.edit"]
  );
  assert.deepEqual(screenActions(screen({ id: "z" }), ["users.view"]), []);
});

test("[PLAT-06] screenRequirementKeys devuelve anyOf y allOf", () => {
  assert.deepEqual(screenRequirementKeys(screen({ id: "a", requirement: { anyOf: ["a.view"] } })), ["a.view"]);
  assert.deepEqual(
    screenRequirementKeys(screen({ id: "b", requirement: { allOf: ["a.view", "a.edit"] } })),
    ["a.view", "a.edit"]
  );
  assert.deepEqual(screenRequirementKeys(screen({ id: "c" })), []);
});

test("[PLAT-06] las pantallas del reloj piden canal CLOCK y Asistencias no", () => {
  const clock = screen({ id: "clock", path: "/hr/time-clock", punchChannel: "CLOCK" });
  assert.equal(isScreenVisibleForChannels(clock, ["WEB", "APP"]), false);
  assert.equal(isScreenVisibleForChannels(clock, ["WEB", "APP", "CLOCK"]), true);
  // Una pantalla sin canal siempre pasa; una sesión sin datos se comporta web+app.
  assert.equal(isScreenVisibleForChannels(screen({ id: "plain" }), ["WEB", "APP"]), true);
  assert.equal(isScreenVisibleForChannels(clock, undefined), false);

  // Catálogo real: el reloj se apaga sin CLOCK, el reporte de Asistencias se queda.
  const leaves = screenLeaves();
  const report = leaves.find((leaf) => leaf.screen.id === "accessTimeClockReport");
  assert.ok(report, "falta el reporte de Asistencias");
  assert.equal(report.screen.punchChannel, undefined);
  const clockEmployees = leaves.find((leaf) => leaf.screen.id === "accessTimeClockEmployees");
  assert.ok(clockEmployees, "falta Empleados del reloj");
  assert.equal(clockEmployees.screen.punchChannel, "CLOCK");
});
