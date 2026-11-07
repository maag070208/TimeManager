/**
 * Alta de cliente en la consola de plataforma (PLAT-03): derivación del
 * subdominio desde el nombre y validación contra rutas de la app.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MX_TIMEZONES,
  RESERVED_SLUGS,
  SLUG_PATTERN,
  isValidSlug,
  slugify,
} from "./slug.ts";

test("[PLAT-03] slugify normaliza acentos, mayúsculas y signos", () => {
  assert.equal(slugify("Hotel Playa Azul S.A."), "hotel-playa-azul-sa");
  assert.equal(slugify("  Cliente   Ñandú  "), "cliente-nandu");
  assert.equal(slugify("ACME"), "acme");
  assert.equal(slugify("!!!"), "");
});

test("[PLAT-03] slugify recorta a 40 y no deja guiones en los extremos", () => {
  const long = slugify(`  ${"a".repeat(30)} ${"b".repeat(30)}  `);
  assert.equal(long.length <= 40, true);
  assert.equal(long.startsWith("-"), false);
  assert.equal(long.endsWith("-"), false);
});

test("[PLAT-03] SLUG_PATTERN acepta minúsculas/números/guiones y rechaza lo demás", () => {
  for (const valid of ["acme", "cliente-1", "a", "a1-b2"]) {
    assert.equal(SLUG_PATTERN.test(valid), true, valid);
  }
  for (const invalid of ["Acme", "a_b", "-acme", "acme-", "a".repeat(41), ""]) {
    assert.equal(SLUG_PATTERN.test(invalid), false, invalid);
  }
});

test("[PLAT-03] isValidSlug bloquea los slugs reservados por las rutas de la app", () => {
  assert.equal(isValidSlug("acme"), true);
  assert.equal(isValidSlug("admin"), false);
  assert.equal(isValidSlug("plans"), false, "ruta de la app");
  assert.equal(isValidSlug("time-clocks"), false, "ruta de la app");
  assert.ok(RESERVED_SLUGS.includes("admin") && RESERVED_SLUGS.includes("www"));
  assert.equal(isValidSlug("acme!"), false);
});

test("[PLAT-03] el catálogo de zonas horarias de México es único y usa IANA", () => {
  assert.ok(MX_TIMEZONES.includes("America/Mexico_City"));
  assert.equal(new Set(MX_TIMEZONES).size, MX_TIMEZONES.length);
  for (const zone of MX_TIMEZONES) assert.match(zone, /^America\//);
});
