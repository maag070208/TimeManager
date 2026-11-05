import type {
  ColumnFilterValue,
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";

/**
 * Cómo se filtra y ordena una columna en una tabla client-side.
 * - `value`: valor de la fila (default: la propiedad `key`, admite "a.b").
 *   Puede regresar un arreglo: coincide si cualquiera coincide.
 * - `match`: "text" contiene (sin mayúsculas ni acentos), "equals" igualdad
 *   (catálogos, enums, ids) o "date" (fecha o rango de ITDatePicker). Si se
 *   omite: fecha/rango → "date", booleano → "equals", lo demás → "text".
 * - `sortValue`: valor para ordenar cuando difiere del de filtro (p. ej. se
 *   filtra por id de catálogo y se ordena por su nombre). Default: `value`.
 */
export interface ClientField<T> {
  value?: (row: T) => unknown;
  match?: "text" | "equals" | "date";
  sortValue?: (row: T) => unknown;
}

export type ClientFields<T> = Record<string, ClientField<T>>;

const byPath = (row: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((v, k) => (v == null ? undefined : (v as Record<string, unknown>)[k]), row);

const normalize = (v: unknown) =>
  String(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const toDate = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** ¿El valor de la fila cumple el filtro? */
const matches = (field: unknown, filter: ColumnFilterValue, match: ClientField<unknown>["match"]): boolean => {
  const values = Array.isArray(field) ? field : [field];
  const mode =
    match ?? (filter instanceof Date || Array.isArray(filter) ? "date" : typeof filter === "boolean" ? "equals" : "text");

  if (mode === "date") {
    const [from, to] = filter instanceof Date ? [filter, filter] : Array.isArray(filter) ? filter : [toDate(filter), toDate(filter)];
    return values.some((v) => {
      const d = toDate(v);
      if (!d) return false;
      return (!from || d >= startOfDay(from)) && (!to || d <= endOfDay(to));
    });
  }
  if (mode === "equals") return values.some((v) => v != null && String(v) === String(filter));
  const needle = normalize(filter);
  return values.some((v) => v != null && normalize(v).includes(needle));
};

const isEmpty = (v: ColumnFilterValue | undefined) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && !v[0] && !v[1]);

const compare = (a: unknown, b: unknown): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const da = typeof a === "string" && /^\d{4}-\d{2}-\d{2}/.test(a) ? toDate(a) : null;
  const db = typeof b === "string" && /^\d{4}-\d{2}-\d{2}/.test(b) ? toDate(b) : null;
  if (da && db) return da.getTime() - db.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * Aplica los filtros y el orden de ITDataTable a un arreglo **completo** (sin
 * paginar). Es el corazón de las tablas client-side y lo reutilizan los
 * exports (PDF/CSV) para respetar lo que se ve en la tabla: filtros de barra
 * (vía `externalFilters`) y de columna, más el orden vigente.
 */
export const applyClientTableParams = <T>(
  rows: T[],
  params: Pick<ITDataTableFetchParams, "filters" | "sort"> | null | undefined,
  fields: ClientFields<T> = {}
): T[] => {
  const valueOf = (row: T, key: string) => (fields[key]?.value ? fields[key].value!(row) : byPath(row, key));
  const sortValueOf = (row: T, key: string) => (fields[key]?.sortValue ? fields[key].sortValue!(row) : valueOf(row, key));
  let out = rows;

  const active = Object.entries(params?.filters ?? {}).filter(([, v]) => !isEmpty(v));
  if (active.length > 0) {
    out = out.filter((row) =>
      active.every(([key, filter]) => matches(valueOf(row, key), filter, fields[key]?.match))
    );
  }

  if (params?.sort?.key) {
    const { key, direction } = params.sort;
    const mult = direction === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = sortValueOf(a, key);
      const bv = sortValueOf(b, key);
      if (av == null || av === "") return 1;
      if (bv == null || bv === "") return -1;
      return compare(av, bv) * mult;
    });
  }

  return out;
};

/**
 * Convierte un fetcher que regresa un arreglo completo en un `fetchData`
 * compatible con ITDataTable (paginación/filtro/orden client-side), con la
 * misma semántica de filtros que las tablas server-side.
 */
export const makeClientTableFetch =
  <T>(
    fetcher: () => Promise<T[]>,
    fields: ClientFields<T> = {}
  ): ((params: ITDataTableFetchParams) => Promise<ITDataTableResponse<T>>) =>
  async (params) => {
    const rows = applyClientTableParams(await fetcher(), params, fields);
    const total = rows.length;
    const start = (params.page - 1) * params.limit;
    return { data: rows.slice(start, start + params.limit), total };
  };
