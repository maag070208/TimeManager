/**
 * Ruta por cliente en el hash (`/#/acme/home`) con respaldo al subdominio
 * (`acme.localhost`). Funciones puras: las prueba `resolve.test.ts` sin DOM.
 *
 * Modo ruta: el primer segmento del hash es el slug y el `HashRouter` usa
 * `basename="/acme"`; la URL canónica de inicio es `/#/acme/home`.
 * Modo subdominio (legado): el slug sale del host y la URL sigue sin prefijo.
 */

/**
 * Primeros segmentos que ya son rutas de la app: nunca se leen como slug.
 * Se mantiene a mano junto con `App.tsx`; un slug de cliente no puede coincidir
 * (los protege también `RESERVED_SLUGS` al dar de alta clientes).
 */
export const APP_ROOT_PATHS: ReadonlySet<string> = new Set([
  "home",
  "login",
  "mi-jornada",
  "teletrabajo",
  "users",
  "employees",
  "departments",
  "subareas",
  "roles",
  "plans",
  "notifications",
  "hr",
  "time-clocks",
  "schedules",
]);

/** Mismas reglas que el API para el slug de un cliente. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Ruta interna del hash; vacía si no viene en la forma canónica `#/…`. */
export const hashPath = (hash: string): string => {
  const match = /^#\/(.*)$/.exec(hash);
  if (!match) return "";
  return match[1].split("?")[0].split("#")[0];
};

/** Slug del cliente en el primer segmento del hash; `null` si es ruta de la app. */
export const tenantSlugFromHash = (hash: string): string | null => {
  const [first] = hashPath(hash).split("/").filter(Boolean);
  if (!first || APP_ROOT_PATHS.has(first) || !SLUG_PATTERN.test(first)) return null;
  return first;
};

/** De dónde salió el cliente de la URL. */
export type TenantRouteSource = "path" | "host" | null;

export interface TenantRoute {
  slug: string | null;
  source: TenantRouteSource;
  /** `basename` del HashRouter: `/<slug>` en modo ruta; `/` en plataforma/subdominio. */
  basename: string;
  /** true si la URL trae al cliente en el hash (modo ruta). */
  fromPath: boolean;
}

/**
 * Cliente de la URL: primero el hash, luego el subdominio. En modo subdominio se
 * conserva la URL sin prefijo para no romper enlaces y sesiones existentes.
 */
export const resolveTenantRoute = (
  hash: string,
  hostname: string,
  hostSlug: (hostname: string) => string | null
): TenantRoute => {
  const fromHash = tenantSlugFromHash(hash);
  if (fromHash) {
    return { slug: fromHash, source: "path", basename: `/${fromHash}`, fromPath: true };
  }
  const fromHost = hostSlug(hostname);
  return { slug: fromHost, source: fromHost ? "host" : null, basename: "/", fromPath: false };
};

/** Ruta interna de la URL actual, sin el prefijo del cliente (`/hr/time-clock`). */
export const routeWithoutTenant = (hash: string): string => {
  const slug = tenantSlugFromHash(hash);
  const path = hashPath(hash);
  if (!slug) return `/${path}`;
  const rest = path.slice(slug.length).replace(/^\/+/, "");
  return `/${rest}`;
};
