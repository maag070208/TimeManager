import { expect, test } from "@playwright/test";
import { gotoRoute, loginAcme } from "./ops-helpers";

/**
 * E2E-2 · Tiempo extra y Pre Nómina.
 *
 * Con los datos sembrados (`api/scripts/e2e-seed.ts`) no hay horarios
 * asignados ni días de tiempo extra aprobados: Tiempo extra arranca vacío
 * (estado vacío real del reporte) y Pre Nómina trae los departamentos con 0 h.
 * acme.admin puede aprobar (`overtime.approve`); acme.rh entra en solo lectura.
 */

const waitOvertimeQuery = (page: import("@playwright/test").Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/overtime/query")
  );

const waitWeeklyAttendance = (page: import("@playwright/test").Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/schedules/weekly-attendance")
  );

test.describe("tiempo extra (acme.admin)", () => {
  test("abre la aprobación con el periodo vacío y consulta otro periodo", async ({ page }) => {
    await loginAcme(page, "admin");
    const initialQuery = waitOvertimeQuery(page);
    await gotoRoute(page, "/schedules/overtime/approval");
    expect((await initialQuery).ok()).toBe(true);

    await expect(page.getByText("Consulta y aprobación de horas extra del personal.")).toBeVisible();
    await expect(page.getByText("Horas extra por semana (LFT 2026)")).toBeVisible();
    // Indicadores del periodo y pestañas por estatus.
    await expect(page.getByText("Por aprobar", { exact: true })).toBeVisible();
    await expect(page.getByText("Aprobado", { exact: true })).toBeVisible();
    await expect(page.getByText("Rechazado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pendientes/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Aprobadas/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rechazadas/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Todas/ })).toBeVisible();
    // Sin datos sembrados de tiempo extra: estado vacío del reporte.
    await expect(page.getByText("No se encontraron resultados")).toBeVisible();

    // Acción mínima: cambiar de periodo y de estatus vuelve a consultar.
    const monthlyQuery = waitOvertimeQuery(page);
    await page.getByRole("button", { name: "Mensual", exact: true }).click();
    expect((await monthlyQuery).ok()).toBe(true);

    const approvedQuery = waitOvertimeQuery(page);
    await page.getByRole("button", { name: /^Aprobadas/ }).click();
    expect((await approvedQuery).ok()).toBe(true);
    await expect(page.getByText("No se encontraron resultados")).toBeVisible();
    await expect(page.getByText("No se pudo guardar la decisión")).toHaveCount(0);
  });
});

test.describe("tiempo extra (acme.rh, solo lectura)", () => {
  test("no muestra pestañas ni acciones de aprobación", async ({ page }) => {
    await loginAcme(page, "rh");
    const initialQuery = waitOvertimeQuery(page);
    await gotoRoute(page, "/schedules/overtime/approval");
    expect((await initialQuery).ok()).toBe(true);

    // RH solo ve lo aprobado: una pestaña y sin botones de decisión.
    await expect(page.getByRole("button", { name: /^Aprobadas/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pendientes/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Rechazadas/ })).toHaveCount(0);
    await expect(page.getByText("Rechazado", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No se encontraron resultados")).toBeVisible();
  });
});

test.describe("pre nómina (acme.admin)", () => {
  test("carga el reporte semanal y navega entre semana e historial", async ({ page }) => {
    await loginAcme(page, "admin");
    const initialReport = waitWeeklyAttendance(page);
    await gotoRoute(page, "/schedules/payroll");
    expect((await initialReport).ok()).toBe(true);

    await expect(page.getByText(/^Semana \d+ – \d+/).first()).toBeVisible();
    await expect(page.getByText("Personas con checadas", { exact: true })).toBeVisible();
    await expect(page.getByText("Horas trabajadas", { exact: true })).toBeVisible();
    await expect(page.getByText("Faltas sin justificar", { exact: true })).toBeVisible();
    // Departamentos sembrados, sin horas en la semana.
    const table = page.getByRole("table", { name: "Departamento" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("cell", { name: "Recursos Humanos" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "Operaciones" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "Por revisar" }).first()).toBeVisible();

    // Historial de cierres: sin semanas cerradas en el seed.
    await page.getByRole("tab", { name: "Historial de cierres" }).click();
    await expect(page.getByText("Todavía no hay semanas cerradas.")).toBeVisible();

    // Acción mínima: volver a la semana y consultar la anterior.
    await page.getByRole("tab", { name: "Semana" }).click();
    const previousWeek = waitWeeklyAttendance(page);
    await page.getByRole("button", { name: "Semana anterior" }).click();
    expect((await previousWeek).ok()).toBe(true);
    await expect(page.getByText("No se pudo cargar el reporte")).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Departamento" })).toBeVisible();
  });
});
