/**
 * Credencial firmada de la foto del empleado (F1C-01).
 *
 * El endpoint `GET /hr/:id/photo/raw` no usa `authenticate` (la web lo pinta
 * desde `<img src>` / fetch same-origin sin headers), así que el token ES la
 * autorización: JWT propio con `sub` = dueño de la foto, `purpose: "photo"` y
 * vida corta. Aquí se cubren firma, expiración, propósito y `sub` ajeno.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

// `env.config` exige estas variables: son valores de unidad, sin BD real.
process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test_photo";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-photo-secret";

const security = async () => import("./security");

const isPhotoTokenError = (reason: "INVALID" | "FORBIDDEN") => {
  return (error: unknown): boolean => {
    return (
      error instanceof Error &&
      error.name === "PhotoTokenError" &&
      (error as Error & { reason?: string }).reason === reason
    );
  };
};

test("firma un token de propósito photo y valida que el sub sea el dueño", async () => {
  const { signPhotoToken, verifyPhotoToken, assertPhotoToken } = await security();

  const token = signPhotoToken("user-a");
  const payload = verifyPhotoToken(token);
  assert.equal(payload.sub, "user-a");
  assert.equal(payload.purpose, "photo");
  assert.doesNotThrow(() => assertPhotoToken(token, "user-a"));
});

test("rechaza (401) un token expirado", async () => {
  const { env } = await import("@core/config/env.config");
  const { assertPhotoToken } = await security();

  const expired = jwt.sign({ purpose: "photo" }, env.JWT_SECRET, {
    subject: "user-a",
    expiresIn: -1,
  });
  assert.throws(() => assertPhotoToken(expired, "user-a"), isPhotoTokenError("INVALID"));
});

test("rechaza (401) un token con otro propósito", async () => {
  const { env } = await import("@core/config/env.config");
  const { assertPhotoToken } = await security();

  // Un access token de sesión no sirve como credencial de foto.
  const accessToken = jwt.sign(
    { id: "user-a", username: "a", role: "CLIENT_STAFF" },
    env.JWT_SECRET,
    { expiresIn: "5m" }
  );
  assert.throws(() => assertPhotoToken(accessToken, "user-a"), isPhotoTokenError("INVALID"));

  // Tampoco un token con purpose distinto.
  const otherPurpose = jwt.sign({ purpose: "document" }, env.JWT_SECRET, {
    subject: "user-a",
    expiresIn: "5m",
  });
  assert.throws(() => assertPhotoToken(otherPurpose, "user-a"), isPhotoTokenError("INVALID"));
});

test("rechaza (401) un token manipulado o firmado con otro secreto", async () => {
  const { signPhotoToken, assertPhotoToken } = await security();

  const valid = signPhotoToken("user-a");
  const [header, payload, signature] = valid.split(".");
  const tampered = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  assert.throws(() => assertPhotoToken(tampered, "user-a"), isPhotoTokenError("INVALID"));

  const foreign = jwt.sign({ purpose: "photo" }, "otro-secreto", {
    subject: "user-a",
    expiresIn: "5m",
  });
  assert.throws(() => assertPhotoToken(foreign, "user-a"), isPhotoTokenError("INVALID"));
});

test("rechaza (403) el token válido de otra persona", async () => {
  const { signPhotoToken, assertPhotoToken } = await security();

  // `sub` != id pedido: la firma es buena pero no es el dueño de esa foto.
  const token = signPhotoToken("user-a");
  assert.throws(() => assertPhotoToken(token, "user-b"), isPhotoTokenError("FORBIDDEN"));
});

test("signedPhotoPath arma la ruta relativa con el token embebido", async () => {
  const { signedPhotoPath, verifyPhotoToken } = await security();

  const path = signedPhotoPath("user-a");
  const match = /^\/hr\/([^/]+)\/photo\/raw\?token=(.+)$/.exec(path);
  assert.ok(match, `ruta inesperada: ${path}`);
  assert.equal(match[1], "user-a");
  assert.equal(verifyPhotoToken(decodeURIComponent(match[2])).sub, "user-a");
});
