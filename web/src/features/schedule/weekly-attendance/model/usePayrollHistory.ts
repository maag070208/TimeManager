import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { scheduleApi, type PayrollClosureRow } from "@entities/schedule";
import { useCan } from "@entities/user";

/**
 * Historial de pre-nóminas cerradas (`GET /schedules/payroll/closures`): cada
 * semana con su cierre, la reapertura (si hubo) y las revisiones por
 * departamento (quién, cuándo y dónde). Permite reabrir una semana cerrada.
 */
export const usePayrollHistory = () => {
  const { t } = useTranslation("weekly-attendance");
  const [rows, setRows] = useState<PayrollClosureRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyWeek, setBusyWeek] = useState<string | null>(null);
  const canClose = useCan("payroll.close");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    scheduleApi
      .payrollClosures()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("history.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const reopen = useCallback(
    async (weekStart: string) => {
      setBusyWeek(weekStart);
      try {
        await scheduleApi.payrollReopen(weekStart);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("history.reopenError"));
      } finally {
        setBusyWeek(null);
      }
    },
    [load, t]
  );

  return { t, rows, loading, error, busyWeek, canClose, reload: load, reopen };
};

export type UsePayrollHistory = ReturnType<typeof usePayrollHistory>;
