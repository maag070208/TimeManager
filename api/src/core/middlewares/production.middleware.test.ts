import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken } from "@core/utils/security";
import { isRateLimitedPath, tenantRateLimitKey } from "./production.middleware";

const tokenFor = (tenantId: string | null): string =>
  signToken({ id: "usr-1", username: "usr", role: "CLIENT_ADMIN", tenantId });

const req = (authorization?: string, ip = "10.0.0.7") => ({
  headers: authorization ? { authorization } : {},
  ip,
});

test("cliente: la clave del rate limit es el tenant", () => {
  const key = tenantRateLimitKey(req(`Bearer ${tokenFor("tenant-a")}`));
  assert.equal(key, "tenant:tenant-a");
  // Dos usuarios del mismo cliente comparten el tope del cliente.
  assert.equal(tenantRateLimitKey(req(`Bearer ${tokenFor("tenant-a")}`)), key);
});

test("clientes distintos no comparten cubo", () => {
  assert.notEqual(tenantRateLimitKey(req(`Bearer ${tokenFor("tenant-a")}`)), tenantRateLimitKey(req(`Bearer ${tokenFor("tenant-b")}`)));
});

test("plataforma sin cliente y anónimos: por IP", () => {
  assert.equal(tenantRateLimitKey(req(`Bearer ${tokenFor(null)}`, "1.2.3.4")), "ip:1.2.3.4");
  assert.equal(tenantRateLimitKey(req(undefined, "5.6.7.8")), "ip:5.6.7.8");
});

test("token inválido cae a IP (authenticate responderá 401)", () => {
  assert.equal(tenantRateLimitKey(req("Bearer no-es-un-jwt", "9.9.9.9")), "ip:9.9.9.9");
});

test("cabecera sin Bearer también se interpreta como token", () => {
  assert.equal(tenantRateLimitKey(req(tokenFor("tenant-c"))), "tenant:tenant-c");
});

test("las rutas caras y la ingesta llevan tope", () => {
  for (const path of ["/users/import", "/agent/punches", "/time-clock/sync", "/time-clock/ingest", "/hr/query"]) {
    assert.equal(isRateLimitedPath(path, "POST"), true, path);
  }
});

test("las subidas en memoria llevan tope, pero solo al escribir", () => {
  assert.equal(isRateLimitedPath("/hr/usr-1/documents", "POST"), true);
  assert.equal(isRateLimitedPath("/hr/usr-1/photo", "POST"), true);
  assert.equal(isRateLimitedPath("/hr/usr-1/documents", "GET"), false);
  assert.equal(isRateLimitedPath("/hr/usr-1/photo/raw", "GET"), false);
  assert.equal(isRateLimitedPath("/hr/usr-1/documents/doc-1/download", "GET"), false);
});

test("las descargas y el resto de rutas no se topan", () => {
  for (const path of ["/dashboard/people", "/hr/usr-1", "/auth/me"]) {
    assert.equal(isRateLimitedPath(path, "GET"), false, path);
  }
});
