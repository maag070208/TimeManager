import { APP_ROOT_PATHS } from "@shared/lib/tenant-route";

/** Mismas reglas que el API (`tenant.dto.ts`). */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
/** Tampoco puede pisar una ruta de la app: el primer segmento del hash es el slug. */
export const RESERVED_SLUGS = [
  "app",
  "admin",
  "api",
  "www",
  "static",
  "cdn",
  "mail",
  ...APP_ROOT_PATHS,
];

/** "Hotel Playa Azul S.A." → "hotel-playa-azul-sa". */
export const slugify = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");

export const isValidSlug = (slug: string): boolean => SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.includes(slug);

/** Zonas horarias de México (las del API son IANA; cualquier otra se puede mandar por API). */
export const MX_TIMEZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Cancun",
  "America/Chihuahua",
  "America/Hermosillo",
  "America/Mazatlan",
  "America/Tijuana",
] as const;
