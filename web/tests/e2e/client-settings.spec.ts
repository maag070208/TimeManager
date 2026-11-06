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
    await expect(page.getByText("Configuración del cliente")).toBeVisible();
    await expect(page.getByText(/Política de asistencia/)).toBeVisible();
    await expect(page.getByText("Límites y retención")).toBeVisible();

    // Cambiar a jueves y guardar.
    await page.selectOption('select[name="weekStartDay"]', "4");
    await expect(page.locator('select[name="weekStartDay"]')).toHaveValue("4");
    await page.waitForTimeout(300);
    const save = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/nom/config")
    );
    await page.getByRole("button", { name: "Guardar" }).click();
    const saveResponse = await save;
    expect(saveResponse.ok()).toBe(true);
    expect((await saveResponse.json()).weekStartDay).toBe(4);
    await expect(page.getByText("Configuración guardada.")).toBeVisible();

    // Persistió: al recargar la configuración sigue en jueves.
    await page.reload();
    await expect(page.locator('select[name="weekStartDay"]')).toHaveValue("4");

    // Regresar el seed a miércoles para no alterar otras pruebas.
    await gotoRoute(page, "/settings/general");
    await page.selectOption('select[name="weekStartDay"]', "3");
    const reset = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/nom/config")
    );
    await page.getByRole("button", { name: "Guardar" }).click();
    expect((await reset).ok()).toBe(true);
  });
});
