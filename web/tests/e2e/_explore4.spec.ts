import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { PLATFORM, login } from "./helpers";

test.use({ timezoneId: "America/Mexico_City" });
const OUT = "/tmp/e2e-explore4";
const dump = async (page: any, name: string) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  writeFileSync(`${OUT}/${name}.txt`, await page.locator("body").innerText().catch(() => ""));
};
const log = (name: string, data: string) => writeFileSync(`${OUT}/${name}.txt`, data);
const settle = async (page: any) => {
  await page.getByText("Cerrar sesión").first().waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
};

test("tenants console flows", async ({ page }) => {
  test.setTimeout(420_000);
  await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
  await settle(page);
  await dump(page, "home");
  const betaRow = page.locator("tr", { hasText: "Cliente E2E Beta" });
  await betaRow.getByRole("button", { name: "Suspender" }).click();
  await page.waitForTimeout(1200);
  await dump(page, "suspend-confirm");
  // confirmar dentro del diálogo
  const dialog = page.locator('[role="dialog"]').last();
  log("dialog-count", String(await page.locator('[role="dialog"]').count()));
  const confirm = dialog.getByRole("button", { name: "Suspender" }).last();
  await confirm.click();
  await page.waitForTimeout(3000);
  await dump(page, "after-suspend");
  // reactivar
  const betaRow2 = page.locator("tr", { hasText: "Cliente E2E Beta" });
  await betaRow2.getByRole("button", { name: "Reactivar" }).click();
  await page.waitForTimeout(1200);
  await dump(page, "reactivate-confirm");
  const dialog2 = page.locator('[role="dialog"]').last();
  await dialog2.getByRole("button", { name: "Reactivar" }).last().click();
  await page.waitForTimeout(3000);
  await dump(page, "after-reactivate");
  // nuevo cliente
  await page.getByRole("button", { name: /Nuevo cliente/ }).click();
  await page.waitForTimeout(1200);
  await dump(page, "create-dialog");
  await page.locator('input[name="name"]').fill("Cliente E2E Gamma");
  await page.locator('input[name="adminName"]').fill("Gaby Gamma");
  await page.locator('input[name="adminUsername"]').fill("gamma.admin");
  await page.locator('input[name="adminEmail"]').fill("gamma.admin@timemanager.test");
  await page.getByRole("button", { name: "Crear cliente", exact: true }).click();
  await page.waitForTimeout(6000);
  await dump(page, "create-result");
  // cerrar resultado
  const listo = page.getByRole("button", { name: "Listo", exact: true });
  if (await listo.count()) await listo.click();
  await page.waitForTimeout(2000);
  await dump(page, "home-after-create");
  // entrar a acme
  const acmeRow = page.locator("tr", { hasText: "Cliente E2E Acme" });
  await acmeRow.getByRole("button", { name: "Entrar" }).click();
  await page.waitForTimeout(5000);
  await dump(page, "home-as-acme");
  log("url-after-enter", page.url());
});

test("roles matrix and forbidden platform role", async ({ page }) => {
  test.setTimeout(420_000);
  await login(page, { base: PLATFORM.base, username: PLATFORM.admin });
  await settle(page);
  await page.waitForFunction(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => /acme/i.test(o.contentText ?? o.textContent ?? ""));
  }, undefined, { timeout: 20000 }).catch(() => {});
  const acmeValue = await page.evaluate(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    const opt = s ? [...s.options].find((o) => /acme/i.test(o.textContent ?? "")) : undefined;
    return opt?.value ?? null;
  });
  await page.locator('select[name="tenant"]').selectOption(acmeValue!);
  await page.waitForTimeout(5000);
  await page.goto(`${PLATFORM.base}/#/roles`);
  await page.waitForTimeout(3500);
  // pestaña comparar roles
  await page.getByText("Comparar roles", { exact: true }).click();
  await page.waitForTimeout(2500);
  await dump(page, "matrix");
  // acceso por persona
  await page.getByText("Acceso por persona", { exact: true }).click();
  await page.waitForTimeout(2000);
  await page.locator('input[name="explorer_search"]').fill("Sergio");
  await page.waitForTimeout(1200);
  await page.locator("button", { hasText: "Sergio Staff" }).first().click();
  await page.waitForTimeout(3000);
  const addRole = page.getByText("Agregar rol", { exact: true }).first();
  await addRole.click();
  await page.waitForTimeout(1500);
  await dump(page, "addrole-menu");
  // clic en ADMINISTRADOR
  await page.getByText("ADMINISTRADOR", { exact: true }).last().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/after-forbidden-role.png`, fullPage: true });
  log("after-forbidden-body", (await page.locator("body").innerText()).slice(-2500));
});
