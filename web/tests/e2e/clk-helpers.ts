import { expect, type Page } from "@playwright/test";
import { ACME, PLATFORM } from "./helpers";
import { loginReady } from "./session";

/**
 * Utilidades de las suites de relojes/checadas/NOM/agente (task-19).
 *
 * Regla del repo: no se modifica `helpers.ts`; estas suites se apoyan en
 * `session.ts` para el login y aquí sólo se agrega lo compartido: navegación
 * por hash del cliente acme, lectura del token de la sesión y llamadas a la API
 * real del stack E2E (para descubrir datos del seed sin hardcodearlos).
 */

/** API real que levanta `playwright.config.ts` (VITE_API_URL). */
export const API_BASE = "http://127.0.0.1:4010/api/v1";
/** Mock ISAPI del stack E2E. */
export const MOCK_URL = "http://127.0.0.1:4801";
/** Serial que reporta el mock (el seed da de alta el reloj con este serial). */
export const MOCK_SERIAL = "MOCK-SERIAL-0001";

export const acmeUrl = (path: string): string => `${ACME.base}/#${path}`;

/** Login tolerante sobre el subdominio del cliente acme. */
export async function enterAcme(
  page: Page,
  user: string = ACME.admin,
  greeting: RegExp = /Hola, Ana/
): Promise<void> {
  await loginReady(page, ACME.base, user, greeting);
}

/** Login de plataforma (consola de clientes/agente). */
export async function enterPlatform(page: Page): Promise<void> {
  await loginReady(page, PLATFORM.base, PLATFORM.admin, /Tus clientes, su estado y su uso\./);
}

/** Va a una ruta del cliente y espera el ancla de esa pantalla. */
export async function openAcme(page: Page, path: string, anchor: string | RegExp): Promise<void> {
  await page.goto(acmeUrl(path));
  await expect(page.getByText(anchor).first()).toBeVisible({ timeout: 25_000 });
}

/** Token de la sesión guardado por el slice de auth. */
export async function authToken(page: Page): Promise<string> {
  const raw = await page.evaluate(() => localStorage.getItem("tm_auth_v1"));
  if (!raw) throw new Error("No hay sesión en localStorage (¿falta el login?)");
  const token = (JSON.parse(raw) as { token?: string | null }).token;
  if (!token) throw new Error("La sesión no tiene token");
  return token;
}

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

/** Llamada autenticada a la API real con la sesión de la pestaña. */
export async function api<T = any>(
  page: Page,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
  headers: Record<string, string> = {}
): Promise<ApiResult<T>> {
  const token = await authToken(page);
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    data,
    failOnStatusCode: false,
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status(), body: body as T };
}

/** Igual que `api`, pero exige 2xx y devuelve el cuerpo. */
export async function apiOk<T = any>(
  page: Page,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  data?: unknown
): Promise<T> {
  const result = await api<T>(page, method, path, data);
  expect(result.status, `${method} ${path} → ${result.status}`).toBeGreaterThanOrEqual(200);
  expect(result.status, `${method} ${path} → ${result.status}`).toBeLessThan(300);
  return result.body;
}

/* ── Descubrimiento de datos del seed (nunca hardcodear ids/nombres) ─────── */

export const getStatus = (page: Page) => apiOk<any>(page, "GET", "/time-clock/status");
export const getSummary = (page: Page) => apiOk<any>(page, "GET", "/time-clock/summary");
export const getRoster = (page: Page) => apiOk<any>(page, "GET", "/time-clock/roster");
export const getClockSettings = (page: Page, serial: string) =>
  apiOk<any>(page, "GET", `/time-clock/clocks/${serial}/settings`);
export const getEmployees = (page: Page, filters: Record<string, unknown> = {}) =>
  apiOk<any>(page, "POST", "/time-clock/employees/query", { page: 1, limit: 100, filters });
export const getPeople = (page: Page, serial: string) =>
  apiOk<any>(page, "GET", `/time-clock/clocks/${serial}/people`);
export const getUsers = (page: Page) => apiOk<any[]>(page, "GET", "/users/employees");
export const getMe = (page: Page) => apiOk<any>(page, "GET", "/auth/me");
export const getTeleworkRegistrations = (page: Page) =>
  apiOk<any[]>(page, "GET", "/nom/telework/registrations");
export const getTeleworkPolicy = (page: Page) => apiOk<any>(page, "GET", "/nom/telework/policy");
export const getTeleworkChecklists = (page: Page) =>
  apiOk<any[]>(page, "GET", "/nom/telework/checklists");
export const getOutOfHoursContacts = (page: Page) =>
  apiOk<any[]>(page, "GET", "/nom/telework/out-of-hours-contacts");
export const getMyTelework = (page: Page) => apiOk<any>(page, "GET", "/nom/me/telework");
export const getMyRecordAgreement = (page: Page) =>
  apiOk<any>(page, "GET", "/nom/me/record-agreement");
export const getMyPunches = (page: Page) => apiOk<any[]>(page, "GET", "/nom/me/punches");

/** Primer reloj dado de alta en el estado (o `null` si el tenant no tiene). */
export const firstClock = (status: any): any | null => status?.devices?.[0] ?? null;

/** Etiqueta visible del estado de conexión del dashboard. */
export const CONNECTION_LABEL: Record<string, RegExp> = {
  ONLINE: /En línea/,
  NO_RESPONSE: /Sin respuesta/,
  PAUSED_CREDENTIALS: /Credenciales rechazadas/,
  NOT_READ: /Sin lectura/,
};

/** Una persona del mock (los números 1001/1002/1003 del seed de E2E). */
export const mockPerson = (people: any[], number: string): any | undefined =>
  (people ?? []).find((person) => String(person.employeeNumber) === number);

/**
 * Crea una persona temporal en el mock para probar escrituras sin tocar a las
 * personas sembradas. Devuelve el número para limpiarlo al final.
 */
export async function createTempPerson(page: Page, serial: string, number: string, name: string): Promise<string> {
  await apiOk(page, "POST", `/time-clock/clocks/${serial}/people`, {
    employeeNumber: number,
    name,
    gender: "unknown",
  });
  return number;
}

/** Borra (idempotente) una persona temporal del mock. */
export async function removeTempPerson(page: Page, serial: string, number: string): Promise<void> {
  await api(page, "DELETE", `/time-clock/clocks/${serial}/people/${number}`);
}

/**
 * Espera al diálogo del kit (`ITDialog` no trae role=dialog: el contenedor es
 * `[data-it-dialog="true"]`).
 */
export const dialog = (page: Page) => page.locator('[data-it-dialog="true"]');

/** Cierra el diálogo abierto con Escape (el kit lo soporta). */
export async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
}

/** Comprueba que al menos una de las variantes posibles está visible. */
export async function expectOneOf(
  page: Page,
  variants: Array<{ name: string; locator: import("@playwright/test").Locator }>,
  timeout = 20_000
): Promise<void> {
  const deadline = Date.now() + timeout;
  for (;;) {
    for (const variant of variants) {
      if (await variant.locator.first().isVisible().catch(() => false)) return;
    }
    if (Date.now() > deadline) {
      throw new Error(`No apareció ninguna variante: ${variants.map((v) => v.name).join(" | ")}`);
    }
    await page.waitForTimeout(250);
  }
}
