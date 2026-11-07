import { expect, type Locator, type Page } from "@playwright/test";
import { ACME, E2E_PASSWORD, loginForm } from "./helpers";

/** Navegación tolerante: no espera `load` completo (Vite/HMR puede tardar). */
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 45_000 };

/**
 * Helpers locales de las suites de operación (Horarios/HE/Nómina).
 * No toca `helpers.ts`.
 *
 * `loginReady` (session.ts) absorbe recargas/HMR del stack compartido y deja la
 * app privada montada antes de mover el HashRouter; `gotoRoute` además
 * reintenta si la navegación tardía del post-login pisó el hash.
 */

export type AcmeRole = "admin" | "rh";

const greeting: Record<AcmeRole, RegExp> = {
  admin: /Hola, Ana/,
  rh: /Hola, Rita/,
};

/**
 * Login con una cuenta de acme y espera a que Inicio termine de pintar.
 * Tolerante al arranque del stack compartido: reintenta si la app se recargó
 * (HMR de otra suite) o si el submit animado del login no quedó estable.
 */
export async function loginAcme(page: Page, role: AcmeRole = "admin"): Promise<void> {
  const username = role === "rh" ? ACME.rh : ACME.admin;
  const ready = greeting[role].first();
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (!(await loginForm(page).isVisible().catch(() => false))) {
        await page.goto(`${ACME.base}/`, NAV);
      }
      const form = loginForm(page);
      await form.waitFor({ state: "visible", timeout: 20_000 });
      await page.locator('input[name="username"]').fill(username);
      await page.locator('input[name="password"]').fill(E2E_PASSWORD);
      // El botón del login tiene animación de entrada: `force` evita esperar
      // estabilidad y el onChange del formulario se dispara igual.
      await form.locator('button[type="submit"]').click({ force: true });
      await expect(ready).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(400);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
    }
  }

  throw lastError;
}

/** Navega a una ruta del HashRouter y confirma que la URL quedó en ella. */
export async function gotoRoute(page: Page, route: string, base: string = ACME.base): Promise<void> {
  const target = `${base}/#${route}`;
  const expected = `#${route}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto(target, NAV);
    } catch {
      // Reintenta: el stack compartido puede estar recargando (HMR).
    }
    if (new URL(page.url()).hash === expected) return;
    await page.waitForTimeout(400);
  }
  await page.goto(target, NAV);
  expect(new URL(page.url()).hash).toBe(expected);
}

/**
 * El `ITSearchSelect` de la app pinta un `<select name>` nativo oculto como
 * puente de compatibilidad: se usa para elegir opción sin pelear con el panel
 * flotante del kit.
 */
export async function selectOption(
  page: Page,
  name: string,
  option: { label: string } | { value: string } | string
): Promise<void> {
  const select = page.locator(`select[name="${name}"]`).first();
  await select.waitFor({ state: "attached", timeout: 20_000 });
  const value = typeof option === "string" ? { label: option } : option;
  await select.selectOption(value, { force: true });
}

/** Texto de la opción seleccionada hoy en un `ITSearchSelect`. */
export async function selectedLabel(page: Page, name: string): Promise<string> {
  const select = page.locator(`select[name="${name}"]`).first();
  await select.waitFor({ state: "attached", timeout: 20_000 });
  return select.locator("option:checked").innerText();
}

/** Opciones del select (label visible, value) para descubrir datos del seed. */
export async function selectOptions(page: Page, name: string): Promise<Array<{ label: string; value: string }>> {
  const select = page.locator(`select[name="${name}"]`).first();
  await select.waitFor({ state: "attached", timeout: 20_000 });
  return select.locator("option").evaluateAll((options) =>
    options.map((option) => ({ label: (option.textContent ?? "").trim(), value: (option as HTMLOptionElement).value }))
  );
}

/** Marca/desmarca un `ITCheckbox` del kit (input `sr-only` + label visible). */
export async function setCheckbox(page: Page, name: string, checked: boolean): Promise<void> {
  const input = page.locator(`input[name="${name}"]`).first();
  await input.waitFor({ state: "attached", timeout: 20_000 });
  if ((await input.isChecked()) !== checked) {
    // El input del kit es `sr-only`: un clic nativo dispara el onChange de React
    // sin pelear con la capa visible (label/dibujo del checkbox).
    await input.evaluate((element, want) => {
      const box = element as HTMLInputElement;
      if (box.checked !== want) box.click();
    }, checked);
  }
  await expect(input).toBeChecked({ checked });
}

/** Marca/desmarca un checkbox del kit recibido como Locator (input `sr-only`). */
export async function toggleCheckbox(input: Locator, checked: boolean): Promise<void> {
  await input.waitFor({ state: "attached", timeout: 20_000 });
  if ((await input.isChecked()) !== checked) {
    await input.evaluate((element, want) => {
      const box = element as HTMLInputElement;
      if (box.checked !== want) box.click();
    }, checked);
  }
  await expect(input).toBeChecked({ checked });
}

/** Diálogo del kit por el título/contenido que muestra (ITDialog/ITConfirmDialog no llevan role). */
export const dialog = (page: Page, text: string | RegExp): Locator =>
  page.locator("div.fixed.inset-0").filter({ hasText: text }).last();

/** Botón visible por su nombre accesible (ignora duplicados responsive ocultos). */
export const visibleButton = (page: Page, name: string | RegExp): Locator =>
  page.locator("button:visible", { hasText: name }).first();

/**
 * Elige una opción de un `ITSearchSelect` que se monta directo del kit (páginas
 * de asignación: no traen el `<select>` puente). Abre el buscador y toca la
 * opción del panel flotante.
 */
export async function pickSearchSelect(page: Page, name: string, label: string): Promise<void> {
  const input = page.locator(`input[name="${name}"]`).first();
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.click();
  const option = page.locator("div.max-h-60").getByText(label, { exact: true }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await expect(input).toHaveValue(label);
}

/** Valor visible actual de un `ITSearchSelect` (input del buscador). */
export async function searchSelectValue(page: Page, name: string): Promise<string> {
  const input = page.locator(`input[name="${name}"]`).first();
  await expect(input).toBeVisible({ timeout: 20_000 });
  return input.inputValue();
}

/** Espera la respuesta de una ruta de la API (método incluido). */
export const waitForApi = (page: Page, path: string, method = "POST") =>
  page.waitForResponse(
    (response) => response.request().method() === method && new URL(response.url()).pathname.endsWith(path)
  );

/** Igual que `waitForApi` pero con expresión regular (rutas con id). */
export const waitForApiMatch = (page: Page, pattern: RegExp, method = "POST") =>
  page.waitForResponse(
    (response) => response.request().method() === method && pattern.test(new URL(response.url()).pathname)
  );
