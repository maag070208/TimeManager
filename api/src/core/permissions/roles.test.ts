import { test } from "node:test";
import assert from "node:assert/strict";
import { isRoleAllowedFor } from "./roles";

test("personal de un cliente: solo roles de cliente", () => {
  for (const role of ["CLIENT_ADMIN", "HUMAN_RESOURCES", "CLIENT_STAFF"]) assert.equal(isRoleAllowedFor(role, "tenant-a"), true, role);
  for (const role of ["ADMIN", "SUPPORT"]) assert.equal(isRoleAllowedFor(role, "tenant-a"), false, role);
});

test("plataforma (sin cliente): sin restricción de esta regla", () => {
  assert.equal(isRoleAllowedFor("ADMIN", null), true);
  assert.equal(isRoleAllowedFor("SUPPORT", undefined), true);
});
