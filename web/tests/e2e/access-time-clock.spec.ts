import { expect, test, type Page } from "@playwright/test";
import { getEmployees, getStatus } from "./clk-helpers";
import { enterAcme, openAcme } from "./clk-helpers";

/**
 * CLK-01..CLK-05 — Checadas y RH del reloj, operadas por acme.admin:
 * resumen (CLK-01), asistencias (CLK-02), padrón (CLK-03), empleados del reloj
 * (CLK-04) y diferencias (CLK-05). Datos descubiertos por API; el personal de
 * beta nunca debe aparecer en la sesión de acme.
 */
test.use({ timezoneId: "America/Mexico_City" });

/** Datos que solo existen en beta: no deben aparecer en la sesión de acme. */
const BETA_MARKERS = /BRENDA|Brenda|BETO|Beto|E2E-BETA|#2001|#2002/;

const enter = (page: Page) => enterAcme(page);

async function expectNoBeta(page: Page): Promise<void> {
  await expect(page.getByText(BETA_MARKERS)).toHaveCount(0);
}

async function download(page: Page, button: RegExp): Promise<string> {
  const [file] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.getByRole("button", { name: button }).first().click(),
  ]);
  return file.suggestedFilename();
}

test.describe("checadas del reloj (RH)", () => {
  test("[CLK-01] resumen: checadas del personal del reloj y filtros de periodo/empleado", async ({ page }) => {
    await enter(page);
    await openAcme(page, "/hr/time-clock", "Registros de los relojes Hikvision");

    await expect(page.getByText("Sincronización con los relojes").first()).toBeVisible();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    await expectNoBeta(page);

    // Periodo: últimos 7 días y de vuelta a hoy (el seed siembra la semana).
    await page.getByRole("button", { name: "Últimos 7 días" }).click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    await page.getByRole("button", { name: "Hoy", exact: true }).click();
    await expect(
      page.getByText("SERGIO STAFF").first().or(page.getByText("No se encontraron resultados")).first()
    ).toBeVisible({ timeout: 25_000 });
    await page.getByRole("button", { name: "Últimos 7 días" }).click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });

    // Filtro por empleado: el personal de beta no aparece ni buscándolo.
    const employee = page.locator('input[name="checadorEmployee"]');
    await employee.fill("Sergio");
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    await employee.fill("Brenda");
    await expect(page.getByText("No se encontraron resultados")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("SERGIO STAFF")).toHaveCount(0);

    // Filtro por método (rostro) y limpiar (se usa la semana sembrada).
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("button", { name: "Últimos 7 días" }).click();
    await page.getByRole("button", { name: "Rostro", exact: true }).first().click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    await expectNoBeta(page);
  });

  test("[CLK-01][ACT-29] importar un rango y sincronizar ahora desde la UI", async ({ page }) => {
    await enter(page);
    await openAcme(page, "/hr/time-clock", "Registros de los relojes Hikvision");

    // Sincronizar ahora: la API responde 202 (arranca) o 409 (ya en curso).
    const sync = page.waitForResponse(
      (r) => r.url().includes("/time-clock/sync") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /Sincronizar ahora/ }).first().click();
    expect([202, 409]).toContain((await sync).status());

    // Importar el rango visible (hoy): 202 al iniciar; 409 si algo corre ya.
    const importResponse = page.waitForResponse(
      (r) => r.url().includes("/time-clock/import") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /Importar de los relojes/ }).first().click();
    expect([202, 409, 503]).toContain((await importResponse).status());

    // La pantalla refleja el estado de sincronización/importación sin romperse.
    await expect(
      page.getByText(/Importando|Importación terminada|Sincronizando|Al día|Sin conexión|Sincronización terminada/)
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("[CLK-01] exporta las checadas a CSV", async ({ page }) => {
    await enter(page);
    await openAcme(page, "/hr/time-clock", "Registros de los relojes Hikvision");
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    const filename = await download(page, /^CSV$/);
    expect(filename.toLowerCase()).toContain(".csv");
  });

  test("[CLK-02] entradas/salidas: jornada de hoy, periodos y búsqueda", async ({ page }) => {
    await enter(page);
    await openAcme(page, "/hr/time-clock/entries-exits", "Jornadas armadas con las checadas del reloj");

    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/\d{2}:\d{2}/).first()).toBeVisible();
    await expectNoBeta(page);

    // Periodo: día, semana y quincena.
    for (const period of ["Hoy", "Semanal", "Quincenal"]) {
      await page.getByText(period, { exact: true }).first().click();
      await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    }

    // Búsqueda: acme.staff sí; el personal de beta no.
    const search = page.locator('input[name="accessReportEmployee"]');
    await search.fill("Sergio");
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });
    await search.fill("Brenda");
    await expect(page.getByText("SERGIO STAFF")).toHaveCount(0, { timeout: 25_000 });
    await expect(page.getByText("BRENDA")).toHaveCount(0);
  });

  test("[CLK-02] exporta CSV y PDF de asistencias con los filtros vigentes", async ({ page }) => {
    await enter(page);
    await openAcme(page, "/hr/time-clock/entries-exits", "Jornadas armadas con las checadas del reloj");
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 25_000 });

    const csv = await download(page, /Exportar CSV/);
    expect(csv.toLowerCase()).toContain(".csv");
    const pdf = await download(page, /^PDF$/);
    expect(pdf.toLowerCase()).toContain(".pdf");
  });

  test("[CLK-03] padrón del reloj: carga sus secciones y no muestra datos de beta", async ({ page }) => {
    await enter(page);
    await openAcme(page, "/hr/time-clock/roster", "Personas de los relojes que cuentan para entradas y salidas");

    await expect(page.getByText(/Todavía no se ha revisado el padrón\.|Última revisión:/)).toBeVisible();
    for (const section of ["Nuevos en el reloj", "Bajas pendientes de motivo", "Reaparecieron después de una baja"]) {
      await expect(page.getByText(section)).toBeVisible();
    }
    await expectNoBeta(page);
  });

  test("[CLK-04] empleados del reloj: números, sugerencias y sin datos de beta", async ({ page }) => {
    await enter(page);
    const employees = await getEmployees(page);
    test.skip((employees.data as any[]).length === 0, "El reloj no tiene números vistos");
    const first = (employees.data as any[])[0];

    await openAcme(page, "/hr/time-clock/employees", "Relaciona cada número del reloj con su usuario");
    await expect(page.getByText("En el reloj").first()).toBeVisible();
    await expect(page.getByText("#" + first.employeeNumber).first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/vinculad|Sin vincular|Sugerencia/i).first()).toBeVisible();
    await expectNoBeta(page);
  });

  test("[CLK-05] diferencias: conciliación en lectura y sin datos de beta", async ({ page }) => {
    await enter(page);
    const employees = await getEmployees(page);
    test.skip((employees.data as any[]).length === 0, "El reloj no tiene números vistos");
    const first = (employees.data as any[])[0];

    await openAcme(page, "/hr/time-clock/employees/differences", "Concilia los números del reloj con las personas");
    await expect(page.getByText("Del reloj").first()).toBeVisible();
    await expect(page.getByText("Del sistema").first()).toBeVisible();
    await expectNoBeta(page);

    // El seed vincula sus números: se apaga el filtro "solo sin vincular".
    const onlyMissing = page.getByText("Solo sin vincular", { exact: true }).first();
    await expect(onlyMissing).toBeVisible({ timeout: 25_000 });
    await onlyMissing.click();
    const onlyFree = page.getByText("Solo sin número", { exact: true }).first();
    await expect(onlyFree).toBeVisible({ timeout: 20_000 });
    await onlyFree.click();
    await expect(page.getByTestId("fila-reloj").first()).toBeVisible({ timeout: 20_000 });

    // Elegir un número y una persona sólo habilita la acción: no escribe aún.
    await page.getByTestId("fila-reloj").first().click();
    await page.getByTestId("fila-persona").first().click();
    await expect(page.getByRole("button", { name: /Asignar|Cambiar/ })).toBeEnabled();

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Elige un número del reloj")).toBeVisible();
    expect((await getStatus(page)).devices.length).toBeGreaterThan(0);
    expect(first.employeeNumber).toBeTruthy();
    await expectNoBeta(page);
  });
});
