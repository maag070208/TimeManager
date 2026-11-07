import { expect, test } from "@playwright/test";
import {
  acceptRecordAgreement,
  adminSession,
  apiLogin,
  createStaffAccount,
  floatingOption,
  loginClient,
  openClientRoute,
  uniqueRef,
  type CreatedAccount,
} from "./rh-fixtures";
import { ACME } from "./helpers";

/**
 * HR-06 · Convenios y acuerdos (RH) y ACT-19 registrar/firmar convenio.
 *
 * Cubre el convenio de distribución del art. 58 (validación de evidencia ≥20 y
 * alta) y la firma patronal del acuerdo de método de registro (el trabajador lo
 * acepta antes por API, como lo haría desde su portal).
 */

test.describe.configure({ retries: 1 });

const newAcceptedWorker = async (
  request: Parameters<typeof adminSession>[0]
): Promise<CreatedAccount> => {
  const admin = await adminSession(request);
  const person = await createStaffAccount(request, admin);
  // El trabajador acepta el acuerdo de método de registro con su propia sesión.
  const worker = await apiLogin(request, person.username, "acme");
  await acceptRecordAgreement(request, worker);
  return person;
};

test.describe("Convenios y acuerdos (CLIENT_ADMIN)", () => {
  test("[HR-06][ACT-19] registra un convenio de distribución con evidencia obligatoria", async ({ page, request }) => {
    const admin = await adminSession(request);
    const person = await createStaffAccount(request, admin);
    await loginClient(page, "admin");
    await openClientRoute(page, "/hr/jornada-acuerdos");

    await expect(page.getByRole("heading", { level: 1, name: "Convenios y acuerdos" })).toBeVisible();
    for (const label of ["Convenios", "Pendientes de aceptación", "Acuerdos de método", "Firma patronal pendiente"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // Persona del convenio (selector con búsqueda).
    await page.locator('input[name="agreementUser"]').click();
    await floatingOption(page, person.fullName).click();

    // Evidencia corta: el alta queda deshabilitada.
    const evidence = page.locator('textarea[name="agreementEvidence"]');
    await evidence.fill("corto");
    await expect(page.getByRole("button", { name: "Registrar convenio" })).toBeDisabled();

    // Evidencia suficiente: registra y aparece como pendiente de aceptación.
    await evidence.fill(`Evidencia E2E ${uniqueRef("CONV")} con fecha, firmantes y referencia del documento`);
    await page.getByRole("button", { name: "Registrar convenio" }).click();
    await expect(page.getByText(/Convenio registrado/)).toBeVisible({ timeout: 20_000 });
    // La convención aparece en la lista de convenios registrados (no en el <option> del selector).
    const created = page
      .locator("div")
      .filter({ hasText: person.fullName })
      .filter({ hasText: "Pendiente de aceptación" })
      .last();
    await expect(created).toBeVisible({ timeout: 20_000 });
  });

  test("[HR-06][ACT-19] firma como patrón el acuerdo de método de registro", async ({ page, request }) => {
    const person = await newAcceptedWorker(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/hr/jornada-acuerdos");

    // El acuerdo del trabajador aparece pendiente de la firma patronal.
    await expect(page.getByText("Acuerdos de método de registro")).toBeVisible();
    const recordRow = page
      .locator("div")
      .filter({ hasText: person.fullName })
      .filter({ hasText: /Firma patronal pendiente|Firmado por patrón/ })
      .last();
    await expect(recordRow).toBeVisible({ timeout: 20_000 });
    await expect(recordRow.getByText("Firma patronal pendiente")).toBeVisible();
    await expect(recordRow.getByRole("button", { name: "Firmar como patrón" })).toBeVisible();

    await recordRow.getByRole("button", { name: "Firmar como patrón" }).click();
    // El efecto visible: la fila pasa a "Firmado por patrón" (el botón desaparece).
    await expect(page.getByText("Firmado por patrón").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Convenios y acuerdos (gating)", () => {
  test("[HR-06] el personal sin time_clock.write no entra a convenios", async ({ page }) => {
    await loginClient(page, "staff");
    await page.goto(`${ACME.base}/#/hr/jornada-acuerdos`);
    await expect(page).not.toHaveURL(/\/hr\/jornada-acuerdos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Sergio" })).toBeVisible({ timeout: 20_000 });
  });
});
