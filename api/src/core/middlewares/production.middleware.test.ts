import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken } from "@core/utils/security";
import { tenantRateLimitKey } from "./production.middleware";

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
