import { expect, type Page } from "@playwright/test";

/** Contraseña de todas las cuentas sembradas por api/scripts/e2e-seed.ts. */
export const E2E_PASSWORD = "E2ePrueba123!";

export const PLATFORM = {
  base: "http://localhost:5106",
  admin: "e2e.admin",
} as const;

export const ACME = {
  base: "http://acme.localhost:5106",
  slug: "acme",
  name: "Cliente E2E Acme",
  admin: "acme.admin",
  rh: "acme.rh",
  staff: "acme.staff",
} as const;

export const BETA = {
  base: "http://beta.localhost:5106",
  slug: "beta",
  name: "Cliente E2E Beta",
  admin: "beta.admin",
  staff: "beta.staff",
} as const;

export interface LoginOptions {
  base: string;
  username: string;
  password?: string;
}

/** Formulario de login (la app usa HashRouter: /login#/login). */
export const loginForm = (page: Page) =>
  page.locator("form", { has: page.locator('input[name="username"]') });

/** Login por la UI; deja la sesión en la pestaña actual. */
export async function login(page: Page, options: LoginOptions): Promise<void> {
  await page.goto(`${options.base}/`);
  const form = loginForm(page);
  await form.waitFor({ state: "visible", timeout: 20_000 });
  await page.locator('input[name="username"]').fill(options.username);
  await page.locator('input[name="password"]').fill(options.password ?? E2E_PASSWORD);
  await form.locator('button[type="submit"]').click();
  // Entrar desmonta el formulario y deja la app privada montada.
  await expect(form).toHaveCount(0, { timeout: 20_000 });
}

/** Login de cliente sin pasar por la UI (deja el token en el mismo contexto). */
export async function loginAs(
  page: Page,
  role: "platform" | "admin" | "rh" | "staff",
  tenant: "acme" | "beta" = "acme"
): Promise<void> {
  if (role === "platform") {
    await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
    return;
  }
  const client = tenant === "acme" ? ACME : BETA;
  const username = role === "admin" ? client.admin : role === "rh" ? ACME.rh : client.staff;
  await login(page, { base: client.base, username });
}

/** Espera a que la app privada esté montada (sale del login). */
export async function expectPrivateLayout(page: Page): Promise<void> {
  await expect(page.locator("#root")).toBeVisible();
  await expect(loginForm(page)).toHaveCount(0);
}
