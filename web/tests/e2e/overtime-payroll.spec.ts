import { expect, test, type Page } from "@playwright/test";
import { dialog, gotoRoute, loginAcme, waitForApi } from "./ops-helpers";

/**
 * Tiempo extra (OT-01, OT-M01, ACT-24/25) y carga de pre-nómina (PAY-01).
 *
 * El seed deja días de tiempo extra PENDIENTES/APROBADOS/RECHAZADOS de la
 * semana en curso y un ledger semanal DRAFT; las decisiones que se toman aquí
 * no afectan a otras suites (cada archivo corre con su propio seed).
 */

const overtimeQuery = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/overtime/query")
  );

const weeklyOvertimeGet = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "GET" && /\/nom\/overtime\/weekly$/.test(new URL(response.url()).pathname)
  );

const weeklyConfirm = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/nom\/overtime\/weekly\/[^/]+\/confirm$/.test(new URL(response.url()).pathname)
  );

test.describe("tiempo extra (acme.admin)", () => {
  test("[OT-01][OT-M01][ACT-24] aprueba un día pendiente y rechaza otro con motivo", async ({ page }) => {
    await loginAcme(page, "admin");
    const query = overtimeQuery(page);
    await gotoRoute(page, "/schedules/overtime/approval");
    expect((await query).ok()).toBe(true);

    await expect(page.getByText("Consulta y aprobación de horas extra del personal.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Por aprobar/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Aprobado/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rechazado/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Todas/ })).toBeVisible();

    // El seed trae al menos dos días pendientes: uno se aprueba y otro se rechaza.
    await expect(page.getByRole("button", { name: "Aprobar", exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // Aprobar es directo (sin modal).
    const approveResponse = waitForApi(page, "/overtime/approvals");
    await page.getByRole("button", { name: "Aprobar", exact: true }).first().click();
    expect((await approveResponse).ok()).toBe(true);
    await expect(page.getByText(/1 día\(s\) aprobado\(s\)/)).toBeVisible();

    // Rechazar abre el modal con motivo opcional.
    await expect(page.getByRole("button", { name: "Rechazar", exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Rechazar", exact: true }).first().click();
    const rejectDialog = dialog(page, "Rechazar tiempo extra");
    await expect(rejectDialog).toBeVisible();
    await expect(rejectDialog).toContainText("No se contabilizará");
    await rejectDialog.locator('textarea[name="overtimeRejectNote"]').fill("Motivo E2E");
    const rejectResponse = waitForApi(page, "/overtime/approvals");
    await rejectDialog.getByRole("button", { name: "Rechazar", exact: true }).click();
    expect((await rejectResponse).ok()).toBe(true);
    await expect(page.getByText(/1 día\(s\) rechazado\(s\)/)).toBeVisible();

    // La pestaña Rechazadas muestra el motivo capturado.
    const rejectedQuery = overtimeQuery(page);
    await page.getByRole("button", { name: /^Rechazado/ }).click();
    expect((await rejectedQuery).ok()).toBe(true);
    await expect(page.getByText("Motivo E2E")).toBeVisible();
  });

  test("[OT-01] el RH entra en solo lectura (sin decidir ni confirmar)", async ({ page }) => {
    await loginAcme(page, "rh");
    const query = overtimeQuery(page);
    await gotoRoute(page, "/schedules/overtime/approval");
    expect((await query).ok()).toBe(true);

    // Solo ve lo aprobado: una tarjeta de filtro y sin botones de decisión.
    await expect(page.getByRole("button", { name: /^Aprobado/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Por aprobar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Rechazado/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Aprobar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rechazar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirmar semana", exact: true })).toHaveCount(0);
  });

  test("[OT-01][ACT-25] confirma la semana LFT (dobles/triples/excedente) y la congela", async ({ page }) => {
    await loginAcme(page, "admin");
    const ledger = weeklyOvertimeGet(page);
    await gotoRoute(page, "/schedules/overtime/approval");
    expect((await ledger).ok()).toBe(true);

    // Clasificación legal por persona y semana.
    await expect(page.getByText(/Horas extra por semana/)).toBeVisible();
    for (const kpi of ["Horas ordinarias", "Horas dobles", "Horas triples", "Excedente ilegal"]) {
      await expect(page.getByText(kpi, { exact: true })).toBeVisible();
    }

    // El seed deja la semana en Borrador: se confirma y queda congelada.
    await expect(page.getByText("Borrador").first()).toBeVisible({ timeout: 20_000 });
    const confirmResponse = weeklyConfirm(page);
    await page.getByRole("button", { name: "Confirmar semana", exact: true }).first().click();
    expect((await confirmResponse).ok()).toBe(true);
    await expect(page.getByText("Semana confirmada y congelada.")).toBeVisible();
    await expect(page.getByText("Confirmada").first()).toBeVisible();
  });
});

test.describe("pre-nómina (PAY-01)", () => {
  test("[PAY-01] carga el reporte semanal y navega otra semana", async ({ page }) => {
    await loginAcme(page, "admin");
    const report = waitForApi(page, "/schedules/weekly-attendance");
    await gotoRoute(page, "/schedules/payroll");
    expect((await report).ok()).toBe(true);

    await expect(page.getByText("Reporte semanal", { exact: true })).toBeVisible();
    for (const kpi of ["Personas", "Horas trabajadas", "HE calculadas", "HE aprobadas", "Faltas"]) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible();
    }
    // Acciones rápidas de la pre-nómina.
    await expect(page.getByRole("button", { name: /Verificar por departamento/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cerrar pre-nómina/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Historial/ })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();

    // Cambiar de semana vuelve a consultar el reporte.
    const previousWeek = waitForApi(page, "/schedules/weekly-attendance");
    await page.getByRole("button", { name: "Semana anterior" }).click();
    expect((await previousWeek).ok()).toBe(true);
    await expect(page.getByText("Reporte semanal", { exact: true })).toBeVisible();
    await expect(page.getByText("No se pudo generar el reporte")).toHaveCount(0);
  });
});
