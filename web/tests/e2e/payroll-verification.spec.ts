import { expect, test } from "@playwright/test";
import { dialog, gotoRoute, loginAcme, toggleCheckbox, waitForApi } from "./ops-helpers";

/**
 * Pre-nómina (PAY-01, PAY-02, PAY-M01..M04, ACT-26): avisos, verificación por
 * departamento, marcar todo, cierre semanal, historial y reapertura.
 *
 * Los casos comparten la semana en curso (el seed no la deja cerrada). El orden
 * del archivo es intencional: se verifica → se comprueba el bloqueo con
 * pendientes → se cierra → se comprueba el historial y se reabre.
 */

const weeklyReport = (page: import("@playwright/test").Page) => waitForApi(page, "/schedules/weekly-attendance");

test.describe("verificación y cierre de pre-nómina", () => {
  test("[PAY-01][PAY-M02][PAY-M03][ACT-26] verifica por departamento y marca todo", async ({ page }) => {
    await loginAcme(page, "admin");
    const report = weeklyReport(page);
    await gotoRoute(page, "/schedules/payroll");
    expect((await report).ok()).toBe(true);
    await expect(page.getByText("Reporte semanal", { exact: true })).toBeVisible();

    // «Verificar toda la pre-nómina» pide confirmación (PAY-M03) y marca todo.
    await page.getByRole("button", { name: /Verificar toda la pre-nómina/ }).click();
    const verifyAll = dialog(page, "Verificar toda la pre-nómina");
    await expect(verifyAll).toBeVisible();
    await expect(verifyAll).toContainText("departamentos de la semana");
    const markAll = waitForApi(page, "/schedules/payroll/reviews/mark-all");
    await verifyAll.getByRole("button", { name: "Sí, verificar toda" }).click();
    expect((await markAll).ok()).toBe(true);
    await expect(verifyAll).toBeHidden();

    // «Verificar por departamento» (PAY-M02): ya están todos revisados; se
    // desmarca uno y se vuelve a marcar con «Marcar todos como revisados».
    await page.getByRole("button", { name: /Verificar por departamento/ }).click();
    const reviewDialog = dialog(page, "Verificar pre-nómina");
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog).toContainText("departamentos por revisar");
    await expect(reviewDialog.getByText("Revisado", { exact: true }).first()).toBeVisible();

    const firstReview = reviewDialog.locator('input[type="checkbox"]').first();
    const unmark = waitForApi(page, "/schedules/payroll/reviews", "PUT");
    await toggleCheckbox(firstReview, false);
    expect((await unmark).ok()).toBe(true);
    await expect(reviewDialog.getByText("Por revisar", { exact: true }).first()).toBeVisible();

    const reMarkAll = waitForApi(page, "/schedules/payroll/reviews/mark-all");
    await reviewDialog.getByRole("button", { name: /Marcar todos como revisados/ }).click();
    expect((await reMarkAll).ok()).toBe(true);
    await expect(reviewDialog.getByText("Por revisar", { exact: true })).toHaveCount(0);
    await expect(reviewDialog.getByRole("button", { name: "Cerrar pre-nómina" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(reviewDialog).toBeHidden();
  });

  test("[PAY-01][PAY-M02][PAY-M04] un departamento pendiente bloquea el cierre", async ({ page }) => {
    await loginAcme(page, "admin");
    const report = weeklyReport(page);
    await gotoRoute(page, "/schedules/payroll");
    expect((await report).ok()).toBe(true);

    // Deja un departamento sin revisar desde el checklist.
    await page.getByRole("button", { name: /Verificar por departamento/ }).click();
    const reviewDialog = dialog(page, "Verificar pre-nómina");
    await expect(reviewDialog).toBeVisible();
    const firstReview = reviewDialog.locator('input[type="checkbox"]').first();
    const unmark = waitForApi(page, "/schedules/payroll/reviews", "PUT");
    await toggleCheckbox(firstReview, false);
    expect((await unmark).ok()).toBe(true);
    await expect(reviewDialog.getByText("Por revisar", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(reviewDialog).toBeHidden();

    // El botón de cierre queda deshabilitado mientras falte revisar.
    const closeButton = page.getByRole("button", { name: /Cerrar pre-nómina/ });
    await expect(closeButton).toBeDisabled();
    await expect(page.getByText(/se habilita cuando todos los departamentos están revisados/)).toBeVisible();

    // Restaura el estado con el flujo de la barra (marcar todo + confirmar).
    await page.getByRole("button", { name: /Verificar toda la pre-nómina/ }).click();
    const verifyAll = dialog(page, "Verificar toda la pre-nómina");
    const markAll = waitForApi(page, "/schedules/payroll/reviews/mark-all");
    await verifyAll.getByRole("button", { name: "Sí, verificar toda" }).click();
    expect((await markAll).ok()).toBe(true);
    await expect(page.getByRole("button", { name: /Cerrar pre-nómina/ })).toBeEnabled({ timeout: 20_000 });
  });

  test("[PAY-01][PAY-M04][ACT-26] cierra la semana y reabre desde el historial", async ({ page }) => {
    await loginAcme(page, "admin");
    const report = weeklyReport(page);
    await gotoRoute(page, "/schedules/payroll");
    expect((await report).ok()).toBe(true);

    // Cierre con confirmación (PAY-M04). Si quedó algún departamento pendiente
    // (estado compartido del archivo), se verifica todo antes de continuar.
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });
    const closeButton = page.getByRole("button", { name: /Cerrar pre-nómina/ });
    const verifyAllButton = page.getByRole("button", { name: /Verificar toda la pre-nómina/ });
    await expect
      .poll(async () => (await closeButton.isEnabled()) || (await verifyAllButton.isVisible().catch(() => false)), {
        timeout: 20_000,
      })
      .toBe(true);
    if (await closeButton.isDisabled()) {
      await verifyAllButton.click();
      const verifyAll = dialog(page, "Verificar toda la pre-nómina");
      const markAll = waitForApi(page, "/schedules/payroll/reviews/mark-all");
      await verifyAll.getByRole("button", { name: "Sí, verificar toda" }).click();
      expect((await markAll).ok()).toBe(true);
    }
    await expect(closeButton).toBeEnabled({ timeout: 20_000 });
    await closeButton.click();
    const closeDialog = dialog(page, "Cerrar la semana");
    await expect(closeDialog).toBeVisible();
    await expect(closeDialog).toContainText("pre-nómina de la semana");
    const closeResponse = waitForApi(page, "/schedules/payroll/close");
    await closeDialog.getByRole("button", { name: "Cerrar semana" }).click();
    expect((await closeResponse).ok()).toBe(true);
    await expect(page.getByRole("button", { name: /Reabrir semana/ })).toBeVisible();
    await expect(page.getByText(/Pre-nómina cerrada por/)).toBeVisible();

    // Historial (PAY-02): la semana recién cerrada con su revisión por depto.
    const closures = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.endsWith("/schedules/payroll/closures")
    );
    await page.getByRole("button", { name: /Historial/ }).first().click();
    await expect(page).toHaveURL(/\/schedules\/payroll\/history$/);
    expect((await closures).ok()).toBe(true);
    await expect(page.getByText("Historial de pre-nóminas").first()).toBeVisible();
    await expect(page.getByText("Cerrada").first()).toBeVisible();
    await page.getByRole("button", { name: /Ver detalle/ }).first().click();
    await expect(page.getByText("Revisión por departamento")).toBeVisible();

    // Reapertura desde el historial: la semana queda como Reabierta.
    const reopenResponse = waitForApi(page, "/schedules/payroll/reopen");
    await page.getByRole("button", { name: "Reabrir", exact: true }).first().click();
    expect((await reopenResponse).ok()).toBe(true);
    await expect(page.getByText("Reabierta").first()).toBeVisible();
  });

  test("[PAY-01][PAY-M01] los avisos de la semana abren su diálogo", async ({ page }) => {
    await loginAcme(page, "admin");
    const report = weeklyReport(page);
    await gotoRoute(page, "/schedules/payroll");
    expect((await report).ok()).toBe(true);

    const bell = page.locator('button[title="Avisos de la semana"]');
    if ((await bell.count()) === 0) {
      test.skip(true, "El seed no deja personas sin reloj/sin horario para el aviso");
      return;
    }
    await bell.first().click();
    const notices = dialog(page, "Avisos de la semana");
    await expect(notices).toBeVisible();
    await expect(notices.getByText(/sin vínculo al reloj|sin horario asignado/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(notices).toBeHidden();
  });
});
