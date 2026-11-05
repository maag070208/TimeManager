import { useCallback, useEffect, useState } from "react";
import { timeClockApi, type TimeClockSummary } from "@entities/time-clock";

/** Estado del reloj para el dashboard. Se actualiza solo al entrar o al pedirlo (sin sondeo). */
export const useTimeClockDashboard = () => {
  const [data, setData] = useState<TimeClockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    timeClockApi
      .summary()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
};
