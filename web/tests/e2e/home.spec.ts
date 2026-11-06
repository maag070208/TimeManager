import { expect, test } from "@playwright/test";
import { ACME, BETA, PLATFORM, loginAs } from "./helpers";

/**
 * Inicio (`/`) según el tipo de sesión:
 *   - ADMIN de plataforma sin cliente elegido → consola de clientes.
 *   - Cualquier otra sesión → inicio del cliente (bloques de primeros pasos y asistencia).
 *   - CLIENT_STAFF solo ve lo suyo y no entra por URL a pantallas prohibidas.
 */
test.describe("inicio de plataforma", () => {
  test("el ADMIN de plataforma ve la consola de clientes en /", async ({ page }) => {
    await loginAs(page, "platform");

    await expect(page.getByRole("heading", { level: 1, name: "Panel de TimeManager" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Clientes", exact: true })).toBeVisible();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByText(ACME.name, { exact: true })).toBeVisible();
    await expect(table.getByText(BETA.name, { exact: true })).toBeVisible();
    await expect(table.getByText("Cliente", { exact: true })).toBeVisible();
    await expect(table.getByText("Estado", { exact: true })).toBeVisible();

    // KPIs y alta de clientes disponibles para el ADMIN.
    await expect(page.getByText("Suspendidos", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuevo cliente" })).toBeVisible();
    await expect(table.getByRole("button", { name: "Entrar" })).toHaveCount(2);
  });

  test("la plataforma sin cliente elegido no entra a pantallas de cliente", async ({ page }) => {
    await loginAs(page, "platform");
    await expect(page.getByRole("heading", { level: 1, name: "Panel de TimeManager" })).toBeVisible();

    // `/employees` es pantalla de cliente: PrivateRoutes devuelve a la consola.
    await page.goto(`${PLATFORM.base}/#/employees`);
    await expect(page).toHaveURL(/localhost:5106\/#\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de TimeManager" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Personal" })).toHaveCount(0);
  });
});

test.describe("inicio de un cliente", () => {
  test("el CLIENT_ADMIN ve el inicio de su cliente con primeros pasos y asistencia", async ({ page }) => {
    await loginAs(page, "admin", "acme");

    // Saludo del inicio del cliente (nombre de pila de la persona).
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Ana" })).toBeVisible();
    await expect(page.getByText(/Cliente E2E Acme · /)).toBeVisible();

    // Bloques del inicio (no la consola de plataforma).
    await expect(page.getByRole("heading", { level: 3, name: "Primeros pasos" })).toBeVisible();
    await expect(page.getByText("Hoy", { exact: true })).toBeVisible();
    await expect(page.getByText(/sin horario/).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Pendientes de configuración" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Panel de TimeManager" })).toHaveCount(0);
  });

  test("el personal solo ve su inicio y no entra a rutas prohibidas", async ({ page }) => {
    await loginAs(page, "staff", "acme");

    await expect(page.getByRole("heading", { level: 1, name: "Hola, Sergio" })).toBeVisible();
    // CLIENT_STAFF solo tiene `attendance.view`: ve su resumen, no los bloques de gestión.
    await expect(page.getByText("Hoy", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Primeros pasos" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Expedientes" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "Personal" })).toHaveCount(0);

    // Rutas de administración: el gate por permiso regresa al inicio.
    await page.goto(`${ACME.base}/#/roles`);
    await expect(page).toHaveURL(/acme\.localhost:5106\/#\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Sergio" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /Roles/ })).toHaveCount(0);

    await page.goto(`${ACME.base}/#/employees`);
    await expect(page).toHaveURL(/acme\.localhost:5106\/#\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Personal" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Sergio" })).toBeVisible();
  });
});
