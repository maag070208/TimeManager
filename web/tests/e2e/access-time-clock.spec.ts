import { expect, test, type Page } from "@playwright/test";
import { ACME } from "./helpers";
import { loginReady } from "./session";

/**
 * Checadas / RH del reloj (E2E-3), operado por acme.admin.
 *
 * El seed siembra 2 checadas de hoy para acme.staff (Sergio Staff, número
 * 1003) y otras 2 para beta.staff. La API resuelve los días con la zona del
 * cliente (America/Mexico_City); fijamos la del navegador a la misma para que
 * "Hoy" signifique el mismo día en la UI y en la API.
 */
test.use({ timezoneId: "America/Mexico_City" });

const BASE = ACME.base;
const route = (path: string) => `${BASE}/#${path}`;

/** Datos que solo existen en beta: no deben aparecer en la sesión de acme. */
const BETA_MARKERS = /BRENDA|Brenda|BETO|Beto|E2E-BETA|#2001|#2002/;

async function enter(page: Page): Promise<void> {
  await loginReady(page, BASE, ACME.admin, /Hola, Ana/);
}

async function open(page: Page, path: string, anchor: string): Promise<void> {
  await page.goto(route(path));
  await expect(page.getByText(anchor).first()).toBeVisible({ timeout: 20_000 });
}

async function expectNoBeta(page: Page): Promise<void> {
  await expect(page.getByText(BETA_MARKERS)).toHaveCount(0);
}

test.describe("checadas del reloj (RH)", () => {
  test("resumen: muestra las checadas de hoy de acme.staff y filtra por periodo/empleado", async ({
    page,
  }) => {
    await enter(page);
    await open(page, "/hr/time-clock", "Registros de los relojes Hikvision");

    await expect(page.getByText("Sincronización con los relojes").first()).toBeVisible();
    // Tabla del día: las dos checadas sembradas de acme.staff.
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("#1003").first()).toBeVisible();
    await expectNoBeta(page);

    // Periodo: últimos 7 días y de vuelta a hoy.
    await page.getByRole("button", { name: "Últimos 7 días" }).click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Hoy", exact: true }).click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });

    // Filtro por empleado: el personal de beta no aparece ni buscándolo.
    const employee = page.locator('input[name="checadorEmployee"]');
    await employee.fill("Sergio");
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await employee.fill("Brenda");
    await expect(page.getByText("No se encontraron resultados")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("SERGIO STAFF")).toHaveCount(0);

    // Filtro por método (las checadas sembradas son de rostro).
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("button", { name: "Rostro", exact: true }).first().click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await expectNoBeta(page);
  });

  test("entradas/salidas: jornada de acme.staff de hoy con periodo y búsqueda", async ({ page }) => {
    await enter(page);
    await open(page, "/hr/time-clock/entries-exits", "Jornadas armadas con las checadas del reloj");

    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("08:02").first()).toBeVisible();
    await expect(page.getByText("17:05").first()).toBeVisible();
    await expectNoBeta(page);

    // Periodo: día y semana.
    await page.getByText("Hoy", { exact: true }).first().click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await page.getByText("Semanal", { exact: true }).first().click();
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });

    // Búsqueda: acme.staff sí; el personal de beta no.
    const search = page.locator('input[name="accessReportEmployee"]');
    await search.fill("Sergio");
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await search.fill("Brenda");
    await expect(page.getByText("SERGIO STAFF")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText("BRENDA")).toHaveCount(0);
  });

  test("padrón del reloj: carga sin checadas de beta", async ({ page }) => {
    await enter(page);
    await open(page, "/hr/time-clock/roster", "Personas de los relojes que cuentan para entradas y salidas");

    await expect(page.getByText("Todavía no se ha revisado el padrón.")).toBeVisible();
    await expect(page.getByText("Nuevos en el reloj")).toBeVisible();
    await expect(page.getByText("Bajas pendientes de motivo")).toBeVisible();
    await expect(page.getByText("Reaparecieron después de una baja")).toBeVisible();
    await expectNoBeta(page);
  });

  test("empleados del reloj: relaciona el número 1003 con acme.staff", async ({ page }) => {
    await enter(page);
    await open(page, "/hr/time-clock/employees", "Relaciona cada número del reloj con su usuario");

    await expect(page.getByText("En el reloj").first()).toBeVisible();
    await expect(page.getByText("Sin vincular").first()).toBeVisible();
    await expect(page.getByText("#1003").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Sugerencia").first()).toBeVisible();
    await expectNoBeta(page);
  });

  test("diferencias: conciliación en lectura (sin asignar) y sin datos de beta", async ({ page }) => {
    await enter(page);
    await open(page, "/hr/time-clock/employees/differences", "Concilia los números del reloj con las personas");

    await expect(page.getByText("Del reloj").first()).toBeVisible();
    await expect(page.getByText("Del sistema").first()).toBeVisible();
    await expect(page.getByText("#1003").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible();
    await expect(page.getByText("Ana Administradora").first()).toBeVisible();
    await expect(page.getByText("Rita Recursos").first()).toBeVisible();
    await expectNoBeta(page);

    // Elige un número del reloj y una persona: hasta confirmar no se escribe nada.
    await page.getByTestId("fila-reloj").filter({ hasText: "#1003" }).first().click();
    await page.getByTestId("fila-persona").filter({ hasText: "Sergio Staff" }).first().click();
    await expect(page.getByRole("button", { name: "Asignar" })).toBeEnabled();
    await expect(page.getByText(/#1003 · SERGIO STAFF/)).toBeVisible();
    await expect(page.getByText("Sergio Staff · #1003")).toBeVisible();

    // Cancelar deja la conciliación como estaba (nada guardado).
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Elige un número del reloj")).toBeVisible();
    await expect(page.getByText("BRENDA")).toHaveCount(0);
  });
});
