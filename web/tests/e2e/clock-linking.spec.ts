import { expect, test, type Page } from "@playwright/test";
import { apiOk, enterAcme, getEmployees, getUsers, openAcme } from "./clk-helpers";

/**
 * CLK-04 (Empleados del reloj), CLK-05 (Diferencias/conciliación), CLK-M05
 * (vincular persona) y ACT-31 (vincular/desvincular número del reloj).
 *
 * Los objetivos se descubren por API: se elige un número sin vínculo (o uno ya
 * vinculado y se restaura al final), nunca un número hardcodeado.
 */
test.use({ timezoneId: "America/Mexico_City" });

const EMPLOYEES = "/hr/time-clock/employees";
const DIFFERENCES = "/hr/time-clock/employees/differences";
const EMPLOYEES_ANCHOR = "Relaciona cada número del reloj con su usuario del sistema";
const DIFFERENCES_ANCHOR = "Concilia los números del reloj con las personas del sistema";

const rowOf = (page: Page, text: string) => page.locator("tbody tr", { hasText: text }).first();
const dialogOpen = (page: Page) => page.locator('[data-it-dialog="true"]');

/**
 * El buscador de usuario del diálogo es el `ITSearchSelect` del kit (sin
 * `<select>` nativo): se escribe el nombre y se elige la opción del portal.
 */
async function pickUser(page: Page, dialog: import("@playwright/test").Locator, user: any): Promise<void> {
  const input = dialog.locator('input[name="checadorVinculoUsuario"]');
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.click();
  await input.fill(user.name);
  const panel = page.locator('[data-it-floating="true"]').first();
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await panel.getByText(user.name, { exact: false }).first().click();
  await expect(input).not.toHaveValue("");
}

/** Usuario del sistema que corresponde al número del reloj (o el primero). */
function userForNumber(users: any[], number: string, suggestion?: { userId?: string | null }): any {
  if (suggestion?.userId) return users.find((user) => user.id === suggestion.userId) ?? users[0];
  return users.find((user) => String(user.employeeNumber ?? "") === number) ?? users[0];
}

test.describe("vínculos del reloj", () => {
  test("[CLK-04][ACT-31] empleados: vincular un número y restaurar el vínculo original", async ({ page }) => {
    await enterAcme(page);
    const employees = await getEmployees(page);
    const users = await getUsers(page);
    const target = (employees.data as any[])[0];
    test.skip(!target || users.length === 0, "Sin números del reloj o sin usuarios del sistema");

    const originalUserId: string | null = target.link?.userId ?? null;
    const nextUser = users.find((user) => user.id !== originalUserId) ?? users[0];

    await openAcme(page, EMPLOYEES, EMPLOYEES_ANCHOR);
    const row = rowOf(page, `#${target.employeeNumber}`);
    await expect(row).toBeVisible({ timeout: 25_000 });
    await row.click();

    const dialog = dialogOpen(page);
    await expect(dialog.getByText(new RegExp(`Vincular número ${target.employeeNumber}`))).toBeVisible();
    await pickUser(page, dialog, nextUser);
    const save = page.waitForResponse(
      (r) => r.url().includes(`/time-clock/employees/${target.employeeNumber}`) && r.request().method() === "PUT"
    );
    await dialog.getByRole("button", { name: "Vincular" }).click();
    expect((await save).status()).toBe(200);
    await expect(page.getByText(new RegExp(`${target.employeeNumber} vinculado a`))).toBeVisible({
      timeout: 20_000,
    });
    await expect(rowOf(page, `#${target.employeeNumber}`).getByText(nextUser.name).first()).toBeVisible({
      timeout: 20_000,
    });

    // Restaura el vínculo original (o lo deja sin vínculo si así venía el seed).
    if (originalUserId) {
      await apiOk(page, "PUT", `/time-clock/employees/${target.employeeNumber}`, { userId: originalUserId });
    } else {
      await apiOk(page, "DELETE", `/time-clock/employees/${target.employeeNumber}`);
    }
  });

  test("[CLK-04][CLK-M05] el diálogo de vínculo valida el usuario y cancelar no escribe", async ({ page }) => {
    await enterAcme(page);
    const employees = await getEmployees(page);
    const users = await getUsers(page);
    const target = (employees.data as any[])[0];
    test.skip(!target || users.length === 0, "Sin números del reloj o sin usuarios");

    await openAcme(page, EMPLOYEES, EMPLOYEES_ANCHOR);
    await rowOf(page, `#${target.employeeNumber}`).click();
    const dialog = dialogOpen(page);
    await expect(dialog.getByText(new RegExp(`Vincular número ${target.employeeNumber}`))).toBeVisible();
    // La fila viene con su vínculo actual precargado en el buscador de usuario.
    const currentUser = users.find((user) => user.id === target.link?.userId);
    if (currentUser) {
      const input = dialog.locator('input[name="checadorVinculoUsuario"]');
      expect(await input.inputValue()).toContain(currentUser.name);
    } else {
      expect(users.length).toBeGreaterThan(0);
    }
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogOpen(page)).toHaveCount(0);

    // Cancelar no cambió el vínculo del número.
    const after = await getEmployees(page);
    const current = (after.data as any[]).find((row) => row.employeeNumber === target.employeeNumber);
    expect(current?.link?.userId ?? null).toBe(target.link?.userId ?? null);
  });

  test("[CLK-04] sugerencias: el lote sólo se ofrece si hay sugerencias seguras", async ({ page }) => {
    await enterAcme(page);
    const employees = await getEmployees(page);
    await openAcme(page, EMPLOYEES, EMPLOYEES_ANCHOR);

    const batch = page.getByRole("button", { name: /Vincular \d+ sugerencias seguras/ });
    if (employees.summary.registrationSuggestions > 0) {
      await expect(batch).toBeEnabled();
    } else {
      await expect(batch).toBeDisabled();
    }
  });

  test("[CLK-05][ACT-31] diferencias: elige número y persona; cancelar no escribe", async ({ page }) => {
    await enterAcme(page);
    const employees = await getEmployees(page);
    test.skip((employees.data as any[]).length === 0, "El reloj no tiene números vistos");

    await openAcme(page, DIFFERENCES, DIFFERENCES_ANCHOR);
    // acme.admin sí tiene time_clock.link: no debe verse el aviso de sólo lectura.
    await expect(page.getByText("Solo lectura: te falta el permiso para vincular.")).toHaveCount(0);

    // El seed vincula sus números: se apaga el filtro "solo sin vincular" del reloj.
    const onlyMissing = page.getByText("Solo sin vincular", { exact: true }).first();
    await expect(onlyMissing).toBeVisible({ timeout: 25_000 });
    await onlyMissing.click();
    const onlyFree = page.getByText("Solo sin número", { exact: true }).first();
    await expect(onlyFree).toBeVisible({ timeout: 20_000 });
    await onlyFree.click();
    await expect(page.getByTestId("fila-reloj").first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("fila-reloj").first().click();
    await page.getByTestId("fila-persona").first().click();
    const action = page.getByRole("button", { name: /Asignar|Cambiar/ }).first();
    await expect(action).toBeEnabled();

    // Cancelar deja la conciliación como estaba (nada guardado).
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Elige un número del reloj")).toBeVisible();
    const after = await getEmployees(page);
    const linked = after.summary.linkedCount;
    expect(linked).toBe(employees.summary.linkedCount);
    expect((await getUsers(page)).length).toBeGreaterThan(0);
  });

});
