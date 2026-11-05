/**
 * Configuración de plataforma (F1B-12 + F3-05):
 * - estación de huellas configurable (default de plataforma + override por
 *   cliente, contraseña write-only, fallback .env) con API solo de plataforma;
 * - branding por cliente (color, logo y remitente) y branding público para el
 *   login.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
} from "./harness";

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

const STATION = {
  url: "http://10.0.0.50:8080",
  username: "fps-admin",
  password: "secreto-estacion-123",
};

describe("F1B-12 estación de huellas configurable", () => {
  test("la plataforma configura la estación central; la contraseña no se devuelve", async () => {
    const platform = await platformSession("ADMIN");

    const saved = await api("PUT", "/time-clock/fingerprint-station/config", {
      token: platform.token,
      body: STATION,
    });
    expectStatus(saved, 200, "config estación central");
    assert.equal(saved.body?.source, "platform");
    assert.equal(saved.body?.configured, true);
    assert.equal(saved.body?.url, STATION.url);
    assert.equal(saved.body?.username, STATION.username);
    assert.equal(saved.body?.hasPassword, true);
    assert.equal(JSON.stringify(saved.body).includes(STATION.password), false, "no filtra la contraseña");

    const read = await api("GET", "/time-clock/fingerprint-station/config", {
      token: platform.token,
    });
    expectStatus(read, 200, "lectura estación central");
    assert.equal(read.body?.source, "platform");
    assert.equal(read.body?.hasPassword, true);
  });

  test("un cliente ve la estación central y puede tener un override en sitio", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });

    // Sin override: el cliente usa la estación central de plataforma.
    const inherited = await api("GET", "/time-clock/fingerprint-station", { token: hr.token });
    expectStatus(inherited, 200, "estación heredada");
    assert.equal(inherited.body?.url, STATION.url);
    assert.equal(inherited.body?.source, "platform");

    // Override del cliente (estación instalada en su sitio).
    const override = await api("PUT", "/time-clock/fingerprint-station/config", {
      token: platform.token,
      body: { ...STATION, tenantId: tenant.id, url: "http://192.168.1.10:8080" },
    });
    expectStatus(override, 200, "override de cliente");
    assert.equal(override.body?.source, "tenant");
    assert.equal(override.body?.url, "http://192.168.1.10:8080");

    const own = await api("GET", "/time-clock/fingerprint-station", { token: hr.token });
    expectStatus(own, 200, "estación propia");
    assert.equal(own.body?.url, "http://192.168.1.10:8080");
    assert.equal(own.body?.source, "tenant");

    // Borrar el override lo regresa a la estación central.
    const cleared = await api("PUT", "/time-clock/fingerprint-station/config", {
      token: platform.token,
      body: { tenantId: tenant.id, clear: true },
    });
    expectStatus(cleared, 200, "limpiar override");
    assert.equal(cleared.body?.source, "platform");

    const back = await api("GET", "/time-clock/fingerprint-station", { token: hr.token });
    assert.equal(back.body?.url, STATION.url);
  });

  test("la configuración solo la ve/edita la plataforma", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const read = await api("GET", "/time-clock/fingerprint-station/config", { token: admin.token });
    expectError(read, 403, "INSUFFICIENT_PERMISSIONS", "config estación desde cliente");

    const write = await api("PUT", "/time-clock/fingerprint-station/config", {
      token: admin.token,
      body: STATION,
    });
    expectError(write, 403, "INSUFFICIENT_PERMISSIONS", "editar estación desde cliente");
  });
});

describe("F3-05 branding por cliente", () => {
  test("la plataforma guarda branding y el login lo lee sin sesión", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const brand = {
      brandColor: "#1a2b3c",
      logoDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      emailFrom: "rh@acme-e2e.test",
    };

    const updated = await api("PATCH", `/tenants/${tenant.id}`, {
      token: platform.token,
      body: brand,
    });
    expectStatus(updated, 200, "branding guardado");
    assert.equal(updated.body?.brandColor, brand.brandColor);
    assert.equal(updated.body?.logoDataUrl, brand.logoDataUrl);
    assert.equal(updated.body?.emailFrom, brand.emailFrom);

    // Público (pantalla de login), sin sesión.
    const publicBrand = await api("GET", `/auth/branding?tenant=${tenant.slug}`);
    expectStatus(publicBrand, 200, "branding público");
    assert.equal(publicBrand.body?.name, tenant.name);
    assert.equal(publicBrand.body?.brandColor, brand.brandColor);
    assert.equal(publicBrand.body?.logoDataUrl, brand.logoDataUrl);

    // Un slug desconocido no revela nada: nulls.
    const unknown = await api("GET", "/auth/branding?tenant=no-existe");
    expectStatus(unknown, 200, "slug desconocido");
    assert.equal(unknown.body?.name, null);

    // La sesión del cliente trae el branding en su tenant (/auth/me).
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const me = await api("GET", "/auth/me", { token: admin.token });
    expectStatus(me, 200, "auth/me con branding");
    assert.equal(me.body?.tenant?.brandColor, brand.brandColor);
    assert.equal(me.body?.tenant?.logoDataUrl, brand.logoDataUrl);
  });

  test("valida color/logo/remitente y sigue siendo solo de plataforma", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const badColor = await api("PATCH", `/tenants/${tenant.id}`, {
      token: platform.token,
      body: { brandColor: "azul" },
    });
    expectStatus(badColor, 400, "color inválido");

    const badLogo = await api("PATCH", `/tenants/${tenant.id}`, {
      token: platform.token,
      body: { logoDataUrl: "https://example.com/logo.png" },
    });
    expectStatus(badLogo, 400, "logo inválido");

    const badFrom = await api("PATCH", `/tenants/${tenant.id}`, {
      token: platform.token,
      body: { emailFrom: "no-es-correo" },
    });
    expectStatus(badFrom, 400, "remitente inválido");

    const forbidden = await api("PATCH", `/tenants/${tenant.id}`, {
      token: admin.token,
      body: { brandColor: "#112233" },
    });
    expectStatus(forbidden, 403, "branding desde cliente");
  });
});
