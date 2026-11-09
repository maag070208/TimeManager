import { expect, test } from "@playwright/test";
import { PLATFORM } from "./helpers";

const HERO = /Cada checada cuenta/i;

test.describe("Landing pública", () => {
  test("carga sin sesión con el recorrido, capturas reales, planes y acceso al login", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/landing`);

    await expect(page.getByRole("heading", { level: 1, name: HERO })).toBeVisible();
    await expect(page).toHaveTitle(/CheckLab · Control de asistencia/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/landing\/og-image\.jpg$/);
    const demo = page.getByRole("link", { name: /Solicitar demo/i }).first();
    await expect(demo).toBeVisible();
    await expect(demo).toHaveAttribute("href", /^https:\/\/wa\.me\/525530451099\?text=/);

    // Capturas reales con tamaño explícito (sin saltos de layout).
    const hero = page.getByRole("img", { name: /Inicio de CheckLab/i });
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("width", /\d+/);
    await expect(hero).toHaveAttribute("height", /\d+/);
    expect(await hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Recorrido del producto: checar → ver el día → horas extra → pre-nómina → prueba.
    await expect(page.getByText(/De la checada al cierre de nómina/i)).toBeVisible();
    for (const step of ["Checar", "Ver el día", "Horas extra LFT", "Pre-nómina", "Prueba ante la autoridad"]) {
      await expect(page.getByText(step, { exact: true }).first()).toBeAttached();
    }
    await expect(page.getByText(/Todo lo que RH opera cada semana/i)).toBeVisible();
    await expect(page.getByText("CheckLab Agent").first()).toBeAttached();

    // Planes por persona y tabla comparativa.
    await expect(page.getByText("1–10 personas", { exact: true })).toBeAttached();
    await expect(page.getByText("11–49 personas", { exact: true })).toBeAttached();
    await expect(page.getByText("50+ personas", { exact: true })).toBeAttached();
    await expect(page.getByText("$69").first()).toBeAttached();
    await expect(page.getByText("$59").first()).toBeAttached();
    await expect(page.getByText("$49").first()).toBeAttached();
    await expect(page.getByText("Qué incluye cada plan")).toBeAttached();
    await expect(page.getByText(/Precio por persona activa al mes, más IVA/i)).toBeAttached();

    // Sin toggle de tema: la landing es clara como la app.
    await expect(page.getByRole("button", { name: /Cambiar a tema/i })).toHaveCount(0);

    // FAQ interactivo.
    await page.getByText("¿Sirve para home office y personal en campo?").click();
    await expect(page.getByText(/no hay rastreo continuo/i).last()).toBeVisible();

    // Acceso al sistema desde la landing.
    await page.getByRole("link", { name: /^Iniciar sesión$/ }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  test("desde el login se puede volver a la landing", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/login`);
    await page.getByRole("link", { name: /Conoce CheckLab/i }).click();
    await expect(page).toHaveURL(/\/landing/);
    await expect(page.getByRole("heading", { level: 1, name: HERO })).toBeVisible();
  });
});
