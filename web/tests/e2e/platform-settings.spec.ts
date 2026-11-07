import { expect, test, type Page } from "@playwright/test";
import {
  ACME_BASE,
  dialog,
  gotoPlatform,
  loginAcmeAdmin,
  loginPlatform,
  rowOf,
  selectAcmeTenant,
  unique,
} from "./platform-kit";

/**
 * SET-01/SET-02 — ajustes del cliente (configuración general y catálogos).
 * La configuración general se opera como CLIENT_ADMIN de acme; los catálogos
 * escriben con `catalogs.manage`, así que se opera como ADMIN de plataforma
 * con acme elegido (X-Tenant-Id).
 */
test.use({ timezoneId: "America/Mexico_City" });

const saveConfig = async (page: Page) => {
  await page.getByRole("button", { name: "Guardar configuración" }).first().click();
  await expect(page.getByText("Configuración guardada.")).toBeVisible({ timeout: 20_000 });
};

/** Elección persistente en un ITSearchSelect visible (la UI re-renderiza por HMR). */
const persistChoice = async (
  page: Page,
  options: { tab: string; name: string; labelText: string; targetLabel: string; targetValue: string }
): Promise<void> => {
  const hidden = () => page.locator(`select[name="${options.name}"]`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByText(options.tab, { exact: true }).first().click();
    const input = page.getByText(options.labelText, { exact: true }).first().locator("xpath=following::input[1]");
    await input.click();
    await page.getByText(options.targetLabel, { exact: true }).last().click();
    await expect(hidden()).toHaveValue(options.targetValue, { timeout: 10_000 });
    await saveConfig(page);
    await page.reload();
    await page.getByText(options.tab, { exact: true }).first().click();
    await page.waitForTimeout(300);
    if ((await hidden().inputValue()) === options.targetValue) return;
  }
  await expect(hidden()).toHaveValue(options.targetValue);
};

test.describe("configuración general del cliente", () => {
  test("[SET-01][SET-01-T1][SET-M1][ACT-12] operación: ayuda contextual y semana laboral persistente", async ({ page }) => {
    await loginAcmeAdmin(page);
    await page.goto(`${ACME_BASE}/#/settings/general`);
    await expect(page.getByRole("heading", { level: 1, name: "Configuración del sistema" })).toBeVisible();

    // Ayuda contextual (SET-M1).
    await page.getByRole("button", { name: "Ayuda" }).first().click();
    const help = dialog(page);
    await expect(help.getByRole("heading", { name: "Ayuda · Operación" })).toBeVisible({ timeout: 20_000 });
    await expect(help.getByText(/Si eliges miércoles/)).toBeVisible();
    await help.getByRole("button", { name: /Entendido|Cerrar/ }).click().catch(async () => {
      await page.keyboard.press("Escape");
    });

    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const previous = await page.locator('select[name="weekStartDay"]').inputValue();
    await persistChoice(page, {
      tab: "Operación",
      name: "weekStartDay",
      labelText: "Primer día de la semana",
      targetLabel: "Jueves",
      targetValue: "4",
    });
    await persistChoice(page, {
      tab: "Operación",
      name: "weekStartDay",
      labelText: "Primer día de la semana",
      targetLabel: days[Number(previous)] ?? "Miércoles",
      targetValue: previous,
    });
  });

  test("[SET-01][SET-01-T2] asistencia: las tolerancias persisten", async ({ page }) => {
    await loginAcmeAdmin(page);
    await page.goto(`${ACME_BASE}/#/settings/general`);
    await expect(page.getByRole("heading", { level: 1, name: "Configuración del sistema" })).toBeVisible();
    await page.getByText("Asistencia", { exact: true }).first().click();
    const tolerance = page.locator('input[name="entryToleranceMin"]');
    const previous = await tolerance.inputValue();
    await tolerance.fill("11");
    await saveConfig(page);
    await page.reload();
    await page.getByText("Asistencia", { exact: true }).first().click();
    await expect(page.locator('input[name="entryToleranceMin"]')).toHaveValue("11", { timeout: 20_000 });
    await page.locator('input[name="entryToleranceMin"]').fill(previous);
    await saveConfig(page);
  });

  test("[SET-01][SET-01-T3][SET-M2] límites y retención: archivar pide confirmación y cancelar no archiva", async ({ page }) => {
    await loginAcmeAdmin(page);
    await page.goto(`${ACME_BASE}/#/settings/general`);
    await page.getByText("Límites y retención", { exact: true }).first().click();
    await expect(page.getByText("Archivar registros vencidos")).toBeVisible();

    await page.getByRole("button", { name: "Archivar registros vencidos" }).click();
    const confirm = dialog(page);
    await expect(confirm.getByText("Archivar registros vencidos")).toBeVisible();
    await expect(confirm.getByText(/moverán a las tablas de archivo/)).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/Archivado:/)).toHaveCount(0);

    // Retención: persiste el valor configurado.
    const retention = page.locator('input[name="retentionMonths"]');
    const previous = await retention.inputValue();
    await retention.fill("24");
    await saveConfig(page);
    await page.reload();
    await page.getByText("Límites y retención", { exact: true }).first().click();
    await expect(page.locator('input[name="retentionMonths"]')).toHaveValue("24", { timeout: 20_000 });
    await page.locator('input[name="retentionMonths"]').fill(previous);
    await saveConfig(page);
  });

  test("[SET-01][SET-01-T4] checada web: los toggles persisten", async ({ page }) => {
    await loginAcmeAdmin(page);
    await page.goto(`${ACME_BASE}/#/settings/general`);
    await page.getByText("Checada web", { exact: true }).first().click();
    const previous = await page.locator('select[name="remotePunchEnabled"]').inputValue();
    const labelOfRemote = (value: string) => (value === "false" ? "Deshabilitada" : "Permitida");
    await persistChoice(page, {
      tab: "Checada web",
      name: "remotePunchEnabled",
      labelText: "Checada desde la web",
      targetLabel: "Deshabilitada",
      targetValue: "false",
    });
    await persistChoice(page, {
      tab: "Checada web",
      name: "remotePunchEnabled",
      labelText: "Checada desde la web",
      targetLabel: labelOfRemote(previous),
      targetValue: previous,
    });
  });
});

