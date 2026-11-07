import { expect, test, type Page } from "@playwright/test";
import {
  createDocumentType,
  dialog,
  loginClient,
  loginPlatformAsAcme,
  openClientRoute,
  openPlatformRoute,
  rowAction,
  tableRowWith,
  uniqueRef,
} from "./rh-fixtures";

/**
 * HR-04 · Catálogo de Documentos + HR-M04 activar/desactivar + HR-M05 eliminar.
 *
 * `catalogs.manage` es exclusivo del ADMIN de plataforma (L-07): el alta/edición
 * se prueba operando como el cliente acme desde la consola de plataforma
 * ("Entrar", impersonación auditada). El cliente (RH) ve la pantalla en solo
 * lectura. Alta y edición son un formulario inline, no un modal; las bajas sí
 * piden confirmación.
 */

test.describe.configure({ retries: 1 });

const openCatalogAsPlatform = async (page: Page): Promise<void> => {
  await loginPlatformAsAcme(page);
  await openPlatformRoute(page, "/employees/catalogs/documents");
  await expect(page.getByRole("heading", { level: 1, name: "Catálogo de Documentos" })).toBeVisible();
};

const createType = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("button", { name: "Nuevo tipo", exact: true }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.locator('input[name="name"]')).toHaveCount(0);
  await expect(tableRowWith(page, name)).toBeVisible({ timeout: 20_000 });
};

test.describe("Catálogo de Documentos (ADMIN de plataforma operando acme)", () => {
  test("[HR-04] crea y edita un tipo de documento (formulario inline)", async ({ page }) => {
    await openCatalogAsPlatform(page);

    const name = `Documento ${uniqueRef("CAT")}`;
    await createType(page, name);

    // Editar: el formulario inline se abre precargado y guarda el nombre nuevo.
    await rowAction(tableRowWith(page, name), "Editar tipo de documento").click();
    const input = page.locator('input[name="name"]');
    await expect(input).toHaveValue(name);
    const edited = `${name} ED`;
    await input.fill(edited);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(tableRowWith(page, edited)).toBeVisible({ timeout: 20_000 });
    await expect(tableRowWith(page, name)).toHaveCount(0);
  });

  test("[HR-04] alterna obligatorio/opcional de un tipo", async ({ page }) => {
    await openCatalogAsPlatform(page);

    const name = `Obligatorio ${uniqueRef("CAT")}`;
    await createType(page, name);
    const row = tableRowWith(page, name);

    await expect(row.locator('button[title="Marcar como obligatorio"]')).toBeVisible();
    await row.locator('button[title="Marcar como obligatorio"]').click();
    await expect(row.locator('button[title="Marcar como opcional"]')).toBeVisible({ timeout: 20_000 });
    await row.locator('button[title="Marcar como opcional"]').click();
    await expect(row.locator('button[title="Marcar como obligatorio"]')).toBeVisible({ timeout: 20_000 });
  });

  test("[HR-04][HR-M04] desactivar/reactivar un tipo con confirmación", async ({ page }) => {
    await openCatalogAsPlatform(page);

    const name = `Estado ${uniqueRef("CAT")}`;
    await createType(page, name);
    const row = tableRowWith(page, name);

    // Cancelar no cambia el estado.
    await rowAction(row, "Desactivar").click();
    const modal = dialog(page);
    await expect(modal.getByText(name).first()).toBeVisible();
    await modal.getByRole("button", { name: "Cancelar" }).click();
    await expect(modal).toHaveCount(0);
    await expect(tableRowWith(page, name).getByText("Activo", { exact: true })).toBeVisible();

    // Confirmar lo deja inactivo.
    await rowAction(row, "Desactivar").click();
    await dialog(page).getByRole("button", { name: "Desactivar", exact: true }).click();
    await expect(tableRowWith(page, name).getByText("Inactivo", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Reactivar lo devuelve a activo.
    await rowAction(tableRowWith(page, name), "Reactivar").click();
    await dialog(page).getByRole("button", { name: "Reactivar", exact: true }).click();
    await expect(tableRowWith(page, name).getByText("Activo", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("[HR-04][HR-M05] eliminar definitivamente un tipo inactivo (cancelar/confirmar)", async ({ page }) => {
    await openCatalogAsPlatform(page);

    const name = `Borrar ${uniqueRef("CAT")}`;
    await createType(page, name);
    await rowAction(tableRowWith(page, name), "Desactivar").click();
    await dialog(page).getByRole("button", { name: "Desactivar", exact: true }).click();
    await expect(tableRowWith(page, name).getByText("Inactivo", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Cancelar conserva el tipo.
    await rowAction(tableRowWith(page, name), "Eliminar definitivamente").click();
    await expect(dialog(page).getByText(/Esto eliminará definitivamente/)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(tableRowWith(page, name)).toBeVisible();

    // Confirmar lo borra de la tabla.
    await rowAction(tableRowWith(page, name), "Eliminar definitivamente").click();
    await dialog(page).getByRole("button", { name: "Eliminar definitivamente", exact: true }).click();
    await expect(tableRowWith(page, name)).toHaveCount(0, { timeout: 20_000 });
  });
});

test.describe("Catálogo de Documentos (cliente en solo lectura)", () => {
  test("[HR-04] RR. HH. sin catalogs.manage ve el catálogo sin acciones", async ({ page, request }) => {
    // Un tipo creado por el ADMIN de plataforma debe verse desde RR. HH., pero sin editar.
    const type = await createDocumentType(request, { required: false });

    await loginClient(page, "rh");
    await openClientRoute(page, "/employees/catalogs/documents");
    await expect(page.getByRole("heading", { level: 1, name: "Catálogo de Documentos" })).toBeVisible();
    await expect(tableRowWith(page, type.name)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Nuevo tipo", exact: true })).toHaveCount(0);
    await expect(rowAction(tableRowWith(page, type.name), "Editar tipo de documento")).toHaveCount(0);
  });
});
