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
