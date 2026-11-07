import { expect, test, type Page } from "@playwright/test";
import {
  PNG_BUFFER,
  adminSession,
  createDocumentType,
  createStaffAccount,
  dialog,
  floatingOption,
  loginClient,
  openClientRoute,
  uniqueRef,
  type ApiSession,
  type CreatedAccount,
} from "./rh-fixtures";

/**
 * EMP-04 · Expediente del empleado y EMP-05 · Edición del expediente.
 *
 * Cubre los tabs (Actividad / Documentos / Reloj checador / Datos del empleado),
 * la subida y eliminación de documentos, la credencial, el alta en el reloj con
 * su confirmación, el diálogo de huella (sin estación configurada muestra su
 * error), la baja/reactivación desde la ficha y la edición con validaciones.
 * Cada prueba crea su propia persona por API para no depender de otras suites.
 */

test.describe.configure({ retries: 1 });

const setupPerson = async (
  request: Parameters<typeof adminSession>[0]
): Promise<{ session: ApiSession; person: CreatedAccount }> => {
  const session = await adminSession(request);
  const person = await createStaffAccount(request, session);
  return { session, person };
};

/** Abre la ficha del expediente y espera el héroe. */
const openDetail = async (page: Page, person: CreatedAccount): Promise<void> => {
  await openClientRoute(page, `/employees/${person.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Información del Personal" })).toBeVisible();
  await expect(page.getByText(person.fullName).first()).toBeVisible();
};

const tab = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).first();

test.describe("Expediente del empleado (CLIENT_ADMIN)", () => {
  test("[EMP-04][EMP-04-T1][EMP-04-T4] la ficha carga y los tabs de Actividad y Datos funcionan", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    await loginClient(page, "admin");
    await openDetail(page, person);

    // Acciones de cabecera según permisos del CLIENT_ADMIN.
    await expect(page.getByRole("button", { name: "Credencial" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dar de baja" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar Información" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cuenta y acceso" })).toBeVisible();

    // Tab por defecto: Actividad (KPIs de documentos/checadas/actas + horario vigente).
    await expect(tab(page, "Actividad")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Documentos", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Horario vigente|Sin horario asignado/)).toBeVisible();

    // Tab Datos del empleado: grupos de identificación, contacto, domicilio, fiscal y médica.
    await tab(page, "Datos del empleado").click();
    await expect(page.getByText("Identificación", { exact: true })).toBeVisible();
    await expect(page.getByText("Contacto", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dirección", { exact: true })).toBeVisible();
    await expect(page.getByText("Fiscal", { exact: true })).toBeVisible();

    // Tab Documentos: tarjetas por tipo de documento (puede no haber tipos configurados).
    await tab(page, "Documentos").click();
    await expect(page.getByText(/No hay tipos de documento|Todo en orden|documentos por subir/)).toBeVisible();
  });

  test("[EMP-04][EMP-04-T2][ACT-16] sube y elimina un documento del expediente", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    // Tipo de documento único (obligatorio) para que la ficha lo muestre como pendiente.
    const docType = await createDocumentType(request, { required: true });

    await loginClient(page, "admin");
    await openDetail(page, person);
    await tab(page, "Documentos").click();

    const card = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: docType.name }) })
      .filter({ has: page.locator('input[type="file"]') })
      .last();
    await expect(card).toBeVisible();

    // Subida real por el dropfile: el archivo entra por el input oculto.
    const fileName = `documento-${uniqueRef("DOC").toLowerCase()}.png`;
    await card.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });
    await expect(card.getByText(fileName)).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText("Cargado", { exact: true })).toBeVisible();

    // El borrado de documento no pide confirmación (comportamiento actual).
    await card.getByRole("button", { name: "Eliminar" }).click();
    await expect(card.getByText(fileName)).toHaveCount(0);
    await expect(card.getByText("Pendiente", { exact: true })).toBeVisible();
  });

  test("[EMP-04][EMP-M07] la credencial se previsualiza y se descarga", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    await loginClient(page, "admin");
    await openDetail(page, person);

    await page.getByRole("button", { name: "Credencial" }).click();
    const credential = dialog(page);
    await expect(credential.getByText("Credencial de empleado")).toBeVisible();
    const downloadButton = credential.getByRole("button", { name: "Descargar imagen" });
    await expect(downloadButton).toBeEnabled({ timeout: 20_000 });

    const download = page.waitForEvent("download");
    await downloadButton.click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/credencial/i);

    // El diálogo del kit cierra con Escape (la X usa una etiqueta del kit).
    await page.keyboard.press("Escape");
    await expect(credential).toHaveCount(0);
  });

  test("[EMP-04][EMP-04-T3][EMP-M08][EMP-M09] alta en el reloj y diálogo de huella", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    await loginClient(page, "admin");
    await openDetail(page, person);
    await tab(page, "Reloj checador").click();

    // Estado inicial: la persona no está dada de alta en el reloj de prueba.
    const altaButton = page.getByRole("button", { name: "Dar de alta en el reloj" });
    await expect(altaButton).toBeVisible({ timeout: 20_000 });

    // Cancelar no cambia el estado.
    await altaButton.click();
    const confirm = dialog(page);
    await expect(confirm.getByText(/^Dar de alta en /)).toBeVisible();
    await confirm.getByRole("button", { name: "No", exact: true }).click();
    await expect(confirm).toHaveCount(0);
    await expect(altaButton).toBeVisible();

    // Confirmar el alta en el reloj de prueba.
    await altaButton.click();
    await dialog(page).getByRole("button", { name: "Dar de alta en el reloj" }).click();
    await expect(page.getByText(/quedó dada de alta en/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Dada de alta", { exact: true })).toBeVisible();

    // Huellas: con el dedo elegido se abre el diálogo de captura. Sin estación
    // configurada en el stack E2E el diálogo muestra su error y se puede cerrar.
    await expect(page.getByText("Huellas", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: /Registrar dedo 1/ }).click();
    const fingerprint = dialog(page);
    await expect(fingerprint.getByText(/Registrar el dedo 1 en /)).toBeVisible();
    await expect(fingerprint.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await expect(fingerprint.getByRole("alert")).toContainText(/No se pudo completar|estación/i);
    await fingerprint.getByRole("button", { name: "Cancelar" }).click();
    await expect(fingerprint).toHaveCount(0);
  });

  test("[EMP-04][EMP-M03][ACT-15] baja con motivo (validación) y reactivación desde la ficha", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    await loginClient(page, "admin");
    await openDetail(page, person);

    await page.getByRole("button", { name: "Dar de baja" }).click();
    const deactivate = dialog(page);
    await expect(page.getByRole("alertdialog")).toContainText(`¿Dar de baja a ${person.fullName}?`);

    // Motivo corto: confirmar deshabilitado y mensaje del mínimo.
    await deactivate.locator('textarea[name="deactivate_reason"]').fill("ab");
    await expect(deactivate.getByText(/al menos 3 caracteres/)).toBeVisible();
    await expect(deactivate.getByRole("button", { name: "Dar de baja" })).toBeDisabled();

    // Cancelar no cambia el estado.
    await deactivate.getByRole("button", { name: "Cancelar" }).click();
    await expect(deactivate).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dar de baja" })).toBeVisible();

    // Confirmar con motivo válido.
    await page.getByRole("button", { name: "Dar de baja" }).click();
    await dialog(page).locator('textarea[name="deactivate_reason"]').fill("Baja E2E desde ficha");
    await dialog(page).getByRole("button", { name: "Dar de baja" }).click();
    await expect(page.getByRole("button", { name: "Reactivar" })).toBeVisible({ timeout: 20_000 });

    // Reactivar la devuelve a activo.
    await page.getByRole("button", { name: "Reactivar" }).click();
    await expect(page.getByRole("button", { name: "Dar de baja" })).toBeVisible({ timeout: 20_000 });
  });

  test("[EMP-04][EMP-05][ACT-13] edita el expediente, valida el RFC y persiste los cambios", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    await loginClient(page, "admin");
    await openDetail(page, person);

    await page.getByRole("button", { name: "Editar Información" }).click();
    await expect(page).toHaveURL(/\/employees\/[^/]+\/edit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Editar Información" })).toBeVisible();

    // Validación fiscal: un RFC inválido bloquea el guardado.
    await page.locator('input[name="rfc"]').fill("ABC");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator('input[name="rfc"]')).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/edit$/);
    await page.locator('input[name="rfc"]').fill("");

    // Cambios válidos: puesto, modo de checada y departamento.
    const puesto = `${person.jobTitle} EDITADO`;
    await page.locator('input[name="jobTitle"]').fill(puesto);
    await page.locator('input[name="checkinMode"]').click();
    await floatingOption(page, "Solo reloj físico").click();
    await page.locator('input[name="departmentId"]').click();
    await floatingOption(page, "Operaciones").click();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).not.toHaveURL(/\/edit$/);

    // La ficha muestra el puesto actualizado.
    await expect(page.getByText(puesto).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Expediente del empleado (HUMAN_RESOURCES)", () => {
  test("[EMP-04][EMP-04-T2][EMP-04-T4] RR. HH. abre la ficha y navega sus tabs", async ({ page, request }) => {
    const { person } = await setupPerson(request);
    await loginClient(page, "rh");
    await openDetail(page, person);
    await tab(page, "Documentos").click();
    await expect(page.getByText(/No hay tipos de documento|Todo en orden|documentos por subir/)).toBeVisible();
    await tab(page, "Datos del empleado").click();
    await expect(page.getByText("Identificación", { exact: true })).toBeVisible();
  });
});
