import { expect, test } from "@playwright/test";
import { ACME, login } from "./helpers";

test.describe("Mi jornada — móvil", () => {
  test("el portal del trabajador es usable en teléfono y no desborda horizontalmente", async ({ page }) => {
    await login(page, { base: ACME.base, username: ACME.staff });
    await page.goto(`${ACME.base}/#/mi-jornada`);

    await expect(page.getByRole("heading", { name: /Mi jornada/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrar entrada/i })).toBeVisible();
    await expect(page.getByText(/Mis marcajes/i).first()).toBeVisible();

    // Nada debe empujar el layout más allá del ancho del viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Los botones principales ocupan bien el ancho en móvil (no quedan diminutos).
    const box = await page.getByRole("button", { name: /Registrar entrada/i }).boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan((viewport?.width ?? 400) * 0.8);

    await page.screenshot({ path: "test-results/mi-jornada-mobile.png", fullPage: true });
  });
});
