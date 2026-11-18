import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { API_VERSION, clientVersionOf } from "./version";

test("la versión del API es la de api/package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../package.json"), "utf8")) as { version: string };
  assert.equal(API_VERSION, pkg.version);
  assert.match(API_VERSION, /^\d+\.\d+\.\d+$/);
});

test("la versión del cliente se recorta para el log", () => {
  assert.equal(clientVersionOf("web/1.0.0"), "web/1.0.0");
  assert.equal(clientVersionOf(undefined), null);
  assert.equal(clientVersionOf("x".repeat(200))?.length, 60);
});
