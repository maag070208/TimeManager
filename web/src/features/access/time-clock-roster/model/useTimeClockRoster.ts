import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  timeClockApi,
  type RemovalCategoryRow,
  type RosterRemovalInput,
  type RosterRunResult,
  type TimeClockRoster,
} from "@entities/time-clock";
import { useCan } from "@entities/user";

/**
 * Padrón del reloj: nuevos en el reloj, bajas pendientes (con motivo) y
 * reapariciones. Las acciones se piden a la API; el estado vive aquí.
 */
export const useTimeClockRoster = () => {
  const { t } = useTranslation("time-clock");
  // Mismos permisos que la API: ver, revisar, dar de baja usuarios, descartar.
  const canView = useCan("time_clock.view");
  const canRun = useCan("time_clock.sync");
  // Las bajas del padrón las aplica RH (hr.records) o quien da de baja usuarios.
  const canEditAccounts = useCan("users.edit");
  const canHr = useCan("hr.records");
  const canRemove = canEditAccounts || canHr;
  const canLink = useCan("time_clock.link");

  const [data, setData] = useState<TimeClockRoster | null>(null);
  const [categories, setCategories] = useState<RemovalCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyNumber, setBusyNumber] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    timeClockApi
      .roster()
      .then(setData)
      .catch(() => setError(t("roster.errors.load")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
    timeClockApi.removalCategories().then(setCategories).catch(() => setCategories([]));
  }, [load]);

  const runReview = async (): Promise<RosterRunResult | null> => {
    setRunning(true);
    setError(null);
    try {
      const result = await timeClockApi.runRoster();
      setToast(result.suspicious ? t("roster.toast.suspicious") : t("roster.toast.ran"));
      load();
      return result;
    } catch {
      setError(t("roster.errors.run"));
      return null;
    } finally {
      setRunning(false);
    }
  };

  const applyRemoval = async (employeeNumber: string, input: RosterRemovalInput): Promise<boolean> => {
    setBusyNumber(employeeNumber);
    setError(null);
    try {
      await timeClockApi.applyRemoval(employeeNumber, input);
      setToast(t("roster.toast.removed"));
      load();
      return true;
    } catch {
      setError(t("roster.errors.remove"));
      return false;
    } finally {
      setBusyNumber(null);
    }
  };

  const dismissRemoval = async (employeeNumber: string): Promise<void> => {
    setBusyNumber(employeeNumber);
    setError(null);
    try {
      await timeClockApi.dismissRemoval(employeeNumber);
      setToast(t("roster.toast.dismissed"));
      load();
    } catch {
      setError(t("roster.errors.dismiss"));
    } finally {
      setBusyNumber(null);
    }
  };

  return {
    data,
    categories,
    loading,
    running,
    busyNumber,
    error,
    toast,
    dismissToast: () => setToast(null),
    canView,
    canRun,
    canRemove,
    canLink,
    reload: load,
    runReview,
    applyRemoval,
    dismissRemoval,
  };
};
