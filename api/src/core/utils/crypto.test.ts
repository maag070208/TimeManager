import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SecretDecryptionError,
  decryptSecret,
  deriveKeyFromJwtSecret,
  encryptSecret,
  keyFromEncryptionKey,
} from "./crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");

test("roundtrip con ENCRYPTION_KEY", () => {
  const payload = encryptSecret("Acc3SHvPN", { encryptionKey: KEY });
  assert.notEqual(payload, "Acc3SHvPN");
  assert.equal(payload.includes("Acc3SHvPN"), false);
  assert.equal(decryptSecret(payload, { encryptionKey: KEY }), "Acc3SHvPN");
});

test("cada cifrado usa un IV distinto", () => {
  const a = encryptSecret("misma", { encryptionKey: KEY });
  const b = encryptSecret("misma", { encryptionKey: KEY });
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a, { encryptionKey: KEY }), "misma");
  assert.equal(decryptSecret(b, { encryptionKey: KEY }), "misma");
});

test("payload manipulado falla", () => {
  const payload = encryptSecret("secreto", { encryptionKey: KEY });
  const parts = payload.split(".");
  const tampered = [...parts];
  const raw = Buffer.from(parts[3], "base64");
  raw[0] ^= 0xff;
  tampered[3] = raw.toString("base64");
  assert.throws(() => decryptSecret(tampered.join("."), { encryptionKey: KEY }), SecretDecryptionError);
  assert.throws(() => decryptSecret(payload.split(".").slice(0, 3).join("."), { encryptionKey: KEY }), SecretDecryptionError);
  assert.throws(() => decryptSecret(payload.replace(/^v1\./, "v2."), { encryptionKey: KEY }), SecretDecryptionError);
  assert.throws(() => decryptSecret("", { encryptionKey: KEY }), SecretDecryptionError);
});

test("con otra clave falla", () => {
  const payload = encryptSecret("secreto", { encryptionKey: KEY });
  assert.throws(() => decryptSecret(payload, { encryptionKey: OTHER_KEY }), SecretDecryptionError);
});

test("sin ENCRYPTION_KEY usa la clave derivada de JWT_SECRET", () => {
  const payload = encryptSecret("derivado", { encryptionKey: null, jwtSecret: "unit-jwt-secret" });
  assert.equal(decryptSecret(payload, { encryptionKey: null, jwtSecret: "unit-jwt-secret" }), "derivado");
  // La derivación es estable entre procesos/llamadas.
  assert.deepEqual(deriveKeyFromJwtSecret("unit-jwt-secret"), deriveKeyFromJwtSecret("unit-jwt-secret"));
  assert.throws(
    () => decryptSecret(payload, { encryptionKey: null, jwtSecret: "otro-secreto" }),
    SecretDecryptionError
  );
  // Un payload con la clave derivada no se descifra con una ENCRYPTION_KEY.
  assert.throws(() => decryptSecret(payload, { encryptionKey: KEY }), SecretDecryptionError);
});

test("ENCRYPTION_KEY inválida se rechaza", () => {
  assert.throws(() => keyFromEncryptionKey("no-es-base64"), /32 bytes/);
  assert.throws(() => keyFromEncryptionKey(Buffer.alloc(16, 1).toString("base64")), /32 bytes/);
  assert.throws(
    () => encryptSecret("x", { encryptionKey: Buffer.alloc(16, 1).toString("base64") }),
    /32 bytes/
  );
});

test("texto plano vacío no se cifra", () => {
  assert.throws(() => encryptSecret("", { encryptionKey: KEY }));
});
