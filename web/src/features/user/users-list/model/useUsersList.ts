import { useCallback, useEffect, useState } from "react";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { usersApi, useCan, type User } from "@entities/user";
import { describeClockSync, timeClockApi } from "@entities/time-clock";
import { departmentsApi, type Department } from "@entities/department";
import { i18n } from "@shared/i18n";

/** Resumen de baja o alta en los relojes para el aviso. Un fallo del reloj no deshace la acción en el sistema. */
const clockSyncNotice = async (
  run: () => Promise<{ results: Parameters<typeof describeClockSync>[0] }>,
  action: "baja" | "alta"
): Promise<string | null> => {
  try {
    const { results } = await run();
    return describeClockSync(results, action);
  } catch {
    return i18n.t("time-clock:clockSync.failed", { clock: "reloj" });
  }
};

export const useUsersList = () => {
  const canWriteClock = useCan("time_clock.write");
  const { t: tt } = useTranslation("users");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  // Totales para la tira del mosaico: todas, activas y dadas de baja.
  const [counts, setCounts] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [userToToggle, setUserToToggle] = useState<User | null>(null);
  const [userToReactivate, setUserToReactivate] = useState<User | null>(null);
  const [userToForceDelete, setUserToForceDelete] = useState<User | null>(null);
  const [userToPassword, setUserToPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  // Tres consultas de una fila: es el total real de cada estado, no la página.
  useEffect(() => {
    let alive = true;
    const count = (filters: Record<string, string | boolean>) =>
      usersApi.table({ page: 1, limit: 1, filters, sort: {} as never });
    Promise.all([count({}), count({ active: true }), count({ active: false })])
      .then(([all, act, inact]) => {
        if (alive) setCounts({ total: all.total, active: act.total, inactive: inact.total });
      })
      .catch(() => alive && setCounts(null));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Departamentos y subáreas para los filtros tipo catálogo (Depto / Subárea).
  useEffect(() => {
    departmentsApi.list(true).then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const fetchTableData = useCallback(async (params: ITDataTableFetchParams) => {
    const res = await usersApi.table({
      page: params.page,
      limit: params.limit,
      filters: params.filters,
      sort: params.sort,
    });
    setTotal(res.total);
    return {
      data: res.data as unknown as Record<string, unknown>[],
      total: res.total,
    };
  }, []);

  /**
   * Confirmación de baja explícita: usa el endpoint /deactivate con motivo.
   * El diálogo de motivo se gestiona en la UI (DeactivateDialog). Esta función
   * solo dispara el request.
   */
  const handleDeactivate = async (reason: string) => {
    if (!userToToggle) return;
    const target = userToToggle;
    setUserToToggle(null);
    try {
      await usersApi.deactivate(target.id, { reason, notifyUser: true });
      setReloadKey((k) => k + 1);
      const notice = canWriteClock ? await clockSyncNotice(() => timeClockApi.employeeClockBajaAll(target.id), "baja") : null;
      setToast({ message: [tt("list.toastDeactivated"), notice].filter(Boolean).join(". "), type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || tt("list.errorDeactivate"), type: "error" });
    }
  };

  /**
   * Toggle legacy: cuando se llamaba desde ITConfirmDialog sin motivo. Ya
   * reemplazado por handleDeactivate; se conserva solo para compatibilidad
   * con flujos donde se quiera desactivar directamente (no debería llamarse
   * desde la UI nueva).
   */
  const handleToggleActive = async (_isAdmin: boolean) => {
    if (!userToToggle) return;
    const target = userToToggle;
    setUserToToggle(null);
    try {
      await usersApi.deactivate(target.id, { reason: i18n.t("users:list.defaultDeactivationReason"), notifyUser: true });
      setReloadKey((k) => k + 1);
      setToast({ message: tt("list.toastDeactivated"), type: "success" });
    } catch (e: any) {
      if (_isAdmin && !target.active) {
        setUserToForceDelete(target);
      } else {
        setToast({ message: e.message || tt("list.errorDeactivate"), type: "error" });
      }
    }
  };

  const handleReactivate = async () => {
    if (!userToReactivate) return;
    const target = userToReactivate;
    setUserToReactivate(null);
    try {
      await usersApi.reactivate(target.id);
      setReloadKey((k) => k + 1);
      const notice = canWriteClock ? await clockSyncNotice(() => timeClockApi.employeeClockAltaAll(target.id), "alta") : null;
      setToast({ message: [tt("list.toastReactivated"), notice].filter(Boolean).join(". "), type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || tt("list.errorReactivate"), type: "error" });
    }
  };

  const handleForceDelete = async () => {
    if (!userToForceDelete) return;
    const target = userToForceDelete;
    setUserToForceDelete(null);
    try {
      await usersApi.delete(userToForceDelete.id, true);
      setReloadKey((k) => k + 1);
      setToast({ message: tt("list.toastDeleted"), type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || tt("list.errorForceDelete"), type: "error" });
    }
  };

  const handleChangePassword = async () => {
    if (!userToPassword || !newPassword.trim()) return;
    try {
      await usersApi.changePassword(userToPassword.id, newPassword);
      setUserToPassword(null);
      setNewPassword("");
      setToast({ message: tt("list.toastPasswordChanged"), type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || tt("list.errorPassword"), type: "error" });
    }
  };

  return {
    departments,
    total,
    counts,
    reloadKey,
    userToToggle,
    setUserToToggle,
    userToReactivate,
    setUserToReactivate,
    userToForceDelete,
    setUserToForceDelete,
    userToPassword,
    setUserToPassword,
    newPassword,
    setNewPassword,
    toast,
    setToast,
    fetchTableData,
    handleToggleActive,
    handleDeactivate,
    handleReactivate,
    handleForceDelete,
    handleChangePassword,
    reload: () => setReloadKey((k) => k + 1),
  };
};

export type UseUsersList = ReturnType<typeof useUsersList>;