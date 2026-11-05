import { resolveTenantRoute, type TenantRoute } from "@shared/lib/tenant-route";

/** Subdominios de plataforma: sin cliente (ADMIN/SUPPORT). */
const PLATFORM_LABELS = new Set(["app", "admin", "www"]);

/**
 * Cliente (slug) según el host: `acme.localhost` en local y
 * `acme.<VITE_TENANT_BASE_DOMAIN>` en producción. Sin subdominio, con un
 * subdominio de plataforma o con una IP: `null` (login de plataforma).
 */
export const tenantSlugFromHost = (hostname: string = window.location.hostname): string | null => {
  const host = hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":")) return null;
  const base = import.meta.env.VITE_TENANT_BASE_DOMAIN?.toLowerCase();
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
  const base = import.meta.env.VITE_TENANT_BASE_DOMAIN;
  if (base) return `https://${slug}.${base}`;
  return `${window.location.origin}/#/${slug}/home`;
};

/** Subdominio legible (`acme.localhost:5006`), para mostrar sin protocolo. */
export const tenantHost = (slug: string): string => {
  const base = import.meta.env.VITE_TENANT_BASE_DOMAIN;
  if (base) return `${slug}.${base}`;
  const { port } = window.location;
  return `${slug}.localhost${port ? `:${port}` : ""}`;
};
