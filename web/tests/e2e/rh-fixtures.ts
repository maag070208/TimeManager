import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { ACME, E2E_PASSWORD, loginAs } from "./helpers";

/**
 * Fixtures de la suite E2E de Personal/RH (task-17).
 *
 * Reglas:
 * - No toca `helpers.ts` ni los helpers de otras suites: se apoya en `helpers.ts` solo para el login.
 * - Cada prueba crea sus datos con nombres/tokens únicos (el worker de Playwright se
 *   reinicia tras una falla, así que no se usan contadores cortos ni ids fijos).
 * - La API se usa solo para *preparar* datos de otras pantallas (solicitudes de
 *   permiso del portal, aceptación de acuerdo de registro, tipos de documento).
 *   La pantalla bajo prueba siempre se ejercita por la UI.
 */

/** URL de la API del stack E2E (misma que `VITE_API_URL` de playwright.config.ts). */
export const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:4010/api/v1";

let seq = 0;

/** Token único por llamada (mayúsculas, sin espacios) para nombres, claves y matrículas. */
export const uniqueRef = (prefix = "E2E"): string => {
  seq += 1;
  return `${prefix}${Date.now().toString(36).slice(-5)}${seq}`.toUpperCase();
};

/** PNG 1×1 válido para subir documentos sin depender de archivos del repo. */
export const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export interface ApiSession {
  token: string;
  userId: string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Login directo a la API (sin navegador); `tenant` es el slug del cliente. */
export async function apiLogin(
  request: APIRequestContext,
  username: string,
  tenant: "acme" | "beta" | null = "acme"
): Promise<ApiSession> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { username, password: E2E_PASSWORD, ...(tenant ? { tenant } : {}) },
  });
  if (!res.ok()) throw new Error(`Login API de ${username} falló: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { token: string; user?: { id?: string } };
  return { token: body.token, userId: body.user?.id ?? "" };
}

export const platformSession = (request: APIRequestContext): Promise<ApiSession> =>
  apiLogin(request, "e2e.admin", null);
export const adminSession = (request: APIRequestContext): Promise<ApiSession> =>
  apiLogin(request, ACME.admin, "acme");
export const rhSession = (request: APIRequestContext): Promise<ApiSession> =>
  apiLogin(request, ACME.rh, "acme");
export const staffSession = (request: APIRequestContext): Promise<ApiSession> =>
  apiLogin(request, ACME.staff, "acme");

/** POST/PATCH/DELETE a la API con el token indicado; falla con el cuerpo del error. */
export async function apiSend<T>(
  request: APIRequestContext,
  session: ApiSession,
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  data?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const res = await request[method](`${API_URL}${path}`, {
    headers: { ...auth(session.token), ...extraHeaders },
    ...(method === "get" ? {} : { data }),
  });
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} falló: ${res.status()} ${await res.text()}`);
  if (res.status() === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface CreatedAccount {
  id: string;
  fullName: string;
  username: string;
  employeeNumber: string;
  jobTitle: string;
  email: string;
}

/** Crea una cuenta de personal (CLIENT_STAFF) por API para usarla como dato de otra pantalla. */
export async function createStaffAccount(
  request: APIRequestContext,
  admin: ApiSession
): Promise<CreatedAccount> {
  const ref = uniqueRef("EMP");
  const payload = {
    username: `e2e.${ref.toLowerCase()}`,
    email: `e2e.${ref.toLowerCase()}@timemanager.test`,
    password: E2E_PASSWORD,
    name: `Persona${ref}`,
    paternalSurname: "Prueba",
    jobTitle: `Puesto ${ref}`,
    employeeNumber: `9${ref}`,
    role: "CLIENT_STAFF",
  };
  const user = await apiSend<{ id: string; name: string; username: string; employeeNumber: string; jobTitle: string; email: string }>(
    request,
    admin,
    "post",
    "/users",
    payload
  );
  return {
    id: user.id,
    // La API compone nombre + apellidos al leer; se arma aquí para no depender del mapeo.
    fullName: `${payload.name} ${payload.paternalSurname}`,
    username: user.username,
    employeeNumber: user.employeeNumber,
    jobTitle: user.jobTitle,
    email: user.email,
  };
}

/**
 * Sesión de plataforma operando sobre acme con `X-Tenant-Id`.
 * `catalogs.manage` es exclusivo del ADMIN de plataforma (L-07), por eso el
 * catálogo de documentos no se puede crear con la cuenta del cliente.
 */
export async function platformAcme(
  request: APIRequestContext
): Promise<{ session: ApiSession; tenantHeaders: Record<string, string>; tenantId: string }> {
  const session = await platformSession(request);
  const tenants = await apiSend<Array<{ id: string; slug: string }>>(request, session, "get", "/tenants");
  const acme = tenants.find((tenant) => tenant.slug === "acme");
  if (!acme) throw new Error("No se encontró el cliente acme en la consola de plataforma");
  return { session, tenantHeaders: { "X-Tenant-Id": acme.id }, tenantId: acme.id };
}

/** Tipo de documento único (por defecto obligatorio para que cuente como faltante). */
export async function createDocumentType(
  request: APIRequestContext,
  options: { required?: boolean } = {}
): Promise<{ id: string; name: string }> {
  const { session, tenantHeaders } = await platformAcme(request);
  const name = `Doc ${uniqueRef("TIPO")}`;
  const row = await apiSend<{ id: string; name: string }>(
    request,
    session,
    "post",
    "/hr/catalogs/document-types",
    { name },
    tenantHeaders
  );
  if (options.required) {
    await apiSend(request, session, "patch", `/hr/catalogs/document-types/${row.id}`, { required: true }, tenantHeaders);
  }
  return { id: row.id, name };
}

/** Login de plataforma y "Entrar" al cliente acme con la UI (impersonación auditada). */
export async function loginPlatformAsAcme(page: Page): Promise<void> {
  await loginAs(page, "platform", "acme");
  await expect(page).not.toHaveURL(/#\/login/);
  await expect(page.getByRole("heading", { level: 1, name: "Panel de TimeManager" })).toBeVisible({ timeout: 20_000 });
  const row = page.locator("tbody tr").filter({ hasText: "Cliente E2E Acme" });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "Entrar" }).click();
  // La impersonación recarga en "/" con el cliente elegido (misma pestaña).
  await expect(page.getByRole("heading", { level: 1, name: /^Hola, / })).toBeVisible({ timeout: 30_000 });
}

