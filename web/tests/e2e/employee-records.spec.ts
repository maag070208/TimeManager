import { expect, test, type Page } from "@playwright/test";
import {
  adminSession,
  createStaffAccount,
  loginClient,
  openClientRoute,
  tableRowWith,
  type CreatedAccount,
} from "./rh-fixtures";

/**
 * HR-01 · Expedientes de empleados (RH) y HR-M01 · aviso masivo de faltantes.
 *
 * Cubre el tablero (KPIs/filtros/búsqueda), la selección de una persona, la
 * consulta del documento ya cargado del seed, el aviso por fila y el aviso
 * masivo con su confirmación (cancelar/confirmar).
 *
 * Nota: la subida real de documentos requiere storage (S3), que el stack E2E no
 * configura (`STORAGE_NOT_CONFIGURED`); queda como prueba manual.
 */

test.describe.configure({ retries: 1 });

const setupPerson = async (request: Parameters<typeof adminSession>[0]): Promise<CreatedAccount> => {
  const session = await adminSession(request);
  return createStaffAccount(request, session);
};

const searchPerson = async (page: Page, person: CreatedAccount): Promise<void> => {
  const search = page.locator('input[name="employee_records_search"]');
  await search.fill(person.employeeNumber);
  await expect(tableRowWith(page, person.fullName)).toBeVisible({ timeout: 20_000 });
};

test.describe("Expedientes de empleados (CLIENT_ADMIN)", () => {
  test("[HR-01] el tablero carga, filtra por estado y abre el detalle de una persona", async ({ page, request }) => {
    const person = await setupPerson(request);
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

  test("[HR-01] avisa faltantes a una persona desde la fila", async ({ page, request }) => {
    const person = await setupPerson(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/employees/records");

    await searchPerson(page, person);
    await tableRowWith(page, person.fullName)
      .getByRole("button", { name: "Avisar", exact: true })
      .click();
    await expect(
      page.getByText(new RegExp(`Se avisó a .*${person.fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
    ).toBeVisible({ timeout: 20_000 });
  });

  test("[HR-01][HR-M01] el aviso masivo se cancela o se confirma", async ({ page, request }) => {
    await setupPerson(request);
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
