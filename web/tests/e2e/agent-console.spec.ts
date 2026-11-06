import { expect, test, type Page } from "@playwright/test";
import { ACME, PLATFORM } from "./helpers";
import { loginReady } from "./session";

/**
 * Agente local desde la web (F3-12 + F3-07).
 *
 * La consola de plataforma emite/rota/revoca el token del `CheckLab Agent`;
 * el panel de relojes del cliente encola trabajos que el agente ejecutará en
 * su red. El stack E2E ya trae lo necesario (seed: `e2e.admin` de plataforma y
 * el reloj "Entrada principal" de acme apuntando al mock ISAPI con escritura
 * habilitada), así que esta suite no toca `e2e-seed.ts` ni `web/src`.
 */
test.use({ timezoneId: "America/Mexico_City" });

const dialog = (page: Page) => page.locator('[data-it-dialog="true"]');
const rowOf = (page: Page, name: string) => page.locator("tr", { hasText: name }).first();

async function enterPlatform(page: Page): Promise<void> {
  await loginReady(page, PLATFORM.base, PLATFORM.admin, /Tus clientes, su estado y su uso\./);
}

async function enterAcme(page: Page): Promise<void> {
  await loginReady(page, ACME.base, ACME.admin, /Hola, Ana/);
}

test.describe("consola del agente (plataforma)", () => {
  test("emite el token una sola vez y permite rotarlo y revocarlo", async ({ page }) => {
    await enterPlatform(page);

    await rowOf(page, ACME.name).getByRole("button", { name: "Agente" }).click();
    const agentDialog = dialog(page);
    await expect(agentDialog.getByText(`Agente local · ${ACME.name}`)).toBeVisible();
    await expect(agentDialog.getByText("Este cliente todavía no tiene agentes.")).toBeVisible({
      timeout: 20_000,
    });

    await agentDialog.locator('input[name="agentName"]').fill("PC recepción E2E");
    await agentDialog.getByRole("button", { name: /Crear agente/ }).click();

    await expect(
      agentDialog.getByText("Token nuevo (se muestra una sola vez; cópialo ahora):")
    ).toBeVisible({ timeout: 20_000 });
    const firstToken = (await agentDialog.locator("code").first().innerText()).trim();
    expect(firstToken).toMatch(/^tma_/);
    await expect(agentDialog.getByText("PC recepción E2E").first()).toBeVisible();
    await expect(agentDialog.getByText("Activo").first()).toBeVisible();

    await agentDialog.getByRole("button", { name: "Rotar token" }).click();
    await expect(agentDialog.getByText("Token rotado: el anterior ya no funciona.")).toBeVisible({
      timeout: 20_000,
    });
    const rotatedToken = (await agentDialog.locator("code").first().innerText()).trim();
    expect(rotatedToken).toMatch(/^tma_/);
    expect(rotatedToken).not.toBe(firstToken);

    await agentDialog.getByRole("button", { name: "Revocar" }).click();
    await expect(agentDialog.getByText("Revocado").first()).toBeVisible({ timeout: 20_000 });
    await expect(agentDialog.getByRole("button", { name: "Reactivar" }).first()).toBeVisible();
  });
});

test.describe("trabajos del agente desde el panel de relojes", () => {
  test("encola SYNC y alta de persona, y quedan pendientes hasta que el agente los tome", async ({
    page,
  }) => {
    await enterAcme(page);
    await page.goto(`${ACME.base}/#/time-clocks`);
    await expect(
      page.getByText("Da de alta los relojes y revisa su configuración").first()
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText("Trabajos para el agente local").first()).toBeVisible();
    // El reloj sembrado tiene la escritura habilitada: no debe avisar lo contrario.
    await expect(page.getByText("Este reloj no tiene la escritura habilitada")).toHaveCount(0);

    const action = page.locator('select[name="agentJobAction"]');
    await expect(page.locator('select[name="agentJobClock"]')).toHaveValue(/.+/);
    // El historial de trabajos: acota las aserciones para no leer las <option> del select.
    const recentJobs = page.getByTestId("agent-jobs-recent");

    // Sincronización: no necesita datos extra.
    await action.selectOption("SYNC");
    await page.getByRole("button", { name: "Encolar" }).click();
    await expect(
      page.getByText("Trabajo encolado: el agente lo ejecutará en segundos.").first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(recentJobs.getByText("Sincronizar checadas").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(recentJobs.getByText("Pendiente").first()).toBeVisible();

    // Alta de persona: pide número de empleado y nombre.
    await action.selectOption("PERSON_ADD");
    await page.locator('input[name="agentJobEmployee"]').fill("999001");
    await page.locator('input[name="agentJobName"]').fill("Persona E2E Agente");
    await page.getByRole("button", { name: "Encolar" }).click();
    await expect(recentJobs.getByText("Alta de persona").first()).toBeVisible({ timeout: 20_000 });

    // Sin agente corriendo en E2E, los trabajos quedan en la cola (no se pierden).
    await expect(recentJobs.getByText("Pendiente").first()).toBeVisible();
    await expect(recentJobs.getByText("Pendiente").nth(1)).toBeVisible();
  });
});
