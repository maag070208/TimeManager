import { expect, test } from "@playwright/test";
import { gotoRoute, loginAcme } from "./ops-helpers";

/** Configuración del cliente: semana laboral, política de asistencia y guardado. */
test.describe("configuración del cliente admin", () => {
  test("cambia la semana a jueves y persiste", async ({ page }) => {
    await loginAcme(page, "admin");
    const configLoaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/nom/config") && response.request().method() === "GET"
    );
    await gotoRoute(page, "/settings/general");
    await configLoaded;
    await expect(page.getByRole("heading", { level: 1, name: "Configuración del sistema" })).toBeVisible();
    await expect(page.getByText("Asistencia", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Límites y retención", { exact: true }).first()).toBeVisible();

    const weekStart = page.locator('select[name="weekStartDay"]');
    await page.getByText("Primer día de la semana", { exact: true }).locator("xpath=following::input[1]").click();
    await page.getByText("Jueves", { exact: true }).last().click();
    await expect(weekStart).toHaveValue("4");
    const save = page.waitForResponse(
      (response) => new URL(response.url()).pathname.endsWith("/nom/config") && response.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    const saveResponse = await save;
    expect(saveResponse.ok()).toBe(true);
    expect((await saveResponse.json()).weekStartDay).toBe(4);
    await expect(page.getByText("Configuración guardada.")).toBeVisible();

    await page.reload();
    await expect(weekStart).toHaveValue("4");

    await page.getByText("Primer día de la semana", { exact: true }).locator("xpath=following::input[1]").click();
    await page.getByText("Miércoles", { exact: true }).last().click();
    const reset = page.waitForResponse(
      (response) => new URL(response.url()).pathname.endsWith("/nom/config") && response.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    expect((await reset).ok()).toBe(true);
  });
});
