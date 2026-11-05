import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantApi, type Tenant } from "@entities/tenant";
import { useCan } from "@entities/user";
import { setSelectedTenant } from "@shared/api/tenant";

export type TenantFilter = "all" | "ACTIVE" | "SUSPENDED";

/** Consola de clientes: lista, totales, entrar como cliente y suspender/reactivar. */
export const useTenantsConsole = () => {
  const canManage = useCan("tenants.manage");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<TenantFilter>("all");
  const [search, setSearch] = useState("");
  const [statusTarget, setStatusTarget] = useState<Tenant | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

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

  /**
   * Operar como el cliente: la API deja el evento de auditoría
   * (`TENANT_IMPERSONATED`) y la elección viaja como `X-Tenant-Id`.
   */
  const enter = async (t: Tenant) => {
    try {
      await tenantApi.impersonate(t.id);
      setSelectedTenant({ id: t.id, name: t.name, slug: t.slug });
      window.location.assign("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Aprovisionamiento guiado (F3-07): entra como el cliente (auditoría) y abre
   * la pantalla de relojes operando con `X-Tenant-Id`, donde ya viven el alta,
   * "Probar conexión", "Sincronizar ahora", el último sync y el panel del agente.
   */
  const manageClocks = async (t: Tenant) => {
    try {
      await tenantApi.impersonate(t.id);
      setSelectedTenant({ id: t.id, name: t.name, slug: t.slug });
      window.location.assign("/#/time-clocks");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    setSavingStatus(true);
    try {
      await tenantApi.update(statusTarget.id, { status: statusTarget.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
      setStatusTarget(null);
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingStatus(false);
    }
  };

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
    enter,
    manageClocks,
    statusTarget,
    setStatusTarget,
    savingStatus,
    confirmStatus,
  };
};
