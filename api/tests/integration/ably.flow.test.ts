/**
 * F1C-02: la web pide un Ably TokenRequest al API en vez de recibir la app key.
 * Se corre contra la API real y una key FALSA con formato válido (`appid.keyid:secret`):
 * el TokenRequest se firma en local, así que no hay llamada a Ably ni a la red.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
} from "./harness";

const FAKE_ABLY_KEY = "fakeapp.fakekey:secreto-de-prueba";
// Antes de que el arnés importe la app (y su env): la key real del `.env` no se usa.
process.env.ABLY_API_KEY = FAKE_ABLY_KEY;

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

interface TokenRequestBody {
  keyName?: string;
  clientId?: string;
  capability?: string;
  ttl?: number;
  timestamp?: number;
  nonce?: string;
  mac?: string;
}

const expectTokenRequestFor = (
  response: { body: unknown },
  userId: string,
  label: string,
  tenantId: string | null
): TokenRequestBody => {
  assert.ok(response.body && typeof response.body === "object", `${label}: cuerpo JSON`);
  const body = response.body as TokenRequestBody;

  assert.equal(body.clientId, userId, `${label}: clientId debe ser el del usuario`);
  assert.equal(body.keyName, "fakeapp.fakekey", `${label}: keyName de la key fake`);
  assert.equal(typeof body.timestamp, "number", `${label}: timestamp`);
  assert.equal(typeof body.mac, "string", `${label}: mac`);
  assert.ok((body.mac ?? "").length > 0, `${label}: TokenRequest firmado`);
  assert.ok((body.nonce ?? "").length >= 16, `${label}: nonce`);
  assert.equal(body.ttl, 3_600_000, `${label}: TTL de 1 hora`);

  const capability = JSON.parse(String(body.capability)) as Record<string, string[]>;
  const expected: Record<string, string[]> = { [`user:${userId}`]: ["subscribe"] };
  if (tenantId) expected[`tenant:${tenantId}:user:${userId}`] = ["subscribe"];
  assert.deepEqual(
    capability,
    expected,
    `${label}: capability de subscribe en el canal propio (y el del cliente si aplica)`
  );
  return body;
};

describe("GET /notifications/ably-token", () => {
  test("sin sesión responde 401 (no filtra la key ni emite tokens)", async () => {
    const response = await api("GET", "/notifications/ably-token");
    expectStatus(response, 401, "token de Ably sin sesión");
  });

  test("un empleado sin permisos extra recibe su TokenRequest", async () => {
    const session = await clientSession("CLIENT_STAFF");
    const response = await api("GET", "/notifications/ably-token", { token: session.token });
    expectStatus(response, 200, "token de Ably del empleado");
    expectTokenRequestFor(response, session.user.id, "empleado", session.tenant!.id);
  });

  test("cada usuario solo puede suscribirse a su canal, sin publish", async () => {
    const first = await clientSession("CLIENT_STAFF");
    const second = await clientSession("CLIENT_STAFF");

    const response = await api("GET", "/notifications/ably-token", { token: second.token });
    expectStatus(response, 200, "token de Ably del segundo usuario");
    const body = expectTokenRequestFor(response, second.user.id, "segundo usuario", second.tenant!.id);

    const capability = JSON.parse(String(body.capability)) as Record<string, string[]>;
    const tenant = second.tenant!.id;
    assert.deepEqual(
      Object.keys(capability).sort(),
      [`user:${second.user.id}`, `tenant:${tenant}:user:${second.user.id}`].sort()
    );
    assert.ok(!capability[`user:${first.user.id}`], "no puede escuchar a otro usuario");
    assert.ok(
      !capability[`tenant:${tenant}:user:${first.user.id}`],
      "no puede escuchar a otro usuario del mismo cliente"
    );
    for (const operations of Object.values(capability)) {
      assert.deepEqual(operations, ["subscribe"], "sin publish ni presence");
    }
  });

  test("un usuario de plataforma también recibe el token de su propio canal", async () => {
    const session = await platformSession("ADMIN");
    const response = await api("GET", "/notifications/ably-token", { token: session.token });
    expectStatus(response, 200, "token de Ably del ADMIN de plataforma");
    expectTokenRequestFor(response, session.user.id, "ADMIN de plataforma", null);
  });

  test("sin app key en el servidor responde 503 ABLY_NOT_CONFIGURED", async () => {
    const { env } = await import("@core/config/env.config");
    const original = env.ABLY_API_KEY;
    env.ABLY_API_KEY = "";
    try {
      const session = await clientSession("CLIENT_STAFF");
      const response = await api("GET", "/notifications/ably-token", { token: session.token });
      expectError(response, 503, "ABLY_NOT_CONFIGURED", "token de Ably sin app key");
    } finally {
      env.ABLY_API_KEY = original;
    }
  });
});
