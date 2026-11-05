import { useCallback, useEffect, useMemo, useState } from "react";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { personalApi, type PersonalStats } from "@entities/hr";
import {
  departmentsApi,
  type Department,
} from "@entities/department";

export type EmployeeStatusFilter = "all" | "active" | "inactive";

export const useEmployeesList = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Totales reales de la plantilla (`GET /hr/stats`) para la franja de resumen.
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<EmployeeStatusFilter>("all");

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    personalApi.stats().then(setStats).catch(() => setStats(null));
  }, [reloadKey]);

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
      const res = await personalApi.table({
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
    []
  );

  return {
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