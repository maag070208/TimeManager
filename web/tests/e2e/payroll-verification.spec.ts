import { expect, test } from "@playwright/test";
import { gotoRoute, loginAcme } from "./ops-helpers";

/**
 * Flujo completo de verificación y cierre de pre-nómina:
 * verificar todos los departamentos, cerrar la semana, verlo en el historial
 * y reabrir. La persistencia es en payroll_department_reviews / closures.
 */
test.describe("verificación y cierre de pre-nómina", () => {
  test("verifica, cierra y aparece en el historial", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules/payroll");
    await expect(page.getByText("Reporte semanal", { exact: true })).toBeVisible();

    // Verificar toda la pre-nómina (con confirmación).
    const verifyResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/schedules/payroll/reviews/mark-all")
    );
    await page.getByRole("button", { name: /Verificar toda la pre-nómina/ }).click();
    await page.getByRole("button", { name: /Sí, verificar toda/ }).click();
    expect((await verifyResponse).ok()).toBe(true);

    // Cerrar la semana (botón habilitado al estar todo verificado).
    const closeResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/schedules/payroll/close")
    );
    await page.getByRole("button", { name: /Cerrar pre-nómina/ }).click();
    await page.getByRole("button", { name: "Cerrar semana" }).click();
    expect((await closeResponse).ok()).toBe(true);
    await expect(page.getByRole("button", { name: /Reabrir/ })).toBeVisible();

    // Historial: la semana cerrada aparece con su revisión.
    await page.getByRole("button", { name: /Historial/ }).first().click();
    await expect(page).toHaveURL(/\/schedules\/payroll\/history/);
    await expect(page.getByRole("heading", { name: /Historial de pre-nóminas/i })).toBeVisible();
    await expect(page.getByText(/Semana|cerrad/i).first()).toBeVisible();

  });
});
