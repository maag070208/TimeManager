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
  test("[NOM-01][NOM-01-S3] el CLIENT_STAFF ve su jornada y su teletrabajo propio", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.staff });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/mi-jornada`);

    await expect(page).toHaveURL(/#\/acme\/mi-jornada$/);
    await expect(page.getByText("Marca tu entrada y salida, consulta tus marcajes")).toBeVisible();
    await expect(page.getByText("Siguiente paso")).toBeVisible();
    await expect(page.getByText("Mis marcajes")).toBeVisible();
    await expect(page.getByText("Mi teletrabajo")).toBeVisible();
    // El seed puede traer al trabajador registrado (con domicilio/checklist) o no.
    await expect(
      page
        .getByText(/No estás registrado como teletrabajador|Domicilio de teletrabajo|Checklist del lugar de teletrabajo/)
        .first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".border-red-200")).toHaveCount(0);
  });

  test("[NOM-02][NOM-02-T2] el CLIENT_ADMIN ve KPIs y las pestañas de teletrabajo", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.admin });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/teletrabajo`);
    await expect(page).toHaveURL(/#\/acme\/teletrabajo$/);
    for (const kpi of ["Teletrabajadores", "Checklists", "Comunicaciones", "Política"]) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    }
    for (const section of ["Política y avisos", "Teletrabajadores", "Checklists", "Comunicaciones"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${section}`) }).first()).toBeVisible();
    }
  });

  test("[NOM-02] el CLIENT_STAFF no entra a la administración de teletrabajo", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.staff });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/teletrabajo`);

    // RequirePermission lo regresa al inicio de su cliente, con el prefijo.
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await expect(page.getByText("Política, desconexión y aviso de privacidad")).toHaveCount(0);
  });

  test("[NOM-02][NOM-02-T1] el CLIENT_ADMIN ve la administración de teletrabajo sin error", async ({ page }) => {
    await login(page, { base: ACME_ROUTE, username: ACME.admin });
    await expect(page).toHaveURL(/#\/acme\/home$/);
    await page.goto(`${ACME_ROUTE}/teletrabajo`);

    await expect(page).toHaveURL(/#\/acme\/teletrabajo$/);
    await expect(page.getByText("Política, desconexión y aviso de privacidad")).toBeVisible();
    // Las secciones viven en pestañas: se verifica la barra completa.
    for (const section of ["Política y avisos", "Teletrabajadores", "Checklists", "Comunicaciones"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${section}`) }).first()).toBeVisible();
    }
    await expect(page.locator(".border-red-200")).toHaveCount(0);
  });
});
