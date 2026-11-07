import { expect, test } from "@playwright/test";
import { ACME, PLATFORM, login, loginForm } from "./helpers";
import { createTenantViaUi, loginPlatform } from "./platform-kit";

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

test.describe("login con sesión", () => {
  test("[AUTH-01][ACT-01] el login deja la sesión y abre la app privada", async ({ page }) => {
    await login(page, { base: ACME.base, username: ACME.admin });
    await expect(loginForm(page)).toHaveCount(0);
    await expect(page.getByText("Hola, Ana").first()).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText("Hola, Ana").first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("acceso por ruta de cliente y contraseña provisional", () => {
  test("[AUTH-01] un cliente inexistente en la ruta muestra el bloqueo y deja ir a plataforma", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/noexiste/login`);
    await expect(page.getByText("Cliente no encontrado").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Ir al acceso de plataforma" })).toBeVisible();
    await page.getByRole("button", { name: "Ir al acceso de plataforma" }).click();
    await expect(loginForm(page)).toBeVisible({ timeout: 20_000 });
  });

  test("[AUTH-01][AUTH-M1][ACT-02] contraseña provisional: obliga el cambio y entra al inicio", async ({ page, browser }) => {
    await loginPlatform(page);
    const tenant = await createTenantViaUi(page);

    const clientPage = await browser.newPage();
    await clientPage.goto(`${PLATFORM.base}/#/${tenant.slug}/login`);
    const form = clientPage.locator("form", { has: clientPage.locator('input[name="username"]') });
    await form.waitFor({ state: "visible", timeout: 30_000 });
    await clientPage.locator('input[name="username"]').fill(tenant.admin);
    await clientPage.locator('input[name="password"]').fill(tenant.password);
    await form.locator('button[type="submit"]').click();

    // Bloqueo no cerrable: no se monta la app privada hasta cambiar la clave.
    await clientPage.waitForLoadState("domcontentloaded");
    await expect(clientPage.getByRole("heading", { name: "Cambia tu contraseña" })).toBeVisible({ timeout: 30_000 });
    await expect(clientPage.getByText("Estás usando una contraseña provisional.")).toBeVisible();
    await expect(clientPage.locator('button[aria-label="Cerrar"]')).toHaveCount(0);

    const submit = clientPage.getByRole("button", { name: "Cambiar contraseña" });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await clientPage.locator('input[name="currentPassword"]').fill("");
      await clientPage.locator('input[name="currentPassword"]').fill(tenant.password);
      await clientPage.locator('input[name="newPassword"]').fill("NuevaClave123!");
      await clientPage.locator('input[name="confirm"]').fill("NuevaClave123!");
      await expect(clientPage.locator('input[name="currentPassword"]')).toHaveValue(tenant.password);
      await expect(clientPage.locator('input[name="newPassword"]')).toHaveValue("NuevaClave123!");
      await expect(clientPage.locator('input[name="confirm"]')).toHaveValue("NuevaClave123!");
      if (await submit.isEnabled()) break;
      // Un HMR/rerender pudo remontar el modal: se reintenta el llenado.
      await clientPage.waitForTimeout(500);
    }
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();
    await expect(clientPage.getByText(/Hola, Admin/).first()).toBeVisible({ timeout: 40_000 });
    await clientPage.close();
  });
});
