import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@app/store";
import { tenantApi, type Tenant } from "@entities/tenant";
import { getSelectedTenant, setSelectedTenant, type SelectedTenant } from "@shared/api/tenant";

/** Valor del selector para "sin cliente" (el select del kit trata "" como vacío). */
export const PLATFORM_OPTION = "__platform__";

/**
 * Cliente vigente de la sesión. Personal de cliente: el suyo (fijo).
 * Plataforma con `tenants.view`: puede elegir uno; la elección viaja como
 * `X-Tenant-Id` y al cambiarla se recarga la app para no mezclar datos.
 */
export const useTenantSwitcher = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const isPlatform = !!user && !user.tenant;
  const canSwitch = isPlatform && (user?.permissions?.["tenants.view"] ?? "NONE") !== "NONE";
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [selected] = useState<SelectedTenant | null>(() => getSelectedTenant());

  useEffect(() => {
    if (!canSwitch) return;
    let alive = true;
    tenantApi
      .list()
      .then((rows) => alive && setTenants(rows.filter((t) => t.status === "ACTIVE")))
      .catch(() => alive && setTenants([]));
    return () => {
      alive = false;
    };
  }, [canSwitch]);

  const select = (id: string) => {
    const next = tenants?.find((t) => t.id === id) ?? null;
    if ((next?.id ?? null) === (selected?.id ?? null)) return;
    setSelectedTenant(next ? { id: next.id, name: next.name, slug: next.slug } : null);
    window.location.assign("/");
  };

  const currentName = user?.tenant?.name ?? selected?.name ?? null;

  return { isPlatform, canSwitch, tenants, selectedId: selected?.id ?? PLATFORM_OPTION, currentName, select };
};
