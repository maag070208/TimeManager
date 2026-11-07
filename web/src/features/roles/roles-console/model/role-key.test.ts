/**
 * Clave interna de un rol nuevo en la consola (PLAT-06 Roles): normalización
 * del nombre visible, límite de 50 y sufijos sin choques.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_KEY_REGEX, roleKeyFromName } from "./role-key.ts";

test("[PLAT-06] roleKeyFromName quita acentos y pasa a MAYÚSCULAS_CON_GUIONES", () => {
  assert.equal(roleKeyFromName("Auxiliar de almacén"), "AUXILIAR_DE_ALMACEN");
  assert.equal(roleKeyFromName("Recursos Humanos"), "RECURSOS_HUMANOS");
  assert.equal(roleKeyFromName("  Jefe   de   turno  "), "JEFE_DE_TURNO");
});

test("[PLAT-06] roleKeyFromName evita que la clave empiece con número o quede vacía", () => {
  assert.equal(roleKeyFromName("24/7 Monitoreo"), "R_24_7_MONITOREO");
  assert.equal(roleKeyFromName("!!!"), "");
});

test("[PLAT-06] roleKeyFromName respeta máximo 50 sin guion bajo final", () => {
  const longKey = roleKeyFromName("A".repeat(60));
  assert.equal(longKey.length, 50);
  assert.equal(ROLE_KEY_REGEX.test(longKey), true);
  const withSpacesAtCut = roleKeyFromName(`${"B".repeat(49)} final`);
  assert.equal(withSpacesAtCut.endsWith("_"), false);
});

test("[PLAT-06] roleKeyFromName agrega sufijo cuando la clave ya existe", () => {
  assert.equal(roleKeyFromName("Auditor", ["AUDITOR"]), "AUDITOR_2");
  assert.equal(roleKeyFromName("Auditor", ["AUDITOR", "AUDITOR_2"]), "AUDITOR_3");
  const longTaken = roleKeyFromName("C".repeat(60), ["C".repeat(50)]);
  assert.equal(longTaken.length <= 50, true);
  assert.equal(ROLE_KEY_REGEX.test(longTaken), true);
});
