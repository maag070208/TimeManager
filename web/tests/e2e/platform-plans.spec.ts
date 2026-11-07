import { expect, test } from "@playwright/test";
import { createPlanViaUi, dialog, gotoPlatform, loginPlatform, rowOf, unique } from "./platform-kit";

/**
 * PLAT-05 — catálogo de planes: alta, validación, edición, baja lógica y
 * reactivación. Los planes de prueba se crean con nombre único.
 */
test.use({ timezoneId: "America/Mexico_City" });

test.describe("catálogo de planes", () => {
  test("[PLAT-05] la consola muestra KPIs y el catálogo", async ({ page }) => {
    await loginPlatform(page);
    await gotoPlatform(page, "/plans");
    await expect(page.getByRole("heading", { level: 1, name: "Planes" })).toBeVisible();
    for (const label of ["Activos", "Dados de baja"]) {
      await expect(page.getByText(label, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Catálogo de planes" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nuevo plan/ })).toBeVisible();
  });

  test("[PLAT-05][PLAT-M6][ACT-07] alta: valida enteros positivos y muestra el plan", async ({ page }) => {
    await loginPlatform(page);
    await gotoPlatform(page, "/plans");
    const name = `Plan QA ${unique("")}`;

    await page.getByRole("button", { name: /Nuevo plan/ }).click();
    const form = dialog(page);
    await expect(form.getByText("Nuevo plan").first()).toBeVisible();
    await form.locator('input[name="name"]').fill(name);
    await form.locator('input[name="employeeLimit"]').fill("0");
    await form.locator('input[name="clockLimit"]').fill("2");
    await form.locator('input[name="monthlyPrice"]').fill("100");
    await form.getByRole("button", { name: "Guardar plan" }).click();
    await expect(form.getByText("Debe ser un número mayor a 0")).toBeVisible();

    // Cancelar no crea nada.
    await form.getByRole("button", { name: "Cancelar" }).click();
    await expect(rowOf(page, name)).toHaveCount(0);

    await createPlanViaUi(page, { name, people: 30, clocks: 3, price: 300 });
    const row = rowOf(page, name);
    await expect(row).toBeVisible();
    await expect(row.getByText("30", { exact: true })).toBeVisible();
    await expect(row.getByText("3", { exact: true })).toBeVisible();
  });

  test("[PLAT-05][PLAT-M6][ACT-07] edita límites y precio del plan", async ({ page }) => {
    await loginPlatform(page);
    const name = await createPlanViaUi(page);
    const edited = `${name} editado`;
    const row = rowOf(page, name);
    await row.getByRole("button", { name: "Editar" }).click();

    const form = dialog(page);
    await form.locator('input[name="name"]').fill(edited);
    await form.locator('input[name="employeeLimit"]').fill("40");
    await form.locator('input[name="clockLimit"]').fill("4");
    await form.locator('input[name="monthlyPrice"]').fill("400");
    await form.getByRole("button", { name: "Guardar plan" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    // El catálogo virtualizado no refresca el texto de una fila existente:
    // se recarga para comprobar que el PATCH persistió.
    await page.reload();
    await expect(rowOf(page, edited)).toBeVisible({ timeout: 20_000 });
    await expect(rowOf(page, edited).getByText("40", { exact: true })).toBeVisible();
  });

  test("[PLAT-05][PLAT-M7][ACT-07] baja lógica: deja de ofrecerse y se reactiva", async ({ page }) => {
    await loginPlatform(page);
    const name = await createPlanViaUi(page);

    await rowOf(page, name).getByRole("button", { name: "Dar de baja" }).click();
    const confirm = dialog(page);
    await expect(confirm.getByText(`¿Dar de baja el plan ${name}?`)).toBeVisible();
    await expect(confirm.getByText(/Dejará de ofrecerse para nuevos clientes/)).toBeVisible();
    await confirm.getByRole("button", { name: "Dar de baja" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await page.reload();
    await expect(rowOf(page, name).getByText("Dado de baja").first()).toBeVisible({ timeout: 20_000 });

    await rowOf(page, name).getByRole("button", { name: "Reactivar" }).click();
    await expect(dialog(page).getByText(`¿Reactivar el plan ${name}?`)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Reactivar" }).click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 20_000 });
    await page.reload();
    await expect(rowOf(page, name).getByText("Activo").first()).toBeVisible({ timeout: 20_000 });
  });
});
