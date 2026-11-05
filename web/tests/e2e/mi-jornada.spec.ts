import { expect, test } from "@playwright/test";
import { ACME, PLATFORM, login, loginForm } from "./helpers";

test.describe("Mi jornada (portal del trabajador)", () => {
  test("la plataforma no ve Mi jornada en el menú y la ruta la regresa a su inicio", async ({ page }) => {
    await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
    // El personal de plataforma no tiene expediente ni marcajes propios.
    await expect(page.getByText("Mi jornada", { exact: true })).toHaveCount(0);
    await page.goto(`${PLATFORM.base}/#/mi-jornada`);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("heading", { name: /Mi jornada/i })).toHaveCount(0);
  });

  test("el trabajador del cliente entra a su portal con marcaje y teletrabajo", async ({ page }) => {
    await login(page, { base: ACME.base, username: ACME.staff });
    await page.goto(`${ACME.base}/#/mi-jornada`);
    await expect(page.getByRole("heading", { name: /Mi jornada/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrar entrada/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Salida a comer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Regreso de comer/i })).toBeVisible();
    // Teletrabajo (desde/hasta) + vacaciones/permisos (desde/hasta).
    await expect(page.locator('input[type="date"]')).toHaveCount(4);
    // Sin errores de contexto: la sesión pertenece al cliente.
    await expect(page.getByText(/requiere un cliente en contexto/i)).toHaveCount(0);
    await expect(loginForm(page)).toHaveCount(0);
  });
});
