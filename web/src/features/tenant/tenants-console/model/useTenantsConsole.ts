import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantApi, type Tenant } from "@entities/tenant";
import { useCan } from "@entities/user";

export type TenantFilter = "all" | "ACTIVE" | "SUSPENDED";

/** Consola de clientes: lista, totales y búsqueda. */
export const useTenantsConsole = () => {
  const canManage = useCan("tenants.manage");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<TenantFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    tenantApi
      .list()
      .then((rows) => {
        if (!alive) return;
        setTenants(rows);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const counts = useMemo(() => {
    const rows = tenants ?? [];
    return {
      all: rows.length,
      active: rows.filter((t) => t.status === "ACTIVE").length,
      suspended: rows.filter((t) => t.status === "SUSPENDED").length,
      people: rows.reduce((sum, t) => sum + t.usage.activeUsers, 0),
    };
  }, [tenants]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tenants ?? []).filter(
      (t) =>
        (filter === "all" || t.status === filter) &&
        (!q || t.name.toLowerCase().includes(q) || t.slug.includes(q))
    );
  }, [tenants, filter, search]);

  return {
    canManage,
    tenants,
    visible,
    counts,
    error,
    setError,
    filter,
    setFilter,
    search,
    setSearch,
    reload,
  };
};
