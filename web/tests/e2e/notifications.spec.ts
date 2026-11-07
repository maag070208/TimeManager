import { expect, test } from "@playwright/test";
import { ACME, loginAs } from "./helpers";
import { loginWithRetry } from "./platform-kit";

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
    await expect(page.getByRole("button", { name: "Marcar todo como leído" }).first()).toBeVisible();
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

test.describe("filtros y borrado del centro de notificaciones", () => {
  test("[PLAT-07] los filtros acotan la bandeja sin salir de la ruta", async ({ page }) => {
    await loginWithRetry(page, "admin", "acme");
    await page.goto(NOTIFICATIONS);
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toBeVisible();

    // El test anterior ya marcó leído el aviso del seed; este caso valida que
    // los filtros cambian la bandeja sin salir de la ruta, sin depender del orden.
    await page.getByRole("button", { name: /Sin leer/ }).first().click();
    await expect(page).toHaveURL(/#\/notifications$/);

    await page.getByRole("button", { name: /Alertas/ }).first().click();
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /Todas/ }).first().click();
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/notifications$/);
  });

  test("[PLAT-07] borrar un aviso lo quita del listado", async ({ page }) => {
    await loginWithRetry(page, "admin", "acme");
    await page.goto(NOTIFICATIONS);
    const notice = page.getByText("Cuenta de prueba E2E", { exact: true });
    await expect(notice).toBeVisible();

    // El botón de borrar vive en la misma fila que el aviso.
    const row = page
      .locator("div")
      .filter({ has: page.getByText("Cuenta de prueba E2E", { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Eliminar" }) })
      .last();
    await row.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toHaveCount(0, { timeout: 20_000 });
    await expect(page).toHaveURL(/#\/notifications$/);
  });
});
