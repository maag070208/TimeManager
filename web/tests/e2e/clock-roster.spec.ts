import { expect, test, type Page } from "@playwright/test";
import { ACME, BETA } from "./helpers";
import { loginReady } from "./session";
import {
  api,
  apiOk,
  createTempPerson,
  enterAcme,
  expectOneOf,
  firstClock,
  getRoster,
  getStatus,
  openAcme,
  removeTempPerson,
} from "./clk-helpers";

/**
 * CLK-03 — Padrón del reloj (nuevos, bajas pendientes con motivo, reapariciones)
 * y la acción ACT-30 (correr padrón / aplicar baja / descartar).
 *
 * La revisión del padrón LEE del mock ISAPI: una persona temporal creada por la
 * API aparece como "Nueva en el reloj" y se limpia al terminar.
 */
test.use({ timezoneId: "America/Mexico_City" });

const ROSTER = "/hr/time-clock/roster";
const ANCHOR = "Personas de los relojes que cuentan para entradas y salidas";

async function runRoster(page: Page): Promise<void> {
  const run = page.getByRole("button", { name: /Revisar padrón|Revisando/ }).first();
  await expect(run).toBeEnabled();
  const response = page.waitForResponse(
    (r) => r.url().includes("/time-clock/roster/run") && r.request().method() === "POST"
  );
  await run.click();
  expect([200, 201]).toContain((await response).status());
  await expectOneOf(page, [
    { name: "toast", locator: page.getByText("Padrón revisado.") },
    { name: "sospechosa", locator: page.getByText(/Revisión sospechosa/) },
    { name: "última revisión", locator: page.getByText(/Última revisión:/) },
  ]);
}

test.describe("padrón del reloj", () => {
  test("[CLK-03][ACT-30] revisa el padrón y muestra la última revisión", async ({ page }) => {
    await enterAcme(page);
    await openAcme(page, ROSTER, ANCHOR);

    await expect(page.getByText("Nuevos en el reloj")).toBeVisible();
    await expect(page.getByText("Bajas pendientes de motivo")).toBeVisible();
    await expect(page.getByText("Reaparecieron después de una baja")).toBeVisible();
    await expect(
      page.getByText(/Todavía no se ha revisado el padrón\.|Última revisión:/)
    ).toBeVisible();

    await runRoster(page);
    await expect(page.getByText(/Última revisión:/)).toBeVisible({ timeout: 25_000 });

    const roster = await getRoster(page);
    expect(roster.lastRun).not.toBeNull();
    // La revisión quedó registrada con su resultado y relojes.
    expect(roster.lastRun).toHaveProperty("ok");
  });

  test("[CLK-03][ACT-30] una baja pendiente exige motivo y permite descartarse", async ({ page }) => {
    await enterAcme(page);
    await openAcme(page, ROSTER, ANCHOR);
    const roster = await getRoster(page);

    if ((roster.pendingRemovals ?? []).length === 0) {
      test.info().annotations.push({
        type: "nota",
        description: "El seed no tiene bajas pendientes; se validó el estado vacío.",
      });
      await expect(
        page.getByText(/No hay bajas pendientes\.|No hay personas nuevas sin vincular\./)
      ).toBeVisible();
      return;
    }

    const pending = roster.pendingRemovals[0];
    // Motivo corto (<3) deja la baja deshabilitada.
    const reason = page.locator(`textarea[name="reason-${pending.employeeNumber}"]`);
    await reason.fill("ab");
    const apply = page.getByRole("button", { name: "Aplicar baja" }).first();
    await expect(apply).toBeDisabled();
    await reason.fill("Motivo de prueba E2E");
    // Descartar conserva a la persona (no aplica baja destructiva) y limpia el pendiente.
    const dismiss = page.getByRole("button", { name: "Descartar" }).first();
    const response = page.waitForResponse((r) => r.url().includes("/dismiss"));
    await dismiss.click();
    expect((await response).status()).toBeGreaterThanOrEqual(200);
    await expect(page.getByText("Baja pendiente descartada.")).toBeVisible({ timeout: 20_000 });
  });

  test("[CLK-03][ACT-30] una persona nueva del reloj aparece en el padrón y se limpia", async ({ page }) => {
    await enterAcme(page);
    const status = await getStatus(page);
    const clock = firstClock(status);
    test.skip(!clock, "acme no tiene relojes dados de alta");

    const number = "9911";
    const name = "PERSONA PADRON E2E";
    await createTempPerson(page, clock.clockSerial, number, name);
    try {
      await openAcme(page, ROSTER, ANCHOR);
      await runRoster(page);
      await expect(page.getByText(new RegExp(`Nº ${number}`)).first()).toBeVisible({ timeout: 25_000 });

      const roster = await getRoster(page);
      expect((roster.unlinked ?? []).some((row: any) => String(row.employeeNumber) === number)).toBe(true);
    } finally {
      await removeTempPerson(page, clock.clockSerial, number);
      // Vuelve a revisar para cancelar el pendiente de la persona temporal.
      await api(page, "POST", "/time-clock/roster/run");
    }
  });

  test("[CLK-03] tenant sin relojes: el padrón carga vacío", async ({ page }) => {
    await loginReady(page, BETA.base, BETA.admin, /Hola, Beto/);
    await page.goto(`${BETA.base}/#${ROSTER}`);
    await expect(page.getByText(ANCHOR).first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/Todavía no se ha revisado el padrón\./)).toBeVisible();
    await expect(page.getByText("No hay personas nuevas sin vincular.")).toBeVisible();
    await expect(page.getByText("No hay bajas pendientes.")).toBeVisible();
  });
});
