import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  timeClockApi,
  type TimeClockDevice,
  type TimeClockConfig,
  type TimeClockStatus,
} from "@entities/time-clock";

/** Refresco del estado mientras algún reloj sincroniza. */
const STATUS_POLL_MS = 5_000;

/** Configuración de un reloj leída en vivo: cargando, leída o con error. */
export interface ClockConfig {
  loading: boolean;
  data: TimeClockConfig | null;
  error: string | null;
}

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

/**
 * Relojes dados de alta: su sincronización (se refresca sola mientras alguno
 * corre), su configuración leída en vivo, el alta, la edición (nombre y si
 * cuenta para entradas/salidas) y la baja. Del reloj solo se LEE: nada de esto
 * lo modifica, solo cambia cómo el sistema se conecta y usa sus checadas.
 */
export const useTimeClocks = () => {
  const { t } = useTranslation(["time-clock", "common"]);

  const [status, setStatus] = useState<TimeClockStatus | null>(null);
  const [configs, setConfigs] = useState<Record<string, ClockConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Alta
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [countsAttendance, setAttendance] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Edición (solo el registro del sistema)
  const [editTarget, setEditTarget] = useState<TimeClockDevice | null>(null);
  const [editName, setEditName] = useState("");
  const [editAttendance, setEditAttendance] = useState(true);
  const [editWrite, setEditWrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Baja
  const [retirementTarget, setRetirementTarget] = useState<TimeClockDevice | null>(null);
  const [retiring, setRetiring] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await timeClockApi.status());
    } catch (e) {
      setError(messageOf(e, t("clocks.errors.status")));
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const syncing = status?.inProgress != null;
  useEffect(() => {
    if (!syncing) return undefined;
    const timer = window.setTimeout(() => void loadStatus(), STATUS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [syncing, status, loadStatus]);

  const loadConfig = useCallback(
    async (serial: string) => {
      setConfigs((c) => ({ ...c, [serial]: { loading: true, data: c[serial]?.data ?? null, error: null } }));
      try {
        const data = await timeClockApi.clockSettings(serial);
        setConfigs((c) => ({ ...c, [serial]: { loading: false, data, error: null } }));
      } catch (e) {
        setConfigs((c) => ({
          ...c,
          [serial]: { loading: false, data: null, error: messageOf(e, t("clocks.errors.config")) },
        }));
      }
    },
    [t]
  );

  // La configuración se lee al abrir el detalle de un reloj (carga perezosa:
  // no se consulta cada reloj hasta que hace falta).

  const openRegistration = () => {
    setUrl("");
    setName("");
    setAttendance(true);
    setRegistrationError(null);
    setIsRegistrationOpen(true);
  };

  const register = async () => {
    setConnecting(true);
    setRegistrationError(null);
    try {
      const clock = await timeClockApi.registerClock({
        url: url.trim(),
        name: name.trim() || undefined,
        countsAttendance,
      });
      setIsRegistrationOpen(false);
      setToast(t("clocks.toasts.registration", { name: clock.name }));
      await loadStatus();
    } catch (e) {
      setRegistrationError(messageOf(e, t("clocks.errors.registration")));
    } finally {
      setConnecting(false);
    }
  };

  const openEdit = (clock: TimeClockDevice) => {
    setEditName(clock.name);
    setEditAttendance(clock.countsAttendance);
    setEditWrite(clock.writeEnabled);
    setEditError(null);
    setEditTarget(clock);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    setEditError(null);
    try {
      const clock = await timeClockApi.updateClock(editTarget.clockSerial, {
        name: editName.trim(),
        countsAttendance: editAttendance,
        writeEnabled: editWrite,
      });
      setEditTarget(null);
      setToast(t("clocks.toasts.edited", { name: clock.name }));
      await loadStatus();
    } catch (e) {
      setEditError(messageOf(e, t("clocks.errors.edit")));
    } finally {
      setSaving(false);
    }
  };

  const confirmRetirement = async () => {
    if (!retirementTarget) return;
    const { clockSerial: serial, name: clockName } = retirementTarget;
    setRetiring(true);
    try {
      await timeClockApi.retireClock(serial);
      setRetirementTarget(null);
      setToast(t("clocks.toasts.retirement", { name: clockName }));
      setConfigs((c) => {
        const rest = { ...c };
        delete rest[serial];
        return rest;
      });
      await loadStatus();
    } catch (e) {
      setRetirementTarget(null);
      setError(messageOf(e, t("clocks.errors.retirement")));
    } finally {
      setRetiring(false);
    }
  };

  return {
    t,
    status,
    configs,
    loadConfig,
    isRegistrationOpen,
    setIsRegistrationOpen,
    openRegistration,
    url,
    setUrl,
    name,
    setName,
    countsAttendance,
    setAttendance,
    connecting,
    registrationError,
    register,
    editTarget,
    setEditTarget,
    openEdit,
    editName,
    setEditName,
    editAttendance,
    setEditAttendance,
    editWrite,
    setEditWrite,
    saving,
    editError,
    saveEdit,
    retirementTarget,
    setRetirementTarget,
    retiring,
    confirmRetirement,
    error,
    setError,
    toast,
    setToast,
  };
};

export type UseTimeClocks = ReturnType<typeof useTimeClocks>;
