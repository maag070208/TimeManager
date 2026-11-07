import { expect, type Page } from "@playwright/test";
import { ACME, BETA, PLATFORM, loginAs } from "./helpers";

/**
 * Utilidades compartidas por las suites E2E de plataforma/auth/ajustes.
 *
 * No se toca `helpers.ts` (lo comparten todas las suites): aquí solo viven
 * atajos para esta área. Los datos mutables se crean por prueba con nombres
 * únicos para no depender del seed ni del orden de las suites.
 */
export const PLATFORM_BASE = PLATFORM.base;
export const ACME_BASE = ACME.base;

/**
 * Diálogo activo. `ITDialog`/`TicConfirm` usan `data-it-dialog`, pero
 * `ITConfirmDialog` del kit no lo trae: se cubre por su contenedor `z-[60]`.
 */
export const dialog = (page: Page) =>
  page.locator('[data-it-dialog="true"], div[class*="z-[60]"]').last();

export const rowOf = (page: Page, text: string) => page.locator("tr", { hasText: text }).first();

export const unique = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Entra como ADMIN de plataforma y espera la consola. */
export async function loginPlatform(page: Page): Promise<void> {
  await loginAs(page, "platform");
  await expect(page.getByRole("heading", { level: 1, name: "Panel de CheckLab" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Entra como CLIENT_ADMIN de acme (inicio del cliente). */
export async function loginAcmeAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin", "acme");
  await expect(page.getByText("Hola, Ana").first()).toBeVisible({ timeout: 30_000 });
}

/** Abre una ruta hash de la plataforma (`/#/tenants`) esperando la app privada. */
export async function gotoPlatform(page: Page, route: string): Promise<void> {
  await page.goto(`${PLATFORM.base}/#${route}`);
}

/** Abre una ruta hash del cliente acme. */
export async function gotoAcme(page: Page, route: string): Promise<void> {
  await page.goto(`${ACME.base}/#${route}`);
}

/** Selecciona una opción en un `ITSearchSelect` (puente `select[name]` oculto). */
export async function pickSelect(page: Page, name: string, option: string): Promise<void> {
  await page.locator(`select[name="${name}"]`).selectOption(option);
}

/** Primer valor no vacío de un select buscable (espera a que carguen opciones). */
export async function firstOptionValue(page: Page, name: string): Promise<string> {
  await expect
    .poll(
      async () =>
        page.locator(`select[name="${name}"] option`).evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value).filter((item) => item !== "")
        ),
      { message: `El select ${name} no cargó opciones`, timeout: 20_000 }
    )
    .not.toHaveLength(0);
  const values = await page.locator(`select[name="${name}"] option`).evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  );
  return values.find((item) => item !== "") as string;
}

export interface CreatedTenant {
  name: string;
  slug: string;
  admin: string;
  password: string;
}

/**
 * Alta de cliente por la UI de la consola (`/tenants` → "Nuevo cliente").
 * Devuelve los datos del diálogo de resultado (la contraseña se muestra una vez).
 */
