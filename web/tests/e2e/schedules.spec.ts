import { expect, test, type Page } from "@playwright/test";
import {
  dialog,
  gotoRoute,
  loginAcme,
  pickSearchSelect,
  searchSelectValue,
  setCheckbox,
  waitForApi,
} from "./ops-helpers";

/**
 * Horarios (SCH-01..04, SCH-M01..M03, ACT-21..23): alta de 7 días con
 * validación legal, edición, baja/reactivación y asignación con aviso de
 * reemplazo.
 *
 * El formulario actual ya NO usa el asistente de Tic: es una rejilla de 7 días
 * con `input[name="name"]`, checkboxes `restDay-1..7` e inputs `start-N`/`end-N`.
 * Cada caso crea sus propios horarios con sufijo único para no chocar con el
 * seed ni con los demás casos del archivo.
 */

const WORK_WEEK = [1, 2, 3, 4, 5];

/** Respuesta del alta/edición de horario (POST /schedules o PATCH /schedules/:id). */
const scheduleSaveResponse = (page: Page) =>
  page.waitForResponse((response) => {
    const method = response.request().method();
    if (method !== "POST" && method !== "PATCH") return false;
    return /\/schedules(\/[^/]+)?$/.test(new URL(response.url()).pathname);
  });

const schedulePatchResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && /\/schedules\/[^/]+$/.test(new URL(response.url()).pathname)
  );

/** Abre el alta de horario y espera el formulario de 7 días. */
async function openNewSchedule(page: Page): Promise<void> {
  await gotoRoute(page, "/schedules/new");
  await expect(page).toHaveURL(/#\/schedules\/new$/);
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 20_000 });
}

/** Llena nombre y marca exactamente los días laborables (el resto descanso). */
async function fillSchedule(
  page: Page,
  options: { name: string; workdays?: number[]; start?: string; end?: string }
): Promise<void> {
  await page.locator('input[name="name"]').fill(options.name);
  const workdays = options.workdays ?? WORK_WEEK;
  for (let day = 1; day <= 7; day += 1) {
    const works = workdays.includes(day);
    await setCheckbox(page, `restDay-${day}`, !works);
    if (works && (options.start || options.end)) {
      if (options.start) await page.locator(`input[name="start-${day}"]`).fill(options.start);
      if (options.end) await page.locator(`input[name="end-${day}"]`).fill(options.end);
    }
  }
}

/** Guarda desde la barra superior y resuelve la respuesta de la API. */
async function saveWithConfirmation(page: Page) {
  await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
  const confirm = dialog(page, "Guardar nuevo horario");
  await expect(confirm).toBeVisible();
  const response = scheduleSaveResponse(page);
  await confirm.getByRole("button", { name: "Guardar", exact: true }).click();
  return response;
}

const rowOf = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name }).first();

/** Recarga el tablero para ver el estado persistido (la tabla no refetchea sola). */
async function reloadBoard(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByText(/\d+ horario\(s\)/)).toBeVisible({ timeout: 20_000 });
}

