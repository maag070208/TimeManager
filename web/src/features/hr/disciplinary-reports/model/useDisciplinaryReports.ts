import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnFilters, ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { personalApi, type DisciplinaryReason } from "@entities/hr";
import type { User } from "@entities/user";
import { usersApi } from "@entities/user";
import { i18n } from "@shared/i18n";

/** Motivos que admite el API (`DisciplinaryReason`), en el orden del formulario. */
export const DISCIPLINARY_REASONS: DisciplinaryReason[] = [
  "ABSENCE",
  "TARDINESS",
  "INTOXICATION",
  "MISCONDUCT",
  "NONCOMPLIANCE",
  "OTHER",
];

/** Atajo del resumen: todo, solo el mes en curso o un motivo concreto. */
export type DisciplinaryQuickFilter = "all" | "month" | DisciplinaryReason;

/**
 * Filtro por motivo que aplican las píldoras: `all` no manda filtro y deja que
 * el filtro propio de la columna funcione.
 */
export type DisciplinaryReasonFilter = "all" | DisciplinaryReason;

/**
 * Totales reales de la lista, contados con los filtros del propio endpoint
 * (`POST /hr/disciplinary-reports/query`). No hay endpoint de estadísticas.
 */
export interface DisciplinaryReportsSummary {
  total: number;
  /** Actas con fecha del incidente dentro del mes en curso. */
  month: number;
  byReason: Record<DisciplinaryReason, number>;
}

const monthRange = (): [Date, Date] => {
  const now = new Date();
  return [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  ];
};

/** Milisegundos que se espera antes de buscar, para no pedir la lista por letra. */
const SEARCH_DEBOUNCE_MS = 350;

export const useDisciplinaryReports = () => {
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [reason, setReason] = useState<DisciplinaryReasonFilter>("all");
  const [monthOnly, setMonthOnly] = useState(false);
  /** Lo que hay escrito en el buscador. */
  const [search, setSearch] = useState("");
  /** El texto ya asentado (con retardo) que viaja al API como `q`. */
  const [q, setQ] = useState("");

  const [summary, setSummary] = useState<DisciplinaryReportsSummary | null>(null);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  /** Filtros que vienen de los mosaicos y del buscador (mandan sobre la columna). */
  const externalFilters = useMemo<ColumnFilters>(() => {
    const filters: ColumnFilters = {};
    if (reason !== "all") filters.reason = reason;
    if (monthOnly) filters.incidentDate = monthRange();
    if (q) filters.q = q;
    return filters;
  }, [reason, monthOnly, q]);

  /** Cambia cualquier filtro de fuera = otra lista: la tabla se remonta en la página 1. */
  const tableKey = useMemo(() => JSON.stringify(externalFilters), [externalFilters]);

  /** Totales reales: el total, el del mes en curso y el de cada motivo. */
  useEffect(() => {
    let alive = true;
    const count = (filters: ColumnFilters) =>
      personalApi.disciplinaryReports({ page: 1, limit: 1, filters }).then((res) => res.total);

    Promise.all([
      count({}),
      count({ incidentDate: monthRange() }),
      ...DISCIPLINARY_REASONS.map((value) => count({ reason: value })),
    ])
      .then(([total, month, ...perReason]) => {
        if (!alive) return;
        const byReason = {} as Record<DisciplinaryReason, number>;
        DISCIPLINARY_REASONS.forEach((value, index) => {
          byReason[value] = perReason[index] ?? 0;
        });
        setSummary({ total, month, byReason });
      })
      .catch(() => {
        // Sin totales no hay franja; la lista sigue funcionando con sus filtros.
        if (alive) setSummary(null);
      });

    return () => {
      alive = false;
    };
  }, [reloadKey]);

  /** Atajo activo de la franja (un solo estado: mes o motivo). */
  const quick: DisciplinaryQuickFilter = monthOnly ? "month" : reason;

  const setQuick = useCallback((id: DisciplinaryQuickFilter) => {
    if (id === "all") {
      setReason("all");
      setMonthOnly(false);
    } else if (id === "month") {
      setReason("all");
      setMonthOnly(true);
    } else {
      setReason(id);
      setMonthOnly(false);
    }
  }, []);

  /** Píldora de motivo: apaga el atajo de mes para que no se estorben. */
  const setReasonFilter = useCallback((id: DisciplinaryReasonFilter) => {
    setReason(id);
    setMonthOnly(false);
  }, []);

  const hasFilters = reason !== "all" || monthOnly || search.trim() !== "";

  const clearFilters = useCallback(() => {
    setReason("all");
    setMonthOnly(false);
    setSearch("");
    setQ("");
  }, []);

  const fetchTableData = useCallback(async (params: ITDataTableFetchParams) => {
    const res = await personalApi.disciplinaryReports({
      page: params.page,
      limit: params.limit,
      filters: params.filters,
      sort: params.sort,
    });
    return {
      data: res.data as unknown as Record<string, unknown>[],
      total: res.total,
    };
  }, []);

  const deleteDisciplinaryReport = async (id: string) => {
    try {
      await personalApi.deleteDisciplinaryReport(id);
      reload();
      return null;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : i18n.t("employees:disciplinary.deleteError");
      setError(message);
      return message;
    }
  };

  return {
    error,
    setError,
    reloadKey,
    reload,
    fetchTableData,
    deleteDisciplinaryReport,
    /** Totales reales de la lista (`null` mientras carga o si no hay acceso). */
    summary,
    /** Atajo activo de la franja de resumen. */
    quick,
    setQuick,
    reason,
    setReasonFilter,
    search,
    setSearch,
    externalFilters,
    tableKey,
    hasFilters,
    clearFilters,
  };
};

export type UseDisciplinaryReports = ReturnType<typeof useDisciplinaryReports>;

export const searchEmployees = async (query?: string): Promise<User[]> => {
  try {
    return await usersApi.employees(undefined, query || undefined);
  } catch {
    return [];
  }
};
