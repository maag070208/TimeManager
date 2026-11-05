/**
 * Foto del empleado (F1C-01).
 *
 * `GET /hr/:id/photo/raw` dejó de ser público: la credencial es un JWT de
 * propósito `photo` y vida corta que el API emite al armar `photoUrl`, y va en
 * la query (`?token=`) para que la web la pinte con `<img src>` / fetch
 * same-origin sin headers. Aquí se cubre sin token (401), token de otra
 * persona/cliente contra el id (403) y token válido que sí llega al storage
 * (sin credenciales S3 en pruebas → 503; sin `photoKey` → 404).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  login,
  setupSuite,
  stopSuite,
} from "./harness";

const photoPath = (id: string): string => `/hr/${id}/photo/raw`;

const photoKeyOf = (id: string): string => `hr/${id}/photo/foto.jpg`;

/** `photoUrl` firmado que el API emite en `/auth/me` a quien tiene foto. */
const signedPhotoUrlOf = async (token: string): Promise<string> => {
  const me = await api("GET", "/auth/me", { token });
  expectStatus(me, 200, "auth/me");
  const photoUrl = me.body?.photoUrl;
  assert.equal(typeof photoUrl, "string", "auth/me debe traer un photoUrl firmado");
  assert.ok(
    !String(photoUrl).includes("amazonaws.com"),
    `photoUrl no debe ser una URL pública de S3: ${photoUrl}`
  );
  return photoUrl as string;
};

const tokenOf = (photoUrl: string): string => {
  const token = new URLSearchParams(photoUrl.split("?")[1] ?? "").get("token");
  assert.ok(token, `photoUrl sin credencial: ${photoUrl}`);
  return token as string;
};

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("GET /hr/:id/photo/raw — credencial firmada de corta vida", () => {
  test("sin token responde 401 TOKEN_MISSING", async () => {
    const tenant = await createTenant();
    const user = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      photoKey: photoKeyOf("sin-token"),
    });

    const response = await api("GET", photoPath(user.id));
    expectError(response, 401, "TOKEN_MISSING", "foto sin token");
  });

  test("un access token de sesión no sirve como credencial de foto: 401 INVALID_TOKEN", async () => {
    const session = await clientSession("CLIENT_STAFF");
    const response = await api(
      "GET",
      `${photoPath(session.user.id)}?token=${encodeURIComponent(session.token)}`
    );
    expectError(response, 401, "INVALID_TOKEN", "access token en lugar del de foto");
  });

  test("el token de una persona de otro cliente contra el id de A responde 403", async () => {
    const tenantA = await createTenant();
    const userA = await createUser({
      tenantId: tenantA.id,
      role: "CLIENT_STAFF",
      photoKey: photoKeyOf("empleado-a"),
    });
    const tenantB = await createTenant();
    const userB = await createUser({
      tenantId: tenantB.id,
      role: "CLIENT_STAFF",
      photoKey: photoKeyOf("empleado-b"),
    });

    // Token legítimo de B (lo emite /auth/me de su propia sesión)…
    const tokensB = await login({ username: userB.username, tenant: tenantB.slug });
    const tokenB = tokenOf(await signedPhotoUrlOf(tokensB.token));

    // …pero se usa contra el id de A: no es el dueño de esa foto.
    const response = await api(
      "GET",
      `${photoPath(userA.id)}?token=${encodeURIComponent(tokenB)}`
    );
    expectError(response, 403, "FORBIDDEN", "token del cliente B contra el id de A");
  });

  test("token válido llega al storage: sin S3 configurado responde 503, no 401", async () => {
    const tenant = await createTenant();
    const user = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      photoKey: photoKeyOf("con-foto"),
    });
    const tokens = await login({ username: user.username, tenant: tenant.slug });
    const photoUrl = await signedPhotoUrlOf(tokens.token);

    assert.match(photoUrl, /^\/hr\/[^/]+\/photo\/raw\?token=.+$/, "ruta firmada esperada");

    // Sin header Authorization: el token de la URL ES la credencial (así lo
    // consume `<img src>`). Llega al storage y falla por falta de S3, no por auth.
    const response = await api("GET", photoUrl);
    expectError(response, 503, "STORAGE_NOT_CONFIGURED", "foto válida sin S3");
  });

  test("token válido de una persona sin foto responde 404 (no 401)", async () => {
    const { signPhotoToken } = await import("@core/utils/security");
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const response = await api(
      "GET",
      `${photoPath(user.id)}?token=${encodeURIComponent(signPhotoToken(user.id))}`
    );
    expectError(response, 404, "EMPLOYEE_HAS_NO_PHOTO", "token válido sin photoKey");
  });

  test("la ficha de RH emite el mismo photoUrl firmado y el endpoint lo acepta", async () => {
    const tenant = await createTenant();
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      photoKey: photoKeyOf("ficha-rh"),
    });
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });

    const profile = await api("GET", `/hr/${employee.id}`, { token: hr.token });
    expectStatus(profile, 200, "ficha de RH");
    const photoUrl = profile.body?.photoUrl;
    assert.equal(typeof photoUrl, "string", "la ficha de RH debe traer photoUrl firmado");
    assert.ok(
      String(photoUrl).startsWith(`/hr/${employee.id}/photo/raw?token=`),
      `photoUrl firmado inesperado: ${photoUrl}`
    );

    // Se consume sin sesión, como lo hace la web con la credencial.
    const response = await api("GET", photoUrl as string);
    expectError(response, 503, "STORAGE_NOT_CONFIGURED", "photoUrl de la ficha de RH");
  });
});
