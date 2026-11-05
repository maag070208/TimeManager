import { expect, test } from "@playwright/test";
import { PLATFORM } from "./helpers";

test.describe("Landing pública", () => {
  test("carga sin sesión con el bento, el toggle de tema y el acceso al login", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/landing`);

    await expect(page.getByRole("heading", { level: 1, name: /El registro de jornada/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Solicitar demo/i }).first()).toBeVisible();
    await expect(page.getByText(/Todo lo que tu operación necesita/i)).toBeVisible();
    await expect(page.getByText(/Precios simples por tamaño de empresa/i)).toBeVisible();
    await expect(page.getByText("TimeManagerAgent").first()).toBeVisible();
    // Planes: tres tarjetas con sus límites.
    await expect(page.getByText("500 personas")).toBeVisible();
    await expect(page.getByText("750 personas")).toBeVisible();
    await expect(page.getByText("1,000 personas")).toBeVisible();

    // Tema claro/oscuro.
    const root = page.locator(".tm-landing");
    await expect(root).toHaveAttribute("data-theme", /light|dark/);
    const before = await root.getAttribute("data-theme");
    await page.getByRole("button", { name: /Cambiar a tema/i }).click();
    await expect(root).not.toHaveAttribute("data-theme", before ?? "light");

    // FAQ interactivo.
    await page.getByText("¿Sirve para home office y personal en campo?").click();
    await expect(page.getByText(/Además del reloj, cada persona tiene su portal/i)).toBeVisible();

    // El tema elegido persiste al recargar.
    await page.reload();
    await expect(page.locator(".tm-landing")).toHaveAttribute("data-theme", before === "light" ? "dark" : "light");

    // Acceso al sistema desde la landing.
    await page.getByRole("link", { name: /^Iniciar sesión$/ }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  test("desde el login se puede volver a la landing", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/login`);
    await page.getByRole("link", { name: /Conoce TimeManager/i }).click();
    await expect(page).toHaveURL(/\/landing/);
    await expect(page.getByRole("heading", { level: 1, name: /El registro de jornada/i })).toBeVisible();
  });
});
