import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { ACME, login } from "./helpers";

const OUT = "/tmp/e2e-ops-explore";

const dump = async (page: import("@playwright/test").Page, name: string) => {
  await page.waitForTimeout(2500);
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const text = await page.locator("#root").innerText().catch(() => "");
  writeFileSync(`${OUT}/${name}.txt`, text);
  const inputs = await page.locator("input, select, textarea").evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName,
      name: el.getAttribute("name"),
      type: el.getAttribute("type"),
      placeholder: el.getAttribute("placeholder"),
      aria: el.getAttribute("aria-label"),
      value: (el as HTMLInputElement).value,
    }))
  );
  writeFileSync(`${OUT}/${name}.inputs.json`, JSON.stringify(inputs, null, 1));
  const buttons = await page.getByRole("button").evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 70),
      aria: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
    }))
  );
  writeFileSync(`${OUT}/${name}.buttons.json`, JSON.stringify(buttons, null, 1));
  writeFileSync(`${OUT}/${name}.url.txt`, page.url());
};

test("explore ops", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page, { base: ACME.base, username: ACME.admin });
  for (const [name, route] of [
    ["departments", "/departments"],
    ["subareas", "/subareas"],
    ["schedules", "/schedules"],
    ["schedule-new", "/schedules/new"],
    ["schedule-assign", "/schedules/assign"],
    ["overtime", "/schedules/overtime/approval"],
    ["payroll", "/schedules/payroll"],
  ] as const) {
    await page.goto(`${ACME.base}/#${route}`);
    await dump(page, `acme-${name}`);
  }
});
