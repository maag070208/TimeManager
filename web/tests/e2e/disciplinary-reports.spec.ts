import { expect, test, type Page } from "@playwright/test";
import { ACME } from "./helpers";
import {
  adminSession,
  createDisciplinaryReport,
  createStaffAccount,
  dialog,
  loginClient,
  openClientRoute,
  rowAction,
  tableRowWith,
  type CreatedAccount,
} from "./rh-fixtures";

/**
 * HR-02 · Actas administrativas (lista) + HR-M02 · nueva acta
 * HR-03 · detalle del acta + HR-M03 · eliminar acta
 *
 * El alta se hace por API porque el selector de empleado del modal tiene un
 * defecto real: `usePeopleOptions` entrega `{id,name}` y el `ITSearchSelect`
 * espera `{value,label}`, así que las opciones se pintan vacías y no se puede
 * elegir persona. El modal sí se cubre (abrir, validación y cancelar); el resto
 * del flujo (lista, detalle y baja) se prueba con el acta ya creada.
 */

test.describe.configure({ retries: 1 });

const setupPerson = async (
  request: Parameters<typeof adminSession>[0]
): Promise<{ person: CreatedAccount; createActa: (description: string) => Promise<void> }> => {
  const session = await adminSession(request);
  const person = await createStaffAccount(request, session);
  return {
    person,
    createActa: async (description: string) => {
      await createDisciplinaryReport(request, session, person.id, description);
    },
  };
};

const openReports = async (page: Page): Promise<void> => {
  await openClientRoute(page, "/employees/disciplinary-reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reportes de personal" })).toBeVisible();
};

test.describe("Actas administrativas (CLIENT_ADMIN)", () => {
  test("[HR-02][HR-M02] la lista carga y el modal de acta valida y cancela", async ({ page }) => {
    await loginClient(page, "admin");
    await openReports(page);

    // KPIs/filtros de la lista y actas sembradas.
    for (const label of ["Total", "Este mes", "Inasistencias", "Retardos"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });

    // Modal: sin empleado no deja guardar.
    await page.getByRole("button", { name: "Nuevo reporte", exact: true }).click();
    const modal = dialog(page);
    await expect(modal.getByText("Nueva acta administrativa")).toBeVisible();
    await modal.getByRole("button", { name: "Guardar acta" }).click();
    await expect(modal.getByText("Selecciona un empleado")).toBeVisible();

    // Cancelar cierra sin crear nada.
    await modal.getByRole("button", { name: "Cancelar" }).click();
    await expect(modal).toHaveCount(0);
  });

  test("[HR-03][ACT-17] abre el detalle del acta y descarga el PDF", async ({ page, request }) => {
    const { person, createActa } = await setupPerson(request);
    await createActa("Hecho de prueba E2E para el detalle del acta");

    await loginClient(page, "admin");
    await openReports(page);
    const row = tableRowWith(page, person.fullName);
    await expect(row).toBeVisible({ timeout: 20_000 });

    await rowAction(row, "Ver acta").click();
    await expect(page).toHaveURL(/\/employees\/disciplinary-reports\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Vista previa del acta" })).toBeVisible();
    await expect(page.getByText(/Hecho de prueba E2E para el detalle/).first()).toBeVisible();
    await expect(page.getByText("Llamada de atención", { exact: true }).first()).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar PDF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("[HR-02][HR-M03][ACT-17] eliminar el acta: cancelar no cambia y confirmar la quita", async ({ page, request }) => {
    const { person, createActa } = await setupPerson(request);
    await createActa("Acta para eliminar en E2E");

    await loginClient(page, "admin");
    await openReports(page);
    const row = tableRowWith(page, person.fullName);
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Cancelar conserva el acta.
    await rowAction(row, "Eliminar").click();
    const modal = dialog(page);
    await expect(modal.getByText(`¿Eliminar el acta administrativa de ${person.fullName}?`)).toBeVisible();
    await modal.getByRole("button", { name: "Cancelar" }).click();
    await expect(modal).toHaveCount(0);
    await expect(tableRowWith(page, person.fullName)).toBeVisible();

    // Confirmar la elimina.
    await rowAction(row, "Eliminar").click();
    await dialog(page).getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(tableRowWith(page, person.fullName)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[HR-02] un rol sin hr.records no entra a las actas", async ({ page }) => {
    await loginClient(page, "staff");
    await page.goto(`${ACME.base}/#/employees/disciplinary-reports`);
    await expect(page).not.toHaveURL(/employees\/disciplinary-reports/);
    await expect(page.getByRole("heading", { level: 1, name: "Reportes de personal" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Sergio" })).toBeVisible({ timeout: 20_000 });
  });
});
