import { expect, test } from "@playwright/test";
import { dialog, gotoRoute, loginAcme, waitForApi, waitForApiMatch } from "./ops-helpers";

/**
 * Nómina configurable (PAY-03, PAY-03-T1/T2, PAY-M05/M06, ACT-27): CRUD de
 * puestos de nómina (salario/SBC), activar/desactivar y configuración general
 * con guardado, validación de JSON y cálculo de recibo.
 *
 * Cada corrida crea su propio puesto con nombre único; el seed aporta el
 * catálogo base y el personal para las asignaciones (PAY-04 tiene su propio
 * archivo).
 */

const unique = `Puesto E2E ${Date.now().toString().slice(-6)}`;

const positionsLoaded = async (page: import("@playwright/test").Page) => {
  await expect(page.getByRole("button", { name: /Nuevo puesto/ })).toBeVisible({ timeout: 20_000 });
};

test.describe("nómina configurable (acme.admin)", () => {
  test("[PAY-03][PAY-03-T1][PAY-M05][PAY-M06][ACT-27] crea, edita, desactiva y reactiva un puesto", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/payroll/settings");
    await positionsLoaded(page);

    // Alta del perfil (PAY-M05): nombre, salario y SBC.
    await page.getByRole("button", { name: /Nuevo puesto/ }).click();
    const createDialog = dialog(page, "Nuevo puesto de nómina");
    await expect(createDialog).toBeVisible();
    await createDialog.locator('input[name="payrollProfileName"]').fill(unique);
    await createDialog.locator('input[name="payrollProfileSalary"]').fill("315.04");
    await createDialog.locator('input[name="payrollProfileSbc"]').fill("350.20");
    const created = waitForApi(page, "/payroll/positions");
    await createDialog.getByRole("button", { name: "Guardar", exact: true }).click();
    expect((await created).ok()).toBe(true);
    await expect(page.getByText("Perfil de nómina creado.")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: unique }).first();
    await expect(row).toBeVisible();

    // Edición: el mismo diálogo en modo edición actualiza el salario.
    await row.click();
    const editDialog = dialog(page, "Editar puesto de nómina");
    await expect(editDialog).toBeVisible();
    await expect(editDialog.locator('input[name="payrollProfileSalary"]')).toHaveValue("315.04");
    await editDialog.locator('input[name="payrollProfileSalary"]').fill("400");
    const updated = waitForApiMatch(page, /\/payroll\/positions\/[^/]+$/, "PATCH");
    await editDialog.getByRole("button", { name: "Guardar", exact: true }).click();
    expect((await updated).ok()).toBe(true);
    await expect(page.getByText("Perfil actualizado.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: unique }).first()).toContainText("$400.00");

    // Baja: aviso de que se quita a las personas asignadas y se conserva el historial.
    await page.getByRole("row").filter({ hasText: unique }).first().getByRole("button", { name: "Desactivar perfil" }).click();
    const deactivate = dialog(page, "Desactivar perfil de nómina");
    await expect(deactivate).toBeVisible();
    await expect(deactivate).toContainText(unique);
    await expect(deactivate).toContainText("se quitará a las personas asignadas");
    const deactivated = waitForApiMatch(page, /\/payroll\/positions\/[^/]+$/, "PATCH");
    await deactivate.getByRole("button", { name: "Desactivar", exact: true }).click();
    expect((await deactivated).ok()).toBe(true);
    await expect(page.getByText("Perfil desactivado.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: unique }).first()).toContainText("Inactivo");

    // Reactivar desde el filtro de inactivos.
    await page.getByRole("button", { name: /^Inactivos/ }).click();
    const inactiveRow = page.getByRole("row").filter({ hasText: unique }).first();
    await expect(inactiveRow).toBeVisible();
    await inactiveRow.getByRole("button", { name: "Activar perfil" }).click();
    const activate = dialog(page, "Activar perfil de nómina");
    await expect(activate).toBeVisible();
    const activated = waitForApiMatch(page, /\/payroll\/positions\/[^/]+$/, "PATCH");
    await activate.getByRole("button", { name: "Activar", exact: true }).click();
    expect((await activated).ok()).toBe(true);
    await expect(page.getByText("Perfil activado.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: unique }).first()).toContainText("Activo");
  });

  test("[PAY-03][PAY-03-T2] guarda la configuración, valida el JSON y calcula el recibo", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/payroll/settings");
    await positionsLoaded(page);
    await page.getByRole("button", { name: "Configuración general" }).click();

    // Salario base para que el cálculo tenga con qué operar.
    const salary = page.locator('input[name="defaultDailySalary"]');
    await expect(salary).toBeVisible({ timeout: 20_000 });
    await salary.fill("315.04");
    const saveButton = () => page.locator("button:visible", { hasText: "Guardar configuración" }).first();
    const saved = waitForApi(page, "/payroll/settings", "PUT");
    await saveButton().click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByText("Configuración de nómina guardada.")).toBeVisible();

    // JSON de ISR inválido: error explícito y no guarda.
    await page.locator('textarea[name="isrBrackets"]').fill("{no-es-json");
    await saveButton().click();
    await expect(page.getByText("Las tablas ISR/IMSS deben ser JSON válido.")).toBeVisible();

    // Se restaura un JSON válido, se apaga ISR (sin tabla) y se vuelve a guardar.
    await page.locator('textarea[name="isrBrackets"]').fill("[]");
    await page.locator('select[name="isrEnabled"]').selectOption({ value: "false" }, { force: true });
    const savedAgain = waitForApi(page, "/payroll/settings", "PUT");
    await saveButton().click();
    expect((await savedAgain).ok()).toBe(true);

    // Cálculo del recibo con la configuración guardada.
    await page.locator('input[name="calcDays"]').fill("6");
    await page.locator('input[name="calcDoubleHours"]').fill("0");
    const calculated = waitForApi(page, "/payroll/calculate");
    await page.getByRole("button", { name: "Calcular con esta configuración" }).click();
    expect((await calculated).ok()).toBe(true);
    await expect(page.getByText(/Costo patronal/)).toBeVisible();
  });
});
