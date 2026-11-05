import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ABLY_TOKEN_TTL_MS,
  buildNotificationCapability,
  createNotificationTokenRequest,
} from "./ably-token.service";

/** Formato de key de Ably (`appid.keyid:secret`), falsa: no hay red ni app real. */
const FAKE_KEY = "fakeapp.fakekey:secreto-de-prueba";

const capabilityOf = (request: { capability: string }): unknown =>
  JSON.parse(request.capability);

const isHttpError = (status: number, code: string) => (error: unknown): boolean => {
  const candidate = error as { status?: number; code?: string };
  assert.equal(candidate.status, status);
  assert.equal(candidate.code, code);
  return true;
};

test("sin cliente (plataforma): solo el canal propio histórico", () => {
  assert.deepEqual(buildNotificationCapability("usr-1", null), {
    "user:usr-1": ["subscribe"],
  });
});

test("con cliente (F1B-05): canal con prefijo de tenant + canal histórico", () => {
  assert.deepEqual(buildNotificationCapability("usr-1", "tenant-a"), {
    "user:usr-1": ["subscribe"],
    "tenant:tenant-a:user:usr-1": ["subscribe"],
  });
  // Nunca incluye canales de otros usuarios ni de otros clientes.
  const capability = buildNotificationCapability("usr-1", "tenant-a");
  assert.equal(Object.keys(capability).includes("tenant:tenant-b:user:usr-1"), false);
  assert.equal(Object.keys(capability).includes("user:usr-2"), false);
  for (const operations of Object.values(capability)) assert.deepEqual(operations, ["subscribe"]);
});

test("TokenRequest firmado en local: clientId, capability y TTL corto", async () => {
  const request = await createNotificationTokenRequest("usr-1", FAKE_KEY);

  assert.equal(request.keyName, "fakeapp.fakekey");
  assert.equal(request.clientId, "usr-1");
  // Sin contexto de cliente en el test: solo el canal histórico.
  assert.deepEqual(capabilityOf(request), { "user:usr-1": ["subscribe"] });
  assert.equal(request.ttl, ABLY_TOKEN_TTL_MS);
  assert.equal(typeof request.timestamp, "number");
  assert.ok(request.nonce.length >= 16, "el nonce debe tener al menos 16 caracteres");
  assert.ok(request.mac.length > 0, "el TokenRequest debe venir firmado");
});

test("el TTL es configurable", async () => {
  const request = await createNotificationTokenRequest("usr-2", FAKE_KEY, 60_000, null);
  assert.equal(request.ttl, 60_000);
  assert.deepEqual(capabilityOf(request), { "user:usr-2": ["subscribe"] });
});

test("TokenRequest con cliente incluye el canal del tenant", async () => {
  const request = await createNotificationTokenRequest("usr-2", FAKE_KEY, ABLY_TOKEN_TTL_MS, "tenant-a");
  assert.deepEqual(capabilityOf(request), {
    "user:usr-2": ["subscribe"],
    "tenant:tenant-a:user:usr-2": ["subscribe"],
  });
});

test("sin app key responde 503 ABLY_NOT_CONFIGURED", async () => {
  await assert.rejects(
    createNotificationTokenRequest("usr-1", undefined),
    isHttpError(503, "ABLY_NOT_CONFIGURED")
  );
  await assert.rejects(
    createNotificationTokenRequest("usr-1", ""),
    isHttpError(503, "ABLY_NOT_CONFIGURED")
  );
});

test("si el SDK no puede firmar responde 503 ABLY_TOKEN_FAILED", async () => {
  await assert.rejects(
    createNotificationTokenRequest("usr-1", "key-sin-formato-valido"),
    isHttpError(503, "ABLY_TOKEN_FAILED")
  );
});
