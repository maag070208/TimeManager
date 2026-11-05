import { expect, test } from "@playwright/test";
import { ACME, PLATFORM, login, loginForm } from "./helpers";

test.describe("login multi-cliente", () => {
  test("plataforma: el ADMIN entra sin subdominio", async ({ page }) => {
    await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
    await expect(page).toHaveURL(/localhost:5106/);
    await expect(loginForm(page)).toHaveCount(0);
  });

  test("cliente: el CLIENT_ADMIN entra por su subdominio", async ({ page }) => {
    await login(page, { base: ACME.base, username: ACME.admin });
    await expect(page).toHaveURL(/acme\.localhost:5106/);
    await expect(loginForm(page)).toHaveCount(0);
  });

  test("contraseña incorrecta no entra y avisa", async ({ page }) => {
    await page.goto(`${ACME.base}/`);
    await loginForm(page).waitFor({ state: "visible" });
    await page.locator('input[name="username"]').fill(ACME.admin);
    await page.locator('input[name="password"]').fill("contraseña-mala");
    await loginForm(page).locator('button[type="submit"]').click();
    await expect(loginForm(page)).toBeVisible();
  });

  test("el personal de un cliente no puede entrar sin subdominio", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/`);
    await loginForm(page).waitFor({ state: "visible" });
    await page.locator('input[name="username"]').fill(ACME.staff);
    await page.locator('input[name="password"]').fill("E2ePrueba123!");
    await loginForm(page).locator('button[type="submit"]').click();
    await expect(loginForm(page)).toBeVisible();
  });
});
