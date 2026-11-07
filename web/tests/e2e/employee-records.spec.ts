import { expect, test, type Page } from "@playwright/test";
import {
  PNG_BUFFER,
  adminSession,
  createDocumentType,
  createStaffAccount,
  loginClient,
  openClientRoute,
  tableRowWith,
  type CreatedAccount,
} from "./rh-fixtures";

/**
 * HR-01 · Expedientes de empleados (RH) y HR-M01 · aviso masivo de faltantes.
 *
 * Cubre el tablero de expedientes (KPIs/filtros/búsqueda), la selección de una
 * persona, la subida de un documento faltante desde el panel, el aviso por fila
 * y el aviso masivo con su confirmación (cancelar/confirmar).
 * Los datos de cada prueba se crean por API con nombres únicos.
 */

test.describe.configure({ retries: 1 });

const setup = async (
  request: Parameters<typeof adminSession>[0]
): Promise<{ person: CreatedAccount; docType: { id: string; name: string } }> => {
  const session = await adminSession(request);
  const person = await createStaffAccount(request, session);
  const docType = await createDocumentType(request, { required: true });
  return { person, docType };
};

const searchPerson = async (page: Page, person: CreatedAccount): Promise<void> => {
  const search = page.locator('input[name="employee_records_search"]');
  await search.fill(person.employeeNumber);
  await expect(tableRowWith(page, person.fullName)).toBeVisible({ timeout: 20_000 });
};

test.describe("Expedientes de empleados (CLIENT_ADMIN)", () => {
  test("[HR-01] el tablero carga, filtra por estado y abre el detalle de una persona", async ({ page, request }) => {
    const { person } = await setup(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/employees/records");

    await expect(page.getByRole("heading", { level: 1, name: "Expedientes de empleados" })).toBeVisible();
    // Las tarjetas de filtro muestran etiqueta + conteo: se busca por prefijo.
    for (const label of ["Todos", "Faltan obligatorios", "Incompletos", "Completos"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${label}`) })).toBeVisible();
    }

    // Búsqueda + selección: el panel de detalle muestra a la persona.
    await searchPerson(page, person);
    const row = tableRowWith(page, person.fullName);
    await row.click();
    await expect(page.getByText("Expediente total")).toBeVisible();
    await expect(page.getByText(person.fullName).first()).toBeVisible();
    await expect(page.getByText(/Obligatorios · \d+ de \d+/)).toBeVisible();

    // Filtro por estado: con un obligatorio pendiente aparece en "Faltan obligatorios".
    await page.getByRole("button", { name: /^Faltan obligatorios/ }).click();
    await searchPerson(page, person);
    await expect(tableRowWith(page, person.fullName)).toBeVisible();
    await page.getByRole("button", { name: /^Completos/ }).click();
    await expect(tableRowWith(page, person.fullName)).toHaveCount(0);
    await page.getByRole("button", { name: /^Todos/ }).click();
    await searchPerson(page, person);
  });

  test("[HR-01][ACT-16] sube el documento obligatorio faltante desde el panel", async ({ page, request }) => {
    const { person, docType } = await setup(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/employees/records");

    await searchPerson(page, person);
    await tableRowWith(page, person.fullName).click();

    const docRow = page
      .locator("div")
      .filter({ hasText: docType.name })
      .filter({ has: page.getByRole("button", { name: "Subir", exact: true }) })
      .last();
    await expect(docRow).toBeVisible();
    await docRow.getByRole("button", { name: "Subir", exact: true }).click();

    // El tablero usa un input de archivo oculto (imagen/PDF).
    await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles({
      name: `expediente-${docType.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`,
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });

    await expect(page.getByText("Documento subido", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(docRow.getByRole("button", { name: "Ver", exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("[HR-01] avisa faltantes a una persona desde la fila", async ({ page, request }) => {
    const { person } = await setup(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/employees/records");

    await searchPerson(page, person);
    const row = tableRowWith(page, person.fullName);
    await row.getByRole("button", { name: "Avisar", exact: true }).click();
    await expect(page.getByText(new RegExp(`Se avisó a .*${person.fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible({
      timeout: 20_000,
    });
  });

  test("[HR-01][HR-M01] el aviso masivo se cancela o se confirma", async ({ page, request }) => {
    await setup(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/employees/records");

    const bulkButton = page.getByRole("button", { name: "Avisar a pendientes", exact: true });
    await expect(bulkButton).toBeEnabled({ timeout: 20_000 });

    // Cancelar: no se envía nada y el modal se cierra.
    await bulkButton.click();
    await expect(page.getByText(/Se enviará una notificación/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByText(/Se enviará una notificación/)).toHaveCount(0);
    await expect(bulkButton).toBeEnabled();

    // Confirmar: el API responde cuántos avisos mandó. El diálogo del kit no
    // expone data-it-dialog: su confirmar es el último botón con ese nombre.
    await bulkButton.click();
    await expect(page.getByText(/Se enviará una notificación/)).toBeVisible();
    await page.getByRole("button", { name: "Avisar a pendientes", exact: true }).last().click();
    await expect(page.getByText(/Se avisó a \d+ persona\(s\)/)).toBeVisible({ timeout: 30_000 });
  });
});
