import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { ACME, PLATFORM, login } from "./helpers";

test.use({ timezoneId: "America/Mexico_City" });

const OUT = "/tmp/e2e-explore2";
const dump = async (page: any, name: string) => {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const text = await page.locator("#root").innerText().catch(() => "");
  writeFileSync(`${OUT}/${name}.txt`, text);
  const body = await page.locator("body").innerText().catch(() => "");
  writeFileSync(`${OUT}/${name}.body.txt`, body);
};
const log = (name: string, data: string) => writeFileSync(`${OUT}/${name}.txt`, data);

test("explore acme tz", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("response", (r: any) => {
    const u = r.url();
    if (u.includes(":4010") && r.status() >= 400) writeFileSync(`${OUT}/http-errors.log`, `${r.status()} ${r.request().method()} ${u}\n${JSON.stringify(r.headers())}\n`, { flag: "a" });
  });
  await login(page, { base: ACME.base, username: ACME.admin });
  await page.goto(`${ACME.base}/#/hr/time-clock`);
  await dump(page, "summary-hoy");
  // rango ultimos 7 dias
  await page.getByText("Últimos 7 días", { exact: true }).click();
  await page.waitForTimeout(2000);
  await dump(page, "summary-last7");
  // ayer
  await page.getByText("Ayer", { exact: true }).click();
  await page.waitForTimeout(1500);
  await dump(page, "summary-ayer");
  // filtro empleado
  await page.getByText("Hoy", { exact: true }).click();
  const emp = page.locator('input[name="checadorEmployee"]');
  await emp.fill("Sergio");
  await page.waitForTimeout(1800);
  await dump(page, "summary-filtro-empleado");

  await page.goto(`${ACME.base}/#/hr/time-clock/entries-exits`);
  await dump(page, "entries-day");
  await page.getByText("Semanal", { exact: true }).click().catch(() => {});
  await page.waitForTimeout(2500);
  await dump(page, "entries-week");
  const search = page.locator('input[name="accessReportEmployee"]');
  await search.fill("Sergio");
  await page.waitForTimeout(1800);
  await dump(page, "entries-search");

  await page.goto(`${ACME.base}/#/hr/time-clock/employees/differences`);
  await dump(page, "differences");

  await page.goto(`${ACME.base}/#/time-clocks`);
  await dump(page, "clocks-list-tz");
  // editar: apagar escritura y volver a prender
  await page.getByText("Entrada principal", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Editar/ }).first().click();
  await page.waitForTimeout(1200);
  await dump(page, "clocks-edit-dialog");
  const writeChk = page.locator('input[name="checadorRelojEditarEscritura"]');
  log("write-checkbox", `count=${await writeChk.count()} checked=${await writeChk.isChecked().catch(() => "err")}`);
  await writeChk.click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.waitForTimeout(2000);
  await dump(page, "clocks-after-write-off");
  // reopened
  await page.getByRole("button", { name: /Editar/ }).first().click();
  await page.waitForTimeout(1000);
  const writeChk2 = page.locator('input[name="checadorRelojEditarEscritura"]');
  log("write-checkbox2", `checked=${await writeChk2.isChecked().catch(() => "err")}`);
  await writeChk2.click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.waitForTimeout(2000);

  // registro con localhost (sin retirar el sembrado)
  await page.getByText("Volver a relojes", { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Dar de alta un reloj/ }).click();
  await page.waitForTimeout(1000);
  await page.locator('input[name="checadorRelojUrl"]').fill("http://localhost:4801");
  await page.locator('input[name="checadorRelojNombre"]').fill("Reloj E2E Localhost");
  await page.getByRole("button", { name: "Dar de alta", exact: true }).click();
  await page.waitForTimeout(6000);
  await dump(page, "clocks-after-register-localhost");
  const bodyAfter = await page.locator("body").innerText();
  log("register-body", bodyAfter.slice(0, 4000));
});

test("explore platform 2", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
  // elegir acme
  const acmeId = await page.evaluate(() => {
    const raw = localStorage.getItem("tm_selected_tenant_v1");
    void raw;
    return null;
  });
  void acmeId;
  const select = page.locator('select[name="tenant"]');
  const value = await page.evaluate(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    if (!s) return null;
    const opt = [...s.options].find((o) => /acme/i.test(o.textContent ?? ""));
    return opt?.value ?? null;
  });
  log("acme-value", String(value));
  if (value) {
    await select.selectOption(value);
    await page.waitForTimeout(3500);
  }
  await page.goto(`${PLATFORM.base}/#/roles`);
  await page.waitForTimeout(3000);
  await dump(page, "roles-acme-roles-tab");
  // pestaña acceso por persona
  await page.getByText("Acceso por persona", { exact: true }).click();
  await page.waitForTimeout(2500);
  await dump(page, "roles-acme-access-tab");
  // buscar y seleccionar a Sergio Staff
  const searchBox = page.locator('input[name="explorer_search"]');
  await searchBox.fill("Sergio");
  await page.waitForTimeout(1200);
  await dump(page, "roles-acme-access-search");
  const member = page.locator("button", { hasText: "Sergio Staff" }).first();
  await member.click();
  await page.waitForTimeout(3000);
  await dump(page, "roles-acme-access-sergio");
  // abrir dropdown de añadir rol
  const addRole = page.getByText("Añadir rol", { exact: true }).first();
  log("add-role-count", String(await addRole.count()));
  if (await addRole.count()) {
    await addRole.click();
    await page.waitForTimeout(1500);
    await dump(page, "roles-acme-addrole-menu");
    const itemsText = await page.locator("body").innerText();
    log("add-role-menu-body", itemsText.slice(-3000));
  }
});
