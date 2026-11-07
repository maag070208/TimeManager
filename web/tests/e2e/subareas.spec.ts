import { expect, test, type Page } from "@playwright/test";
import {
  dialog,
  floatingOption,
  loginClient,
  openClientRoute,
  tableRowWith,
  uniqueRef,
} from "./rh-fixtures";
import { ACME } from "./helpers";

/**
 * DEP-03 · Subáreas + DEP-M07 crear, DEP-M08 editar y DEP-M09 eliminar/desactivar.
 *
 * CRUD completo del catálogo de subáreas: alta (departamento + nombre
 * obligatorios), edición, baja lógica/reactivación y eliminación definitiva.
 * Se documenta el comportamiento actual de permisos (botones visibles sin
 * `departments.manage`; el API sí responde 403).
 */

test.describe.configure({ retries: 1 });

const row = (page: Page, name: string) => tableRowWith(page, name);

const openSubareas = async (page: Page): Promise<void> => {
  await openClientRoute(page, "/subareas");
  await expect(page.getByRole("heading", { level: 1, name: "Subáreas" })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible({ timeout: 20_000 });
};

const createSubarea = async (page: Page, department: string, name: string): Promise<void> => {
  await page.getByRole("button", { name: "Nueva subárea", exact: true }).click();
  const modal = dialog(page);
  await expect(modal.getByText("Nueva subárea").first()).toBeVisible();

  // Sin departamento ni nombre no se puede crear.
  await expect(modal.getByRole("button", { name: "Crear", exact: true })).toBeDisabled();
  await modal.locator('input[name="newDepartmentId"]').click();
  await floatingOption(page, department).click();
  await expect(modal.getByRole("button", { name: "Crear", exact: true })).toBeDisabled();
  await modal.locator('input[name="newName"]').fill(name);
  await modal.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(row(page, name)).toBeVisible({ timeout: 20_000 });
};

test.describe("Subáreas (CLIENT_ADMIN)", () => {
  test("[DEP-03][DEP-M07][ACT-20] crea una subárea y valida el formulario", async ({ page }) => {
    await loginClient(page, "admin");
    await openSubareas(page);

    // Cancelar no crea nada.
    await page.getByRole("button", { name: "Nueva subárea", exact: true }).click();
    await expect(dialog(page).getByText("Nueva subárea").first()).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);

    const name = `Subárea ${uniqueRef("SUB")}`;
    await createSubarea(page, "Operaciones", name);
    await expect(row(page, name)).toContainText("Operaciones");
  });

  test("[DEP-03][DEP-M08][ACT-20] edita el nombre de una subárea", async ({ page }) => {
    await loginClient(page, "admin");
    await openSubareas(page);
    const name = `Renombrar ${uniqueRef("SUB")}`;
    await createSubarea(page, "Operaciones", name);

    await row(page, name).getByRole("button", { name: "Editar nombre" }).click();
    const modal = dialog(page);
    await expect(modal.getByText("Editar subárea")).toBeVisible();
    const input = modal.locator('input[name="editName"]');
    await expect(input).toHaveValue(name);
    const renamed = `${name} PRO`;
    await input.fill(renamed);
    await modal.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(row(page, renamed)).toBeVisible({ timeout: 20_000 });
    await expect(row(page, name)).toHaveCount(0);
  });

  test("[DEP-03][DEP-M09][ACT-20] desactiva, reactiva y elimina definitivamente una subárea", async ({ page }) => {
    await loginClient(page, "admin");
    await openSubareas(page);
    const name = `Baja ${uniqueRef("SUB")}`;
    await createSubarea(page, "Administración", name);

    // Cancelar la baja no cambia el estado (ITConfirmDialog del kit: sin data-it-dialog).
    await row(page, name).getByRole("button", { name: "Eliminar subárea" }).click();
    await expect(page.getByText(/Se desactivará/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByText(/Se desactivará/)).toHaveCount(0);
    await expect(row(page, name).getByText("inactiva")).toHaveCount(0);

    // Confirmar: baja lógica.
    await row(page, name).getByRole("button", { name: "Eliminar subárea" }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(row(page, name).getByText("inactiva")).toBeVisible({ timeout: 20_000 });

    // Reactivar: acción directa sin confirmación.
    await row(page, name).getByRole("button", { name: "Reactivar", exact: true }).click();
    await expect(row(page, name).getByText("inactiva")).toHaveCount(0, { timeout: 20_000 });

    // Desactivar de nuevo y eliminar definitivamente.
    await row(page, name).getByRole("button", { name: "Eliminar subárea" }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(row(page, name).getByText("inactiva")).toBeVisible({ timeout: 20_000 });
    await row(page, name).getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(page.getByText(/Eliminar definitivamente la subárea/)).toBeVisible();
    await page.getByRole("button", { name: "Eliminar definitivamente", exact: true }).click();
    await expect(row(page, name)).toHaveCount(0, { timeout: 20_000 });
  });
});

test.describe("Subáreas (permisos)", () => {
  test("[DEP-03] RR. HH. sin departments.manage: el API rechaza la creación", async ({ page }) => {
    await loginClient(page, "rh");
    await openClientRoute(page, "/subareas");
    await expect(page.getByRole("heading", { level: 1, name: "Subáreas" })).toBeVisible();

    // Comportamiento actual (hueco de UI): el botón se muestra aunque el rol no
    // tenga `departments.manage`; el API corta con 403 y la pantalla avisa.
    await page.getByRole("button", { name: "Nueva subárea", exact: true }).click();
    const modal = dialog(page);
    await modal.locator('input[name="newDepartmentId"]').click();
    await floatingOption(page, "Operaciones").click();
    await modal.locator('input[name="newName"]').fill(`Sin permiso ${uniqueRef("SUB")}`);
    await modal.getByRole("button", { name: "Crear", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /permiso|403|No tienes/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(`${ACME.base}/#/subareas`);
  });
});
