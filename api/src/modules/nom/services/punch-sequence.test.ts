/**
 * Secuencia del marcaje remoto (F2-07): reglas puras, sin BD.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// El helper importa `HttpError` y la i18n; no hay BD en estas pruebas, pero
// `env.config` exige las variables al cargarse la cadena de imports.
process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test_nom";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-nom-secret";

const loadSequence = () => import("./punch-sequence");

const httpError = async (): Promise<typeof import("@core/middlewares/error.middleware")> =>
  import("@core/middlewares/error.middleware");

test("secuencia: día sin checadas espera ENTRY", async () => {
  const { expectedNextTypes } = await loadSequence();
  assert.deepEqual(expectedNextTypes(null, false), ["ENTRY"]);
  assert.deepEqual(expectedNextTypes(null, true), ["ENTRY"]);
});

test("secuencia: un día anterior arranca de nuevo en ENTRY", async () => {
  const { expectedNextTypes } = await loadSequence();
  assert.deepEqual(expectedNextTypes("EXIT", false), ["ENTRY"]);
  assert.deepEqual(expectedNextTypes("LUNCH_START", false), ["ENTRY"]);
});

test("secuencia: ENTRY → LUNCH_START o EXIT, LUNCH_START → LUNCH_END, LUNCH_END → EXIT", async () => {
  const { expectedNextTypes } = await loadSequence();
  assert.deepEqual(expectedNextTypes("ENTRY", true), ["LUNCH_START", "EXIT"]);
  assert.deepEqual(expectedNextTypes("LUNCH_START", true), ["LUNCH_END"]);
  assert.deepEqual(expectedNextTypes("LUNCH_END", true), ["EXIT"]);
});

test("secuencia: tras la salida el día está cerrado (sin pasos válidos)", async () => {
  const { expectedNextTypes, assertPunchSequence } = await loadSequence();
  const { HttpError } = await httpError();
  assert.deepEqual(expectedNextTypes("EXIT", true), []);
  for (const type of ["ENTRY", "LUNCH_START", "LUNCH_END", "EXIT"] as const) {
    assert.throws(
      () => assertPunchSequence(type, "EXIT", true),
      (error: unknown) => error instanceof HttpError && error.code === "WORKDAY_ALREADY_CLOSED",
      `después de EXIT ${type} debe rechazarse`
    );
  }
});

test("secuencia: paso fuera de orden responde INVALID_PUNCH_SEQUENCE con lo esperado", async () => {
  const { assertPunchSequence } = await loadSequence();
  const { HttpError } = await httpError();
  assert.throws(
    () => assertPunchSequence("LUNCH_END", "ENTRY", true),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === "INVALID_PUNCH_SEQUENCE" &&
      error.status === 409 &&
      JSON.stringify(error.params) === JSON.stringify({ type: "LUNCH_END", expected: ["LUNCH_START", "EXIT"] }),
    "LUNCH_END sobre una ENTRY abierta"
  );
  // Sin checadas hoy la primera siempre es ENTRY.
  assert.throws(
    () => assertPunchSequence("EXIT", null, false),
    (error: unknown) => error instanceof HttpError && error.code === "INVALID_PUNCH_SEQUENCE"
  );
});

test("secuencia: los pasos válidos no lanzan", async () => {
  const { assertPunchSequence } = await loadSequence();
  assert.doesNotThrow(() => assertPunchSequence("ENTRY", null, false));
  assert.doesNotThrow(() => assertPunchSequence("ENTRY", "EXIT", false));
  assert.doesNotThrow(() => assertPunchSequence("LUNCH_START", "ENTRY", true));
  assert.doesNotThrow(() => assertPunchSequence("EXIT", "ENTRY", true));
  assert.doesNotThrow(() => assertPunchSequence("LUNCH_END", "LUNCH_START", true));
  assert.doesNotThrow(() => assertPunchSequence("EXIT", "LUNCH_END", true));
});
