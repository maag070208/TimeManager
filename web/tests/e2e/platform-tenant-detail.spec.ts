import { expect, test } from "@playwright/test";
import {
  createTenantViaUi,
  dialog,
  firstOptionValue,
  gotoPlatform,
  loginPlatform,
  pickSelect,
  rowOf,
  unique,
} from "./platform-kit";

/**
 * PLAT-04 — detalle del cliente (`/tenants/:id`): resumen, módulos, cobros y
 * actividad. Se opera sobre un cliente QA creado por prueba.
 */
test.use({ timezoneId: "America/Mexico_City" });

async function openTenant(page: Parameters<typeof rowOf>[0], name: string): Promise<void> {
  await gotoPlatform(page, "/tenants");
  await rowOf(page, name).getByText(name, { exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 30_000 });
}

test.describe("detalle del cliente", () => {
  test("[PLAT-04][PLAT-04-T1] resumen: pestañas, puesta en marcha y cuenta", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await openTenant(page, tenant.name);

    for (const tab of ["Resumen", "Facturación", "Actividad"]) {
      await expect(page.getByRole("button", { name: tab, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /^Módulos \d+\/\d+$/ })).toBeVisible();
    await expect(page.getByText("Asignar plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Definir límite de personas", { exact: true })).toBeVisible();
    await expect(page.getByText("Módulos activados", { exact: true })).toBeVisible();
    await expect(page.getByText("Cuenta", { exact: true })).toBeVisible();
    await expect(page.getByText("Últimos movimientos", { exact: true })).toBeVisible();
    await expect(page.getByText("Aún no hay cargos ni pagos.")).toBeVisible();
  });

  test("[PLAT-04][PLAT-04-T2][ACT-37] módulos: apaga, persiste y reactiva", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await openTenant(page, tenant.name);
    await page.getByRole("button", { name: /^Módulos \d+\/\d+$/ }).click();
    await expect(page.getByText("Módulos y pantallas")).toBeVisible();

    const moduleName = "Teletrabajo NOM-037";
    const row = page.locator("div").filter({ hasText: moduleName }).last();
    const toggle = row.getByRole("switch").first();
    await toggle.click();
    await expect(page.getByText(/Apagado\. Los .* usuarios ya no ven/)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Módulos y pantallas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Apagado\. Los .* usuarios ya no ven/)).toBeVisible();

    // Limpieza: el módulo vuelve a estar activo.
    await page.locator("div").filter({ hasText: moduleName }).last().getByRole("switch").first().click();
    await expect(page.getByText(/Apagado\. Los .* usuarios ya no ven/)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[PLAT-04][PLAT-04-T3][PLAT-M5][ACT-37] registra un cargo, lo ve en kardex y lo marca pagado", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await openTenant(page, tenant.name);

    await page.getByRole("button", { name: "Facturación", exact: true }).click();
    await expect(page.getByText("Kardex de pagos")).toBeVisible();
    const concept = `Cargo QA ${unique("")}`;
    await page.getByRole("button", { name: /Registrar cargo/ }).first().click();
    const charge = dialog(page);
    await expect(charge.getByText("Registrar cargo").first()).toBeVisible();
    await charge.locator('input[name="payConcept"]').fill(concept);
    await charge.locator('input[name="payPeriod"]').fill(new Date().toISOString().slice(0, 7));
    await charge.locator('input[name="payAmount"]').fill("1500");
    await charge.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });

    await expect(page.getByText(concept, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Pendiente").first()).toBeVisible();
    await page.getByRole("button", { name: "Registrar pago" }).first().click();
    await expect(page.getByText("Pagado").first()).toBeVisible({ timeout: 20_000 });
  });

  test("[PLAT-04][PLAT-04-T4] actividad: la pestaña muestra la bitácora del cliente", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await openTenant(page, tenant.name);
    await page.getByRole("button", { name: "Actividad", exact: true }).click();
    await expect(page.getByText("Actividad", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Cliente creado", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("[PLAT-04][PLAT-M2][ACT-06] asigna plan desde la ficha del cliente", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await openTenant(page, tenant.name);

    await page.getByRole("button", { name: "Asignar", exact: true }).click();
    const planDialog = dialog(page);
    await expect(planDialog.getByText(`Plan de ${tenant.name}`)).toBeVisible();
    const planValue = await firstOptionValue(page, "planId");
    const planLabel = (await page.locator(`select[name="planId"] option[value="${planValue}"]`).innerText()).split(" — ")[0].trim();
    await pickSelect(page, "planId", planValue);
    await planDialog.getByRole("button", { name: "Guardar plan" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(planLabel, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  });
});
