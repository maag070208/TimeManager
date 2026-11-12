import { useCallback, useEffect, useState } from "react";
import { nomApi } from "@entities/nom";
import type { LeaveBalance, LeaveRequestRow, LeaveType } from "@entities/nom";

/** Vacaciones/permisos del trabajador: saldo, tipos, solicitudes y acciones. */
export const useMyLeave = () => {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const year = new Date().getFullYear();
      const [nextBalance, nextTypes, nextRequests] = await Promise.all([
        nomApi.leaveBalance(year),
        nomApi.leaveTypes(),
        nomApi.myLeaveRequests(),
      ]);
      setBalance(nextBalance);
      setTypes(nextTypes);
      setRequests(nextRequests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus vacaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    balance,
    types,
    requests,
    loading,
    busy,
    error,
    refresh: load,
    request: (input: { typeId: string; startDate: string; endDate: string; reason?: string }) =>
      run(async () => {
        await nomApi.createLeaveRequest(input);
      }),
    cancel: (id: string) => run(async () => void (await nomApi.cancelLeaveRequest(id))),
  };
};
