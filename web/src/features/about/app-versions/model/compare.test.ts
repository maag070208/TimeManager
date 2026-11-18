import { test } from "node:test";
import assert from "node:assert/strict";

import { versionsMismatch } from "./compare";

test("un parche distinto entre web y API no es desfase; un cambio de menor o mayor sí", () => {
  assert.equal(versionsMismatch("1.2.0", "1.2.3"), false);
  assert.equal(versionsMismatch("1.2.0", "1.3.0"), true);
  assert.equal(versionsMismatch("2.0.0", "1.9.9"), true);
  assert.equal(versionsMismatch("1.2.0", null), false, "sin la versión del API no se avisa nada");
});
