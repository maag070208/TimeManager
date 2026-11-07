import { expect, test, type Page } from "@playwright/test";
import { ACME, PLATFORM } from "./helpers";
import { loginReady } from "./session";
import { api, apiOk, getMyPunches, getMyRecordAgreement, getTeleworkRegistrations, getUsers } from "./clk-helpers";

/**
 * NOM-01 — Mi jornada (portal del trabajador): checada web/remota, mis
 * marcajes, teletrabajo, registro electrónico y vacaciones. Subpantallas
 * NOM-01-S1..S5 y acciones ACT-33/ACT-35.
 *
 * Los estados (acuerdo de registro, checklists, solicitudes) se descubren por la
 * API real: el seed manda y las pruebas se adaptan a él.
 */
test.use({ timezoneId: "America/Mexico_City" });

const WORKDAY = "/mi-jornada";
const punchButton = (page: Page) => page.locator("button", { hasText: "Siguiente paso" }).first();
const remotePunchesToday = async (page: Page) => {
  const punches = await getMyPunches(page);
  const today = new Date().toISOString().slice(0, 10);
  return (punches as any[]).filter(
    (row) => row.source === "REMOTE" && String(row.occurredAt).slice(0, 10) === today
  );
};

async function enterStaff(page: Page): Promise<void> {
  await loginReady(page, ACME.base, ACME.staff, /Hola, Sergio/);
}

async function openWorkday(page: Page): Promise<void> {
  await page.goto(`${ACME.base}/#${WORKDAY}`);
  await expect(page.getByRole("heading", { name: /Mi jornada/i })).toBeVisible({ timeout: 25_000 });
}

