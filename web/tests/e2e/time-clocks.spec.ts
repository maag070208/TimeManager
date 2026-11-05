import { expect, test, type Page } from "@playwright/test";
import { ACME } from "./helpers";
import { loginReady } from "./session";

/**
 * Relojes checadores (E2E-3). El seed deja "Entrada principal" apuntando al
 * mock ISAPI (http://127.0.0.1:4801) y la API resuelve los días con la zona
 * del cliente (America/Mexico_City), no con la del navegador: fijamos la zona
 * del navegador a la del cliente para que "Hoy" sea el mismo día en ambos.
 */
test.use({ timezoneId: "America/Mexico_City" });

const BASE = ACME.base;
const MOCK_URL = "http://127.0.0.1:4801";

const route = (path: string) => `${BASE}/#${path}`;

/** Entra por la UI y espera el inicio del cliente. */
async function enter(page: Page): Promise<void> {
  await loginReady(page, BASE, ACME.admin, /Hola, Ana/);
}

/** Va a una ruta hash y espera el ancla de esa pantalla. */
async function open(page: Page, path: string, anchor: string): Promise<void> {
  await page.goto(route(path));
  await expect(page.getByText(anchor).first()).toBeVisible({ timeout: 20_000 });
}

test.describe("relojes checadores", () => {
  test("la lista muestra el reloj dado de alta (serial y URL del mock)", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");

    await expect(page.getByText("Entrada principal").first()).toBeVisible();
    await expect(page.getByText(MOCK_URL).first()).toBeVisible();
    await expect(page.getByText("Checadas guardadas").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Dar de alta un reloj/ })).toBeVisible();
    await expect(page.getByText("Ver detalles").first()).toBeVisible();
  });

  test("el dashboard carga el estado del reloj", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks/dashboard", "Estado de cada reloj, alertas y checadas de hoy.");

    await expect(page.getByText("Dashboard del reloj").first()).toBeVisible();
    await expect(page.getByText("Entrada principal").first()).toBeVisible();
    await expect(page.getByText("En línea").first()).toBeVisible();
    await expect(page.getByText("Checadas hoy").first()).toBeVisible();
    await expect(page.getByText("Checadas de hoy por hora").first()).toBeVisible();
    // Checadas sembradas de acme.staff.
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible();
  });

  test("la pantalla de personas del reloj lee el equipo simulado", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks/people", "renombra y da de baja personas en el reloj");

    await expect(page.getByText("Personas del reloj").first()).toBeVisible();
    await expect(page.getByText("PERSONA PRUEBA UNO").first()).toBeVisible();
    await expect(page.getByText(/persona\(s\) en el reloj/).first()).toBeVisible();
  });

  test("la pantalla de inspección lee identidad, personas y tarjetas del reloj", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks/inspect", "Personas, tarjetas y eventos que el reloj tiene guardados");

    await expect(page.getByText("Mock Access Controller").first()).toBeVisible();
    await expect(page.getByText("MOCK-SERIAL-0001").first()).toBeVisible();

    await page.getByRole("tab", { name: "Personas" }).click();
    await expect(page.getByText("PERSONA PRUEBA UNO").first()).toBeVisible();

    await page.getByRole("tab", { name: "Tarjetas" }).click();
    await expect(page.getByText("9000000001").first()).toBeVisible();
  });

  test("se edita el reloj y se habilita/deshabilita la escritura", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");

    await page.getByText("Entrada principal").first().click();
    await expect(page.getByText("Configuración del reloj").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Editar/ }).first().click();

    const dialog = page.locator('[data-it-dialog="true"]');
    await expect(dialog.getByText("Editar Entrada principal")).toBeVisible();
    const write = dialog.locator('input[name="checadorRelojEditarEscritura"]');
    // El seed lo deja habilitado.
    await expect(write).toBeChecked();

    // Deshabilitar escritura y guardar.
    await write.uncheck({ force: true });
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/Entrada principal actualizado/)).toBeVisible({ timeout: 20_000 });
    // El estado del reloj se recarga después de guardar; hay que esperar ese refresco.
    await page.waitForTimeout(1_500);

    // Reabrir: el cambio persistió.
    await page.getByRole("button", { name: /Editar/ }).first().click();
    await expect(dialog.getByText("Editar Entrada principal")).toBeVisible();
    await expect(write).not.toBeChecked();

    // Dejarlo como estaba (habilitado).
    await write.check({ force: true });
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/Entrada principal actualizado/)).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
  });

  test("se da de alta un reloj nuevo contra el mock (serial leído del equipo)", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");

    await page.getByRole("button", { name: /Dar de alta un reloj/ }).click();
    const dialog = page.locator('[data-it-dialog="true"]');
    await expect(dialog.getByText("Dar de alta un reloj")).toBeVisible();

    // La UI no captura el serial: lo lee del equipo al conectarse (mock: MOCK-SERIAL-0001).
    // La URL sembrada (127.0.0.1) ya está ocupada; localhost:4801 llega al mismo mock.
    await dialog.locator('input[name="checadorRelojUrl"]').fill("http://localhost:4801");
    await dialog.locator('input[name="checadorRelojNombre"]').fill("Reloj E2E Nuevo");
    await dialog.getByRole("button", { name: "Dar de alta" }).click();

    await expect(page.getByText(/dado de alta: ya está trayendo sus checadas/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Reloj E2E Nuevo").first()).toBeVisible();
    await expect(page.getByText("http://localhost:4801").first()).toBeVisible();

    // El serial real del mock aparece en el detalle (configuración leída en vivo).
    await page.getByText("Reloj E2E Nuevo").first().click();
    await expect(page.getByText("Configuración del reloj").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Número de serie").first()).toBeVisible();
    await expect(page.getByText("MOCK-SERIAL-0001").first()).toBeVisible({ timeout: 30_000 });
  });
});
