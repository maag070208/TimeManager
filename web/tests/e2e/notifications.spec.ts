import { expect, test } from "@playwright/test";
import { ACME, loginAs } from "./helpers";

const NOTIFICATIONS = `${ACME.base}/#/notifications`;

/** El seed deja un aviso sin leer para `acme.admin` (tipo USER_CREATED). */
test.describe("centro de notificaciones", () => {
  test("muestra el aviso sembrado en /notifications", async ({ page }) => {
    await loginAs(page, "admin", "acme");
    await page.goto(NOTIFICATIONS);

    await expect(page.getByRole("heading", { level: 1, name: "Notificaciones" })).toBeVisible();
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Datos sembrados para las pruebas de extremo a extremo.", { exact: true })
    ).toBeVisible();
    // Agrupado por día: el seed crea el aviso hoy.
    await expect(page.getByText("Hoy", { exact: true })).toBeVisible();

    // Sin leer: punto azul en la fila y botón de marcar todo como leído.
    await expect(page.getByRole("img", { name: "Sin leer" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Marcar todo como leído" })).toBeVisible();
  });

  test("el aviso se marca leído al abrirlo y el estado persiste", async ({ page }) => {
    await loginAs(page, "admin", "acme");
    await page.goto(NOTIFICATIONS);

    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Sin leer" })).toHaveCount(1);

    // Abrir el aviso (tipo USER_CREATED: se queda en la bandeja, solo lo marca leído).
    await page.getByRole("button").filter({ hasText: "Cuenta de prueba E2E" }).click();

    await expect(page.getByRole("img", { name: "Sin leer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Marcar todo como leído" })).toHaveCount(0);
    await expect(page).toHaveURL(/#\/notifications$/);

    // El cambio se guardó en el servidor: al recargar sigue leído.
    await page.reload();
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Sin leer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Marcar todo como leído" })).toHaveCount(0);
  });
});
