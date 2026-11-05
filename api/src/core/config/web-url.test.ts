import { test } from "node:test";
import assert from "node:assert/strict";
import { webLoginUrl } from "./web-url";

test("entrada por subdominio desde el comodín de WEB_ORIGIN", () => {
  const origins = "http://localhost:5006, http://*.localhost:5006";
  assert.equal(webLoginUrl("acme", origins), "http://acme.localhost:5006/login");
  assert.equal(webLoginUrl(null, origins), "http://localhost:5006/login");
});

test("sin comodín no hay URL de cliente; con * no hay ninguna", () => {
  assert.equal(webLoginUrl("acme", "https://app.timemanager.mx"), null);
  assert.equal(webLoginUrl("acme", "*"), null);
  assert.equal(webLoginUrl(null, "*"), null);
});
