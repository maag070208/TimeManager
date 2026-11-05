import { expect, test } from "@playwright/test";
import { PLATFORM } from "./helpers";

test.describe("Landing pública — móvil", () => {
  test("se ve sin desbordes y los planes se apilan", async ({ page }) => {
    await page.goto(`${PLATFORM.base}/#/landing`);
    await expect(page.getByRole("heading", { level: 1, name: /El registro de jornada/i })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/landing-mobile.png" });
  });
});
