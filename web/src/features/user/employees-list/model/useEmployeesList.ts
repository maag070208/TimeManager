import { useCallback, useEffect, useMemo, useState } from "react";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { personalApi, type PersonalStats } from "@entities/hr";
import { useCan, usersApi } from "@entities/user";
import {
  departmentsApi,
  type Department,
} from "@entities/department";

export type EmployeeStatusFilter = "all" | "active" | "inactive";

/**
 * Personal = una persona, una cuenta. Con `hr.records` la lista sale del
 * expediente (`/hr/query`); sin él (p. ej. SUPPORT, que administra cuentas
 * pero no ve expedientes) sale de las cuentas (`/users/query`), que no trae
 * datos sensibles. Mismas columnas en ambos casos.
 */
export const useEmployeesList = () => {
  const canRecords = useCan("hr.records");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Totales reales de la plantilla (`GET /hr/stats`) para la franja de resumen.
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<EmployeeStatusFilter>("all");

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    const load = canRecords
      ? personalApi.stats()
      : Promise.all(
          ([{}, { active: true }, { active: false }] as Record<string, boolean>[]).map((filters) =>
            usersApi.table({ page: 1, limit: 1, filters, sort: {} as never })
          )
        ).then(([all, act, inact]) => ({ total: all.total, active: act.total, inactive: inact.total, roles: {} }) as PersonalStats);
    load.then((s) => alive && setStats(s)).catch(() => alive && setStats(null));
    return () => {
      alive = false;
    };
  }, [reloadKey, canRecords]);

  // El mosaico elegido se manda como filtro externo de la tabla (columna `active`).
  const externalFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    if (statusFilter !== "all") filters.active = statusFilter === "active" ? "true" : "false";
    return filters;
  }, [statusFilter]);

  useEffect(() => {
    departmentsApi.list(true).then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const fetchTableData = useCallback(
    async (params: ITDataTableFetchParams) => {
      const res = await (canRecords ? personalApi.table : usersApi.table)({
        page: params.page,
        limit: params.limit,
        filters: params.filters,
        sort: params.sort,
      });
      setTotal(res.total);
      return {
        data: res.data as unknown as Record<string, unknown>[],
        total: res.total,
      };
    },
    [canRecords]
  );

  return {
    canRecords,
    departments,
    total,
    stats,
    statusFilter,
    setStatusFilter,
    externalFilters,
    error,
    setError,
    reloadKey,
    reload,
    fetchTableData,
  };
};