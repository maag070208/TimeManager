import { expect, test, type Page } from "@playwright/test";
import { gotoRoute, loginAcme } from "./ops-helpers";

/**
 * E2E-2 · Horarios (acme.admin).
 *
 * Datos sembrados: Matutino y Vespertino. Las altas se hacen con el asistente
 * de Tic de `/#/schedules/new`: en alta el guardado vive en el chat y el alta
 * pide confirmación. Las ediciones se prueban sobre un horario creado por la
 * propia UI (con días), no sobre los del seed, que se insertan sin días.
 */

type CreatedSchedule = { id: string; name: string };

/** Alta completa por el chat de Tic; devuelve el horario que responde la API. */
const createSchedule = async (page: Page, name: string): Promise<CreatedSchedule> => {
  await gotoRoute(page, "/schedules/new");

  const chatName = page.locator('input[name="agentScheduleName"]');
  await expect(chatName).toBeVisible();
  await chatName.fill(name);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByRole("button", { name: /Lunes a viernes/ }).click();
  await page.getByRole("button", { name: "09:00 – 18:00", exact: true }).click();
  await page.getByRole("button", { name: "No, corrido", exact: true }).click();
  await page.getByRole("button", { name: "Usar estos", exact: true }).click();

  // El botón del chat aplica el borrador y pide confirmación de alta.
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "Guardar nuevo horario" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(name);
  await expect(dialog).toContainText("5 días");

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/schedules")
  );
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as CreatedSchedule;
  expect(body.name).toBe(name);

  await expect(page).toHaveURL(/#\/schedules$/);
  return body;
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
    const created = await createSchedule(page, "Nocturno E2E");

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText("Nocturno E2E", { exact: true })).toBeVisible();
    await expect(page.getByText("3 horario(s)")).toBeVisible();
  });

  test("edita un horario existente", async ({ page }) => {
    await loginAcme(page, "admin");
    const created = await createSchedule(page, "Editable E2E");

    await gotoRoute(page, `/schedules/${created.id}/edit`);
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveValue("Editable E2E", { timeout: 20_000 });
    await nameInput.fill("Editable E2E Pro");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "Guardar nuevo horario" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(page).toHaveURL(/#\/schedules$/);
    await expect(page.getByText("Editable E2E Pro", { exact: true })).toBeVisible();
    await expect(page.getByText("Editable E2E", { exact: true })).toHaveCount(0);
  });

  test("asigna un horario a una persona", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules/assign");

    await expect(page.getByText("Asigna un horario a varias personas a la vez.")).toBeVisible();
    await expect(page.getByText("Sergio Staff", { exact: true })).toBeVisible();

    // El selector arranca con el primer horario del catálogo.
    const scheduleName = await page.locator('input[name="schedule"]').inputValue();
    expect(scheduleName.length).toBeGreaterThan(0);

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
    // La persona ya aparece del lado del horario elegido.
    await expect(page.getByText(`En ${scheduleName}`)).toBeVisible();
  });
});
