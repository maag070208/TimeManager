/**
 * Resolución de la ruta por cliente (`/#/acme/home`) y del respaldo por
 * subdominio. Sin navegador: `cd web && node --test src/shared/lib/tenant-route/resolve.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTenantRoute,
  routeWithoutTenant,
  tenantSlugFromHash,
  type TenantRoute,
} from "./resolve.ts";

/** Subdominio de cliente como lo resuelve `tenantSlugFromHost`. */
const hostSlug = (hostname: string): string | null => {
  if (!hostname.endsWith(".localhost")) return null;
  const label = hostname.slice(0, -".localhost".length);
  return label === "" || label === "www" || label === "admin" ? null : label;
};

test("las rutas de la app no se leen como slug", () => {
  for (const hash of [
    "",
    "#/",
    "#/login",
    "#/roles",
    "#/plans",
    "#/mi-jornada",
    "#/teletrabajo",
    "#/users",
    "#/users/abc/edit",
    "#/employees/new",
    "#/hr/time-clock",
    "#/time-clocks",
    "#/notifications",
    "#/schedules/assign",
  ]) {
    assert.equal(tenantSlugFromHash(hash), null, hash);
  }
});

test("el primer segmento del hash es el slug del cliente", () => {
  assert.equal(tenantSlugFromHash("#/acme/home"), "acme");
  assert.equal(tenantSlugFromHash("#/cliente-1/home"), "cliente-1");
  assert.equal(tenantSlugFromHash("#/acme"), "acme");
  assert.equal(tenantSlugFromHash("#/acme/hr/time-clock"), "acme");
  assert.equal(tenantSlugFromHash("#/acme/users/abc/edit?tab=cuenta"), "acme");
});

test("un segmento que no cumple el patrón de slug no es cliente", () => {
  for (const hash of ["#/Acme/home", "#/a_b/home", "#acme/home", "#/acme-/home", "#/-acme/home"]) {
    assert.equal(tenantSlugFromHash(hash), null, hash);
  }
});

test("la ruta del hash gana sobre el subdominio", () => {
  const route = resolveTenantRoute("#/beta/home", "acme.localhost", hostSlug);
  assert.deepEqual(route, {
    slug: "beta",
    source: "path",
    basename: "/beta",
    fromPath: true,
  } satisfies TenantRoute);
  assert.equal(resolveTenantRoute("#/beta", "acme.localhost", hostSlug).basename, "/beta");
});

test("sin slug en el hash se usa el subdominio y la URL sigue sin prefijo", () => {
  const route = resolveTenantRoute("#/hr/time-clock", "acme.localhost", hostSlug);
  assert.deepEqual(route, {
    slug: "acme",
    source: "host",
    basename: "/",
    fromPath: false,
  } satisfies TenantRoute);
});

test("la plataforma no resuelve cliente", () => {
  const route = resolveTenantRoute("#/login", "localhost", hostSlug);
  assert.deepEqual(route, {
    slug: null,
    source: null,
    basename: "/",
    fromPath: false,
  } satisfies TenantRoute);
});

test("la ruta interna se calcula sin el prefijo del cliente", () => {
  assert.equal(routeWithoutTenant("#/acme/hr/time-clock"), "/hr/time-clock");
  assert.equal(routeWithoutTenant("#/acme"), "/");
  assert.equal(routeWithoutTenant("#/acme/"), "/");
  assert.equal(routeWithoutTenant("#/acme/users/abc/edit"), "/users/abc/edit");
  assert.equal(routeWithoutTenant("#/hr/time-clock"), "/hr/time-clock");
  assert.equal(routeWithoutTenant("#/"), "/");
});
