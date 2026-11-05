import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { ACME, PLATFORM, login } from "./helpers";

test.use({ timezoneId: "America/Mexico_City" });
const OUT = "/tmp/e2e-explore3";

const dump = async (page: any, name: string) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const text = await page.locator("#root").innerText().catch(() => "");
  writeFileSync(`${OUT}/${name}.txt`, text);
  writeFileSync(`${OUT}/${name}.url.txt`, page.url());
};
const log = (name: string, data: string) => writeFileSync(`${OUT}/${name}.txt`, data);
const settle = async (page: any) => {
  await page.getByText("Cerrar sesión").first().waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
};

test("acme clocks registration", async ({ page }) => {
  test.setTimeout(420_000);
  await login(page, { base: ACME.base, username: ACME.admin });
  await settle(page);
  await page.goto(`${ACME.base}/#/hr/time-clock`);
  await dump(page, "summary-hoy");
  log("summary-body", (await page.locator("body").innerText()).slice(0, 5000));
  await page.goto(`${ACME.base}/#/time-clocks`);
  await dump(page, "clocks-list");
  // registro con localhost sin retirar
  await page.getByRole("button", { name: /Dar de alta un reloj/ }).click();
  await page.waitForTimeout(800);
  await page.locator('input[name="checadorRelojUrl"]').fill("http://localhost:4801");
  await page.locator('input[name="checadorRelojNombre"]').fill("Reloj E2E Localhost");
  await page.getByRole("button", { name: "Dar de alta", exact: true }).click();
  await page.waitForTimeout(7000);
  await dump(page, "clocks-after-register-localhost");
  log("localhost-body", (await page.locator("body").innerText()).slice(0, 5000));
  // si sigue el diálogo, cancelar
  const cancel = page.getByRole("button", { name: "Cancelar", exact: true });
  if (await cancel.count()) await cancel.click();
  await page.waitForTimeout(1000);
  // retirar el reloj sembrado
  await page.getByText("Entrada principal", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Dar de baja/ }).first().click();
  await page.waitForTimeout(1200);
  await dump(page, "clocks-retire-dialog");
  const confirmBaja = page.getByRole("button", { name: "Dar de baja", exact: true });
  await confirmBaja.last().click();
  await page.waitForTimeout(3000);
  await dump(page, "clocks-after-retire");
  // alta con 127.0.0.1
  await page.getByRole("button", { name: /Dar de alta un reloj/ }).click();
  await page.waitForTimeout(800);
  await page.locator('input[name="checadorRelojUrl"]').fill("http://127.0.0.1:4801");
  await page.locator('input[name="checadorRelojNombre"]').fill("Reloj E2E Nuevo");
  await page.getByRole("button", { name: "Dar de alta", exact: true }).click();
  await page.waitForTimeout(8000);
  await dump(page, "clocks-after-register-ip");
  log("ip-body", (await page.locator("body").innerText()).slice(0, 5000));
  // detalle del reloj nuevo
  const nuevo = page.getByText("Reloj E2E Nuevo", { exact: true }).first();
  if (await nuevo.count()) {
    await nuevo.click();
    await page.waitForTimeout(4000);
    await dump(page, "clocks-new-detail");
  }
});

test("platform roles with acme", async ({ page }) => {
  test.setTimeout(420_000);
  await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
  await settle(page);
  // esperar opciones del selector de cliente
  await page.waitForFunction(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => /acme/i.test(o.textContent ?? ""));
  }, undefined, { timeout: 20000 });
  const acmeValue = await page.evaluate(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    const opt = s ? [...s.options].find((o) => /acme/i.test(o.textContent ?? "")) : undefined;
    return opt?.value ?? null;
  });
  log("acme-value", String(acmeValue));
  await page.locator('select[name="tenant"]').selectOption(acmeValue!);
  await page.waitForTimeout(5000);
  await dump(page, "home-as-acme");
  await page.goto(`${PLATFORM.base}/#/roles`);
  await page.waitForTimeout(3500);
  await dump(page, "roles-acme");
  await page.getByText("Acceso por persona", { exact: true }).click();
  await page.waitForTimeout(2500);
  await page.locator('input[name="explorer_search"]').fill("Sergio");
  await page.waitForTimeout(1500);
  await page.locator("button", { hasText: "Sergio Staff" }).first().click();
  await page.waitForTimeout(3000);
  await dump(page, "roles-acme-sergio");
  // menú agregar rol
  const addRole = page.getByText("Agregar rol", { exact: true }).first();
  log("add-role-count", String(await addRole.count()));
  if (await addRole.count()) {
    await addRole.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/roles-acme-addrole-menu.png`, fullPage: true });
    log("add-role-menu-body", (await page.locator("body").innerText()).slice(-3000));
  }
});
