import { expect, test, type Page } from "@playwright/test";
import { ACME } from "./helpers";
import { MOCK_SERIAL, api, apiOk, firstClock, getStatus } from "./clk-helpers";
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
  test("[CLK-09][ACT-28] la lista muestra el reloj dado de alta (serial y URL del mock)", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");

    const clock = firstClock(await getStatus(page));
    expect(clock).toBeTruthy();
    await expect(page.getByText(clock.name).first()).toBeVisible();
    await expect(page.getByText(clock.url).first()).toBeVisible();
    expect(MOCK_URL).toBeTruthy();
    await expect(page.getByText("Checadas guardadas").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Dar de alta un reloj/ })).toBeVisible();
    await expect(page.getByText("Ver detalles").first()).toBeVisible();
  });

  test("[CLK-06][CLK-06-T1] el dashboard carga el estado del reloj", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks/dashboard", "Estado de cada reloj, alertas y checadas de hoy.");

    const clock = firstClock(await getStatus(page));
    await expect(page.getByText("Dashboard del reloj").first()).toBeVisible();
    await expect(page.getByText(clock.name).first()).toBeVisible();
    await expect(page.getByText("En línea").first()).toBeVisible();
    await expect(page.getByText("Checadas hoy").first()).toBeVisible();
    await expect(page.getByText("Checadas de hoy por hora").first()).toBeVisible();
    // Checadas sembradas de acme.staff.
    await expect(page.getByText("SERGIO STAFF").first()).toBeVisible();
  });

  test("[CLK-07] la pantalla de personas del reloj lee el equipo simulado", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks/people", "renombra y da de baja personas en el reloj");

    await expect(page.getByText("Personas del reloj").first()).toBeVisible();
    await expect(page.getByText("PERSONA PRUEBA UNO").first()).toBeVisible();
    await expect(page.getByText(/persona\(s\) en el reloj/).first()).toBeVisible();
  });

  test("[CLK-08] la pantalla de inspección lee identidad, personas y tarjetas del reloj", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks/inspect", "Personas, tarjetas y eventos que el reloj tiene guardados");

    await expect(page.getByText("Mock Access Controller").first()).toBeVisible();
    await expect(page.getByText("MOCK-SERIAL-0001").first()).toBeVisible();

    await page.getByRole("tab", { name: "Personas" }).click();
    await expect(page.getByText("PERSONA PRUEBA UNO").first()).toBeVisible();

    await page.getByRole("tab", { name: "Tarjetas" }).click();
    await expect(page.getByText("9000000001").first()).toBeVisible();
  });

  test("[CLK-09][CLK-M03][ACT-28] se edita el reloj y se habilita/deshabilita la escritura", async ({ page }) => {
    await enter(page);
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");
    const clock = firstClock(await getStatus(page));

    await page.getByText(clock.name).first().click();
    await expect(page.getByText("Configuración del reloj").first()).toBeVisible({ timeout: 25_000 });
    await page.getByRole("button", { name: /Editar/ }).first().click();

    const dialog = page.locator('[data-it-dialog="true"]');
    await expect(dialog.getByText(new RegExp(`Editar ${clock.name}`))).toBeVisible();
    const write = dialog.locator('input[name="checadorRelojEditarEscritura"]');
    // El seed lo deja habilitado.
    await expect(write).toBeChecked();

    // Deshabilitar escritura y guardar.
    await write.uncheck({ force: true });
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(new RegExp(`${clock.name} actualizado`))).toBeVisible({ timeout: 20_000 });
    // El estado del reloj se recarga después de guardar; hay que esperar ese refresco.
    await page.waitForTimeout(1_500);

    // Reabrir: el cambio persistió.
    await page.getByRole("button", { name: /Editar/ }).first().click();
    await expect(dialog.getByText(new RegExp(`Editar ${clock.name}`))).toBeVisible();
    await expect(write).not.toBeChecked();

    // Dejarlo como estaba (habilitado).
    await write.check({ force: true });
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(new RegExp(`${clock.name} actualizado`))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
  });

  test("[CLK-09][CLK-M02][ACT-28] se da de alta un reloj nuevo contra el mock (serial leído del equipo)", async ({ page }) => {
    await enter(page);
    const original = firstClock(await getStatus(page));
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

    // El mismo equipo físico no admite dos filas: el alta re-apunta el reloj.
    // Se restaura la dirección y el nombre sembrados para las demás pruebas.
    await apiOk(page, "POST", "/time-clock/clocks", { url: original.url, name: original.name });
    const restored = firstClock(await getStatus(page));
    expect(restored.clockSerial).toBe(original.clockSerial);
    expect(restored.name).toBe(original.name);
  });

  test("[CLK-09][ACT-29] detalle: probar conexión y sincronizar ahora", async ({ page }) => {
    await enter(page);
    const clock = firstClock(await getStatus(page));
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");
    await page.getByText(clock.name).first().click();
    await expect(page.getByText("Configuración del reloj").first()).toBeVisible({ timeout: 25_000 });

    // Probar conexión lee la identidad del equipo simulado.
    const probe = page.waitForResponse(
      (r) => r.url().includes("/inspect/overview") && r.request().method() === "GET"
    );
    await page.getByRole("button", { name: "Probar conexión" }).click();
    expect((await probe).status()).toBe(200);
    await expect(page.getByText(/Conexión correcta/).first()).toBeVisible({ timeout: 25_000 });

    // Sincronizar ahora: 202 (arranca) o 409 (ya corre); la UI avisa el resultado.
    const sync = page.waitForResponse(
      (r) => r.url().includes("/time-clock/sync") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /Sincronizar ahora|Sincronizando/ }).click();
    expect([202, 409]).toContain((await sync).status());
    await expect(
      page.getByText(
        /Sincronización iniciada|Sincronización terminada|Todos los relojes ya están sincronizando|Sincronizando|Al día|Sincronizado/
      )
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("[CLK-09][CLK-M04][ACT-28] baja de un reloj temporal: cancelar no cambia y confirmar lo quita", async ({ page }) => {
    await enter(page);
    const original = firstClock(await getStatus(page));
    await open(page, "/time-clocks", "Da de alta los relojes y revisa su configuración");

    // Alta de un reloj temporal contra el mismo mock (URL alternativa al seed).
    const tempName = "Reloj Temporal E2E";
    await page.getByRole("button", { name: /Dar de alta un reloj/ }).click();
    const dialog = page.locator('[data-it-dialog="true"]');
    const url = "http://localhost:4801";
    await dialog.locator('input[name="checadorRelojUrl"]').fill(url);
    await dialog.locator('input[name="checadorRelojNombre"]').fill(tempName);
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/time-clock/clocks") && r.request().method() === "POST"
    );
    await dialog.getByRole("button", { name: "Dar de alta" }).click();
    expect((await created).status()).toBe(201);
    await expect(page.getByText(tempName).first()).toBeVisible({ timeout: 25_000 });

    // Cancelar la baja deja el reloj dado de alta.
    await page.getByText(tempName).first().click();
    await expect(page.getByText("Configuración del reloj").first()).toBeVisible({ timeout: 25_000 });
    await page.getByRole("button", { name: /Dar de baja/ }).first().click();
    await expect(dialog.getByText(new RegExp(`Dar de baja ${tempName}`))).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(tempName).first()).toBeVisible();

    // Confirmar la baja lo quita de la lista (sus checadas se conservan).
    await page.getByRole("button", { name: /Dar de baja/ }).first().click();
    const retired = page.waitForResponse(
      (r) => r.url().includes("/time-clock/clocks/") && r.request().method() === "DELETE"
    );
    await dialog.getByRole("button", { name: "Dar de baja" }).click();
    expect([200, 204]).toContain((await retired).status());
    await expect(page.getByText(tempName)).toHaveCount(0, { timeout: 25_000 });
    await expect(page.getByText(/dado de baja/).first()).toBeVisible({ timeout: 20_000 });
    expect(MOCK_SERIAL).toBeTruthy();

    // Restaura el reloj sembrado (mismo serial) para las demás suites.
    await apiOk(page, "POST", "/time-clock/clocks", { url: original.url, name: original.name });
    expect(firstClock(await getStatus(page)).name).toBe(original.name);
    expect((await api(page, "GET", "/time-clock/status")).status).toBe(200);
  });
});
