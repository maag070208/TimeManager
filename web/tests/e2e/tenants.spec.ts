import { expect, test, type Page } from "@playwright/test";
import { PLATFORM } from "./helpers";
import { loginReady } from "./session";

/**
 * Consola de plataforma (E2E-3): clientes, suspender/reactivar y entrar como
 * cliente. e2e.admin es ADMIN con tenants.manage, así que ve la consola en "/".
 */
test.use({ timezoneId: "America/Mexico_City" });

const BASE = PLATFORM.base;

async function enter(page: Page): Promise<void> {
  await loginReady(page, BASE, PLATFORM.admin, /Tus clientes, su estado y su uso\./);
}

const rowOf = (page: Page, name: string) => page.locator("tr", { hasText: name }).first();
const dialog = (page: Page) => page.locator('[data-it-dialog="true"]');

test.describe("consola de clientes", () => {
  test("lista los clientes acme y beta con su estado", async ({ page }) => {
    await enter(page);

    await expect(page.getByText("Panel de CheckLab").first()).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Acme")).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Beta")).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Acme").getByText("acme.localhost").first()).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Beta").getByText("beta.localhost").first()).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Acme").getByText("Activo").first()).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Beta").getByText("Activo").first()).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Acme").getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nuevo cliente/ })).toBeVisible();
  });

  test("suspende y reactiva un cliente con confirmación", async ({ page }) => {
    await enter(page);
    const beta = rowOf(page, "Cliente E2E Beta");

    await beta.getByRole("button", { name: "Suspender" }).click();
    await expect(dialog(page).getByText("¿Suspender a Cliente E2E Beta?")).toBeVisible();
    await expect(dialog(page).getByText(/Nadie de este cliente podrá entrar/)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Suspender" }).click();

    await expect(rowOf(page, "Cliente E2E Beta").getByText("Suspendido").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      rowOf(page, "Cliente E2E Beta").getByRole("button", { name: "Reactivar" })
    ).toBeVisible();

    await rowOf(page, "Cliente E2E Beta").getByRole("button", { name: "Reactivar" }).click();
    await expect(dialog(page).getByText("¿Reactivar a Cliente E2E Beta?")).toBeVisible();
    await expect(dialog(page).getByText(/volver a entrar por beta\.localhost/)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Reactivar" }).click();

    await expect(rowOf(page, "Cliente E2E Beta").getByText("Activo").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      rowOf(page, "Cliente E2E Beta").getByRole("button", { name: "Suspender" })
    ).toBeVisible();
  });

  test("crea un cliente nuevo con su administrador y correo", async ({ page }) => {
    await enter(page);
    await page.getByRole("button", { name: /Nuevo cliente/ }).click();

    const create = dialog(page);
    await expect(create.getByText("Nuevo cliente").first()).toBeVisible();
    await create.locator('input[name="name"]').fill("Cliente E2E Gamma");
    // El subdominio se deriva del nombre.
    await expect(create.locator('input[name="slug"]')).toHaveValue("cliente-e2e-gamma");
    await create.locator('input[name="adminName"]').fill("Gaby Gamma");
    await create.locator('input[name="adminUsername"]').fill("gamma.admin");
    await create.locator('input[name="adminEmail"]').fill("gamma.admin@timemanager.test");
    await create.getByRole("button", { name: "Crear cliente" }).click();

    // El diálogo pasa al resultado con los datos de acceso (se muestran una vez).
    await expect(create.getByText("Cliente E2E Gamma está listo")).toBeVisible({ timeout: 30_000 });
    await expect(create.getByText("gamma.admin").first()).toBeVisible();
    await expect(create.getByText("Contraseña provisional")).toBeVisible();
    await create.getByRole("button", { name: "Listo" }).click();

    await expect(rowOf(page, "Cliente E2E Gamma")).toBeVisible({ timeout: 20_000 });
    await expect(
      rowOf(page, "Cliente E2E Gamma").getByText("cliente-e2e-gamma.localhost").first()
    ).toBeVisible();
  });

  test("la consola de planes carga y da de alta un plan", async ({ page }) => {
    await enter(page);
    await page.goto(`${BASE}/#/plans`);
    await expect(page.getByText("Catálogo de planes")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Relojes")).toBeVisible();
    await page.getByRole("button", { name: /Nuevo plan/ }).click();

    const create = dialog(page);
    await expect(create.getByText("Nuevo plan").first()).toBeVisible();
    await create.locator('input[name="name"]').fill("Plan E2E");
    await create.locator('input[name="employeeLimit"]').fill("20");
    await create.locator('input[name="clockLimit"]').fill("2");
    await create.locator('input[name="monthlyPrice"]').fill("199");
    await create.getByRole("button", { name: "Guardar plan" }).click();

    await expect(rowOf(page, "Plan E2E")).toBeVisible({ timeout: 20_000 });
    await expect(rowOf(page, "Plan E2E").getByText("20")).toBeVisible();
  });

  test("entra a operar como el cliente acme", async ({ page }) => {
    await enter(page);
    await rowOf(page, "Cliente E2E Acme").getByRole("button", { name: "Entrar" }).click();

    // La app recarga y queda operando como acme (inicio del cliente).
    await expect(page.getByText("Hola, Admin").first()).toBeVisible({ timeout: 30_000 });
    // El saludo del inicio del cliente: "Cliente E2E Acme · <día de hoy>".
    await expect(page.getByText(/Cliente E2E Acme ·/).first()).toBeVisible();
    await expect(page.getByText(/Primeros pasos/).first()).toBeVisible();
  });
});

test.describe("cancelar acciones de cliente", () => {
  test("[PLAT-03][PLAT-M4] cancelar la suspensión deja al cliente activo", async ({ page }) => {
    await enter(page);
    const beta = rowOf(page, "Cliente E2E Beta");
    await beta.getByRole("button", { name: "Suspender" }).click();
    const confirm = dialog(page);
    await expect(confirm.getByText("¿Suspender a Cliente E2E Beta?")).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(rowOf(page, "Cliente E2E Beta").getByText("Activo").first()).toBeVisible();
    await expect(rowOf(page, "Cliente E2E Beta").getByRole("button", { name: "Suspender" })).toBeVisible();
  });
});
