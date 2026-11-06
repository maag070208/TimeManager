/**
 * Rutas por cliente en el hash (local-first): `/#/acme/home`, `/#/acme/login`.
 * La plataforma sigue sin prefijo (`/#/login`, `/#/`) y el subdominio se
 * conserva, pero estas pruebas entran por el mismo host (`localhost:5106`) con
 * el cliente en la ruta, usando los tenants que siembra `api/scripts/e2e-seed.ts`.
 */
import { expect, test } from "@playwright/test";
import { ACME, E2E_PASSWORD, PLATFORM, expectPrivateLayout, login, loginForm } from "./helpers";

/** Base de la web con el cliente acme en el hash. */
const ACME_ROUTE = `${PLATFORM.base}/#/acme`;

test.describe("ruta por cliente en el hash", () => {
  test("el login de cliente está en /#/<slug>/login y su inicio en /#/<slug>/home", async ({ page }) => {
    await page.goto(`${ACME_ROUTE}/login`);
    const form = loginForm(page);
    await expect(form).toBeVisible();
    await expect(page).toHaveURL(/#\/acme\/login$/);
    await expect(page.getByText(ACME.name, { exact: false }).first()).toBeVisible();

    await page.locator('input[name="username"]').fill(ACME.admin);
    await page.locator('input[name="password"]').fill(E2E_PASSWORD);
    await form.locator('button[type="submit"]').click();

    await expect(form).toHaveCount(0);
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await expectPrivateLayout(page);
  });

  test("la navegación del cliente no lo saca de su prefijo", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.admin });
    await expect(page).toHaveURL(/#\/acme\/home$/);

    const seeAll = page.getByRole("button", { name: "Ver todo" }).first();
    await seeAll.waitFor({ state: "visible" });
    await seeAll.click();
    await expect(page).toHaveURL(/#\/acme\/hr\/time-clock$/);
  });

  test("la guarda de permisos redirige dentro del prefijo, no a la plataforma", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.staff });
    await page.goto(`${ACME_ROUTE}/roles`);

    await expect(page).toHaveURL(/#\/acme\/home$/);
    await expect(page).not.toHaveURL(/#\/roles$/);
  });

  test("/users/* conserva el prefijo del cliente", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.admin });
    await page.goto(`${ACME_ROUTE}/users`);
    await expect(page).toHaveURL(/#\/acme\/employees$/);
  });

  test("una sesión de cliente en una URL sin prefijo vuelve a su ruta", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.admin });
    await page.goto(`${PLATFORM.base}/#/`);
    await expect(page).toHaveURL(/#\/acme\/home$/);
  });

  test("un slug desconocido cae en el login de ese cliente y no muestra formulario", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/noexiste/home`);
    await expect(page).toHaveURL(/#\/noexiste\/login$/);
    await expect(page.getByText("Cliente no encontrado")).toBeVisible();
    await expect(loginForm(page)).toHaveCount(0);
  });

  test("la plataforma sigue sin prefijo", async ({ page }) => {
    await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
    await expect(page).toHaveURL(/#\/$/);

    await page.goto(`${PLATFORM.base}/#/roles`);
    await expect(page).toHaveURL(/#\/roles$/);

    // Aunque abra la ruta de un cliente, la plataforma se queda sin prefijo.
    await page.goto(`${PLATFORM.base}/#/acme/home`);
    await expect(page).toHaveURL(/#\/$/);
  });
});
