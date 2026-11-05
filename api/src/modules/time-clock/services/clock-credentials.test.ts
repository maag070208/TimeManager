import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret } from "@core/utils/crypto";
import { credentialsOf, hasOwnCredentials } from "./clock-credentials";

const FALLBACK = { user: "env-user", pass: "env-pass" };

const own = (password = "clock-pass") => ({
  serialNumber: "CLOCK-1",
  username: "clock-user",
  passwordEncrypted: encryptSecret(password),
});

test("usa las credenciales propias del reloj cuando existen", () => {
  assert.deepEqual(credentialsOf(own(), FALLBACK), { user: "clock-user", pass: "clock-pass" });
});

test("cae al par global cuando el reloj no tiene credenciales", () => {
  assert.deepEqual(credentialsOf({ serialNumber: "CLOCK-1", username: null, passwordEncrypted: null }, FALLBACK), FALLBACK);
  assert.deepEqual(credentialsOf(undefined, FALLBACK), FALLBACK);
});

test("sin reloj ni fallback no hay credenciales (el llamador decide el 503)", () => {
  assert.equal(credentialsOf({ username: null, passwordEncrypted: null }, null), null);
});

test("una contraseña cifrada ilegible cae al fallback, sin exponerla", () => {
  const corrupt = { serialNumber: "CLOCK-1", username: "clock-user", passwordEncrypted: "v1.aaaa.bbbb.cccc" };
  assert.deepEqual(credentialsOf(corrupt, FALLBACK), FALLBACK);
});

test("un usuario sin contraseña guardada usa el fallback", () => {
  assert.equal(hasOwnCredentials({ username: "clock-user", passwordEncrypted: null }), false);
  assert.deepEqual(credentialsOf({ username: "clock-user", passwordEncrypted: null }, FALLBACK), FALLBACK);
});

test("hasOwnCredentials exige usuario y contraseña", () => {
  assert.equal(hasOwnCredentials(own()), true);
  assert.equal(hasOwnCredentials({ username: "clock-user" }), false);
  assert.equal(hasOwnCredentials({ passwordEncrypted: "x" }), false);
  assert.equal(hasOwnCredentials(null), false);
});
