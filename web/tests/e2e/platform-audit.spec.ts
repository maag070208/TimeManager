import { expect, test } from "@playwright/test";
import { ACME, PLATFORM, loginAs } from "./helpers";
import { dialog, gotoPlatform, loginPlatform, pickSelect } from "./platform-kit";

/**
 * AUD-01 — auditoría inmutable: filtros, detalle y permisos.
 * e2e.admin (ADMIN con audit.view) ve todos los clientes; acme.admin
 * (CLIENT_ADMIN con audit.view) solo ve su cliente; acme.rh no tiene acceso.
 */
test.use({ timezoneId: "America/Mexico_City" });

test.describe("auditoría de plataforma", () => {
  test("[AUD-01][AUD-M1] lista, filtra y abre el detalle del log", async ({ page }) => {
    await loginPlatform(page);
    await gotoPlatform(page, "/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Auditoría" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Los logs de auditoría no se editan ni se borran/)).toBeVisible();
    for (const filter of ["Cliente", "Persona", "Módulo", "Acción", "Buscar", "Rango de fechas"]) {
      await expect(page.getByText(filter, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 20_000 });

    // Los filtros se aplican y "Limpiar filtros" los restablece.
    await page.locator('input[name="auditSearch"]').fill("e2e");
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator('input[name="auditSearch"]')).toHaveValue("");

    // Detalle del log.
    await page.locator("tbody tr").first().click();
    const detail = dialog(page);
    await expect(detail.getByText("Detalle del log")).toBeVisible({ timeout: 20_000 });
    await expect(detail.getByText("Evidencia inmutable de la operación.")).toBeVisible();
    for (const field of ["Fecha", "Usuario", "Módulo", "Acción", "Entidad"]) {
      await expect(detail.getByText(field, { exact: true }).first()).toBeVisible();
    }
    await detail.getByText("Cerrar", { exact: true }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[AUD-01] CLIENT_ADMIN solo ve la auditoría de su cliente", async ({ page }) => {
    await loginAs(page, "admin", "acme");
    await page.goto(`${ACME.base}/#/audit`);
    await expect(page.getByRole("heading", { level: 1, name: "Auditoría" })).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(/Los logs de auditoría de tu empresa no se editan ni se borran\. Solo puedes ver la actividad de tu propio cliente\./)
    ).toBeVisible();
    // El filtro por cliente es exclusivo de plataforma.
    await expect(page.locator('select[name="auditTenant"]')).toHaveCount(0);
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 20_000 });
  });

  test("[AUD-01] sin audit.view la ruta regresa al inicio", async ({ page }) => {
    await loginAs(page, "rh", "acme");
    await expect(page.getByText("Hola, Rita").first()).toBeVisible({ timeout: 30_000 });
    await page.goto(`${ACME.base}/#/audit`);
    await expect(page).toHaveURL(/acme\.localhost:5106\/#\/$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Auditoría" })).toHaveCount(0);
  });

  test("[AUD-01] la plataforma filtra por búsqueda y limpia filtros", async ({ page }) => {
    await loginPlatform(page);
    await gotoPlatform(page, "/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Auditoría" })).toBeVisible({ timeout: 30_000 });
    // El filtro por cliente solo existe para la plataforma.
    // El filtro de cliente es exclusivo de plataforma y se anuncia con su label.
    await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible();

    await page.locator('input[name="auditSearch"]').fill("e2e.admin");
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator('input[name="auditSearch"]')).toHaveValue("");
    await expect(page.getByRole("table").first()).toBeVisible();
  });
});
