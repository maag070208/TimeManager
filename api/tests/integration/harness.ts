/**
 * Arnés de pruebas de integración: API real (`createApp`) contra un PostgreSQL
 * de PRUEBA.
 *
 * Seguridad: exige que `DATABASE_URL` sea loopback y que el nombre de la base
 * termine en `_test`. Si no, aborta antes de tocar nada (nunca la nube).
 *
 * Uso típico:
 *
 *   import { after, before, test } from "node:test";
 *   import { expectStatus, setupSuite, stopSuite, clientSession, api } from "./harness";
 *
 *   before(async () => { await setupSuite(); });
 *   after(async () => { await stopSuite(); });
 *   test("...", async () => { ... });
 *
 * Los archivos corren en serie (`--test-concurrency=1`) porque `setupSuite`
 * trunca la base al inicio de cada archivo.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// ── Guardas de entorno (antes de importar la app) ──────────────────────────

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error(
    "Falta DATABASE_URL. Corre `pnpm db:test:up` y luego `pnpm test:integration` (usa la BD local de pruebas)."
  );
}
const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
// `tm_test` y las bases por suite (`tm_test_tenancy`, `tm_test_accounts`, …).
const isTestDatabase =
  databaseName.endsWith("_test") || databaseName.startsWith("tm_test");
if (!localHosts.has(parsedUrl.hostname) || !isTestDatabase) {
  throw new Error(
    `DATABASE_URL no es una base de pruebas local (host=${parsedUrl.hostname}, db=${databaseName}). ` +
      "Las pruebas de integración se niegan a correr contra cualquier otra base."
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";

// ── Acceso perezoso a módulos de la app (ya con el entorno fijado) ─────────

const db = async () => (await import("@core/config/database")).prismaClient;

export type ApiJson = Record<string, any> | null;

export interface ApiResponse<T extends ApiJson = ApiJson> {
  status: number;
  body: T;
  text: string;
  headers: Headers;
}

export interface RequestOptions {
  token?: string;
  tenantId?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface TenantFixture {
  id: string;
  slug: string;
  name: string;
}

export interface UserFixture {
  id: string;
  username: string;
  role: string;
  tenantId: string | null;
}

export interface Session {
  tenant: TenantFixture | null;
  user: UserFixture;
  token: string;
  refreshToken: string;
}

let server: Server | null = null;
let baseUrl = "";

// 15 caracteres: cumple el mínimo de 12 del API (altas y reseteos).
export const DEFAULT_PASSWORD = "Prueba123!2027";

let passwordHash: string | null = null;
const defaultPasswordHash = async (): Promise<string> => {
  if (!passwordHash) {
    const { hashPassword } = await import("@core/utils/security");
    passwordHash = await hashPassword(DEFAULT_PASSWORD);
  }
  return passwordHash;
};

export const unique = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// ── Ciclo de vida ──────────────────────────────────────────────────────────

/** Trunca todas las tablas de negocio (menos el histórico de migraciones). */
export const resetDatabase = async (): Promise<void> => {
  const client = await db();
  const tables = await client.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) {
    throw new Error("La base de pruebas está vacía: corre `pnpm db:test:up`.");
  }
  const list = tables
    .map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`)
    .join(", ");
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`
  );
};

/** Siembra roles/permisos/matriz y políticas ABAC desde los fixtures. */
export const seedAccessCatalog = async (): Promise<void> => {
  const client = await db();
  const { seedPermissionsFromFixtures } = await import("@core/permissions");
  const { seedPoliciesFromFixtures } = await import("@core/policies");
  await seedPermissionsFromFixtures(client);
  await seedPoliciesFromFixtures(client);
};

/** Levanta la API en un puerto efímero (una sola vez por archivo). */
export const startApp = async (): Promise<void> => {
  if (server) return;
  const { createApp } = await import("@src/app");
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
};

/** Base de datos limpia + catálogo sembrado + API arriba. */
export const setupSuite = async (): Promise<void> => {
  await resetDatabase();
  await seedAccessCatalog();
  await startApp();
};

/** Cierra la API y la conexión a la base. */
export const stopSuite = async (): Promise<void> => {
  if (server) {
    server.close();
    await once(server, "close");
    server = null;
  }
  const client = await db();
  await client.$disconnect();
};

// ── Cliente HTTP ───────────────────────────────────────────────────────────

export const api = async <T extends ApiJson = ApiJson>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.tenantId) headers["X-Tenant-Id"] = options.tenantId;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
    redirect: "manual",
  });
  const text = await response.text();
  let json: ApiJson = null;
  try {
    json = text ? (JSON.parse(text) as ApiJson) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json, text, headers: response.headers };
};

export const expectStatus = (
  response: ApiResponse,
  expected: number,
  label: string
): void => {
  assert.equal(
    response.status,
    expected,
    `${label}: esperaba ${expected}, recibí ${response.status} — ${response.text.slice(0, 400)}`
  );
};

