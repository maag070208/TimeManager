/**
 * Validaciones de los formularios de Personal (EMP-02/05): reglas puras sin
 * i18n ni React. `cd web && node --test src/shared/validation/patterns.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBlank,
  isValidCurp,
  isValidEmail,
  isValidNss,
  isValidPhone,
  isValidPostal,
  isValidRfc,
  trimValue,
} from "./patterns.ts";

test("[EMP-02][EMP-05][EMP-M01] RFC: persona física y moral, tolera minúsculas", () => {
  assert.equal(isValidRfc("GODE561231GR8"), true);
  assert.equal(isValidRfc("ABC010101AB1"), true);
  assert.equal(isValidRfc("gode561231gr8"), true);
  assert.equal(isValidRfc("RFC"), false);
  assert.equal(isValidRfc("GODE56123GR8"), false);
  assert.equal(isValidRfc(""), false);
  assert.equal(isBlank("   "), true);
  assert.equal(trimValue(null), "");
});

test("[EMP-02][EMP-05] CURP: 18 posiciones, mayúsculas y sin espacios internos", () => {
  assert.equal(isValidCurp("GODE561231HDFRRN09"), true);
  assert.equal(isValidCurp("gode561231hdfrrn09"), true);
  assert.equal(isValidCurp("GODE561231HDFRRN"), false, "17 posiciones");
  assert.equal(isValidCurp("GO DE561231HDFRRN09"), false);
});

test("[EMP-02][EMP-05] NSS: exactamente 11 dígitos", () => {
  assert.equal(isValidNss("12345678901"), true);
  assert.equal(isValidNss("1234567890"), false);
  assert.equal(isValidNss("123456789012"), false);
  assert.equal(isValidNss("12345A78901"), false);
});

test("[EMP-02][EMP-05] teléfono: 10–13 dígitos con +, espacios o guiones", () => {
  assert.equal(isValidPhone("6641234567"), true);
  assert.equal(isValidPhone("+52 664 123 4567"), true);
  assert.equal(isValidPhone("664-123-4567"), true);
  assert.equal(isValidPhone("664123456"), false, "9 dígitos");
  assert.equal(isValidPhone("12345678901234"), false, "14 dígitos");
});

test("[EMP-02][EMP-05][EMP-M01] CP y correo con errores obvios", () => {
  assert.equal(isValidPostal("22000"), true);
  assert.equal(isValidPostal("2200"), false);
  assert.equal(isValidPostal("220000"), false);
  assert.equal(isValidEmail("ana@empresa.mx"), true);
  assert.equal(isValidEmail(" ana@empresa.mx "), true);
  assert.equal(isValidEmail("ana@empresa"), false);
  assert.equal(isValidEmail("ana empresa.mx"), false);
  assert.equal(isValidEmail(""), false);
});
