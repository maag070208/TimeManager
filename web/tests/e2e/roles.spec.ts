import { expect, test, type Page } from "@playwright/test";
import { PLATFORM } from "./helpers";
import { loginReady } from "./session";

/**
 * Consola de plataforma de roles (E2E-3). e2e.admin (ADMIN, permiso
 * roles.manage) elige el cliente acme en la barra superior (X-Tenant-Id) para
 * revisar la ficha de acceso de un usuario de cliente y comprobar que los
 * roles de plataforma (ADMIN/SUPPORT) no se pueden dar a personal de cliente
 * (regla ROLE_NOT_FOR_CLIENT: la UI no debería ofrecerlos y, si los ofrece, la
 * API debe rechazarlo).
 */
test.use({ timezoneId: "America/Mexico_City" });

const BASE = PLATFORM.base;
const route = (path: string) => `${BASE}/#${path}`;

async function enter(page: Page): Promise<void> {
  await loginReady(page, BASE, PLATFORM.admin, /Panel de CheckLab/);
}

/** Elige el cliente acme en el selector de la barra superior y espera la recarga. */
async function selectAcmeTenant(page: Page): Promise<void> {
  const select = page.locator('select[name="tenant"]');
  await expect(select).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
      return !!s && [...s.options].some((o) => /acme/i.test(o.textContent ?? ""));
    },
    undefined,
    { timeout: 20_000 }
  );
  const value = await page.evaluate(() => {
    const s = document.querySelector('select[name="tenant"]') as HTMLSelectElement | null;
    const option = s ? [...s.options].find((o) => /acme/i.test(o.textContent ?? "")) : undefined;
    return option?.value ?? null;
  });
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  // La selección recarga la app ("window.location.assign('/')") y opera como acme:
  // el inicio cambia de consola de plataforma al inicio del cliente.
  await expect(page.getByText("Hola, Admin").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
}

async function openRoles(page: Page): Promise<void> {
  await page.goto(route("/roles"));
  await expect(
    page.getByText("Define qué puede hacer cada rol y revisa el acceso de cualquier persona.")
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("consola de roles", () => {
  test("carga con pestañas y matriz de permisos visible", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);

    // Pestañas de la consola.
    for (const tab of ["Roles", "Comparar roles", "Acceso por persona", "Políticas", "Catálogo", "Actividad"]) {
      await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
    }

    // Matriz rol × permiso.
    await page.getByText("Comparar roles", { exact: true }).click();
    await expect(page.getByText("PERMISO").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Clic en una celda para conceder, subir el alcance o quitar.")).toBeVisible();
    await expect(page.getByText("Solo diferencias").first()).toBeVisible();
    // Roles de plataforma y de cliente en las columnas de la matriz.
    for (const role of [
      "ADMINISTRADOR",
      "SOPORTE",
      "ADMINISTRADOR DEL CLIENTE",
      "RECURSOS HUMANOS",
      "PERSONAL",
    ]) {
      await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    }
  });

  /**
   * Regla ROLE_NOT_FOR_CLIENT: ADMIN/SUPPORT son roles del equipo de
   * CheckLab y no pueden darse a personal de un cliente. Con el cliente acme
   * elegido (X-Tenant-Id), el menú "Agregar rol" debe ofrecer SOLO roles de
   * cliente. (Este caso llegó a fallar: el menú ofrecía ADMINISTRADOR/SOPORTE y
   * la API los rechazaba con 403; ya está corregido en el working tree.)
   */
  test("con cliente acme el menú Agregar rol solo ofrece roles de cliente", async ({ page }) => {
    await enter(page);
    await selectAcmeTenant(page);
    await openRoles(page);
    await page.getByText("Acceso por persona", { exact: true }).click();
    await page.locator('input[name="explorer_search"]').fill("Sergio");
    await page.locator("button", { hasText: "Sergio Staff" }).first().click();
    await expect(page.getByText("@acme.staff").first()).toBeVisible({ timeout: 20_000 });

    await page.getByText("Agregar rol", { exact: true }).first().click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 10_000 });

    await expect(menu.getByRole("menuitem", { name: "ADMINISTRADOR", exact: true })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: "SOPORTE", exact: true })).toHaveCount(0);
    // Los roles de cliente que todavía no tiene sí se ofrecen.
    await expect(
      menu.getByRole("menuitem", { name: "ADMINISTRADOR DEL CLIENTE", exact: true })
    ).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "RECURSOS HUMANOS", exact: true })).toBeVisible();
  });

  test("sin cliente elegido la plataforma sí puede asignar roles de plataforma", async ({ page }) => {
    await enter(page);
    await openRoles(page);
    await page.getByText("Acceso por persona", { exact: true }).click();
    // Sin cliente elegido, la consola lista a todas las personas; se prueba con
    // un usuario de cliente (beta.admin) para ver que aquí la matriz completa sí
    // está disponible (el filtro por cliente solo aplica con cliente elegido).
    await page.locator('input[name="explorer_search"]').fill("Beto");
    await page.locator("button", { hasText: "Beto Administrador" }).first().click();
    await expect(page.getByText("@beta.admin").first()).toBeVisible({ timeout: 20_000 });

    await page.getByText("Agregar rol", { exact: true }).first().click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await expect(menu.getByRole("menuitem", { name: "ADMINISTRADOR", exact: true })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "SOPORTE", exact: true })).toBeVisible();
  });

});
