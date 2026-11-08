/**
 * Bots de QA: actores reales (cuentas con su propio token) que recorren los
 * flujos completos contra un API corriendo. SOLO local: el API debe estar en
 * loopback y la base en `tm_qa*`; si no, aborta antes de la primera petición.
 *
 * Configuración en `qa/.env.qa` (no se commitea): QA_API_URL, QA_DATABASE_URL,
 * QA_PLATFORM_USER y QA_PLATFORM_PASS.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ENV_FILE = path.resolve(__dirname, ".env.qa");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

const LOCAL = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export const QA = {
  apiUrl: process.env.QA_API_URL ?? "http://127.0.0.1:4031/api/v1",
  databaseUrl: process.env.QA_DATABASE_URL ?? "",
  platformUser: process.env.QA_PLATFORM_USER ?? "",
  platformPass: process.env.QA_PLATFORM_PASS ?? "",
  outDir: path.resolve(__dirname, "out"),
};

{
  const api = new URL(QA.apiUrl);
  const db = QA.databaseUrl ? new URL(QA.databaseUrl) : null;
  const dbName = db ? decodeURIComponent(db.pathname.replace(/^\//, "")) : "";
  if (!LOCAL.has(api.hostname) || !db || !LOCAL.has(db.hostname) || !dbName.startsWith("tm_qa")) {
    throw new Error(
      `Los bots de QA solo corren contra un API local y una base local tm_qa* (api=${api.hostname}, db=${db?.hostname}/${dbName}).`
    );
  }
}

export interface Res<T = any> {
  status: number;
  body: T;
  text: string;
}

export interface CallOptions {
  body?: unknown;
  tenantId?: string;
  headers?: Record<string, string>;
  form?: FormData;
}

/** Una persona con sesión propia. Todas las peticiones salen con su token. */
export class Bot {
  token = "";
  id = "";
  tenantId: string | null = null;

  constructor(
    readonly label: string,
    readonly username: string,
    public password: string,
    readonly tenantSlug: string | null,
    readonly role: string
  ) {}

  async login(): Promise<this> {
    const res = await call(null, "POST", "/auth/login", {
      body: { username: this.username, password: this.password, ...(this.tenantSlug ? { tenant: this.tenantSlug } : {}) },
    });
    if (res.status !== 200) throw new Error(`${this.label}: login ${res.status} ${res.text}`);
    this.token = res.body.token;
    this.id = res.body.user.id;
    if (res.body.user.mustChangePassword) {
      const next = `${this.password}-n`;
      const changed = await this.post("/auth/change-password", { currentPassword: this.password, newPassword: next });
      if (changed.status >= 300) throw new Error(`${this.label}: cambio de contraseña ${changed.status} ${changed.text}`);
      this.password = next;
      return this.login();
    }
    const me = await this.get("/auth/me");
    this.tenantId = me.body?.tenant?.id ?? me.body?.tenantId ?? null;
    return this;
  }

  get<T = any>(route: string, options: CallOptions = {}) {
    return call<T>(this, "GET", route, options);
  }
  post<T = any>(route: string, body?: unknown, options: CallOptions = {}) {
    return call<T>(this, "POST", route, { ...options, body });
  }
  put<T = any>(route: string, body?: unknown, options: CallOptions = {}) {
    return call<T>(this, "PUT", route, { ...options, body });
  }
  patch<T = any>(route: string, body?: unknown, options: CallOptions = {}) {
    return call<T>(this, "PATCH", route, { ...options, body });
  }
  delete<T = any>(route: string, body?: unknown, options: CallOptions = {}) {
    return call<T>(this, "DELETE", route, { ...options, body });
  }
}

export async function call<T = any>(bot: Bot | null, method: string, route: string, options: CallOptions = {}): Promise<Res<T>> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (bot?.token) headers.authorization = `Bearer ${bot.token}`;
  if (options.tenantId) headers["x-tenant-id"] = options.tenantId;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${QA.apiUrl}${route}`, { method, headers, body });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, text: text.slice(0, 600) };
}

// ── Reporte ────────────────────────────────────────────────────────────────

export type Severity = "BLOQUEANTE" | "ALTA" | "MEDIA" | "BAJA";

export interface Check {
  flow: string;
  step: string;
  ok: boolean;
  detail?: string;
}

export interface Finding {
  flow: string;
  severity: Severity;
  title: string;
  detail: string;
}

/** Bitácora de un flujo: cada paso queda como ✓/✗ y los hallazgos aparte. */
export class Report {
  readonly checks: Check[] = [];
  readonly findings: Finding[] = [];

  constructor(readonly flow: string) {}

  /** Registra un paso. Devuelve `ok` para poder cortar el flujo si falla algo previo. */
  check(step: string, ok: boolean, detail?: string): boolean {
    this.checks.push({ flow: this.flow, step, ok, detail: ok ? undefined : detail });
    console.log(`${ok ? "  ✓" : "  ✗"} [${this.flow}] ${step}${ok || !detail ? "" : ` — ${detail}`}`);
    return ok;
  }

  /** Espera un estado HTTP exacto (y opcionalmente el `code` del error). */
  expect(step: string, res: Res, status: number, code?: string): boolean {
    const gotCode = res.body?.code ?? res.body?.error?.code;
    const ok = res.status === status && (code === undefined || gotCode === code);
    return this.check(step, ok, `esperaba ${status}${code ? ` ${code}` : ""}, llegó ${res.status} ${gotCode ?? ""} ${res.text}`);
  }

  finding(severity: Severity, title: string, detail: string): void {
    this.findings.push({ flow: this.flow, severity, title, detail });
    console.log(`  ⚑ [${this.flow}] ${severity}: ${title}`);
  }
}

export function writeJson(name: string, data: unknown): string {
  mkdirSync(QA.outDir, { recursive: true });
  const file = path.join(QA.outDir, name);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(QA.outDir, name), "utf8")) as T;
}

/** Fecha local (YYYY-MM-DD) en una zona IANA. */
export function localDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
