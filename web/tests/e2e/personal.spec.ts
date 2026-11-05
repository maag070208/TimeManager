import { expect, test, type Locator, type Page } from "@playwright/test";
import { ACME, E2E_PASSWORD, loginAs } from "./helpers";

/**
 * Pantalla Personal (antes Usuarios): lista única de personas/cuentas, con
 * búsqueda, filtros, acciones de cuenta por fila, alta, baja/reactivación y
 * edición por diálogo con URL propia.
 *
 * El seed corre antes de cada corrida (globalSetup): los datos de partida son
 * siempre los mismos. Cada test crea sus propios empleados para no depender del
 * orden dentro del archivo.
 */

// Otros ingenieros editan web/src mientras corre la suite: una recarga de HMR a
// media prueba tira el formulario. Un reintento evita falsos negativos.
test.describe.configure({ retries: 1 });

const EMPLOYEES = `${ACME.base}/#/employees`;
const PERSONAL = { level: 1 as const, name: "Personal" };

interface NewEmployee {
  name: string;
  paternalSurname: string;
  username: string;
  email: string;
  employeeNumber: string;
  jobTitle: string;
  password: string;
  /** Nombre completo con el que lo muestra la app (compone nombre + apellidos). */
  fullName: string;
}

let seq = 0;

/**
 * Datos únicos por alta. No se derivan de un contador global a secas: Playwright
 * reinicia el worker (y el módulo) tras una falla o un reintento, y volver a
 * "Empleado1" chocaría con lo ya creado. El sello de tiempo + secuencia garantiza
 * unicidad dentro de la corrida y entre reintentos.
 */
const uniqueToken = (): string => {
  seq += 1;
  return `${Date.now().toString(36).slice(-5)}${seq}`.toUpperCase();
};

/** Datos únicos por corrida para el empleado que crea cada test. */
const nextEmployee = (): NewEmployee => {
  const token = uniqueToken();
  const name = `Empleado${token}`;
  const paternalSurname = `E2E${token}`;
  return {
    name,
    paternalSurname,
    username: `empleado.${token.toLowerCase()}`,
    email: `empleado.${token.toLowerCase()}@timemanager.test`,
    employeeNumber: `E${token}`,
    jobTitle: `Puesto ${token}`,
    password: E2E_PASSWORD,
    fullName: `${name} ${paternalSurname}`,
  };
};

const employeesTable = (page: Page) => page.locator("tbody");

/** Fila de la tabla por un texto que solo aparece en ella (nº de empleado o nombre). */
const rowWith = (page: Page, text: string): Locator =>
  page.locator("tbody tr").filter({ hasText: text });

const rowMenuTrigger = (row: Locator): Locator =>
  row.getByRole("button", { name: /^Más acciones de / });

/** Espera a que la lista pinte al menos una fila. */
async function expectList(page: Page): Promise<void> {
  await expect(page.getByRole("heading", PERSONAL)).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
}

/** Abre `/employees` ya autenticado (reintenta si el login aún resuelve a "/"). */
async function openEmployees(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(EMPLOYEES);
    const visible = await page
      .getByRole("heading", PERSONAL)
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await expectList(page);
      return;
    }
  }
  await expectList(page);
}

/** Alta por la UI: `/employees/new` → formulario → lista. */
async function createEmployee(page: Page, data: NewEmployee): Promise<void> {
  await openEmployees(page);
  await page.getByRole("button", { name: "Nuevo empleado" }).click();
  await expect(page).toHaveURL(/#\/employees\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo usuario" })).toBeVisible();

  await page.locator('input[name="u_name"]').fill(data.name);
  await page.locator('input[name="u_apa"]').fill(data.paternalSurname);
  await page.locator('input[name="u_email"]').fill(data.email);
  await page.locator('input[name="u_num"]').fill(data.employeeNumber);
  await page.locator('input[name="u_jobTitle"]').fill(data.jobTitle);
  await page.locator('input[name="u_username"]').fill(data.username);
  await expect(page.locator('select[name="u_role"] option[value="CLIENT_STAFF"]')).toHaveCount(1);
  await page.locator('select[name="u_role"]').selectOption("CLIENT_STAFF");
  await page.locator('input[name="u_password"]').fill(data.password);

  await page.getByRole("button", { name: "Crear usuario", exact: true }).click();
  // Alta correcta: vuelve a la lista y el empleado ya está en la tabla.
  try {
    await expect(page).toHaveURL(/#\/employees$/, { timeout: 30_000 });
  } catch (error) {
    // Diagnóstico para distinguir un fallo de API de una recarga de HMR.
    const alerts = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
    const saving = await page.getByRole("button", { name: /Guardando/ }).count();
    const fieldErrors = await page
      .locator('[aria-invalid="true"], .text-danger-500, [class*="text-red"]')
      .allInnerTexts()
      .catch(() => []);
    const values = await page
      .evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name],select[name]")].map(
            (el) => [el.name, el.value]
          )
        )
      )
      .catch(() => ({}));
    console.error(
      "ALTA FALLÓ",
      JSON.stringify({ alerts, saving, fieldErrors, values, url: page.url() })
    );
    throw error;
  }
  await expect(page.getByRole("heading", PERSONAL)).toBeVisible();
  await expect(rowWith(page, data.employeeNumber)).toBeVisible();
}