export const expectError = (
  response: ApiResponse,
  status: number,
  code: string,
  label: string
): void => {
  expectStatus(response, status, label);
  assert.equal(response.body?.code, code, `${label}: código de error inesperado — ${response.text.slice(0, 400)}`);
};

// ── Fixtures ───────────────────────────────────────────────────────────────

export const createTenant = async (
  options: {
    slug?: string;
    name?: string;
    status?: "ACTIVE" | "SUSPENDED";
  } = {}
): Promise<TenantFixture> => {
  const client = await db();
  const slug = options.slug ?? unique("cli");
  const tenant = await client.tenant.create({
    data: {
      name: options.name ?? `Cliente ${slug}`,
      slug,
      status: options.status ?? "ACTIVE",
    },
  });
  return { id: tenant.id, slug: tenant.slug, name: tenant.name };
};

export interface CreateUserOptions {
  tenantId?: string | null;
  username?: string;
  role: string;
  extraRoles?: string[];
  active?: boolean;
  password?: string;
  email?: string | null;
  employeeNumber?: string | null;
  jobTitle?: string | null;
  photoKey?: string | null;
  mustChangePassword?: boolean;
}

export const createUser = async (
  options: CreateUserOptions
): Promise<UserFixture> => {
  const client = await db();
  const { runWithTenant } = await import("@core/tenancy/context");
  const username = options.username ?? unique("user");
  const password = options.password
    ? await (await import("@core/utils/security")).hashPassword(options.password)
    : await defaultPasswordHash();

  const data = {
    username,
    name: `Usuario ${username}`,
    password,
    role: options.role,
    active: options.active ?? true,
    email: options.email ?? null,
    employeeNumber: options.employeeNumber ?? null,
    jobTitle: options.jobTitle ?? null,
    photoKey: options.photoKey ?? null,
    mustChangePassword: options.mustChangePassword ?? false,
  };

  const tenantId = options.tenantId ?? null;
  const created = tenantId
    ? await runWithTenant(tenantId, () => client.user.create({ data: { ...data, tenantId } }))
    : await client.user.create({ data });

  if (options.extraRoles?.length) {
    await client.userRole.createMany({
      data: options.extraRoles.map((role) => ({ userId: created.id, role })),
    });
  }

  return {
    id: created.id,
    username: created.username,
    role: created.role,
    tenantId: created.tenantId,
  };
};

export const login = async (options: {
  username: string;
  password?: string;
  tenant?: string;
}): Promise<{ token: string; refreshToken: string; user: ApiJson }> => {
  const response = await api("POST", "/auth/login", {
    body: {
      username: options.username,
      password: options.password ?? DEFAULT_PASSWORD,
      ...(options.tenant ? { tenant: options.tenant } : {}),
    },
  });
  expectStatus(response, 200, `login de ${options.username}`);
  return response.body as { token: string; refreshToken: string; user: ApiJson };
};

/** Sesión de un usuario de plataforma (ADMIN/SUPPORT, sin cliente). */
export const platformSession = async (role: "ADMIN" | "SUPPORT" = "ADMIN"): Promise<Session> => {
  const user = await createUser({ tenantId: null, role });
  const tokens = await login({ username: user.username });
  return { tenant: null, user, token: tokens.token, refreshToken: tokens.refreshToken };
};

/** Sesión de un usuario de cliente; crea el cliente si no se pasa uno. */
export const clientSession = async (
  role: string,
  options: { tenant?: TenantFixture; extraRoles?: string[]; username?: string } = {}
): Promise<Session> => {
  const tenant = options.tenant ?? (await createTenant());
  const user = await createUser({
    tenantId: tenant.id,
    role,
    extraRoles: options.extraRoles,
    username: options.username,
  });
  const tokens = await login({ username: user.username, tenant: tenant.slug });
  return { tenant, user, token: tokens.token, refreshToken: tokens.refreshToken };
};

export const createDepartment = async (
  tenantId: string,
  name = "RH"
): Promise<{ id: string; name: string }> => {
  const client = await db();
  const { runWithTenant } = await import("@core/tenancy/context");
  const department = await runWithTenant(tenantId, () =>
    client.department.create({ data: { name } })
  );
  return { id: department.id, name: department.name };
};

export const createPunch = async (
  tenantId: string,
  options: {
    employeeNumber: string;
    name: string;
    clockSerial?: string;
    serialNo?: number;
    occurredAt?: Date;
  }
): Promise<{ id: string }> => {
  const client = await db();
  const { runWithTenant } = await import("@core/tenancy/context");
  const punch = await runWithTenant(tenantId, () =>
    client.timeClockPunch.create({
      data: {
        clockSerial: options.clockSerial ?? unique("RELOJ"),
        serialNo: options.serialNo ?? Math.floor(Math.random() * 1_000_000),
        employeeNumber: options.employeeNumber,
        name: options.name,
        method: "FACE",
        minor: 75,
        occurredAt: options.occurredAt ?? new Date(),
      },
    })
  );
  return { id: punch.id };
};