test.describe("horarios (acme.admin)", () => {
  test("[SCH-01] lista, filtra y muestra el catálogo sin errores", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules");

    await expect(page.getByText("Administración de horarios del personal y cálculo de horas extra.")).toBeVisible();
    // Tarjetas de filtro: Horarios / Activos / Inactivo y contador de la tabla.
    await expect(page.getByRole("button", { name: /^Horarios/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Activos/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Inactivo/ })).toBeVisible();
    await expect(page.getByText(/\d+ horario\(s\)/)).toBeVisible();

    // Filtro Activos → Inactivo → todos: la tabla responde y no hay error.
    await page.getByRole("button", { name: /^Activos/ }).click();
    await expect(page.getByText(/\d+ horario\(s\)/)).toBeVisible();
    await page.getByRole("button", { name: /^Inactivo/ }).click();
    await expect(page.getByText(/\d+ horario\(s\)/)).toBeVisible();
    await page.getByRole("button", { name: /^Horarios/ }).click();

    await expect(page.getByText("Error al cargar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nuevo horario" })).toBeVisible();
  });

  test("[SCH-02][SCH-M01][ACT-21] alta 5+2: cancelar no crea y confirmar sí", async ({ page }) => {
    await loginAcme(page, "admin");
    const name = "Horario E2E 5x2";
    await openNewSchedule(page);
    await fillSchedule(page, { name, workdays: WORK_WEEK });

    // Cancelar la confirmación no crea nada y deja el formulario abierto.
    await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
    const cancelDialog = dialog(page, "Guardar nuevo horario");
    await expect(cancelDialog).toBeVisible();
    await expect(cancelDialog).toContainText(name);
    await expect(cancelDialog).toContainText("5 días");
    await cancelDialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(cancelDialog).toBeHidden();
    await expect(page).toHaveURL(/#\/schedules\/new$/);

    // Confirmar el alta: POST /schedules y de vuelta al tablero con la fila nueva.
    const response = await saveWithConfirmation(page);
    expect(response.ok()).toBe(true);
    await expect(page).toHaveURL(/#\/schedules$/);
    await expect(rowOf(page, name)).toBeVisible();
  });

  test("[SCH-02][SCH-M01] rechaza 7 días trabajados y semana sobre el tope legal", async ({ page }) => {
    await loginAcme(page, "admin");
    await openNewSchedule(page);
    await page.locator('input[name="name"]').fill("Horario E2E ilegal");

    // 7 días trabajados: se quita el descanso del domingo (default = descanso).
    await setCheckbox(page, "restDay-7", false);
    const sevenDays = await saveWithConfirmation(page);
    expect(sevenDays.status()).toBe(400);
    await expect(page.getByText(/SIN_DIA_DE_DESCANSO|jornada legal/).first()).toBeVisible();
    await expect(page).toHaveURL(/#\/schedules\/new$/);

    // Semana de 52 h (5×8 + un día de 12 h): supera el tope legal del año.
    await setCheckbox(page, "restDay-7", true);
    await page.locator('input[name="end-1"]').fill("20:00");
    const overLimit = await saveWithConfirmation(page);
    expect(overLimit.status()).toBe(400);
    await expect(page.getByText(/SEMANA_MAYOR_LEGAL|jornada legal/).first()).toBeVisible();
  });

  test("[SCH-02][SCH-03][SCH-M01][ACT-21] alta con turno nocturno y persistencia en edición", async ({ page }) => {
    await loginAcme(page, "admin");
    const name = "Nocturno E2E";
    await openNewSchedule(page);
    await fillSchedule(page, { name, workdays: WORK_WEEK, start: "22:00", end: "06:00" });

    // El formulario avisa que el turno termina al día siguiente (cruza medianoche).
    await expect(page.getByText("Este turno termina al día siguiente.").first()).toBeVisible();
    const response = await saveWithConfirmation(page);
    expect(response.ok()).toBe(true);
    await expect(page).toHaveURL(/#\/schedules$/);

    // La fila resume el turno nocturno y la edición conserva las horas.
    const row = rowOf(page, name);
    await expect(row).toBeVisible();
    await expect(row).toContainText("22:00–06:00");
    await row.click();
    await expect(page).toHaveURL(/#\/schedules\/[0-9a-f-]+\/edit$/);
    await expect(page.locator('input[name="name"]')).toHaveValue(name, { timeout: 20_000 });
    await expect(page.locator('input[name="start-1"]')).toHaveValue("22:00");
    await expect(page.locator('input[name="end-1"]')).toHaveValue("06:00");
  });

  test("[SCH-03][SCH-M01][ACT-21] edita el horario y bloquea el nombre duplicado", async ({ page }) => {
    await loginAcme(page, "admin");
    const original = "Editable E2E";
    const renamed = "Editable E2E Pro";
    await openNewSchedule(page);
    await fillSchedule(page, { name: original, workdays: WORK_WEEK });
    expect((await saveWithConfirmation(page)).ok()).toBe(true);
    await expect(page).toHaveURL(/#\/schedules$/);

    // Abrir la edición desde la fila (clic de fila) y renombrar.
    await rowOf(page, original).click();
    await expect(page).toHaveURL(/#\/schedules\/[0-9a-f-]+\/edit$/);
    await expect(page.locator('input[name="name"]')).toHaveValue(original, { timeout: 20_000 });
    await page.locator('input[name="name"]').fill(renamed);
    const patch = await saveWithConfirmation(page);
    expect(patch.ok()).toBe(true);
    await expect(page).toHaveURL(/#\/schedules$/);
    await expect(rowOf(page, renamed)).toBeVisible();

    // Nombre duplicado: 409 del API y alerta visible, sin salir del formulario.
    await openNewSchedule(page);
    await fillSchedule(page, { name: renamed, workdays: WORK_WEEK });
    const duplicate = await saveWithConfirmation(page);
    expect(duplicate.status()).toBe(409);
    await expect(page.getByText(/Ya existe un horario con ese nombre/)).toBeVisible();
    await expect(page).toHaveURL(/#\/schedules\/new$/);
  });

  test("[SCH-01][SCH-M02][ACT-22] desactiva (con cancelar), filtra inactivos y reactiva", async ({ page }) => {
    await loginAcme(page, "admin");
    const name = "Toggle E2E";
    await openNewSchedule(page);
    await fillSchedule(page, { name, workdays: WORK_WEEK });
    expect((await saveWithConfirmation(page)).ok()).toBe(true);
    await expect(page).toHaveURL(/#\/schedules$/);

    // Cancelar la baja no cambia el estado.
    const row = rowOf(page, name);
    await row.getByRole("button", { name: "Desactivar" }).click();
    const deactivate = dialog(page, "Desactivar horario");
    await expect(deactivate).toBeVisible();
    await expect(deactivate).toContainText(name);
    await deactivate.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(deactivate).toBeHidden();
    await expect(rowOf(page, name)).toContainText("Activo");

    // Confirmar la baja: PATCH active=false y estado Inactivo.
    await rowOf(page, name).getByRole("button", { name: "Desactivar" }).click();
    const confirmDeactivate = dialog(page, "Desactivar horario");
    const patch = schedulePatchResponse(page);
    await confirmDeactivate.getByRole("button", { name: "Desactivar", exact: true }).click();
    expect((await patch).ok()).toBe(true);
    await reloadBoard(page);
    await expect(rowOf(page, name)).toContainText("Inactivo");

    // El filtro Inactivo lo muestra; reactivar lo devuelve a Activo.
    await page.getByRole("button", { name: /^Inactivo/ }).click();
    const inactiveRow = rowOf(page, name);
    await expect(inactiveRow).toBeVisible();
    await inactiveRow.getByRole("button", { name: "Reactivar" }).click();
    const activate = dialog(page, "Activar horario");
    await expect(activate).toBeVisible();
    await activate.getByRole("button", { name: "Activar", exact: true }).click();
    await reloadBoard(page);
    await expect(rowOf(page, name)).toContainText("Activo");
  });

  test("[SCH-04][SCH-M03][ACT-23] asigna sin horario, reemplaza con aviso actual→nuevo y quita", async ({ page }) => {
    await loginAcme(page, "admin");
    await gotoRoute(page, "/schedules/assign");
    await expect(page.getByText("Asigna un horario a varias personas a la vez.")).toBeVisible();

    // Horario elegido por defecto y otro activo distinto para probar el reemplazo.
    const actual = await searchSelectValue(page, "schedule");
    expect(actual.length).toBeGreaterThan(0);
    const targets = ["Matutino", "Vespertino", "Nocturno E2E"].filter((name) => name !== actual);
    expect(targets.length).toBeGreaterThan(0);
    const second = { label: targets[0] };

    const leftPane = page.locator(".tm-hero-card").filter({ hasText: "Con este horario" });
    const rightPane = page.locator(".tm-hero-card").filter({ hasText: "Sin este horario" });

    // 1) Persona sin horario vigente: se asigna directo, sin modal de reemplazo.
    await expect(rightPane.locator('input[name^="assign-right-"]').first()).toBeAttached({ timeout: 20_000 });
    const rightRows = rightPane.locator("div.cursor-pointer");
    let candidateRow = rightRows.first();
    let personName = "";
    for (let index = 0; index < (await rightRows.count()); index += 1) {
      const row = rightRows.nth(index);
      const text = await row.innerText();
      if (text.includes("Actualmente:")) continue;
      candidateRow = row;
      personName = text.split("\n")[0].trim();
      break;
    }
    expect(personName.length).toBeGreaterThan(0);
    await candidateRow.click();
    const assignDirect = waitForApi(page, "/schedules/assignments");
    await page.getByTitle("Asignar seleccionados").click();
    expect((await assignDirect).ok()).toBe(true);
    await expect(page.getByText(/Se asignó el horario a 1 persona/)).toBeVisible();
    await expect(leftPane.getByText(personName, { exact: true })).toBeVisible({ timeout: 20_000 });

    // 2) Mover a otro horario: aviso de reemplazo con actual → nuevo; cancelar no cambia.
    await pickSearchSelect(page, "schedule", second.label);
    await expect(rightPane.getByText(personName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await rightPane.getByText(personName, { exact: true }).click();
    await page.getByTitle("Asignar seleccionados").click();
    const changeDialog = dialog(page, "Cambiar horario");
    await expect(changeDialog).toBeVisible();
    await expect(changeDialog).toContainText(actual);
    await expect(changeDialog).toContainText(second.label);
    await changeDialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(changeDialog).toBeHidden();

    // 3) Confirmar el aviso: se reemplaza la vigencia previa (una sola vigente).
    await page.getByTitle("Asignar seleccionados").click();
    const confirmChange = dialog(page, "Cambiar horario");
    const assignReplace = waitForApi(page, "/schedules/assignments");
    await confirmChange.getByRole("button", { name: "Cambiar horario", exact: true }).click();
    expect((await assignReplace).ok()).toBe(true);
    await expect(leftPane.getByText(personName, { exact: true })).toBeVisible({ timeout: 20_000 });

    // 4) En el horario anterior ya no aparece: la asignación es única.
    await pickSearchSelect(page, "schedule", actual);
    await expect(leftPane.getByText(personName, { exact: true })).toHaveCount(0);

    // 5) Quitar del horario actual con la acción rápida de la fila.
    await pickSearchSelect(page, "schedule", second.label);
    const leftRow = leftPane.locator("div.cursor-pointer").filter({ hasText: personName }).first();
    await expect(leftRow).toBeVisible({ timeout: 20_000 });
    const removed = waitForApi(page, "/schedules/assignments/remove");
    await leftRow.getByTitle("Quitar horario").click();
    expect((await removed).ok()).toBe(true);
    await expect(page.getByText(/Se quitó el horario a 1 persona/)).toBeVisible();
  });
});
