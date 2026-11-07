import { expect, test, type Page } from "@playwright/test";
import { ACME, loginAs } from "./helpers";

/**
 * Pantalla Personal en viewport móvil (proyecto `mobile`, Pixel 7).
 * Solo comprueba que el cliente puede entrar y operar lo esencial: ver la
 * lista y abrir el diálogo de cuenta de una fila.
 */

test.describe.configure({ retries: 1 });

const EMPLOYEES = `${ACME.base}/#/employees`;
const PERSONAL = { level: 1 as const, name: "Personal" };

async function openEmployees(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(EMPLOYEES);
    const visible = await page
      .getByRole("heading", PERSONAL)
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await expect(page.locator("tbody tr").first()).toBeVisible();
      return;
    }
  }
  await expect(page.getByRole("heading", PERSONAL)).toBeVisible();
}

test.describe("Personal en móvil", () => {
  test("[EMP-01][EMP-06][EMP-M01] el cliente entra, ve la lista y abre el diálogo de cuenta", async ({ page }) => {
    await loginAs(page, "admin", "acme");
    await openEmployees(page);

    await expect(page.getByRole("heading", PERSONAL)).toBeVisible();
    // Buscar deja una sola fila visible y alcanzable en pantalla chica.
    await page.locator('input[name="filter-name"]').fill("Sergio");
    const row = page.locator("tbody tr").filter({ hasText: "Sergio Staff" });
    await expect(row).toBeVisible();

    // Menú ⋯ de la fila → abrir la cuenta (URL propia del diálogo).
    await row.getByRole("button", { name: /^Más acciones de / }).click();
    await page.getByRole("menuitem", { name: "Cuenta: usuario, rol y correo" }).click();
    await expect(page).toHaveURL(/\/#\/employees\/[^/]+\/account$/);

    const dialog = page.locator('[data-it-dialog="true"]');
    await expect(dialog.getByRole("heading", { name: "Editar usuario" })).toBeVisible();
    await expect(dialog.locator('input[name="u_username"]')).toHaveValue("acme.staff");
    // La organización también es alcanzable en el teléfono.
    await expect(dialog.locator('input[name="u_dept"]')).toHaveValue("Operaciones");

    // Cerrar sin cambios abre la ficha de la persona.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/#\/employees\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Información del Personal" })).toBeVisible();
  });
});
