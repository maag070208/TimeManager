import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeArgs } from "./scope";

const T = "tenant-a";

test("lecturas y escrituras con where agregan tenantId", () => {
  for (const op of ["findUnique", "findFirst", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany"]) {
    assert.deepEqual(scopeArgs("Schedule", op, { where: { id: "1" } }, T).where, { id: "1", tenantId: T }, op);
  }
});

test("las variantes OrThrow también se filtran por cliente", () => {
  for (const op of ["findUniqueOrThrow", "findFirstOrThrow"]) {
    assert.deepEqual(scopeArgs("User", op, { where: { id: "1" } }, T).where, { id: "1", tenantId: T }, op);
    const args = { where: { id: "1" } };
    assert.deepEqual(scopeArgs("User", op, args, null), args, op);
  }
});

test("sin where crea uno con tenantId", () => {
  assert.deepEqual(scopeArgs("Schedule", "findMany", undefined, T), { where: { tenantId: T } });
});

test("el tenantId del contexto gana sobre uno enviado en where", () => {
  const out = scopeArgs("Schedule", "findMany", { where: { tenantId: "tenant-b" } }, T);
  assert.deepEqual(out.where, { tenantId: T });
});

test("create inyecta tenantId en data y gana sobre el enviado", () => {
  assert.deepEqual(scopeArgs("Department", "create", { data: { name: "RH", tenantId: "tenant-b" } }, T).data, { name: "RH", tenantId: T });
});

test("createMany inyecta tenantId en cada elemento (arreglo u objeto)", () => {
  assert.deepEqual(scopeArgs("Department", "createMany", { data: [{ name: "A" }, { name: "B" }] }, T).data, [
    { name: "A", tenantId: T },
    { name: "B", tenantId: T },
  ]);
  assert.deepEqual(scopeArgs("Department", "createMany", { data: { name: "A" } }, T).data, [{ name: "A", tenantId: T }]);
});

test("upsert inyecta en where y create; update queda como viene", () => {
  const out = scopeArgs("Department", "upsert", { where: { id: "1" }, create: { name: "A" }, update: { name: "B" } }, T);
  assert.deepEqual(out, { where: { id: "1", tenantId: T }, create: { name: "A", tenantId: T }, update: { name: "B" } });
});

test("plataforma sin cliente (tenantId null) no filtra", () => {
  const args = { where: { id: "1" } };
  assert.deepEqual(scopeArgs("Schedule", "findMany", args, null), args);
});

test("modelos de plataforma no se tocan", () => {
  const args = { where: { key: "LANGUAGE" } };
  assert.deepEqual(scopeArgs("SysConfig", "findFirst", args, T), args);
  assert.deepEqual(scopeArgs("Tenant", "findMany", undefined, T), {});
});

test("no muta los argumentos originales", () => {
  const args = { where: { id: "1" } };
  scopeArgs("Schedule", "findMany", args, T);
  assert.deepEqual(args, { where: { id: "1" } });
});
