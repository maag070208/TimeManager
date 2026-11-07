import { expect, test, type Page } from "@playwright/test";
import {
  adminSession,
  createLeaveRequest,
  createLeaveType,
  loginClient,
  openClientRoute,
  staffSession,
  tableRowWith,
  uniqueRef,
} from "./rh-fixtures";
import { ACME } from "./helpers";

/**
 * HR-05 · Vacaciones y permisos (RH) y ACT-18 aprobar/rechazar.
 *
 * El seed puede traer solicitudes, pero la prueba crea las suyas por API (portal
 * del trabajador) con un motivo único para localizarlas sin depender del seed.
 * Aprobar/rechazar son acciones directas (sin modal), con toast y recarga.
 */

test.describe.configure({ retries: 1 });

interface PendingFixture {
  marker: string;
  typeName: string;
}

const createPendingRequests = async (
  request: Parameters<typeof adminSession>[0],
  count: number
): Promise<PendingFixture[]> => {
  const admin = await adminSession(request);
  const staff = await staffSession(request);
  const fixtures: PendingFixture[] = [];
  for (let index = 0; index < count; index += 1) {
    // Un tipo de permiso distinto por solicitud: así el historial identifica
    // cada fila por su nombre de tipo aunque compartan empleado.
    const type = await createLeaveType(request, admin);
    const marker = uniqueRef("SOLICITUD");
    await createLeaveRequest(request, staff, type.id, marker);
    fixtures.push({ marker, typeName: type.name });
  }
  return fixtures;
};

/** Tarjeta de solicitud pendiente identificada por el motivo único. */
const pendingCard = (page: Page, marker: string) =>
  page
    .locator("div")
    .filter({ has: page.getByRole("button", { name: "Aprobar", exact: true }) })
    .filter({ hasText: marker })
    .last();

test.describe("Vacaciones y permisos (CLIENT_ADMIN)", () => {
  test("[HR-05][ACT-18] aprueba y rechaza solicitudes pendientes", async ({ page, request }) => {
    const [toApprove, toReject] = await createPendingRequests(request, 2);
    await loginClient(page, "admin");
    await openClientRoute(page, "/hr/leave");

    await expect(page.getByRole("heading", { level: 1, name: "Vacaciones y permisos" })).toBeVisible();
    await expect(page.getByText(/Pendientes de aprobar \(\d+\)/)).toBeVisible();

    // Aprobar la primera: toast y desaparición de la tarjeta pendiente.
    await expect(pendingCard(page, toApprove.marker)).toBeVisible({ timeout: 20_000 });
    await pendingCard(page, toApprove.marker).getByRole("button", { name: "Aprobar", exact: true }).click();
    await expect(page.getByText("Solicitud aprobada.", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(pendingCard(page, toApprove.marker)).toHaveCount(0);

    // Rechazar la segunda.
    await expect(pendingCard(page, toReject.marker)).toBeVisible();
    await pendingCard(page, toReject.marker).getByRole("button", { name: "Rechazar", exact: true }).click();
    await expect(page.getByText("Solicitud rechazada.", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(pendingCard(page, toReject.marker)).toHaveCount(0);

    // El historial (tras recargar) refleja el estado de cada solicitud.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Vacaciones y permisos" })).toBeVisible();
    await expect(
      tableRowWith(page, toApprove.typeName).getByText("Aprobada", { exact: true })
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      tableRowWith(page, toReject.typeName).getByText("Rechazada", { exact: true })
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Vacaciones y permisos (gating)", () => {
  test("[HR-05] el personal sin time_clock.write no entra a la administración de permisos", async ({ page }) => {
    await loginClient(page, "staff");
    await page.goto(`${ACME.base}/#/hr/leave`);
    await expect(page).not.toHaveURL(/\/hr\/leave$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hola, Sergio" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Vacaciones y permisos" })).toHaveCount(0);
  });
});
