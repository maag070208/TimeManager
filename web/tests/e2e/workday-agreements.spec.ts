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

    await expect(page.getByRole("heading", { level: 1, name: "Acuerdos con el personal" })).toBeVisible();
    await expect(page.getByText("Nuevo acuerdo de jornada")).toBeVisible();

    // Persona del convenio (selector con búsqueda).
    await page.locator('input[name="agreementUser"]').click();
    await floatingOption(page, person.fullName).click();

    // Evidencia corta: el alta queda deshabilitada.
    const evidence = page.locator('textarea[name="agreementEvidence"]');
    await evidence.fill("corto");
    await expect(page.getByRole("button", { name: "Guardar y pedir aceptación" })).toBeDisabled();

    // Evidencia suficiente: registra y aparece como pendiente de aceptación.
    await evidence.fill(`Evidencia E2E ${uniqueRef("CONV")} con fecha, firmantes y referencia del documento`);
    await page.getByRole("button", { name: "Guardar y pedir aceptación" }).click();
    await expect(page.getByText(/ya puede aceptarlo desde Mi jornada/)).toBeVisible({ timeout: 20_000 });
    // La convención aparece en la lista de convenios registrados (no en el <option> del selector).
    const created = page
      .locator("div")
      .filter({ hasText: person.fullName })
      .filter({ hasText: "Esperando que la persona acepte" })
      .last();
    await expect(created).toBeVisible({ timeout: 20_000 });
  });

  test("[HR-06][ACT-19] firma como patrón el acuerdo de método de registro", async ({ page, request }) => {
    const person = await newAcceptedWorker(request);
    await loginClient(page, "admin");
    await openClientRoute(page, "/hr/jornada-acuerdos");

    // El acuerdo del trabajador aparece pendiente de la firma patronal.
    await page.getByRole("button", { name: /Forma de registro/ }).click();
    const recordRow = page
      .locator("div")
      .filter({ hasText: person.fullName })
      .filter({ has: page.getByRole("button", { name: "Firmar", exact: true }) })
      .last();
    await expect(recordRow).toBeVisible({ timeout: 20_000 });

    await recordRow.getByRole("button", { name: "Firmar", exact: true }).click();
    // El efecto visible: la fila pasa a "Firmado por la empresa" (el botón desaparece).
    const signedRow = page
      .locator("div")
      .filter({ hasText: person.fullName })
      .filter({ hasText: "Firmado por la empresa" })
      .last();
    await expect(signedRow).toBeVisible({ timeout: 20_000 });
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
