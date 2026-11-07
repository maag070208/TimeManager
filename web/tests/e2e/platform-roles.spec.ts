import { expect, test, type Page } from "@playwright/test";
import { PLATFORM } from "./helpers";
import { dialog, unique } from "./platform-kit";
import { loginReady } from "./session";

/**
 * PLAT-06 — consola de roles y permisos. Se entra como ADMIN y, para las
 * operaciones sobre personas de un cliente, se elige acme en la barra superior.
 * Los roles/permisos mutables se crean con nombre único dentro de la prueba.
 */
test.use({ timezoneId: "America/Mexico_City" });

const BASE = PLATFORM.base;
const route = (path: string) => `${BASE}/#${path}`;

async function enter(page: Page): Promise<void> {
  await loginReady(page, BASE, PLATFORM.admin, /Panel de CheckLab/);
}

async function selectAcmeTenant(page: Page): Promise<void> {
  const select = page.locator('select[name="tenant"]');
  await expect(select).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
      return !!el && [...el.options].some((o) => /acme/i.test(o.textContent ?? ""));
    },
    undefined,
    { timeout: 20_000 }
  );
  const value = await page.evaluate(() => {
    const el = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    const option = el ? [...el.options].find((o) => /acme/i.test(o.textContent ?? "")) : undefined;
    return option?.value ?? null;
  });
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  await expect(page.getByText("Hola, Admin").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

async function openRoles(page: Page): Promise<void> {
  await page.goto(route("/roles"));
  await expect(page.getByText(/Define qué puede hacer cada rol/)).toBeVisible({ timeout: 30_000 });
}

async function createRole(page: Page, name?: string): Promise<string> {
  const roleName = name ?? `E2E QA Rol ${unique("")}`;
  await page.getByRole("button", { name: "Nuevo rol" }).click();
  const form = dialog(page);
  await expect(form.getByText("Nuevo rol").first()).toBeVisible();
  await form.locator('input[name="role_name"]').fill(roleName);
  await form.getByRole("button", { name: "Crear rol" }).click();
  await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText(roleName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  return roleName;
}

async function openTab(page: Page, tab: string | RegExp): Promise<void> {
  await page.getByRole("button", { name: tab }).first().click();
}

test.describe("consola de roles y permisos", () => {
  test("[PLAT-06][PLAT-06-T1][PLAT-M8][ACT-08] crea un rol y lo deja seleccionable", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);

    // Cancelar no crea nada.
    await page.getByRole("button", { name: "Nuevo rol" }).click();
    const form = dialog(page);
    await form.locator('input[name="role_name"]').fill(`Cancelado ${unique("")}`);
    await form.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });

    const roleName = await createRole(page);
    // El rol nuevo se abre en el detalle con sus acciones.
    await page.getByText(roleName, { exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Duplicar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Más acciones" })).toBeVisible();
  });

  test("[PLAT-06][PLAT-06-T1][PLAT-M9][ACT-08] desactiva, reactiva y elimina un rol", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);
    const roleName = await createRole(page);
    await page.getByText(roleName, { exact: true }).first().click();

    // Desactivar con confirmación.
    await page.getByRole("button", { name: "Más acciones" }).click();
    await page.getByRole("menuitem", { name: "Desactivar rol" }).click();
    const confirm = dialog(page);
    await expect(confirm.getByText("Desactivar rol", { exact: true })).toBeVisible();
    await expect(confirm.getByText(new RegExp(`¿Desactivar el rol "${roleName}"`))).toBeVisible();
    await confirm.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });

    // Reactivar.
    await page.getByRole("button", { name: "Más acciones" }).click();
    await page.getByRole("menuitem", { name: "Activar rol" }).click();
    await expect(dialog(page).getByText("Activar rol", { exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });

    // Eliminar (rol sin personas).
    await page.getByRole("button", { name: "Más acciones" }).click();
    await page.getByRole("menuitem", { name: "Eliminar rol" }).click();
    const remove = dialog(page);
    await expect(remove.getByText("Eliminar rol", { exact: true })).toBeVisible();
    await expect(remove.getByText(new RegExp(`¿Eliminar el rol "${roleName}"`))).toBeVisible();
    await remove.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(roleName, { exact: true })).toHaveCount(0, { timeout: 20_000 });
  });

  test("[PLAT-06][PLAT-06-T2][PLAT-M18][ACT-09] matriz: descarta y luego aplica un cambio", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);
    const roleName = await createRole(page);
    await openTab(page, "Comparar roles");
    await expect(page.getByText("PERMISO").first()).toBeVisible({ timeout: 20_000 });

    const cell = page.locator(`button[title^="${roleName} · "]`).first();
    await expect(cell).toBeVisible({ timeout: 20_000 });
    const before = await cell.getAttribute("title");
    await cell.click();
    await expect(page.getByRole("button", { name: "Revisar y guardar" })).toBeVisible();
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByRole("button", { name: "Revisar y guardar" })).toHaveCount(0);

    // Cambio real: revisar y guardar.
    await cell.click();
    await page.getByRole("button", { name: "Revisar y guardar" }).click();
    const review = dialog(page);
    await expect(review.getByText("Guardar cambios")).toBeVisible();
    await review.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 30_000 });

    // Persistió: tras recargar, la celda ya no tiene el título original.
    await page.reload();
    await openTab(page, "Comparar roles");
    await expect(page.getByText("PERMISO").first()).toBeVisible({ timeout: 30_000 });
    const after = page.locator(`button[title^="${roleName} · "]`).first();
    await expect(after).toBeVisible({ timeout: 20_000 });
    expect(await after.getAttribute("title")).not.toBe(before);
  });

  test("[PLAT-06][PLAT-06-T3][PLAT-M15][PLAT-M16][ACT-10] excepción: la concede y la quita", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);
    await openTab(page, "Acceso por persona");
    await page.locator('input[name="explorer_search"]').fill("Sergio");
    await page.locator("button", { hasText: "Sergio Staff" }).first().click();
    await expect(page.getByText("@acme.staff").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Todo", exact: true }).click();

    await page.getByText("Dar acceso", { exact: true }).first().click();
    await page.getByRole("menuitem", { name: /Dárselo solo a Sergio Staff/ }).click();
    const exception = dialog(page);
    await expect(exception.getByText("Dar acceso solo a Sergio Staff")).toBeVisible();
    await exception.locator('input[name="exception_reason"]').fill("Cobertura E2E");
    await exception.getByRole("button", { name: "Dar acceso", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });

    // La excepción se refleja en el acceso de la persona (chip violeta).
    await page.reload();
    await openTab(page, "Acceso por persona");
    await page.locator('input[name="explorer_search"]').fill("Sergio");
    await page.locator("button", { hasText: "Sergio Staff" }).first().click();
    await page.getByRole("button", { name: "Todo", exact: true }).click();
    await expect(page.getByTitle("Cobertura E2E").first()).toBeVisible({ timeout: 20_000 });

    // Limpiar la excepción desde la fila del permiso que la tiene.
    const exceptionRow = page
      .locator("div")
      .filter({ has: page.getByTitle("Cobertura E2E") })
      .filter({ has: page.getByText("Quitar", { exact: true }) })
      .last();
    await exceptionRow.getByText("Quitar", { exact: true }).click();
    await page.getByRole("menuitem", { name: "Quitar la excepción" }).click();
    const clear = dialog(page);
    await expect(clear.getByText("Quitar excepción")).toBeVisible();
    await clear.getByRole("button", { name: /Quitar la excepción|Quitar/ }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[PLAT-06][PLAT-06-T3][PLAT-M17] agrega y quita un rol adicional desde el acceso", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);
    await openTab(page, "Acceso por persona");
    await page.locator('input[name="explorer_search"]').fill("Sergio");
    await page.locator("button", { hasText: "Sergio Staff" }).first().click();
    await expect(page.getByText("@acme.staff").first()).toBeVisible({ timeout: 20_000 });

    await page.getByText("Agregar rol", { exact: true }).first().click();
    await page.getByRole("menuitem", { name: "ADMINISTRADOR DEL CLIENTE", exact: true }).click();
    await expect(page.getByRole("button", { name: "Quitar este rol" }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Quitar este rol" }).first().click();
    const confirm = dialog(page);
    await expect(confirm.getByText("Quitar rol adicional", { exact: true })).toBeVisible();
    await confirm.getByRole("button", { name: "Quitar", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[PLAT-06][PLAT-06-T5][PLAT-M11][PLAT-M12][ACT-11] catálogo: crea un permiso y lo desactiva", async ({ page }) => {
    await enter(page);
    await openRoles(page);
    await openTab(page, "Catálogo");
    await expect(page.getByText("Los permisos del sistema. No se borran: se desactivan.")).toBeVisible();

    const permissionName = `E2E QA permiso ${unique("")}`;
    await page.getByRole("button", { name: "Nuevo permiso" }).click();
    const form = dialog(page);
    await form.locator('input[name="permission_name"]').fill(permissionName);
    await form.locator('input[name="permission_module"]').fill("E2E QA");
    await form.locator('input[name="permission_key"]').fill(`e2e.qa_${Date.now().toString(36)}`);
    await form.getByText("Sí o no", { exact: true }).first().click();
    await form.getByRole("button", { name: "Crear permiso" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    const row = page.locator("tr", { hasText: permissionName }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByTitle("Desactivar").click();
    const confirm = dialog(page);
    await expect(confirm.getByText(/¿Desactivar el permiso/)).toBeVisible();
    await confirm.getByRole("button", { name: /Desactivar|Confirmar/ }).click();
    await expect(row.getByText("Inactivo").first()).toBeVisible({ timeout: 20_000 });

    await row.getByTitle("Activar").click();
    await dialog(page).getByRole("button", { name: /Activar|Confirmar/ }).click();
    await expect(row.getByText("Activo").first()).toBeVisible({ timeout: 20_000 });
  });

  test("[PLAT-06][PLAT-06-T3][PLAT-M19] probador de acceso: abre, muestra el estado inicial y cierra", async ({ page }) => {
    await enter(page);
    await openRoles(page);
    await page.getByRole("button", { name: "Probar acceso" }).click();

    const tester = dialog(page);
    await expect(tester.getByText("¿Puede…? — probador de acceso")).toBeVisible({ timeout: 20_000 });
    await expect(tester.getByText(/Revisa en tres pasos lo mismo que revisa el sistema/)).toBeVisible();
    await expect(tester.getByText("Elige una persona", { exact: false }).first()).toBeVisible();

    // Sin acciones ABAC configuradas el probador queda en su estado inicial;
    // debe poder cerrarse con el botón de cerrar del diálogo.
    await tester.getByRole("button", { name: "Cerrar" }).first().click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("[PLAT-06][PLAT-06-T4][PLAT-M13][PLAT-M14] ABAC sin acciones: la consola no ofrece crear reglas", async ({ page }) => {
    await enter(page);
    await openRoles(page);
    await openTab(page, "Políticas");
    await expect(page.getByText(/Las reglas ponen condiciones a un permiso/)).toBeVisible({ timeout: 20_000 });
    // El catálogo de acciones ABAC del producto está vacío: la consola no
    // ofrece crear políticas ni probar reglas (gap documentado en la matriz QA).
    await expect(page.getByRole("button", { name: "Nueva política" })).toHaveCount(0);
  });

  test("[PLAT-06][PLAT-06-T6] actividad: subtítulo, filtros rápidos y tabla", async ({ page }) => {
    await enter(page);
    await openRoles(page);
    await openTab(page, "Actividad");
    await expect(page.getByText(/Cambios de roles, permisos, políticas y excepciones/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Accesos denegados", { exact: true })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("[PLAT-06][PLAT-M20] ayuda del control de acceso: abre y cierra", async ({ page }) => {
    await enter(page);
    await openRoles(page);
    await page.getByRole("button", { name: "Ayuda" }).click();
    const help = dialog(page);
    await expect(help.getByText("Cómo funciona el control de acceso")).toBeVisible({ timeout: 20_000 });
    await expect(help.getByText(/Identidad/)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
