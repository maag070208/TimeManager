import { expect, test, type Page } from "@playwright/test";
import { loginClient, openClientRoute } from "./rh-fixtures";

/**
 * DEP-01 · Departamentos + DEP-M01..M03 (alta, edición, baja/eliminación)
 * DEP-02 · Detalle del departamento + DEP-M04..M06 (subáreas y baja del depto)
 * DEP-03 · Subáreas (aquí solo la navegación; su CRUD vive en `subareas.spec.ts`)
 *
 * Cada prueba entra por el login y trabaja con datos que ella misma crea (más
 * los departamentos sembrados por `api/scripts/e2e-seed.ts`), sin depender del
 * orden con otros archivos.
 */

const dialogOf = (page: Page) => page.locator('[data-it-dialog="true"]');

const createDepartment = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("button", { name: "Nuevo departamento" }).first().click();
  const dialog = dialogOf(page);
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

const openDetail = async (page: Page, name: string): Promise<void> => {
  await page.locator(`button[title="${name.toUpperCase()}"]`).click();
  await expect(page).toHaveURL(/#\/departments\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Detalle del departamento")).toBeVisible();
};

test.describe("departamentos (acme.admin)", () => {
  test("[DEP-01] lista los departamentos sembrados", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/departments");

    await expect(page.getByText("Estructura organizacional de tu empresa")).toBeVisible();
    for (const name of ["Recursos Humanos", "Operaciones", "Administración"]) {
      await expect(page.locator(`button[title="${name}"]`)).toBeVisible();
    }
    await expect(page.getByText("Error al cargar")).toHaveCount(0);
  });

  test("[DEP-01][DEP-M01][DEP-02][ACT-20] crea un departamento, abre su detalle y le agrega una subárea", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/departments");

    await createDepartment(page, "Nómina E2E");
    await openDetail(page, "Nómina E2E");
    await expect(page.getByText("NÓMINA E2E").first()).toBeVisible();
    await expect(page.getByText("Activo").first()).toBeVisible();

    // Subárea desde el detalle.
    await page.locator('input[name="newSubarea"]').fill("Kiosco E2E");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText("Kiosco E2E")).toBeVisible();
  });

  test("[DEP-01][DEP-M02][ACT-20] edita el nombre de un departamento desde la lista", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/departments");

    await createDepartment(page, "Editable E2E");
    await tileOf(page, "Editable E2E").getByRole("button", { name: "Editar nombre" }).click();

    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    const input = dialog.locator('input[name="editDept"]');
    await expect(input).toHaveValue("EDITABLE E2E");
    await input.fill("Editable E2E Pro");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('button[title="EDITABLE E2E PRO"]')).toBeVisible();
    await expect(page.locator('button[title="EDITABLE E2E"]')).toHaveCount(0);
  });

  test("[DEP-01][DEP-M03][ACT-20] baja lógica y eliminación definitiva desde la lista", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/departments");
    await createDepartment(page, "Borrar E2E");
    const tile = tileOf(page, "Borrar E2E");

    // Cancelar la baja: el departamento sigue activo.
    await tile.getByRole("button", { name: "Eliminar departamento" }).click();
    await expect(dialogOf(page).getByText(/Se desactivará/)).toBeVisible();
    await dialogOf(page).getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(tileOf(page, "Borrar E2E").getByText("Inactivo")).toHaveCount(0);

    // Confirmar: baja lógica (la tarjeta queda inactiva).
    await tileOf(page, "Borrar E2E").getByRole("button", { name: "Eliminar departamento" }).click();
    await dialogOf(page).getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(tileOf(page, "Borrar E2E").getByText("Inactivo")).toBeVisible({ timeout: 20_000 });

    // Eliminación definitiva: ahora el diálogo lo advierte y la tarjeta desaparece.
    await tileOf(page, "Borrar E2E").getByRole("button", { name: "Eliminar departamento" }).click();
    await expect(dialogOf(page).getByText(/definitivamente/)).toBeVisible();
    await expect(dialogOf(page).getByText(/Esta acción no se puede deshacer/)).toBeVisible();
    await dialogOf(page).getByRole("button", { name: "Eliminar definitivamente", exact: true }).click();
    await expect(page.locator('button[title="BORRAR E2E"]')).toHaveCount(0, { timeout: 20_000 });
  });

  test("[DEP-02][DEP-M06][ACT-20] desactiva el departamento desde el detalle", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/departments");

    await createDepartment(page, "Baja E2E");
    await openDetail(page, "Baja E2E");
    // La vista de detalle monta después de cambiar el hash: esperar su formulario.
    await expect(page.locator('input[name="newSubarea"]')).toBeVisible();

    await page.getByRole("button", { name: "Eliminar departamento" }).click();
    await expect(page.getByText(/¿Eliminar BAJA E2E\?/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByText(/¿Eliminar BAJA E2E\?/)).toHaveCount(0);
    await page.getByRole("button", { name: "Eliminar departamento" }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    // La baja es suave: vuelve a la lista y la tarjeta queda inactiva.
    await expect(page).toHaveURL(/#\/departments$/);
    await expect(tileOf(page, "Baja E2E").getByText("Inactivo")).toBeVisible();
  });

  test("[DEP-02][DEP-M04][DEP-M05][ACT-20] detalle: editar, quitar y reactivar una subárea", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/departments");
    await createDepartment(page, "Subáreas E2E");
    await openDetail(page, "Subáreas E2E");
    await expect(page.locator('input[name="newSubarea"]')).toBeVisible();

    // Alta de subárea desde el detalle.
    await page.locator('input[name="newSubarea"]').fill("Almacén E2E");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText("Almacén E2E")).toBeVisible();

    // DEP-M04: renombrar (diálogo con el nombre precargado).
    await page.getByTitle("Editar subárea").first().click();
    const edit = dialogOf(page);
    await expect(edit.getByText("Renombrar subárea")).toBeVisible();
    const input = edit.locator('input[name="editSubarea"]');
    await expect(input).toHaveValue("Almacén E2E");
    await input.fill("Almacén E2E Pro");
    await edit.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Almacén E2E Pro")).toBeVisible();

    // DEP-M05: cancelar la baja no cambia nada; confirmar la desactiva.
    await page.getByTitle("Eliminar subárea").first().click();
    await expect(page.getByText(/Se desactivará/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByText(/Se desactivará/)).toHaveCount(0);
    await expect(page.getByText("Almacén E2E Pro")).toBeVisible();
    await expect(page.getByText("Inactiva", { exact: true })).toHaveCount(0);

    await page.getByTitle("Eliminar subárea").first().click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText("Inactiva", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Reactivación directa y eliminación definitiva de la subárea inactiva.
    await page.getByTitle("Reactivar subárea").first().click();
    await expect(page.getByText("Inactiva", { exact: true })).toHaveCount(0, { timeout: 20_000 });
    await page.getByTitle("Eliminar subárea").first().click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText("Inactiva", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByTitle("Eliminar subárea").first().click();
    await expect(page.getByText(/definitivamente la subárea/)).toBeVisible();
    await page.getByRole("button", { name: "Eliminar definitivamente", exact: true }).click();
    await expect(page.getByText("Almacén E2E Pro")).toHaveCount(0, { timeout: 20_000 });
  });

  test("[DEP-01][DEP-02] RR. HH. sin departments.manage ve la organización en solo lectura", async ({ page }) => {
    await loginClient(page, "rh");
    await openClientRoute(page, "/departments");
    await expect(page.locator('button[title="Operaciones"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuevo departamento" })).toHaveCount(0);

    // El detalle carga (la ruta no tiene gate) pero sin acciones de escritura.
    await openDetail(page, "Operaciones");
    await expect(page.getByRole("button", { name: "Eliminar departamento" })).toHaveCount(0);
    await expect(page.locator('input[name="newSubarea"]')).toHaveCount(0);
  });

  test("[DEP-03] abre la pantalla de subáreas", async ({ page }) => {
    await loginClient(page, "admin");
    await openClientRoute(page, "/subareas");

    await expect(page.getByText("Sublugares dentro de cada departamento", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nueva subárea" })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
    await expect(page.getByText("Error al cargar")).toHaveCount(0);
  });
});
