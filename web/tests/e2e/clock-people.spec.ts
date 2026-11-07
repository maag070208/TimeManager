import { expect, test, type Page } from "@playwright/test";
import {
  api,
  createTempPerson,
  enterAcme,
  expectOneOf,
  firstClock,
  getStatus,
  openAcme,
  removeTempPerson,
} from "./clk-helpers";

/**
 * CLK-07 — Personas del reloj (mock ISAPI: personas 1000..1007) con CLK-M06
 * (ficha de la persona: renombrar y tarjetas) y CLK-M07 (baja de persona),
 * más ACT-32 (escrituras en el equipo).
 *
 * Para no tocar a las personas sembradas del mock, cada prueba crea una
 * persona temporal por la API, opera en la UI y la borra al terminar.
 */
test.use({ timezoneId: "America/Mexico_City" });

const PEOPLE = "/time-clocks/people";
const ANCHOR = "renombra y da de baja personas en el reloj";

const dialogOpen = (page: Page) => page.locator('[data-it-dialog="true"]');
const rowOf = (page: Page, text: string) => page.locator("tbody tr", { hasText: text }).first();

async function openPeople(page: Page): Promise<void> {
  await openAcme(page, PEOPLE, ANCHOR);
  await expect(page.getByText(/persona\(s\) en el reloj/).first()).toBeVisible({ timeout: 25_000 });
}

test.describe("personas del reloj", () => {
  test("[CLK-07] lista las personas del mock con su avance y refresca", async ({ page }) => {
    await enterAcme(page);
    await openPeople(page);

    await expect(page.getByText(/persona\(s\) en el reloj/).first()).toBeVisible();
    await expect(rowOf(page, "PERSONA PRUEBA UNO")).toBeVisible({ timeout: 25_000 });
    const refresh = page.getByRole("button", { name: /Actualizar todo/ }).first();
    await expect(refresh).toBeVisible();
    await refresh.click();
    await expect(rowOf(page, "PERSONA PRUEBA UNO")).toBeVisible({ timeout: 25_000 });
  });

  test("[CLK-07][CLK-M06][ACT-32] ficha: renombrar, tarjeta sólo dígitos, alta y baja", async ({ page }) => {
    await enterAcme(page);
    const status = await getStatus(page);
    const clock = firstClock(status);
    test.skip(!clock, "acme no tiene relojes dados de alta");

    const number = "9912";
    const name = "PERSONA FICHA E2E";
    await createTempPerson(page, clock.clockSerial, number, name);
    try {
      await openPeople(page);
      await rowOf(page, `#${number}`).click();
      const dialog = dialogOpen(page);
      await expect(dialog.getByText("Ficha de la persona")).toBeVisible({ timeout: 20_000 });
      await expect(dialog.getByText("Checadas hoy")).toBeVisible();

      // Renombrar: menos de 2 letras no deja guardar.
      await dialog.getByRole("button", { name: "Renombrar" }).click();
      const nameInput = dialog.locator('input[name="clockPersonName"]');
      await nameInput.fill("X");
      await expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
      const renamed = "PERSONA FICHA E2E DOS";
      await nameInput.fill(renamed);
      const rename = page.waitForResponse(
        (r) => r.url().includes(`/people/${number}`) && r.request().method() === "PATCH"
      );
      await dialog.getByRole("button", { name: "Guardar" }).click();
      expect((await rename).status()).toBe(200);
      await expect(dialog.getByText(renamed).first()).toBeVisible({ timeout: 20_000 });

      // Tarjeta: el campo filtra a dígitos y sin número no se puede registrar.
      const cardInput = dialog.locator('input[name="clockPersonCard"]');
      await cardInput.fill("abc");
      await expect(cardInput).toHaveValue("");
      await expect(dialog.getByRole("button", { name: "Registrar tarjeta" })).toBeDisabled();
      const cardNo = "5500999";
      await cardInput.fill(cardNo);
      const addCard = page.waitForResponse(
        (r) => r.url().includes(`/people/${number}/cards`) && r.request().method() === "POST"
      );
      await dialog.getByRole("button", { name: "Registrar tarjeta" }).click();
      expect((await addCard).status()).toBeGreaterThanOrEqual(200);
      await expect(dialog.getByText(cardNo).first()).toBeVisible({ timeout: 20_000 });

      // Quitar la tarjeta (escritura en el reloj) y verificar que desaparece.
      const removeCard = page.waitForResponse(
        (r) => r.url().includes(`/cards/${cardNo}`) && r.request().method() === "DELETE"
      );
      await dialog.getByRole("button", { name: "Quitar" }).first().click();
      expect((await removeCard).status()).toBeGreaterThanOrEqual(200);
      await expect(dialog.getByText(cardNo)).toHaveCount(0, { timeout: 20_000 });

      await page.keyboard.press("Escape");
      await expect(dialogOpen(page)).toHaveCount(0);
    } finally {
      await removeTempPerson(page, clock.clockSerial, number);
    }
  });

  test("[CLK-07][CLK-M07][ACT-32] baja de persona: cancelar no cambia y confirmar la quita", async ({ page }) => {
    await enterAcme(page);
    const status = await getStatus(page);
    const clock = firstClock(status);
    test.skip(!clock, "acme no tiene relojes dados de alta");

    const number = "9913";
    const name = "PERSONA BAJA E2E";
    await createTempPerson(page, clock.clockSerial, number, name);
    try {
      await openPeople(page);
      const row = rowOf(page, `#${number}`);
      await expect(row).toBeVisible({ timeout: 25_000 });

      // Cancelar la baja no cambia nada.
      await row.getByRole("button", { name: "Dar de baja" }).first().click();
      await expect(dialogOpen(page).getByText(new RegExp(`Dar de baja a ${name}`))).toBeVisible();
      await dialogOpen(page).getByRole("button", { name: "No" }).click();
      await expect(dialogOpen(page)).toHaveCount(0);
      await expect(rowOf(page, `#${number}`)).toBeVisible();

      // Confirmar la baja escribe en el reloj y quita la fila.
      await rowOf(page, `#${number}`).getByRole("button", { name: "Dar de baja" }).first().click();
      const remove = page.waitForResponse(
        (r) => r.url().includes(`/people/${number}`) && r.request().method() === "DELETE"
      );
      await dialogOpen(page).getByRole("button", { name: "Dar de baja" }).click();
      expect((await remove).status()).toBeGreaterThanOrEqual(200);
      await expectOneOf(page, [
        { name: "toast", locator: page.getByText("Persona dada de baja del reloj.") },
        { name: "resultado api", locator: page.getByText(/dado de baja|Dar de baja/) },
      ]);
      await expect(rowOf(page, `#${number}`)).toHaveCount(0, { timeout: 20_000 });
      expect((await api(page, "DELETE", `/time-clock/clocks/${clock.clockSerial}/people/${number}`)).status).not.toBe(500);
    } finally {
      await removeTempPerson(page, clock.clockSerial, number);
    }
  });
});
