import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { ACME, PLATFORM, login } from "./helpers";

const OUT = "/tmp/e2e-explore";
const dump = async (page: any, name: string) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const text = await page.locator("#root").innerText().catch(() => "");
  writeFileSync(`${OUT}/${name}.txt`, text);
  writeFileSync(`${OUT}/${name}.url.txt`, page.url());
};

test("explore acme", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("console", (m: any) => { if (m.type() === "error") writeFileSync(`${OUT}/console.log`, `[${new Date().toISOString()}] ${m.text()}\n`, { flag: "a" }); });
  await login(page, { base: ACME.base, username: ACME.admin });
  for (const [name, route] of [
    ["tc-list", "/time-clocks"],
    ["tc-dashboard", "/time-clocks/dashboard"],
    ["tc-people", "/time-clocks/people"],
    ["tc-inspect", "/time-clocks/inspect"],
    ["hr-summary", "/hr/time-clock"],
    ["hr-entries", "/hr/time-clock/entries-exits"],
    ["hr-roster", "/hr/time-clock/roster"],
    ["hr-employees", "/hr/time-clock/employees"],
    ["hr-differences", "/hr/time-clock/employees/differences"],
  ] as const) {
    await page.goto(`${ACME.base}/#${route}`);
    await dump(page, `acme-${name}`);
  }
  // detalle de un reloj
  await page.goto(`${ACME.base}/#/time-clocks`);
  await page.waitForTimeout(2500);
  const card = page.locator("text=Entrada principal").first();
  if (await card.count()) {
    await card.click();
    await dump(page, "acme-clock-detail");
    const edit = page.getByRole("button", { name: /editar/i }).first();
    if (await edit.count()) {
      await edit.click();
      await dump(page, "acme-clock-edit-dialog");
    }
  }
});

test("explore platform", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
  await dump(page, "plat-home");
  await page.goto(`${PLATFORM.base}/#/roles`);
  await dump(page, "plat-roles");
  // select acme tenant in top bar
  const select = page.locator('select[name="tenant"]');
  writeFileSync(`${OUT}/plat-select.txt`, `count=${await select.count()}`);
  if (await select.count()) {
    const options = await select.locator("option").all();
    for (const o of options) writeFileSync(`${OUT}/plat-options.txt`, (await o.innerText()) + "\n", { flag: "a" });
    const value = await page.evaluate(() => { const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement; return s ? s.value : "none"; });
    writeFileSync(`${OUT}/plat-select-value.txt`, value);
  }
  // find acme option value
  const acmeValue = await page.evaluate(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    if (!s) return null;
    const opt = [...s.options].find((o) => /acme/i.test(o.text));
    return opt?.value ?? null;
  });
  if (acmeValue) {
    await select.selectOption(acmeValue);
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(3000);
    await dump(page, "plat-home-after-acme");
    await page.goto(`${PLATFORM.base}/#/roles`);
    await dump(page, "plat-roles-after-acme");
  }
});
