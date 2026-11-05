import { expect, type Page } from "@playwright/test";
import { ACME, login } from "./helpers";

/**
 * Helper local de las suites de operación (E2E-2). No toca `helpers.ts`.
 *
 * El login del cliente deja a la app navegando a Inicio justo después de
 * desmontar el formulario; por eso esperamos a que Inicio esté pintado antes
 * de mover el HashRouter. `gotoRoute` además reintenta si esa navegación
 * tardía pisó el hash (carrera del redirect post-login).
 */

export type AcmeRole = "admin" | "rh";

const greeting: Record<AcmeRole, RegExp> = {
  admin: /Hola, Ana/,
  rh: /Hola, Rita/,
};

/** Login con una cuenta de acme y espera a que Inicio termine de pintar. */
export async function loginAcme(page: Page, role: AcmeRole = "admin"): Promise<void> {
  await login(page, { base: ACME.base, username: role === "rh" ? ACME.rh : ACME.admin });
  await expect(page).not.toHaveURL(/#\/login/);
  await expect(page.getByText(greeting[role]).first()).toBeVisible();
}

/** Navega a una ruta del HashRouter y confirma que la URL quedó en ella. */
export async function gotoRoute(page: Page, route: string): Promise<void> {
  const target = `${ACME.base}/#${route}`;
  const expected = `#${route}`;
  await page.goto(target);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (new URL(page.url()).hash === expected) return;
    await page.waitForTimeout(250);
    await page.goto(target);
  }
  expect(new URL(page.url()).hash).toBe(expected);
}
