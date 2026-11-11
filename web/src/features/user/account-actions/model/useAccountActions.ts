import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usersApi, useCan } from "@entities/user";
import { describeClockSync, timeClockApi } from "@entities/time-clock";
import { i18n } from "@shared/i18n";

/** Lo mínimo de una persona para actuar sobre su cuenta (sirve para `User` y `PersonalProfile`). */
export interface AccountTarget {
  id: string;
  username: string;
  name: string;
  active: boolean;
}

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

/**
 * Acciones sobre la cuenta de una persona: baja con motivo,
 * reactivación y borrado (con forzado si tiene historial).
 */
export const useAccountActions = (onChanged: () => void) => {
  const { t } = useTranslation("users");
  const canEdit = useCan("users.edit");
  const canRecords = useCan("hr.records");
  const canDelete = useCan("users.delete");
  const canWriteClock = useCan("time_clock.write");
  const can = {
    edit: canEdit,
    // El API acepta la baja/reactivación con cualquiera de los dos.
    deactivate: canEdit || canRecords,
    delete: canDelete,
    writeClock: canWriteClock,
  };
  const [toDeactivate, setToDeactivate] = useState<AccountTarget | null>(null);
  const [toDelete, setToDelete] = useState<AccountTarget | null>(null);
  const [toForceDelete, setToForceDelete] = useState<AccountTarget | null>(null);
  const [toReactivate, setToReactivate] = useState<AccountTarget | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const fail = (e: unknown, fallback: string) =>
    setToast({ message: (e instanceof Error && e.message) || t(fallback as never), type: "error" });

  const deactivate = async (reason: string) => {
    const target = toDeactivate;
    if (!target) return;
    setToDeactivate(null);
    try {
      await usersApi.deactivate(target.id, { reason, notifyUser: true });
      onChanged();
      const notice = can.writeClock ? await clockSyncNotice(() => timeClockApi.employeeClockBajaAll(target.id), "baja") : null;
      setToast({ message: [t("list.toastDeactivated"), notice].filter(Boolean).join(". "), type: "success" });
    } catch (e) {
      fail(e, "list.errorDeactivate");
    }
  };

  const reactivate = async () => {
    const target = toReactivate;
    if (!target) return;
    setToReactivate(null);
    try {
      await usersApi.reactivate(target.id);
      onChanged();
      const notice = can.writeClock ? await clockSyncNotice(() => timeClockApi.employeeClockAltaAll(target.id), "alta") : null;
      setToast({ message: [t("list.toastReactivated"), notice].filter(Boolean).join(". "), type: "success" });
    } catch (e) {
      fail(e, "list.errorReactivate");
    }
  };

  /** Borrado de una cuenta dada de baja; si el API lo rechaza por historial, se ofrece forzarlo. */
  const remove = async (force: boolean) => {
    const target = force ? toForceDelete : toDelete;
    if (!target) return;
    setToDelete(null);
    setToForceDelete(null);
    try {
      await usersApi.delete(target.id, force);
      onChanged();
      setToast({ message: t("list.toastDeleted"), type: "success" });
    } catch (e) {
      if (!force) setToForceDelete(target);
      else fail(e, "list.errorForceDelete");
    }
  };

  return {
    can,
    toDeactivate, setToDeactivate, deactivate,
    toDelete, setToDelete,
    toForceDelete, setToForceDelete, remove,
    toReactivate, setToReactivate, reactivate,
    toast, setToast,
  };
};

export type AccountActions = ReturnType<typeof useAccountActions>;
