import { expect, test } from "@playwright/test";
import { PLATFORM } from "./helpers";

test.describe("Landing pública — móvil", () => {
  test("se ve sin desbordes, con menú móvil y título legible", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/landing`);
    const h1 = page.getByRole("heading", { level: 1, name: /Cada checada cuenta/i });
    await expect(h1).toBeVisible();
    expect(parseFloat(await h1.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(36);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: /Abrir menú/i }).click();
    await expect(page.getByRole("navigation", { name: /Secciones \(menú\)/ })).toBeVisible();
    await page.screenshot({ path: "test-results/landing-mobile.png" });
  });
});