test.describe("catálogos del cliente", () => {

/** Tras recargar, ITDataTable monta con datos vacíos: se remonta cambiando de tab. */
const reopenCatalog = async (page: Page, tab: RegExp): Promise<void> => {
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Catálogos" })).toBeVisible({ timeout: 30_000 });
  const other = /^Permisos \(/.test(tab.source) ? /^Documentos \(/ : /^Permisos \(/;
  await page.getByRole("button", { name: other }).first().click();
  await page.getByRole("button", { name: tab }).first().click();
};

  const openCatalogs = async (page: Page) => {
    await loginPlatform(page);
    await selectAcmeTenant(page);
    await gotoPlatform(page, "/settings/catalogs");
    await expect(page.getByRole("heading", { level: 1, name: "Catálogos" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Los catálogos afectan solicitudes, expedientes y nómina/)).toBeVisible();
  };

  test("[SET-02][SET-02-T1][SET-02-T3][SET-M3][SET-M4] alta, edición y baja de permiso y departamento", async ({ page }) => {
    await openCatalogs(page);

    // Tipos de permiso.
    await page.getByText(/^Permisos \(/).first().click();
    await expect(page.getByText("Tipos de permiso", { exact: true }).first()).toBeVisible();
    const leaveName = `Permiso QA ${unique("")}`;
    await page.getByRole("button", { name: "Agregar" }).click();
    const leaveForm = dialog(page);
    await leaveForm.locator('input[name="catalogKey"]').fill(`QA_${unique("").toUpperCase()}`.replace(/[^A-Z0-9_]/g, "_"));
    await leaveForm.locator('input[name="catalogName"]').fill(leaveName);
    await leaveForm.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    const leaveRow = rowOf(page, leaveName);
    await expect(leaveRow).toBeVisible({ timeout: 20_000 });

    await leaveRow.getByTitle("Editar").click();
    const editLeave = dialog(page);
    await editLeave.locator('input[name="catalogName"]').fill(`${leaveName} editado`);
    await editLeave.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await reopenCatalog(page, /^Permisos \(/);
    await expect(rowOf(page, `${leaveName} editado`)).toBeVisible({ timeout: 20_000 });

    await rowOf(page, `${leaveName} editado`).getByTitle("Dar de baja").click();
    const retire = dialog(page);
    await expect(retire.getByText("Dar de baja del catálogo")).toBeVisible();
    await retire.getByRole("button", { name: "Dar de baja" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await reopenCatalog(page, /^Permisos \(/);
    await expect(rowOf(page, `${leaveName} editado`).getByText("Inactivo").first()).toBeVisible({ timeout: 20_000 });

    // Departamentos.
    await page.getByText(/^Departamentos \(/).first().click();
    await expect(page.getByText("Departamentos", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const deptName = `Depto QA ${unique("")}`;
    await page.getByRole("button", { name: "Agregar" }).click();
    const deptForm = dialog(page);
    await deptForm.locator('input[name="catalogName"]').fill(deptName);
    await deptForm.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(rowOf(page, deptName)).toBeVisible({ timeout: 20_000 });
    await rowOf(page, deptName).getByTitle("Dar de baja").click();
    await dialog(page).getByRole("button", { name: "Dar de baja" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await reopenCatalog(page, /^Departamentos \(/);
    await expect(rowOf(page, deptName).getByText("Inactivo").first()).toBeVisible({ timeout: 20_000 });
  });

  test("[SET-02][SET-02-T2][SET-02-T4][SET-M3] documentos: alta y cancelación en puestos", async ({ page }) => {
    await openCatalogs(page);

    await page.getByText(/^Documentos \(/).first().click();
    await expect(page.getByText("Tipos de documento", { exact: true }).first()).toBeVisible();
    const docName = `Documento QA ${unique("")}`;
    await page.getByRole("button", { name: "Agregar" }).click();
    const docForm = dialog(page);
    await docForm.locator('input[name="catalogName"]').fill(docName);
    await docForm.getByRole("button", { name: "Guardar" }).click();
    await expect(rowOf(page, docName)).toBeVisible({ timeout: 20_000 });

    // Puestos: el diálogo abre y cancelar no crea nada.
    await page.getByText(/^Puestos \(/).first().click();
    await expect(page.getByText("Puestos de nómina", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Agregar" }).click();
    const positionForm = dialog(page);
    await positionForm.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[SET-02] CLIENT_ADMIN no puede escribir catálogos (403 visible)", async ({ page }) => {
    await loginAcmeAdmin(page);
    await page.goto(`${ACME_BASE}/#/settings/catalogs`);
    await expect(page.getByRole("heading", { level: 1, name: "Catálogos" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Agregar" }).click();
    const form = dialog(page);
    await form.locator('input[name="catalogName"]').fill(`Sin permiso ${unique("")}`);
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/INSUFFICIENT|permiso|No se pudo|No tienes/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
