import { expect, test, type Page } from "@playwright/test";
import { gotoRoute, loginAcme } from "./ops-helpers";

/**
 * E2E-2 · Horarios (acme.admin).
 *
 * Datos sembrados: Matutino y Vespertino. Las altas se hacen por el asistente
 * de Tic de `/#/schedules/new` (en alta el botón de guardar vive en el chat;
 * el alta pide confirmación). Cada test hace su propio login.
 */

/** Id del horario leyendo el listado que pide la propia pantalla. */
const scheduleIdByName = async (page: Page, name: string): Promise<string> => {
  const listed = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname.endsWith("/schedules") &&
      response.ok()
  );
  await gotoRoute(page, "/schedules");
  const rows = (await (await listed).json()) as Array<{ id: string; name: string }>;
  const row = rows.find((schedule) => schedule.name === name);
  if (!row) throw new Error(`El horario «${name}» no está en el listado`);
  return row.id;
};

/** Guarda el formulario en edición y confirma el diálogo. */
const saveEditedSchedule = async (page: Page, name: string): Promise<void> => {
  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toHaveValue(name, { timeout: 20_000 });
  await page.locator('input[name="name"]').fill(`${name} E2E`);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "Guardar nuevo horario" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(/#\/schedules$/);
  await expect(page.getByText(`${name} E2E`, { exact: true })).toBeVisible();
};

test.describe("horarios (acme.admin)", () => {
  test("lista los horarios sembrados", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules");

    await expect(
      page.getByText("Administración de horarios del personal y cálculo de horas extra.")
    ).toBeVisible();
    await expect(page.getByText("Matutino", { exact: true })).toBeVisible();
    await expect(page.getByText("Vespertino", { exact: true })).toBeVisible();
    await expect(page.getByText("2 horario(s)")).toBeVisible();
    await expect(page.getByText("Error al cargar")).toHaveCount(0);
  });

  test("da de alta un horario con días y jornada", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules/new");

    // Paso 1: nombre.
    const chatName = page.locator('input[name="agentScheduleName"]');
    await expect(chatName).toBeVisible();
    await chatName.fill("Nocturno E2E");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    // Paso 2: días.
    await page.getByRole("button", { name: /Lunes a viernes/ }).click();
    // Paso 3: jornada.
    await page.getByRole("button", { name: "09:00 – 18:00", exact: true }).click();
    // Paso 4: sin jornada partida.
    await page.getByRole("button", { name: "No, corrido", exact: true }).click();
    // Paso 6: tolerancias por defecto.
    await page.getByRole("button", { name: "Usar estos", exact: true }).click();

    // El botón del chat aplica el borrador y pide confirmación de alta.
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "Guardar nuevo horario" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Nocturno E2E");
    await expect(dialog).toContainText("5 días");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(page).toHaveURL(/#\/schedules$/);
    await expect(page.getByText("Nocturno E2E", { exact: true })).toBeVisible();
    await expect(page.getByText("3 horario(s)")).toBeVisible();
  });

  test("edita un horario existente", async ({ page }) => {
    await loginAcme(page, "admin");
    const id = await scheduleIdByName(page, "Matutino");

    await gotoRoute(page, `/schedules/${id}/edit`);
    await saveEditedSchedule(page, "Matutino");

    // Restaurar el nombre sembrado para no arrastrar estado a otros tests.
    const editedId = await scheduleIdByName(page, "Matutino E2E");
    await gotoRoute(page, `/schedules/${editedId}/edit`);
    await expect(page.locator('input[name="name"]')).toHaveValue("Matutino E2E", { timeout: 20_000 });
    await page.locator('input[name="name"]').fill("Matutino");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "Guardar nuevo horario" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page).toHaveURL(/#\/schedules$/);
    await expect(page.getByText("Matutino", { exact: true })).toBeVisible();
  });

  test("asigna un horario a una persona", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules/assign");

    await expect(
      page.getByText("Asigna un horario a varias personas a la vez.")
    ).toBeVisible();
    await expect(page.getByText("Sergio Staff", { exact: true })).toBeVisible();

    // Marcar a la persona de acme y aplicar la asignación.
    await page.getByText("Sergio Staff", { exact: true }).click();
    const apply = page.getByRole("button", { name: "Asignar (1)", exact: true });
    await expect(apply).toBeEnabled();

    const assigned = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/schedules/assignments")
    );
    await apply.click();
    const response = await assigned;
    expect(response.ok()).toBe(true);
    expect((await response.json()) as { assigned: number }).toMatchObject({ assigned: 1 });

    await expect(page.getByText("Horario asignado a 1 persona(s)")).toBeVisible();
    // La persona sale de "Por asignar" y pasa al horario elegido.
    await expect(page.getByText("En Matutino")).toBeVisible();
  });
});