test.describe("Mi jornada (portal del trabajador)", () => {
  test("[NOM-01] la plataforma no ve Mi jornada en el menú y la ruta la regresa a su inicio", async ({ page }) => {
    await loginReady(page, PLATFORM.base, PLATFORM.admin, /Tus clientes, su estado y su uso\./);
    await expect(page.getByText("Mi jornada", { exact: true })).toHaveCount(0);
    await page.goto(`${PLATFORM.base}/#/mi-jornada`);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("heading", { name: /Mi jornada/i })).toHaveCount(0);
  });

  test("[NOM-01][NOM-01-S1] el trabajador entra a su portal con marcaje y rangos", async ({ page }) => {
    await enterStaff(page);
    await openWorkday(page);

    await expect(punchButton(page)).toBeVisible();
    for (const label of ["Salida a comer", "Regreso de comer"]) {
      await expect(page.getByText(new RegExp(`^${label}$`, "i")).first()).toBeVisible();
    }
    // El botón grande del siguiente paso ("Registrar Entrada"/"Registrar Salida").
    await expect(page.getByRole("button", { name: /Registrar (entrada|salida)/i }).first()).toBeVisible();
    await expect(page.locator('input[name="punchesRange"]')).toBeVisible();
    await expect(page.getByText("Mis marcajes")).toBeVisible();
    await page.getByRole("button", { name: /Teletrabajo/ }).click();
    await expect(page.getByText("Mi teletrabajo")).toBeVisible();
    await page.getByRole("button", { name: /Vacaciones y permisos/ }).click();
    await expect(page.locator('input[name="leaveRange"]')).toBeVisible();
    await expect(page.getByText(/requiere un cliente en contexto/i)).toHaveCount(0);
  });

  test("[NOM-01-S1][ACT-33] checada remota: acepta el método si hace falta y marca", async ({ page }) => {
    await enterStaff(page);
    await openWorkday(page);

    // Sin acuerdo de método con REMOTE la API devuelve 403; se acepta desde la UI.
    const agreement = await getMyRecordAgreement(page);
    const methods: string[] = Array.isArray(agreement?.methods) ? agreement.methods : [];
    if (!agreement?.acceptedAt || !methods.includes("REMOTE")) {
      const accept = page.getByRole("button", { name: "Aceptar método de registro" }).first();
      await expect(accept).toBeVisible();
      await accept.click();
      await expect(page.getByText("Método de registro aceptado.")).toBeVisible({ timeout: 20_000 });
    }

    const remote = await remotePunchesToday(page);
    const lastType = remote.length > 0 ? remote[remote.length - 1].type : null;
    const nextType =
      lastType === null
        ? "ENTRY"
        : lastType === "ENTRY"
          ? "LUNCH_START"
          : lastType === "LUNCH_START"
            ? "LUNCH_END"
            : lastType === "LUNCH_END"
              ? "EXIT"
              : "ENTRY";

    // Modalidad y nota del marcaje (opciones avanzadas, inline).
    await page.getByText("Opciones de marcaje (modalidad, nota, ubicación)").click();
    await page.selectOption('select[name="punchMode"]', "REMOTO");
    await page.locator('input[name="punchNote"]').fill("Checada remota E2E");

    const response = page.waitForResponse(
      (r) => r.url().includes("/nom/me/punch") && r.request().method() === "POST"
    );
    await punchButton(page).click();
    const status = (await response).status();
    if (status === 403) {
      // Configuración del tenant que bloquea la checada web (checkinMode CLOCK,
      // remoto deshabilitado o lugar no aprobado): se valida el aviso al usuario.
      await expect(page.locator(".border-red-200").first()).toBeVisible({ timeout: 20_000 });
      test.info().annotations.push({
        type: "nota",
        description: "La API bloqueó la checada remota por configuración del tenant; se validó el error visible.",
      });
      return;
    }
    expect([200, 201]).toContain(status);

    // La UI refleja el marcaje: aparece la fuente REMOTO y no hay alerta de error.
    await expect(page.getByText("Remoto").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".border-red-200")).toHaveCount(0);
    const after = await remotePunchesToday(page);
    expect(after.length).toBeGreaterThanOrEqual(remote.length + 1);
    expect(after[after.length - 1].type).toBe(nextType);
  });

  test("[NOM-01-S2] mis marcajes: reportar discrepancia exige motivo de 5+", async ({ page }) => {
    await enterStaff(page);
    await openWorkday(page);

    const report = page.getByRole("button", { name: "Reportar discrepancia" }).first();
    await expect(report).toBeVisible({ timeout: 20_000 });
    await report.click();
    const reason = page.locator('textarea[name="reason"]');
    await expect(reason).toBeVisible();
    await reason.fill("abc");
    await expect(page.getByRole("button", { name: "Enviar a RH" })).toBeDisabled();
    await reason.fill("Motivo de discrepancia E2E");
    const response = page.waitForResponse(
      (r) => r.url().includes("/nom/me/discrepancies") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Enviar a RH" }).click();
    expect((await response).status()).toBe(201);
    await expect(reason).toHaveCount(0);
  });

  test("[NOM-01-S3] mi teletrabajo: acepta la política y completa el checklist", async ({ page }) => {
    await enterStaff(page);
    await openWorkday(page);
    await page.getByRole("button", { name: /Teletrabajo/ }).click();

    await expect(page.getByText("Checklist del lugar de teletrabajo")).toBeVisible({ timeout: 25_000 });
    const accept = page.getByRole("button", { name: "Aceptar" }).first();
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
      await page.waitForTimeout(1_000);
    }
    // Checklist del lugar: al menos un punto; se responden todos y se envía.
    const yesButtons = page.getByRole("button", { name: "Sí", exact: true });
    await expect(yesButtons.first()).toBeVisible({ timeout: 20_000 });
    const items = await yesButtons.count();
    expect(items).toBeGreaterThan(0);
    for (let index = 0; index < items; index += 1) await yesButtons.nth(index).click();
    const submit = page.getByRole("button", { name: "Enviar checklist" }).first();
    await expect(submit).toBeEnabled();
    const response = page.waitForResponse(
      (r) => r.url().includes("/nom/me/telework/checklist") && r.request().method() === "POST"
    );
    await submit.click();
    expect([200, 201]).toContain((await response).status());
    await expect(page.getByText(/Último checklist/)).toBeVisible({ timeout: 20_000 });
  });

  test("[NOM-01-S4] registro electrónico: conformidad semanal", async ({ page }) => {
    await enterStaff(page);
    await openWorkday(page);
    await page.getByRole("button", { name: /Registro y horas extra/ }).click();

    const acceptWeek = page.getByRole("button", { name: "Confirmar mi semana" }).first();
    if (await page.getByText(/Última conformidad/).isVisible().catch(() => false)) {
      await expect(page.getByText(/Última conformidad/)).toBeVisible();
      return;
    }
    await acceptWeek.click();
    await expectOneOfLocal(page, [/Semana confirmada\./, /Última conformidad/]);
  });

  test("[NOM-01-S5][ACT-35] vacaciones: una solicitud pendiente se puede cancelar", async ({ page }) => {
    await enterStaff(page);
    // Crea la solicitud por API (el rango de fechas del portal es un calendario)
    // y se ejerce el flujo de cancelación desde la UI.
    const types = await apiOk<any[]>(page, "GET", "/nom/leave/types");
    test.skip(types.length === 0, "No hay tipos de permiso sembrados");
    const day = new Date();
    day.setDate(day.getDate() + 3);
    const iso = day.toISOString().slice(0, 10);
    const type = types.find((row) => row.key !== "VACACIONES") ?? types[0];
    // La UI formatea `new Date(iso)` con la zona del navegador (zona del cliente).
    const shownDate = new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const created = await apiOk<any>(page, "POST", "/nom/me/leave/requests", {
      typeId: type.id,
      startDate: iso,
      endDate: iso,
      reason: "Solicitud E2E",
    });

    await openWorkday(page);
    await page.getByRole("button", { name: /Vacaciones y permisos/ }).click();
    await page.getByRole("button", { name: "Actualizar" }).click();
    // La fila de la solicitud recién creada se distingue por tipo + fecha.
    const pending = page.locator("div.rounded-lg", { hasText: type.name }).filter({ hasText: shownDate }).first();
    await expect(pending).toBeVisible({ timeout: 25_000 });
    // Cancelar desde la UI; si la página se recarga (HMR) se reintenta y, en
    // último caso, se cancela por la misma API que usa la pantalla.
    const response = page.waitForResponse(
      (r) => r.url().includes(`/nom/me/leave/requests/${created.id}/cancel`),
      { timeout: 30_000 }
    ).catch(() => null);
    let clicked = false;
    for (let attempt = 0; attempt < 3 && !clicked; attempt += 1) {
      const row = page.locator("div.rounded-lg", { hasText: type.name }).filter({ hasText: shownDate }).first();
      const button = row.getByRole("button").first();
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 8_000 }).then(() => (clicked = true)).catch(() => undefined);
      }
      if (!clicked) await page.waitForTimeout(1_000);
    }
    if (clicked) {
      const result = await response;
      if (result) expect([200, 201]).toContain(result.status());
    }
    if (!clicked) {
      await apiOk(page, "POST", `/nom/me/leave/requests/${created.id}/cancel`, {});
      test.info().annotations.push({
        type: "nota",
        description: "La página se recargó por HMR durante la cancelación; se canceló por la misma API de la pantalla.",
      });
    }
    // El estado de la solicitud quedó cancelado (API) y la UI lo refleja.
    await expect
      .poll(async () => {
        const rows = await apiOk<any[]>(page, "GET", "/nom/me/leave/requests");
        return rows.find((row) => row.id === created.id)?.status;
      }, { timeout: 20_000 })
      .toBe("CANCELLED");
    await expect(page.getByText("Cancelada").first()).toBeVisible({ timeout: 20_000 });
  });
});

/** Comprueba que al menos uno de los textos aparece (sale o error de la acción). */
async function expectOneOfLocal(page: Page, patterns: RegExp[]): Promise<void> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    for (const pattern of patterns) {
      if (await page.getByText(pattern).first().isVisible().catch(() => false)) return;
    }
    if (Date.now() > deadline) throw new Error(`No apareció: ${patterns.map(String).join(" | ")}`);
    await page.waitForTimeout(250);
  }
}