/** Navega a una ruta del hash de la app de plataforma (sin subdominio). */
export async function openPlatformRoute(page: Page, route: string): Promise<void> {
  const target = `http://localhost:5106/#${route}`;
  await page.goto(target);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (new URL(page.url()).hash === `#${route}`) return;
    await page.waitForTimeout(250);
    await page.goto(target);
  }
  expect(new URL(page.url()).hash).toBe(`#${route}`);
}

/** Tipo de permiso único y sin goce (no consume saldo de vacaciones). */
export async function createLeaveType(
  request: APIRequestContext,
  admin: ApiSession
): Promise<{ id: string; name: string }> {
  const ref = uniqueRef("PERM");
  const row = await apiSend<{ id: string; name: string }>(request, admin, "post", "/nom/leave/types", {
    key: ref,
    name: `Permiso ${ref}`,
    kind: "OTHER",
    paid: false,
  });
  return { id: row.id, name: row.name };
}

/** Fecha local "YYYY-MM-DD" desplazada `days` días. */
export const dateKey = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Solicitud de permiso del propio trabajador (portal), vía API, con ventana única. */
export async function createLeaveRequest(
  request: APIRequestContext,
  staff: ApiSession,
  typeId: string,
  reason: string
): Promise<{ id: string }> {
  seq += 1;
  const startOffset = 60 + seq * 4;
  return apiSend<{ id: string }>(request, staff, "post", "/nom/me/leave/requests", {
    typeId,
    startDate: dateKey(startOffset),
    endDate: dateKey(startOffset + 2),
    reason,
  });
}

/** El trabajador acepta el acuerdo del método de registro (prueba plena NOM). */
export async function acceptRecordAgreement(
  request: APIRequestContext,
  staff: ApiSession
): Promise<void> {
  await apiSend(request, staff, "post", "/nom/me/record-agreement/accept", {
    methods: ["CLOCK", "REMOTE"],
  });
}

/** Acta administrativa creada por API (para dejar historial ligado a una cuenta). */
export async function createDisciplinaryReport(
  request: APIRequestContext,
  admin: ApiSession,
  userId: string,
  description: string
): Promise<{ id: string }> {
  return apiSend<{ id: string }>(request, admin, "post", "/hr/disciplinary-reports", {
    userId,
    reason: "ABSENCE",
    incidentDate: dateKey(0),
    description,
    sanction: "Llamada de atención",
  });
}

type ClientRole = "admin" | "rh" | "staff";

const greeting: Record<ClientRole, RegExp> = {
  admin: /Hola, Ana/,
  rh: /Hola, Rita/,
  staff: /Hola, Sergio/,
};

/** Login de cliente + espera de Inicio (evita la carrera del redirect post-login). */
export async function loginClient(page: Page, role: ClientRole = "admin"): Promise<void> {
  await loginAs(page, role, "acme");
  await expect(page).not.toHaveURL(/#\/login/);
  await expect(page.getByText(greeting[role]).first()).toBeVisible({ timeout: 20_000 });
}

/** Navega a una ruta del HashRouter del cliente y confirma que la URL quedó en ella. */
export async function openClientRoute(page: Page, route: string): Promise<void> {
  const target = `${ACME.base}/#${route}`;
  await page.goto(target);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (new URL(page.url()).hash === `#${route}`) return;
    await page.waitForTimeout(250);
    await page.goto(target);
  }
  expect(new URL(page.url()).hash).toBe(`#${route}`);
}

/** Fila de una tabla por un texto que solo debe aparecer en ella. */
export const tableRowWith = (page: Page, text: string) =>
  page.locator("tbody tr").filter({ hasText: text });

/** Botón de acción de una fila: `RowAction` usa `title`/`aria-label` con su nombre accesible. */
export const rowAction = (row: ReturnType<typeof tableRowWith>, name: string | RegExp) =>
  row.getByRole("button", { name });

/** Tarjeta de acción dentro de un diálogo (`[data-it-dialog]`). */
export const dialog = (page: Page) => page.locator('[data-it-dialog="true"]');

/** Opción visible del panel flotante de un `ITSearchSelect` (portal). */
export const floatingOption = (page: Page, text: string) =>
  page.locator('[data-it-floating="true"]').last().getByText(text, { exact: false }).first();