/** Abre la cuenta de la fila y devuelve el diálogo. */
async function openAccountDialog(page: Page, row: Locator): Promise<Locator> {
  await rowMenuTrigger(row).click();
  await page.getByRole("menuitem", { name: "Cuenta: usuario, rol y correo" }).click();
  await expect(page).toHaveURL(/\/employees\/[^/]+\/account$/);
  const dialog = page.locator('[data-it-dialog="true"]');
  await expect(dialog.getByRole("heading", { name: "Editar usuario" })).toBeVisible();
  return dialog;
}

async function dismissAccountDialog(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/employees$/);
}

test.describe("Personal — CLIENT_ADMIN", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin", "acme");
  });

  test("la lista muestra el personal del cliente con sus columnas y totales", async ({ page }) => {
    await openEmployees(page);

    await expect(page.getByText(/\d+ registro\(s\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuevo empleado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cargar Excel" })).toBeVisible();

    // Mosaico de totales y columnas de la tabla.
    await expect(page.getByText("Todo el personal", { exact: true })).toBeVisible();
    for (const column of ["No. Empleado", "Nombre", "Rol", "Estatus", "Puesto", "Departamento"]) {
      await expect(page.getByText(column, { exact: true }).first()).toBeVisible();
    }

    // Personal sembrado: 1001 Ana (R. H.), 1002 Rita (R. H.), 1003 Sergio (Operaciones).
    const ana = rowWith(page, "Ana Administradora");
    await expect(ana).toContainText("1001");
    await expect(ana).toContainText("Gerente general");
    await expect(ana.getByText("Activo", { exact: true })).toBeVisible();

    const sergio = rowWith(page, "Sergio Staff");
    await expect(sergio).toContainText("1003");
    await expect(sergio).toContainText("Analista");
    await expect(sergio).toContainText("Operaciones");

    await expect(employeesTable(page)).toContainText("Rita Recursos");
  });

  test("el buscador y los filtros acotan la lista", async ({ page }) => {
    await openEmployees(page);
    await expect(rowWith(page, "Ana Administradora")).toBeVisible();

    // Buscar por nombre.
    await page.locator('input[name="filter-name"]').fill("Rita");
    await expect(rowWith(page, "Rita Recursos")).toBeVisible();
    await expect(rowWith(page, "Ana Administradora")).toHaveCount(0);

    // Limpiar y buscar por número de empleado.
    await page.locator('input[name="filter-name"]').fill("");
    await expect(rowWith(page, "Ana Administradora")).toBeVisible();
    await page.locator('input[name="filter-employeeNumber"]').fill("1003");
    await expect(rowWith(page, "Sergio Staff")).toBeVisible();
    await expect(rowWith(page, "Ana Administradora")).toHaveCount(0);

    // Filtro por rol (columna Rol).
    await page.locator('input[name="filter-employeeNumber"]').fill("");
    await expect(page.locator('select[name="filter-role"] option[value="CLIENT_STAFF"]')).toHaveCount(1);
    await page.locator('select[name="filter-role"]').selectOption("CLIENT_STAFF");
    await expect(rowWith(page, "Sergio Staff")).toBeVisible();
    await expect(rowWith(page, "Ana Administradora")).toHaveCount(0);
  });

  test("el menú ⋯ de la fila ofrece las acciones de cuenta", async ({ page }) => {
    await openEmployees(page);
    const sergio = rowWith(page, "Sergio Staff");

    await rowMenuTrigger(sergio).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Cuenta: usuario, rol y correo" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Cambiar contraseña" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Desactivar" })).toBeVisible();

    // Acción de contraseña: abre su diálogo y se puede cerrar sin cambios.
    await menu.getByRole("menuitem", { name: "Cambiar contraseña" }).click();
    const passwordDialog = page.locator('[data-it-dialog="true"]');
    await expect(passwordDialog.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
    await expect(passwordDialog.locator('input[name="newPassword"]')).toBeVisible();
    await passwordDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(passwordDialog).toHaveCount(0);
  });

  test("el diálogo de cuenta tiene URL propia, edita el departamento y cierra", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);

    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();
    const dialog = await openAccountDialog(page, row);

    // URL propia del diálogo: /#/employees/<id>/account.
    const accountUrl = page.url();
    expect(accountUrl).toMatch(/\/#\/employees\/[^/]+\/account$/);
    await expect(dialog.getByText(/se editan en su expediente/)).toBeVisible();

    // Los datos de la persona se editan en el expediente; aquí sí se edita la organización.
    await dialog.locator('input[name="u_dept"]').click();
    await page
      .locator('[data-it-floating="true"]')
      .last()
      .getByText("Administración", { exact: true })
      .click();
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog.getByText("Usuario actualizado correctamente", { exact: true })).toBeVisible();

    await dismissAccountDialog(page, dialog);

    // El cambio se refleja en la tabla.
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    await expect(rowWith(page, data.employeeNumber).getByText("Administración", { exact: true })).toBeVisible();
  });

  test("el alta en /#/employees/new crea al empleado y aparece en la lista", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);

    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();
    await expect(row).toContainText(`@${data.username}`);
    await expect(row).toContainText(data.jobTitle);
  });

  test("la baja y la reactivación desde el menú de la fila", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();
    await expect(row.getByText("Activo", { exact: true })).toBeVisible();

    // Baja con motivo (la pide el diálogo de confirmación).
    await rowMenuTrigger(row).click();
    await page.getByRole("menuitem", { name: "Desactivar" }).click();
    // El rol `alertdialog` envuelve el encabezado; el motivo y los botones viven en el mismo ITDialog.
    await expect(page.getByRole("alertdialog")).toContainText(`¿Dar de baja a ${data.fullName}?`);
    const deactivateDialog = page.locator('[data-it-dialog="true"]');
    await deactivateDialog.locator('textarea[name="deactivate_reason"]').fill("Baja de prueba E2E");
    await deactivateDialog.getByRole("button", { name: "Dar de baja" }).click();

    await expect(row.getByText("Inactivo", { exact: true })).toBeVisible();
    await expect(page.getByText(/Usuario desactivado/)).toBeVisible();

    // Reactivación desde el mismo menú.
    await rowMenuTrigger(row).click();
    await page.getByRole("menuitem", { name: "Reactivar" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`¿Reactivar a ${data.username}?`);
    await page
      .locator('[data-it-dialog="true"]')
      .getByRole("button", { name: "Reactivar" })
      .click();

    await expect(row.getByText("Activo", { exact: true })).toBeVisible();
    await expect(page.getByText(/Usuario reactivado/)).toBeVisible();
  });

  test("las rutas viejas de Usuarios redirigen a Personal", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();

    // /users → /employees.
    await page.goto(`${ACME.base}/#/users`);
    await expect(page).toHaveURL(/#\/employees$/);
    await expect(page.getByRole("heading", PERSONAL)).toBeVisible();

    // /users/:id/edit → /employees/:id/account (diálogo sobre la lista).
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    await expect(row).toBeVisible();
    const dialog = await openAccountDialog(page, row);
    const id = page.url().match(/\/employees\/([^/]+)\/account$/)![1];
    await dismissAccountDialog(page, dialog);

    await page.goto(`${ACME.base}/#/users/${id}/edit`);
    await expect(page).toHaveURL(new RegExp(`/#/employees/${id}/account$`));
    await expect(
      page.locator('[data-it-dialog="true"]').getByRole("heading", { name: "Editar usuario" })
    ).toBeVisible();
  });

  test("el puesto se edita en el expediente (el diálogo de cuenta enlaza a él)", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();
    await expect(row).toContainText(data.jobTitle);

    const dialog = await openAccountDialog(page, row);
    await dialog.getByRole("button", { name: "Abrir expediente" }).click();
    await expect(page).toHaveURL(/\/employees\/[^/]+\/edit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Editar Información" })).toBeVisible();

    const jobTitle = page.locator('input[name="jobTitle"]');
    await expect(jobTitle).toHaveValue(data.jobTitle);
    await jobTitle.fill("Supervisor E2E");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    // Tras guardar vuelve a la pantalla anterior (el diálogo de cuenta / expediente).
    await expect(page).not.toHaveURL(/\/edit$/);

    await openEmployees(page);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    await expect(rowWith(page, data.employeeNumber).getByText("Supervisor E2E", { exact: true })).toBeVisible();
  });

  test("la eliminación definitiva se ofrece para una cuenta dada de baja", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();

    // Solo se puede eliminar una cuenta inactiva.
    await rowMenuTrigger(row).click();
    await page.getByRole("menuitem", { name: "Desactivar" }).click();
    const deactivateDialog = page.locator('[data-it-dialog="true"]');
    await deactivateDialog.locator('textarea[name="deactivate_reason"]').fill("Baja para eliminar E2E");
    await deactivateDialog.getByRole("button", { name: "Dar de baja" }).click();
    await expect(row.getByText("Inactivo", { exact: true })).toBeVisible();

    await rowMenuTrigger(row).click();
    await page.getByRole("menuitem", { name: "Eliminar" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Eliminar a ${data.username}`);
    await page
      .locator('[data-it-dialog="true"]')
      .getByRole("button", { name: "Eliminar" })
      .click();

    // Si la cuenta tiene historial ligado, el API pide forzar la eliminación.
    const forceDialog = page.getByRole("alertdialog").filter({ hasText: "Forzar la eliminación" });
    const deletedToast = page.getByText(/Usuario eliminado definitivamente/);
    await expect(forceDialog.or(deletedToast)).toBeVisible();
    if (await forceDialog.isVisible().catch(() => false)) {
      await page
        .locator('[data-it-dialog="true"]')
        .getByRole("button", { name: "Forzar eliminación" })
        .click();
    }
    await expect(deletedToast).toBeVisible();
    await expect(rowWith(page, data.employeeNumber)).toHaveCount(0);
  });

  test("la carga desde Excel abre su pantalla (subida de archivo pendiente)", async ({ page }) => {
    await openEmployees(page);
    await page.getByRole("button", { name: "Cargar Excel" }).click();
    await expect(page).toHaveURL(/#\/employees\/import$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Cargar usuarios desde Excel" })
    ).toBeVisible();
    await expect(page.getByText(/El archivo debe traer columnas/)).toBeVisible();
    await expect(page.getByText("Ningún archivo seleccionado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Examinar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar usuarios" })).toBeDisabled();
    // Acepta solo Excel y el archivo se elige desde el input oculto.
    await expect(page.locator('input[type="file"][accept*=".xlsx"]')).toHaveCount(1);
  });
});

test.describe("Personal — HUMAN_RESOURCES", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "rh", "acme");
  });

  test("ve la lista, filtra y abre las acciones de cuenta de una fila", async ({ page }) => {
    await openEmployees(page);
    await expect(page.getByRole("heading", PERSONAL)).toBeVisible();

    await page.locator('input[name="filter-name"]').fill("Sergio");
    const sergio = rowWith(page, "Sergio Staff");
    await expect(sergio).toBeVisible();
    await expect(rowWith(page, "Ana Administradora")).toHaveCount(0);

    await rowMenuTrigger(sergio).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Cuenta: usuario, rol y correo" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Cambiar contraseña" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Desactivar" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("abre el diálogo de cuenta con URL propia y lo cierra", async ({ page }) => {
    await openEmployees(page);
    await page.locator('input[name="filter-name"]').fill("Sergio");
    const sergio = rowWith(page, "Sergio Staff");
    await expect(sergio).toBeVisible();

    const dialog = await openAccountDialog(page, sergio);
    await expect(dialog.getByText(/se editan en su expediente/)).toBeVisible();
    // Departamento actual de Sergio (sembrado en Operaciones).
    await expect(dialog.locator('input[name="u_dept"]')).toHaveValue("Operaciones");

    await dismissAccountDialog(page, dialog);
  });

  test("da de alta, da de baja y reactiva a un empleado", async ({ page }) => {
    const data = nextEmployee();
    await createEmployee(page, data);
    await page.locator('input[name="filter-employeeNumber"]').fill(data.employeeNumber);
    const row = rowWith(page, data.employeeNumber);
    await expect(row).toBeVisible();

    await rowMenuTrigger(row).click();
    await page.getByRole("menuitem", { name: "Desactivar" }).click();
    const deactivateDialog = page.locator('[data-it-dialog="true"]');
    await deactivateDialog.locator('textarea[name="deactivate_reason"]').fill("Baja RH E2E");
    await deactivateDialog.getByRole("button", { name: "Dar de baja" }).click();
    await expect(row.getByText("Inactivo", { exact: true })).toBeVisible();

    await rowMenuTrigger(row).click();
    await page.getByRole("menuitem", { name: "Reactivar" }).click();
    await page
      .locator('[data-it-dialog="true"]')
      .getByRole("button", { name: "Reactivar" })
      .click();
    await expect(row.getByText("Activo", { exact: true })).toBeVisible();
  });
});
