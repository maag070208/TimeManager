import type { ColumnFilters } from "@axzydev/axzy_ui_system";
import { post } from "./client";

/**
 * Contrato ITDataTable (server-side). El frontend envía { page, limit, filters, sort }
 * y el backend responde { data, total }.
 */
export interface ITDataTableFetchParamsPost {
  page: number;
  limit: number;
  /** Filtros tal como los entrega ITDataTable; `tableRequest` los serializa. */
  filters: ColumnFilters;
  sort?: { key: string; direction: "asc" | "desc" };
}

export interface ITDataTableResponse<T> {
  data: T[];
  total: number;
}

/** Filtro ya serializado para la API: escalar o rango `[desde, hasta]` en ISO local. */
type TableFilterValue = string | number | boolean | [string | null, string | null];

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

/**
 * ISO con la zona local ("2026-09-19T00:00:00.000-07:00"), no en UTC: la API
 * obtiene el instante exacto para columnas con hora y el día del calendario
 * (los primeros 10 caracteres) para columnas de solo fecha.
 */
const localIso = (d: Date) => {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
};

const startOfDay = (d: Date) => localIso(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
const endOfDay = (d: Date) => localIso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));

/**
 * Serializa los filtros de ITDataTable: una fecha (`filter: "date"`) es el día
 * local completo y un rango (`filter: "date-range"`) va del inicio del primer
 * día al final del último, así la API solo recibe rangos `[desde, hasta]`
 * inclusivos y no depende de la zona horaria del servidor.
 */
export const serializeTableFilters = (filters: ColumnFilters): Record<string, TableFilterValue> => {
  const out: Record<string, TableFilterValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value instanceof Date) {
      out[key] = [startOfDay(value), endOfDay(value)];
    } else if (Array.isArray(value)) {
      const [from, to] = value;
      if (from || to) out[key] = [from ? startOfDay(from) : null, to ? endOfDay(to) : null];
    } else {
      out[key] = value;
    }
  }
  return out;
};

/** POST de una consulta de tabla con su respuesta propia (reportes con `summary`, KPIs…). */
export const tableQuery = <R>(path: string, params: ITDataTableFetchParamsPost): Promise<R> =>
  post<R>(path, { ...params, filters: serializeTableFilters(params.filters) });

export const tableRequest = <T>(
  path: string,
  params: ITDataTableFetchParamsPost
): Promise<ITDataTableResponse<T>> => tableQuery<ITDataTableResponse<T>>(path, params);
