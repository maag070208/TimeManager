import { resolveTenantRoute, type TenantRoute } from "@shared/lib/tenant-route";
import type { PunchChannel } from "@shared/lib/punch-channels";
import { TENANT_BASE_DOMAIN } from "./constants/API_CONSTANTS";

/** Subdominios de plataforma: sin cliente (ADMIN/SUPPORT). */
const PLATFORM_LABELS = new Set(["app", "admin", "www"]);

/**
 * Cliente (slug) según el host: `acme.localhost` en local y
 * `acme.<TENANT_BASE_DOMAIN>` en producción. Sin subdominio, con un
 * subdominio de plataforma o con una IP: `null` (login de plataforma).
 */
export const tenantSlugFromHost = (hostname: string = window.location.hostname): string | null => {
  const host = hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":")) return null;
  const base = TENANT_BASE_DOMAIN;
  let rest: string | null = null;
  if (host.endsWith(".localhost")) rest = host.slice(0, -".localhost".length);
  else if (base && host.endsWith(`.${base}`)) rest = host.slice(0, -(base.length + 1));
  const label = rest?.split(".").pop() ?? null;
  return label && !PLATFORM_LABELS.has(label) ? label : null;
};

/**
 * Cliente y prefijo de la URL actual: primero la ruta del hash
 * (`/#/acme/home`), después el subdominio. En modo ruta el `HashRouter` usa
 * `basename="/acme"`; en modo subdominio la URL sigue sin prefijo.
 */
export const tenantRouteFromLocation = (): TenantRoute =>
  resolveTenantRoute(window.location.hash, window.location.hostname, tenantSlugFromHost);

/** Slug efectivo para el login: el de la ruta o, en su defecto, el subdominio. */
export const tenantSlugFromLocation = (): string | null => tenantRouteFromLocation().slug;

/** `basename` del `HashRouter` para la URL actual. */
export const tenantRouteBasename = (): string => tenantRouteFromLocation().basename;

export interface SelectedTenant {
  id: string;
  name: string;
  slug: string;
  /** Canales de checada del cliente elegido (los define la plataforma). */
  punchChannels?: PunchChannel[];
}

const STORAGE_KEY = "tm_selected_tenant_v1";

/** Cliente que eligió el personal de plataforma (viaja como `X-Tenant-Id`). */
export const getSelectedTenant = (): SelectedTenant | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SelectedTenant) : null;
  } catch {
    return null;
  }
};

export const setSelectedTenant = (tenant: SelectedTenant | null): void => {
  try {
    if (tenant) localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};

/**
 * URL de entrada de un cliente. En producción (con base domain) es su
 * subdominio; en local-first es el mismo host con su ruta en el hash.
 */
export const tenantUrl = (slug: string): string => {
  if (TENANT_BASE_DOMAIN) return `https://${slug}.${TENANT_BASE_DOMAIN}`;
  return `${window.location.origin}/#/${slug}/home`;
};

/**
 * Entrada legible del cliente, sin protocolo: su subdominio cuando hay dominio
 * base (o en local, donde `*.localhost` siempre resuelve) y, sin dominio
 * propio, la misma ruta por cliente a la que lleva `tenantUrl`.
 */
export const tenantHost = (slug: string): string => {
  if (TENANT_BASE_DOMAIN) return `${slug}.${TENANT_BASE_DOMAIN}`;
  const { hostname, host, port } = window.location;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return `${slug}.localhost${port ? `:${port}` : ""}`;
  return `${host}/#/${slug}`;
};
