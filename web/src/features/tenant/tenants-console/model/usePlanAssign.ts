import { useEffect, useState } from "react";
import { planApi } from "@entities/plan";
import { tenantApi, type Tenant } from "@entities/tenant";

/** Resumen de plan que necesita la ficha del cliente (incluye el que está dado de baja). */
export interface PlanOption {
  id: string;
  name: string;
  employeeLimit: number;
  clockLimit: number;
  monthlyPrice: string | null;
  active: boolean;
}

/** Asigna (o quita) el plan de un cliente desde su ficha; al guardar refresca la consola. */
export const usePlanAssign = (tenant: Tenant | null, onSaved: () => void) => {
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlanId(tenant?.planId ?? "");
    if (!tenant) return undefined;
    let alive = true;
    planApi
      .list()
      .then((rows) => {
        if (!alive) return;
        const options: PlanOption[] = rows.map((plan) => ({
          id: plan.id,
          name: plan.name,
          employeeLimit: plan.employeeLimit,
          clockLimit: plan.clockLimit,
          monthlyPrice: plan.monthlyPrice,
          active: plan.active,
        }));
        // Un plan dado de baja ya no viene en el catálogo activo: se conserva visible.
        if (tenant.plan && !options.some((plan) => plan.id === tenant.plan?.id)) {
          options.push(tenant.plan);
        }
        setPlans(options);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [tenant]);

  const submit = async () => {
    if (!tenant) return;
    setSaving(true);
    setError(null);
    try {
      await tenantApi.update(tenant.id, { planId: planId || null });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return { plans, planId, setPlanId, saving, error, setError, submit };
};
