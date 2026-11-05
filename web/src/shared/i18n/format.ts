import i18n from "./config";

/** Locale de `Intl` para el idioma de la interfaz. */
export const dateLocale = (): string => (i18n.language?.startsWith("en") ? "en-US" : "es-MX");

export const formatDate = (
  value: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(dateLocale(), options);
};
export type FileNameKey = keyof (typeof import("./locales/es/common.json"))["files"];

/** Prefijo de un archivo descargado (CSV/PDF), en el idioma de la interfaz. */
export const fileName = (key: FileNameKey): string => i18n.t(`common:files.${key}`);

/**
 * Namespace cuyas llaves `agoSeconds` / `agoMinutes` / `agoHours` usa
 * `formatAgo`. Va como literal (no `string`) para que las llaves sigan tipadas
 * contra los recursos de i18next: si se renombra una, esto deja de compilar.
 */
type AgoNamespace = "time-clock:status";

/**
 * Antigüedad de un instante ("hace 2 min", "hace 2 h 20 min"), con las llaves
 * `<base>.agoSeconds` / `<base>.agoMinutes` / `<base>.agoHours`. `null` si no
 * hay instante (o si no es una fecha válida).
 */
export const formatAgo = (base: AgoNamespace, iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return i18n.t(`${base}.agoSeconds`, { seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return i18n.t(`${base}.agoMinutes`, { minutes });
  return i18n.t(`${base}.agoHours`, { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
};