export async function createTenantViaUi(
  page: Page,
  options: { name?: string; admin?: string; email?: string; planLabel?: string } = {}
): Promise<CreatedTenant> {
  const name = options.name ?? `Cliente QA ${unique("")}`.trim();
  const admin = options.admin ?? `qa.${unique("")}`.replace(/[^a-z0-9.]/g, "");
  await gotoPlatform(page, "/tenants");
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Nuevo cliente/ }).click();

  const create = dialog(page);
  await expect(create.getByText("Nuevo cliente").first()).toBeVisible();
  await create.locator('input[name="name"]').fill(name);
  // El slug se deriva del nombre; se fuerza uno único.
  const slug = `qa-${unique("")}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 38);
  await create.locator('input[name="slug"]').fill(slug);
  await create.locator('input[name="adminName"]').fill(`Admin ${name}`);
  await create.locator('input[name="adminUsername"]').fill(admin);
  await create.locator('input[name="adminEmail"]').fill(options.email ?? `${admin.replace(/\./g, "")}@timemanager.test`);
  if (options.planLabel) {
    const planValue = await page
      .locator('select[name="planId"] option')
      .evaluateAll((items) => {
        const match = items.find((item) => (item.textContent ?? "").includes(options.planLabel as string));
        return match ? (match as HTMLOptionElement).value : "";
      });
    if (planValue) await pickSelect(page, "planId", planValue);
  }
  await create.getByRole("button", { name: "Crear cliente" }).click();

  await expect(create.getByText(`${name} está listo`)).toBeVisible({ timeout: 40_000 });
  const values = await create.locator("dd").allInnerTexts();
  expect(values.length).toBeGreaterThanOrEqual(3);
  const password = values[2].trim();
  await create.getByRole("button", { name: "Listo" }).click();
  await expect(rowOf(page, name)).toBeVisible({ timeout: 30_000 });
  return { name, slug, admin, password };
}

/** Devuelve el nombre de un plan activo; si no hay catálogo, crea uno por UI. */
export async function ensurePlan(page: Page, name?: string): Promise<string> {
  const planName = name ?? `Plan QA ${unique("")}`;
  await gotoPlatform(page, "/plans");
  await expect(page.getByRole("heading", { level: 1, name: "Planes" })).toBeVisible({ timeout: 30_000 });
  const existing = page.locator("tr").filter({ hasText: planName });
  if ((await existing.count()) > 0) return planName;
  if ((await page.getByText("Aún no hay planes: crea el primero.").count()) === 0) {
    // Ya hay planes del seed: se usa el primero disponible.
    const firstPlan = page.locator("tbody tr").first();
    const firstName = (await firstPlan.locator("td").first().innerText()).split("\n")[0].trim();
    return firstName;
  }
  await page.getByRole("button", { name: /Nuevo plan/ }).click();
  const form = dialog(page);
  await form.locator('input[name="name"]').fill(planName);
  await form.locator('input[name="employeeLimit"]').fill("25");
  await form.locator('input[name="clockLimit"]').fill("2");
  await form.locator('input[name="monthlyPrice"]').fill("250");
  await form.getByRole("button", { name: "Guardar plan" }).click();
  await expect(rowOf(page, planName)).toBeVisible({ timeout: 30_000 });
  return planName;
}

/** Crea un plan por UI y devuelve su nombre. */
export async function createPlanViaUi(
  page: Page,
  options: { name?: string; people?: number; clocks?: number; price?: number } = {}
): Promise<string> {
  const name = options.name ?? `Plan QA ${unique("")}`;
  await gotoPlatform(page, "/plans");
  await expect(page.getByRole("heading", { level: 1, name: "Planes" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Nuevo plan/ }).click();
  const form = dialog(page);
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="employeeLimit"]').fill(String(options.people ?? 25));
  await form.locator('input[name="clockLimit"]').fill(String(options.clocks ?? 2));
  await form.locator('input[name="monthlyPrice"]').fill(String(options.price ?? 250));
  await form.getByRole("button", { name: "Guardar plan" }).click();
  await expect(rowOf(page, name)).toBeVisible({ timeout: 30_000 });
  return name;
}

/** Elige el cliente acme en la barra superior de plataforma (X-Tenant-Id). */
export async function selectAcmeTenant(page: Page): Promise<void> {
  const select = page.locator('select[name="tenant"]');
  await expect(select).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
      return !!el && [...el.options].some((option) => /acme/i.test(option.textContent ?? ""));
    },
    undefined,
    { timeout: 20_000 }
  );
  const value = await page.evaluate(() => {
    const el = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    const option = el ? [...el.options].find((item) => /acme/i.test(item.textContent ?? "")) : undefined;
    return option?.value ?? null;
  });
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  await expect(page.getByText("Hola, Admin").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

/** Login con reintentos: absorbe recargas/HMR del stack E2E compartido. */
export async function loginWithRetry(
  page: Page,
  role: "platform" | "admin" | "rh" | "staff",
  tenant: "acme" | "beta" = "acme"
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await loginAs(page, role, tenant);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
      await page.goto(role === "platform" ? PLATFORM.base : tenant === "acme" ? ACME.base : BETA.base);
    }
  }
  throw lastError;
}
