import { test } from "node:test";
import assert from "node:assert/strict";
import { TenantCreateDto, TenantUpdateDto } from "./tenant.dto";

const base = { name: "Acme", slug: "acme", admin: { name: "Ana", username: "ana" } };

test("slug válido se normaliza a minúsculas", () => {
  assert.equal(TenantCreateDto.parse({ ...base, slug: " Acme-Norte " }).slug, "acme-norte");
});

test("slugs inválidos o reservados se rechazan", () => {
  for (const slug of ["-acme", "acme-", "ac me", "acme_1", "a".repeat(41), "app", "admin", "www", "api"]) {
    assert.equal(TenantCreateDto.safeParse({ ...base, slug }).success, false, slug);
  }
});

test("zona horaria se valida", () => {
  assert.equal(TenantCreateDto.safeParse({ ...base, timezone: "America/Tijuana" }).success, true);
  assert.equal(TenantCreateDto.safeParse({ ...base, timezone: "Mars/Base" }).success, false);
});

test("PATCH vacío se rechaza; estado válido pasa", () => {
  assert.equal(TenantUpdateDto.safeParse({}).success, false);
  assert.equal(TenantUpdateDto.safeParse({ status: "SUSPENDED" }).success, true);
  assert.equal(TenantUpdateDto.safeParse({ status: "DELETED" }).success, false);
});
