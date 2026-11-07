import { expect, test } from "@playwright/test";
import { gotoRoute, loginAcme, searchSelectValue, waitForApiMatch } from "./ops-helpers";

/**
 * Asignar personal a puesto de nómina (PAY-04, ACT-27): selector de puesto
 * activo, filtros, badge del puesto actual y asignar/quitar individual.
 *
 * El seed deja puestos con salario y personal activo; el caso usa el primer
 * puesto activo y la primera persona disponible para no depender de nombres.
 */

const positionsLoaded = async (page: import("@playwright/test").Page) => {
  const name = await searchSelectValue(page, "payrollPosition");
  expect(name.length).toBeGreaterThan(0);
  return name;
};

test.describe("asignar personal a puesto (acme.admin)", () => {
  test("[PAY-04][ACT-27] asigna una persona a un puesto y la quita", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/payroll/assign");
    await expect(page.getByText("Asigna un puesto de nómina a varias personas a la vez.")).toBeVisible();
    const positionName = await positionsLoaded(page);

    // Solo quienes no están en este puesto.
    await page.getByRole("button", { name: /^Por asignar/ }).click();
    const pendingRow = page.locator("tbody tr").first();
    await expect(pendingRow).toBeVisible({ timeout: 20_000 });
    const personName = (await pendingRow.locator("td").nth(1).innerText()).split("\n")[0].trim();
    expect(personName.length).toBeGreaterThan(0);

    // Selección y asignación en lote (acción primaria compacta).
    await pendingRow.click();
    await expect(page.getByText("1 seleccionada(s)")).toBeVisible();
    const assigned = waitForApiMatch(page, /\/payroll\/positions\/[^/]+\/assign$/, "PUT");
    await page.getByRole("button", { name: "Asignar (1)" }).click();
    expect((await assigned).ok()).toBe(true);
    await expect(page.getByText("Personal asignado al puesto.")).toBeVisible();

    // La persona aparece en el puesto con su badge.
    await page.getByRole("button", { name: /^En este puesto/ }).click();
    const assignedRow = page.getByRole("row").filter({ hasText: personName }).first();
    await expect(assignedRow).toBeVisible({ timeout: 20_000 });
    await expect(assignedRow).toContainText(positionName);

    // Quitar del puesto con la acción de fila.
    const removed = waitForApiMatch(page, /\/payroll\/positions\/[^/]+\/assign$/, "PUT");
    await assignedRow.getByRole("button", { name: "Quitar del puesto" }).click();
    expect((await removed).ok()).toBe(true);
    await expect(page.getByText("Asignación actualizada.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: personName })).toHaveCount(0, { timeout: 20_000 });
  });
});
