import { expect, type Page } from "@playwright/test";
import { login, loginForm } from "./helpers";

/**
 * Login tolerante a recargas/arranques transitorios del stack E2E compartido.
 *
 * Entra por la UI y espera el inicio de la app privada (el saludo del cliente
 * o la consola de plataforma). Si en ese arranque la app se recargó (p. ej.
 * HMR de otra suite escribiendo en web/src) o la sesión no quedó montada,
 * recarga y vuelve a intentar (hasta 3 veces).
 */
export async function loginReady(
  page: Page,
  base: string,
  username: string,
  greeting: RegExp
): Promise<void> {
  const ready = page.getByText(greeting).first();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Al entrar a la base, la app privada manda al login si no hay sesión.
    if (!(await loginForm(page).isVisible().catch(() => false))) {
      await page.goto(`${base}/`);
    }
    if (await loginForm(page).isVisible().catch(() => false)) {
      await login(page, { base, username });
    }

    try {
      await expect(ready).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(800);
      return;
    } catch {
      // Reintento: la pestaña pudo quedar en el login o la app recargarse.
    }
  }

  await expect(ready).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
}
