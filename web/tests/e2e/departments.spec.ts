import { expect, test, type Page } from "@playwright/test";
import { gotoRoute, loginAcme } from "./ops-helpers";

/**
 * E2E-2 · Departamentos y subáreas (acme.admin).
 *
 * Cada test entra por el login y trabaja solo con datos que él mismo crea
 * (más los departamentos sembrados por `api/scripts/e2e-seed.ts`), así que no
 * depende del orden con otros archivos. El seed trunca la base en cada corrida.
 */

const createDepartment = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("button", { name: "Nuevo departamento" }).first().click();
  const dialog = page.locator('[data-it-dialog="true"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="newDept"]').fill(name);
  await dialog.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // La API guarda el nombre en mayúsculas.
  await expect(page.locator(`button[title="${name.toUpperCase()}"]`)).toBeVisible();
};

const tileOf = (page: Page, name: string) =>
  page.locator("section.it-bento-tile", {
    has: page.locator(`button[title="${name.toUpperCase()}"]`),
  });

test.describe("departamentos (acme.admin)", () => {
  test("lista los departamentos sembrados", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/departments");

    await expect(page.getByText("Estructura organizacional de tu empresa")).toBeVisible();
    for (const name of ["Recursos Humanos", "Operaciones", "Administración"]) {
      await expect(page.locator(`button[title="${name}"]`)).toBeVisible();
    }
    // Sin errores de carga.
    await expect(page.getByText("Error al cargar")).toHaveCount(0);
  });

  test("crea un departamento, abre su detalle y le agrega una subárea", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/departments");

    await createDepartment(page, "Nómina E2E");

    // Abrir el detalle haciendo clic en el nombre de la tarjeta.
    await page.locator('button[title="NÓMINA E2E"]').click();
    await expect(page).toHaveURL(/#\/departments\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Detalle del departamento")).toBeVisible();
    await expect(page.getByText("NÓMINA E2E").first()).toBeVisible();
    await expect(page.getByText("Activo").first()).toBeVisible();

    // Subárea desde el detalle.
    await page.locator('input[name="newSubarea"]').fill("Kiosco E2E");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText("Kiosco E2E")).toBeVisible();
  });

  test("edita el nombre de un departamento desde la lista", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/departments");

    await createDepartment(page, "Editable E2E");
    await tileOf(page, "Editable E2E").getByRole("button", { name: "Editar nombre" }).click();

    const dialog = page.locator('[data-it-dialog="true"]');
    await expect(dialog).toBeVisible();
    const input = dialog.locator('input[name="editDept"]');
    await expect(input).toHaveValue("EDITABLE E2E");
    await input.fill("Editable E2E Pro");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('button[title="EDITABLE E2E PRO"]')).toBeVisible();
    await expect(page.locator('button[title="EDITABLE E2E"]')).toHaveCount(0);
  });

  test("desactiva el departamento desde el detalle", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/departments");

    await createDepartment(page, "Baja E2E");
    await page.locator('button[title="BAJA E2E"]').click();
    await expect(page).toHaveURL(/#\/departments\/[0-9a-f-]{36}$/);
    // La vista de detalle monta después de cambiar el hash: esperar a su formulario.
    await expect(page.locator('input[name="newSubarea"]')).toBeVisible();

    await page.getByRole("button", { name: "Eliminar departamento" }).click();
    await expect(page.getByText(/¿Eliminar BAJA E2E\?/)).toBeVisible();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    // La baja es suave: vuelve a la lista y la tarjeta queda inactiva.
    await expect(page).toHaveURL(/#\/departments$/);
    await expect(tileOf(page, "Baja E2E").getByText("Inactivo")).toBeVisible();
  });

  test("abre la pantalla de subáreas", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/subareas");

    await expect(page.getByText("Sublugares dentro de cada departamento", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nueva subárea" })).toBeVisible();
    // La tabla del catálogo monta (vacía o con las subáreas creadas antes).
    await expect(page.getByRole("table").first()).toBeVisible();
    await expect(page.getByText("Error al cargar")).toHaveCount(0);
  });
});
