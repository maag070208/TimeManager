/**
 * Guard de destino de relojes y estación de huellas (SSRF): la dirección la
 * escribe el administrador del cliente y el API la consulta con credenciales.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// `clock-url` importa env; no toca la BD ni la red en estos casos.
process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-clock-url-secret";

const load = async () => import("./clock-url");

test("normaliza la dirección del reloj a un origen", async () => {
  const { normalizeClockUrl } = await load();
  assert.equal(normalizeClockUrl("192.168.1.132"), "https://192.168.1.132");
  assert.equal(normalizeClockUrl("http://192.168.1.132:8000/ruta#x"), "http://192.168.1.132:8000");
  assert.equal(normalizeClockUrl(" https://reloj.midominio.mx "), "https://reloj.midominio.mx");
});

test("rechaza esquemas que no son http(s) y credenciales en la URL", async () => {
  const { normalizeClockUrl } = await load();
  assert.throws(() => normalizeClockUrl("ftp://192.168.1.10"));
  assert.throws(() => normalizeClockUrl("http://admin:secreto@192.168.1.10"));
});

test("bloquea metadatos de nube y direcciones no enrutables siempre", async () => {
  const { blockedClockTarget } = await load();
  for (const origin of [
    "http://169.254.169.254",
    "http://169.254.1.1",
    "http://100.100.100.200",
    "http://0.0.0.0",
    "http://255.255.255.255",
    "http://224.0.0.1",
    "http://[fe80::1]",
    "http://[ff02::1]",
    "http://[fd00:ec2::254]",
  ]) {
    assert.notEqual(blockedClockTarget(origin, { allowPrivate: true }), null, `${origin} pasó`);
  }
});

test("localhost se rechaza aunque se permita la red privada", async () => {
  const { normalizeClockUrl } = await load();
  assert.throws(() => normalizeClockUrl("http://localhost:8000"));
  assert.throws(() => normalizeClockUrl("http://reloj.localhost"));
});

test("con red privada permitida (on-prem) sí se aceptan rangos internos", async () => {
  const { blockedClockTarget } = await load();
  for (const origin of ["http://10.1.2.3", "http://192.168.1.132", "http://172.16.0.9", "http://[::1]"]) {
    assert.equal(blockedClockTarget(origin, { allowPrivate: true }), null, origin);
  }
});

test("en la nube (red privada prohibida) se rechazan loopback, RFC1918 y CGNAT", async () => {
  const { blockedClockTarget } = await load();
  for (const origin of [
    "http://127.0.0.1",
    "http://10.1.2.3",
    "http://192.168.1.132",
    "http://172.16.0.9",
    "http://100.70.0.1",
    "http://[::1]",
  ]) {
    assert.notEqual(blockedClockTarget(origin, { allowPrivate: false }), null, `${origin} pasó`);
  }
});

test("una IPv4 embebida en IPv6 no esquiva la comprobación", async () => {
  const { blockedClockTarget } = await load();
  assert.notEqual(blockedClockTarget("http://[::ffff:a9fe:a9fe]", { allowPrivate: true }), null);
  assert.notEqual(blockedClockTarget("http://[::ffff:7f00:1]", { allowPrivate: false }), null);
});
