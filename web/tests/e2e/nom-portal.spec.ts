/**
 * Portal del trabajador y administración NOM-037 (F2-07/F2-08) bajo las rutas
 * por cliente: `/#/acme/mi-jornada` (autoservicio) y `/#/acme/teletrabajo`
 * (RH, con `time_clock.view`). El tenant acme y su personal los siembra
 * `api/scripts/e2e-seed.ts`; no se crea nada aquí.
 */
import { expect, test } from "@playwright/test";
import { ACME, PLATFORM, login } from "./helpers";

/** Base de la web con el cliente acme en el hash. */
const ACME_ROUTE = `${PLATFORM.base}/#/acme`;

test.describe("NOM: portal del trabajador y teletrabajo", () => {
  test("el CLIENT_STAFF ve su jornada y su teletrabajo propio", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.staff });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/mi-jornada`);

    await expect(page).toHaveURL(/#\/acme\/mi-jornada$/);
    await expect(page.getByText("Marca tu entrada y salida, consulta tus marcajes")).toBeVisible();
    await expect(page.getByText("Marcaje de hoy")).toBeVisible();
    await expect(page.getByText("Mis marcajes")).toBeVisible();
    await expect(page.getByText("Mi teletrabajo")).toBeVisible();
    // acme.staff no está dado de alta como teletrabajador en el seed.
    await expect(page.getByText(/No estás registrado como teletrabajador/)).toBeVisible();
    await expect(page.locator(".border-red-200")).toHaveCount(0);
  });

  test("el CLIENT_STAFF no entra a la administración de teletrabajo", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.staff });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/teletrabajo`);

    // RequirePermission lo regresa al inicio de su cliente, con el prefijo.
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await expect(page.getByText("Política, desconexión y aviso de privacidad")).toHaveCount(0);
  });

  test("el CLIENT_ADMIN ve la administración de teletrabajo sin error", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.admin });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/teletrabajo`);

    await expect(page).toHaveURL(/#\/acme\/teletrabajo$/);
    await expect(page.getByText("Política, desconexión y aviso de privacidad")).toBeVisible();
    await expect(page.getByText("Teletrabajadores", { exact: true })).toBeVisible();
    await expect(page.getByText("Checklists del lugar de trabajo")).toBeVisible();
    await expect(page.getByText("Comunicaciones fuera de jornada", { exact: true })).toBeVisible();
    await expect(page.locator(".border-red-200")).toHaveCount(0);
  });
});
