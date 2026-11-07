/**
 * Utilidades compartidas por los scripts de capturas: abrir sesión con una
 * cuenta demo (`docs/DEMO_DATA.md`) y esperar a que la pantalla termine de
 * cargar. No son pruebas: solo navegan.
 */
export const DEMO_PASSWORD = "Demo2026!";

/** URL de la web con el subdominio del cliente (`null` = plataforma). */
export const withTenant = (base, slug) => (slug ? base.replace("://", `://${slug}.`) : base);

/** Espera red tranquila y un margen para animaciones de entrada. */
export const settle = async (page, extraMs = 1200) => {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(extraMs);
};

/** Inicia sesión en el cliente (o plataforma) y deja la página en el inicio. */
export const login = async (page, { base, tenant, username, password = DEMO_PASSWORD }) => {
  const root = withTenant(base, tenant);
  await page.goto(`${root}/#/login`);
  const user = page.locator('input[name="username"]');
  await user.waitFor({ timeout: 20000 });
  await user.fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').first().click({ force: true });
  await page.waitForURL((url) => !url.hash.includes("login"), { timeout: 20000 });
  await settle(page);
  return root;
};
