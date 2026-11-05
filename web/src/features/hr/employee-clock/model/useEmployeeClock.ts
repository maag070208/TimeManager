import { useCallback, useEffect, useState } from "react";
import { timeClockApi, type EmployeeClockStatus } from "@entities/time-clock";

/** Estado del alta de una persona en cada reloj. Se lee al entrar; el alta escribe solo en el reloj de prueba (lo decide la API). */
export const useEmployeeClock = (userId: string | undefined, enabled: boolean) => {
  const [status, setStatus] = useState<EmployeeClockStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId || !enabled) return;
    setLoading(true);
    setError(null);
    timeClockApi
      .employeeClockStatus(userId)
      .then(setStatus)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [userId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const alta = async (serial: string): Promise<boolean> => {
    if (!userId) return false;
    setError(null);
    try {
      await timeClockApi.employeeClockAlta(userId, serial);
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  return { status, loading, error, alta, reload: load };
};
