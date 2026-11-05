import type { ColumnFilters, ColumnFilterValue } from "@axzydev/axzy_ui_system";
import { formatDate } from "./dates";

/** Filtros y orden que una tabla server-side ya aplicó a su última consulta. */
export interface TableQuery {
  filters: ColumnFilters;
  sort: { key: string; direction: "asc" | "desc" };
}

interface AppliedFiltersOptions {
  /** Traduce VALORES que son enums (p. ej. Estado `ASSIGNED` → "Asignado"). */
  translateValue?: (key: string, value: string) => string;
  /** Catálogos de las columnas ITSearchSelect/catálogo: el id se imprime con su nombre. */
  catalogs?: Record<string, Array<{ id: string | number; name: string }>>;
}

const day = (d: Date | null) => (d ? formatDate(d.toISOString()) : "…");

/**
 * Traduce los filtros de columna vigentes a pares etiqueta/valor para el pie de
 * un PDF. La etiqueta la resuelve quien llama (cada pestaña tiene su propio
 * namespace i18n), así que aquí sólo se ordena y se descartan las claves que no
 * tienen traducción. Fechas y rangos salen como "dd/mm/aaaa – dd/mm/aaaa" y los
 * ids de catálogo con su nombre.
 */
export const appliedFilters = (
  filters: ColumnFilters,
  labels: Record<string, string>,
  t: (key: string) => string,
  { translateValue, catalogs = {} }: AppliedFiltersOptions = {}
): Array<{ label: string; value: string }> => {
  const format = (key: string, value: ColumnFilterValue): string => {
    if (value instanceof Date) return day(value);
    if (Array.isArray(value)) return `${day(value[0])} – ${day(value[1])}`;
    const fromCatalog = catalogs[key]?.find((o) => String(o.id) === String(value))?.name;
    if (fromCatalog) return fromCatalog;
    return translateValue ? translateValue(key, String(value)) : String(value);
  };
  return Object.entries(filters)
    .filter(([key, value]) => labels[key] !== undefined && value !== "" && value != null)
    .map(([key, value]) => ({ label: t(labels[key]), value: format(key, value) }));
};
