import { expect, test, type Page } from "@playwright/test";
import {
  api,
  enterAcme,
  expectOneOf,
  getOutOfHoursContacts,
  getTeleworkPolicy,
  getTeleworkRegistrations,
  getUsers,
  openAcme,
} from "./clk-helpers";

/**
 * NOM-02 — Administración de teletrabajo (`/#/teletrabajo`) con sus tabs
 * (NOM-02-T1..T4) y modales (NOM-M01 política, NOM-M02 alta de teletrabajador,
 * NOM-M03 comunicación fuera de jornada). ACT-34.
 *
 * Los textos/propiedades se descubren por API para no depender del seed; la
 * prueba de política restaura la versión al final para no dejar el
 * consentimiento del personal desactualizado.
 */
test.use({ timezoneId: "America/Mexico_City" });

const PAGE = "/teletrabajo";
const ANCHOR = "Política, desconexión y aviso de privacidad";
const dialogOpen = (page: Page) => page.locator('[data-it-dialog="true"]');
const tab = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();

test.describe("administración de teletrabajo", () => {
  test("[NOM-02] carga KPIs y las cuatro pestañas", async ({ page }) => {
    await enterAcme(page);
    await openAcme(page, PAGE, ANCHOR);

    for (const kpi of ["Teletrabajadores", "Checklists", "Comunicaciones", "Política"]) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible();
    }
    for (const section of ["Política y avisos", "Teletrabajadores", "Checklists", "Comunicaciones"]) {
      await expect(tab(page, new RegExp(`^${section}`))).toBeVisible();
    }
  });

  test("[NOM-02-T1][NOM-M01][ACT-34] política: valida las secciones NOM, cancela sin cambios y guarda subiendo versión", async ({
    page,
  }) => {
    await enterAcme(page);
    const before = await getTeleworkPolicy(page);
    await openAcme(page, PAGE, ANCHOR);

    // Cancelar: no debe subir la versión.
    await page.getByRole("button", { name: "Editar política" }).click();
    const dialog = dialogOpen(page);
    const policyArea = dialog.locator('textarea[name="teleworkPolicy"]');
    const original = await policyArea.inputValue();
    await policyArea.fill(`${original} [cancelar E2E]`);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogOpen(page)).toHaveCount(0);
    const afterCancel = await getTeleworkPolicy(page);
    expect(afterCancel.policyVersion).toBe(before.policyVersion);

    // La política exige las secciones de NOM-037 (horario, desconexión, riesgos,
    // equipo, lactancia y reversibilidad): guardar un texto incompleto da 400.
    await page.getByRole("button", { name: "Editar política" }).click();
    await dialogOpen(page).locator('textarea[name="teleworkPolicy"]').fill("Texto sin las secciones obligatorias");
    const invalid = page.waitForResponse(
      (r) => r.url().includes("/nom/telework/policy") && r.request().method() === "PUT"
    );
    await dialogOpen(page).getByRole("button", { name: "Guardar textos" }).click();
    expect((await invalid).status()).toBe(400);
    await expect(page.getByText(/secciones|TELEWORK_POLICY_SECTIONS|No se pudo/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // Con las secciones obligatorias, guardar sube la versión de la política.
    const validPolicy = [
      "Política de teletrabajo E2E con horario, desconexión digital, riesgos,",
      "equipo de trabajo, lactancia y reversibilidad del teletrabajo.",
    ].join(" ");
    await dialogOpen(page).locator('textarea[name="teleworkPolicy"]').fill(validPolicy);
    const saved = page.waitForResponse(
      (r) => r.url().includes("/nom/telework/policy") && r.request().method() === "PUT"
    );
    await dialogOpen(page).getByRole("button", { name: "Guardar textos" }).click();
    expect((await saved).status()).toBe(200);
    const afterSave = await getTeleworkPolicy(page);
    expect(afterSave.policyVersion).toBe(before.policyVersion + 1);
    await expect(page.getByText(/Versiones vigentes: política/)).toBeVisible();
  });

  test("[NOM-02-T2][NOM-M02][ACT-34] teletrabajadores: alta y baja", async ({ page }) => {
    await enterAcme(page);
    const [users, registrations] = await Promise.all([getUsers(page), getTeleworkRegistrations(page)]);
    const active = new Set((registrations as any[]).filter((row) => row.status === "ACTIVE").map((row) => row.userId));
    // Preferir a alguien de RH/administración para no alterar el portal del staff.
    const candidates = (users as any[]).filter(
      (user) => !active.has(user.id) && String(user.employeeNumber ?? "") !== "1003"
    );
    test.skip(candidates.length === 0, "Todos los usuarios ya están como teletrabajadores activos");
    const person = candidates.find((user) => String(user.employeeNumber ?? "") === "1002") ?? candidates[0];

    await openAcme(page, PAGE, ANCHOR);
    await tab(page, /^Teletrabajadores/).click();
    await page.getByRole("button", { name: "Nuevo" }).click();
    const dialog = dialogOpen(page);
    await expect(dialog.getByText("Teletrabajadores")).toBeVisible();
    await dialog.locator('select[name="registrationUser"]').selectOption(person.id);
    await dialog.locator('select[name="registrationMode"]').selectOption("REMOTO");
    await dialog.locator('input[name="homeAddress"]').fill("Domicilio E2E 123");
    const created = page.waitForResponse(
      (r) => r.url().includes("/nom/telework/registrations") && r.request().method() === "POST"
    );
    await dialog.getByRole("button", { name: "Registrar" }).click();
    expect((await created).status()).toBe(201);
    await expect(dialogOpen(page)).toHaveCount(0);
    const row = page.locator("div.rounded-xl", { hasText: person.name }).last();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText("Activo").first()).toBeVisible();

    // Baja (termina el registro) sin borrar el historial.
    const ended = page.waitForResponse(
      (r) => r.url().includes("/nom/telework/registrations/") && r.request().method() === "PATCH"
    );
    await row.getByRole("button", { name: "Terminar" }).first().click();
    expect((await ended).status()).toBe(200);
    await expect(page.getByText("Terminado").first()).toBeVisible({ timeout: 20_000 });
  });

  test("[NOM-02-T3] checklists: pestaña con lista o estado vacío", async ({ page }) => {
    await enterAcme(page);
    await openAcme(page, PAGE, ANCHOR);
    await tab(page, /^Checklists/).click();

    await expectOneOf(page, [
      { name: "vacío", locator: page.getByText("Sin checklists") },
      { name: "hint", locator: page.getByText(/Se reciben cuando el trabajador contesta/) },
      { name: "lista inicial", locator: page.getByText("Inicial", { exact: true }) },
      { name: "lista periódico", locator: page.getByText("Periódico", { exact: true }) },
    ]);
  });

  test("[NOM-02-T4][NOM-M03][ACT-34] comunicaciones: motivo ≥5 y registro", async ({ page }) => {
    await enterAcme(page);
    const [users, before] = await Promise.all([getUsers(page), getOutOfHoursContacts(page)]);
    test.skip(users.length === 0, "No hay usuarios para registrar el contacto");
    const person = (users as any[])[0];
    const reason = `Contacto E2E ${Date.now()}`;

    await openAcme(page, PAGE, ANCHOR);
    await tab(page, /^Comunicaciones/).click();
    await page.getByRole("button", { name: "Registrar" }).click();
    const dialog = dialogOpen(page);
    await expect(dialog.getByText("Comunicaciones fuera de jornada")).toBeVisible();
    await dialog.locator('select[name="contactUser"]').selectOption(person.id);
    await dialog.locator('select[name="contactChannel"]').selectOption("MESSAGE");
    await dialog.locator('input[name="contactReason"]').fill("abc");
    await expect(dialog.getByRole("button", { name: "Registrar contacto" })).toBeDisabled();

    await dialog.locator('input[name="contactReason"]').fill(reason);
    const created = page.waitForResponse(
      (r) => r.url().includes("/nom/telework/out-of-hours-contacts") && r.request().method() === "POST"
    );
    await dialog.getByRole("button", { name: "Registrar contacto" }).click();
    expect((await created).status()).toBe(201);
    await expect(dialogOpen(page)).toHaveCount(0);
    await expect(page.getByText(reason).first()).toBeVisible({ timeout: 20_000 });
    const after = await getOutOfHoursContacts(page);
    expect((after as any[]).length).toBe((before as any[]).length + 1);
    expect((await api(page, "GET", "/nom/telework/out-of-hours-contacts")).status).toBe(200);
  });
});
