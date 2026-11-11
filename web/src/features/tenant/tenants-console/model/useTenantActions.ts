import { useState } from "react";
import { tenantApi, type Tenant } from "@entities/tenant";
import { setSelectedTenant } from "@shared/api/tenant";

/** Acciones sobre un cliente: operarlo como soporte (auditado) y suspender/reactivar con confirmación. */
export const useTenantActions = (onStatusChanged: (tenant: Tenant) => void) => {
  const [error, setError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Tenant | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  /**
   * Operar como el cliente: la API deja el evento de auditoría (`TENANT_IMPERSONATED`)
   * y la elección viaja como `X-Tenant-Id`. `path` abre una pantalla concreta,
   * p. ej. relojes (F3-07: alta, probar conexión, sync y agente).
   */
  const enter = async (tenant: Tenant, path = "/") => {
    try {
      await tenantApi.impersonate(tenant.id);
      setSelectedTenant({ id: tenant.id, name: tenant.name, slug: tenant.slug });
      window.location.assign(path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    setSavingStatus(true);
    try {
      const updated = await tenantApi.update(statusTarget.id, { status: statusTarget.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
      setStatusTarget(null);
      onStatusChanged(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingStatus(false);
    }
  };

  return { error, setError, enter, statusTarget, setStatusTarget, savingStatus, confirmStatus };
};
