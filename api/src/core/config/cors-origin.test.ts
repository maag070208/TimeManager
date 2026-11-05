import { test } from "node:test";
import assert from "node:assert/strict";
import { corsOrigin } from "./cors-origin";

const allows = (raw: string, origin: string | undefined): boolean => {
  const fn = corsOrigin(raw);
  if (fn === true) return true;
  let result = false;
  fn(origin, (_err, allow) => (result = !!allow));
  return result;
};

test("* permite todo", () => assert.equal(corsOrigin("*"), true));

test("lista con comodín de subdominio", () => {
  const raw = "http://localhost:5006, http://*.localhost:5006, https://*.timemanager.mx";
  assert.equal(allows(raw, "http://localhost:5006"), true);
  assert.equal(allows(raw, "http://acme.localhost:5006"), true);
  assert.equal(allows(raw, "https://acme.timemanager.mx"), true);
  assert.equal(allows(raw, "http://localhost:5007"), false);
  assert.equal(allows(raw, "https://timemanager.mx.evil.com"), false);
  assert.equal(allows(raw, "https://acme.timemanager.mx.evil.com"), false);
  assert.equal(allows(raw, "https://xtimemanager.mx"), false);
  assert.equal(allows(raw, undefined), true);
});
