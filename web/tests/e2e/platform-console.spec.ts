import { expect, test } from "@playwright/test";
import { PLATFORM, loginAs, loginForm } from "./helpers";
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
 * PLAT-01/03 — consola de plataforma y clientes.
 * Datos mutables con nombre único; el resto sale del seed (acme/beta).
 */
test.use({ timezoneId: "America/Mexico_City" });

test.describe("consola de plataforma", () => {
  test("[PLAT-01] la consola muestra KPIs, tableros y la lista de clientes", async ({ page }) => {
    await loginPlatform(page);

    for (const label of ["Clientes", "Personas activas", "Ingreso mensual", "Por cobrar"]) {
      await expect(page.getByText(label, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    for (const section of ["Altas de clientes", "Estado de clientes", "Próximos cobros", "Uso por plan"]) {
      await expect(page.getByText(section, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    const table = page.getByRole("table");
    await expect(table.getByText("Cliente E2E Acme", { exact: true })).toBeVisible();
    await expect(table.getByText("Cliente E2E Beta", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nuevo cliente/ })).toBeVisible();
  });

  test("[PLAT-03] la pantalla de clientes lista, busca y abre el detalle", async ({ page }) => {
    await loginPlatform(page);
    await gotoPlatform(page, "/tenants");
    await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
    for (const label of ["Activos", "Suspendidos", "Personas"]) {
      await expect(page.getByText(label, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Todos los clientes")).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Acme")).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Beta")).toBeVisible();

    // Búsqueda: filtra por nombre y deja "sin coincidencias" con basura.
    const search = page.locator('input[name="tenantSearch"]');
    await search.fill("Beta");
    await expect(rowOf(page, "Cliente E2E Beta")).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Acme")).toHaveCount(0);
    await search.fill("zzz-sin-coincidencias");
    await expect(page.getByText("Sin coincidencias")).toBeVisible();
    await search.fill("");

    // La fila abre el detalle del cliente.
    await rowOf(page, "Cliente E2E Acme").getByText("Cliente E2E Acme", { exact: true }).click();
    await expect(page).toHaveURL(/#\/tenants\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Cliente E2E Acme" })).toBeVisible();
  });

  test("[PLAT-03][PLAT-M1][ACT-04] alta de cliente: validación, credenciales y fila nueva", async ({ page }) => {
    await loginPlatform(page);
    await gotoPlatform(page, "/tenants");
    const name = `Cliente QA ${unique("")}`;
    await page.getByRole("button", { name: /Nuevo cliente/ }).click();
    const create = dialog(page);

    // Validación de slug reservado.
    await create.locator('input[name="name"]').fill(name);
    await create.locator('input[name="slug"]').fill("app");
    await create.locator('input[name="adminName"]').fill("Admin QA");
    await create.locator('input[name="adminUsername"]').fill(`qa.${unique("")}`.replace(/[^a-z0-9.]/g, ""));
    await create.getByRole("button", { name: "Crear cliente" }).click();
    await expect(create.getByText(/no puede ser app, admin, api o www/)).toBeVisible();

    // Cancelar no debe dejar registro.
    await create.getByRole("button", { name: "Cancelar" }).click();
    await expect(rowOf(page, name)).toHaveCount(0);

    // Alta válida.
    const created = await createTenantViaUi(page, { name });
    expect(created.password.length).toBeGreaterThan(0);
    const row = rowOf(page, name);
    await expect(row).toBeVisible();
    await expect(row.getByText("Activo").first()).toBeVisible();
  });

  test("[PLAT-03][PLAT-M4][ACT-05] suspender/reactivar: confirmar aplica el cambio", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);

    await rowOf(page, tenant.name).getByRole("button", { name: "Suspender" }).click();
    await expect(dialog(page).getByText(`¿Suspender a ${tenant.name}?`)).toBeVisible();
    await expect(dialog(page).getByText(/Nadie de este cliente podrá entrar/)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Suspender" }).click();
    await expect(rowOf(page, tenant.name).getByText("Suspendido").first()).toBeVisible({ timeout: 20_000 });

    await rowOf(page, tenant.name).getByRole("button", { name: "Reactivar" }).click();
    await expect(dialog(page).getByText(`¿Reactivar a ${tenant.name}?`)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Reactivar" }).click();
    await expect(rowOf(page, tenant.name).getByText("Activo").first()).toBeVisible({ timeout: 20_000 });
  });

  test("[PLAT-01][PLAT-M2][ACT-03][ACT-06] asigna plan desde la fila y entra como cliente", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await gotoPlatform(page, "/tenants");
    await rowOf(page, tenant.name).getByRole("button", { name: "Asignar plan" }).click();

    const planDialog = dialog(page);
    await expect(planDialog.getByText(`Plan de ${tenant.name}`)).toBeVisible();
    const planValue = await firstOptionValue(page, "planId");
    const planLabel = (await page.locator(`select[name="planId"] option[value="${planValue}"]`).innerText()).split(" — ")[0].trim();
    await pickSelect(page, "planId", planValue);
    await planDialog.getByRole("button", { name: "Guardar plan" }).click();
    await expect(planDialog).toHaveCount(0, { timeout: 20_000 });
    await expect(rowOf(page, tenant.name).getByText(planLabel).first()).toBeVisible({ timeout: 20_000 });

    // Entrar como cliente (impersonación auditada) deja la app operando el cliente.
    await rowOf(page, tenant.name).getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/Hola, Admin/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/localhost:5106\/(#\/)?$/);
  });

  test("[PLAT-03][PLAT-M3] agente local: crea, rota y revoca el token", async ({ page }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);
    await gotoPlatform(page, "/tenants");
    await rowOf(page, tenant.name).getByRole("button", { name: "Agente" }).click();

    const agentDialog = dialog(page);
    await expect(agentDialog.getByText(`Agente local · ${tenant.name}`)).toBeVisible();
    const agentName = `Agente QA ${unique("")}`;
    await agentDialog.locator('input[name="agentName"]').fill(agentName);
    await agentDialog.getByRole("button", { name: "Crear agente" }).click();
    await expect(agentDialog.getByText(/Token nuevo \(se muestra una sola vez/)).toBeVisible({ timeout: 20_000 });
    await expect(agentDialog.getByText(agentName, { exact: false }).first()).toBeVisible();

    await agentDialog.getByRole("button", { name: "Rotar token" }).first().click();
    await expect(agentDialog.getByText(/Token nuevo \(se muestra una sola vez/)).toBeVisible({ timeout: 20_000 });

    await agentDialog.getByRole("button", { name: "Revocar" }).first().click();
    await expect(agentDialog.getByRole("button", { name: "Reactivar" }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("[PLAT-02] el inicio del cliente muestra el saludo y sus tableros", async ({ page }) => {
    await loginAs(page, "admin", "acme");
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Ana" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Cliente E2E Acme · /)).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Primeros pasos" })).toBeVisible();
    await expect(page.getByText("Hoy", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Panel de CheckLab" })).toHaveCount(0);
  });

  test("[AUTH-02] la landing pública es accesible sin sesión y enlaza al login", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/landing`);
    await expect(page.getByRole("heading", { level: 1, name: /El registro de jornada/i })).toBeVisible();
    await page.getByRole("link", { name: "Iniciar sesión" }).first().click();
    await expect(loginForm(page)).toBeVisible({ timeout: 20_000 });
  });
});
