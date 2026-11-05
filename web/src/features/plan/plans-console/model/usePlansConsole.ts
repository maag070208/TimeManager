import { useCallback, useEffect, useMemo, useState } from "react";
import { planApi, type Plan } from "@entities/plan";
import { useCan } from "@entities/user";

/** Consola de planes: catálogo completo (bajas incluidas), alta/edición y baja/reactivación. */
export const usePlansConsole = () => {
  const canManage = useCan("plans.manage");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Plan | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let alive = true;
    planApi
      .list(true)
      .then((rows) => {
        if (!alive) return;
        setPlans(rows);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const counts = useMemo(() => {
    const rows = plans ?? [];
    return {
      all: rows.length,
      active: rows.filter((plan) => plan.active).length,
      inactive: rows.filter((plan) => !plan.active).length,
    };
  }, [plans]);

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    setSavingStatus(true);
    try {
      await planApi.update(statusTarget.id, { active: !statusTarget.active });
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
    plans,
    counts,
    error,
    setError,
    reload,
    creating,
    editing,
    openCreate: () => setCreating(true),
    openEdit: (plan: Plan) => setEditing(plan),
    closeForm,
    statusTarget,
    setStatusTarget,
    savingStatus,
    confirmStatus,
  };
};

export type UsePlansConsole = ReturnType<typeof usePlansConsole>;
