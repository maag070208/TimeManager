import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  timeClockApi,
  type ClockGender,
  type TimeClockBiometrics,
  type TimeClockDevice,
  type TimeClockPeopleList,
} from "@entities/time-clock";

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);

/**
 * Personas y tarjetas de un reloj. Cada acción ESCRIBE en el reloj a través de
 * la API, que aplica su candado (solo el mock, o un reloj con escritura habilitada).
 */
export const useTimeClockPeople = (controlledSerial?: string) => {
  const { t } = useTranslation("time-clock");
  const [devices, setDevices] = useState<TimeClockDevice[]>([]);
  const [internalSerial, setInternalSerial] = useState("");
  const serial = controlledSerial ?? internalSerial;
  const setSerial = setInternalSerial;
  const [data, setData] = useState<TimeClockPeopleList | null>(null);
  /** Sube en cada lectura exitosa; la tabla lo usa para recargarse. */
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [biometrics, setBiometrics] = useState<TimeClockBiometrics | null>(null);
  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [biometricsError, setBiometricsError] = useState<string | null>(null);

  useEffect(() => {
    timeClockApi
      .status()
      .then((s) => {
        setDevices(s.devices);
        setInternalSerial((current) => current || s.devices[0]?.clockSerial || "");
      })
      .catch(() => setError(t("people.errors.devices")));
  }, [t]);

  const load = useCallback(() => {
    if (!serial) return;
    setLoading(true);
    setError(null);
    timeClockApi
      .peopleList(serial)
      .then((list) => {
        setData(list);
        setVersion((v) => v + 1);
      })
      .catch((e: unknown) => setError(messageOf(e, t("people.errors.load"))))
      .finally(() => setLoading(false));
  }, [serial, t]);

  useEffect(() => {
    load();
  }, [load]);

  /** Rostros y huellas: se leen aparte porque el equipo las pide persona por persona. */
  const loadBiometrics = useCallback(
    (refresh = false) => {
      if (!serial) return;
      setBiometricsLoading(true);
      setBiometricsError(null);
      timeClockApi
        .peopleBiometrics(serial, refresh)
        .then(setBiometrics)
        .catch((e: unknown) => setBiometricsError(messageOf(e, t("people.biometrics.error"))))
        .finally(() => setBiometricsLoading(false));
    },
    [serial, t]
  );

  useEffect(() => {
    setBiometrics(null);
    loadBiometrics(false);
  }, [loadBiometrics]);

  /** Ejecuta una escritura y refresca. Devuelve true si salió bien. */
  const write = async (action: () => Promise<unknown>, okMessage: string, failMessage: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setToast(okMessage);
      load();
      return true;
    } catch (e) {
      setError(messageOf(e, failMessage));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    devices,
    serial,
    setSerial,
    data,
    version,
    biometrics,
    biometricsLoading,
    biometricsError,
    reloadBiometrics: () => loadBiometrics(true),
    loading,
    busy,
    error,
    toast,
    dismissToast: () => setToast(null),
    reload: load,
    create: (input: { employeeNumber: string; name: string; gender: ClockGender }) =>
      write(() => timeClockApi.peopleCreate(serial, input), t("people.toasts.created"), t("people.errors.create")),
    rename: (employeeNumber: string, name: string) =>
      write(() => timeClockApi.peopleRename(serial, employeeNumber, name), t("people.toasts.renamed"), t("people.errors.rename")),
    remove: (employeeNumber: string) =>
      write(() => timeClockApi.peopleRemove(serial, employeeNumber), t("people.toasts.removed"), t("people.errors.remove")),
    addCard: (employeeNumber: string, cardNo: string) =>
      write(() => timeClockApi.peopleAddCard(serial, employeeNumber, cardNo), t("people.toasts.cardAdded"), t("people.errors.addCard")),
    removeCard: (cardNo: string) =>
      write(() => timeClockApi.peopleRemoveCard(serial, cardNo), t("people.toasts.cardRemoved"), t("people.errors.removeCard")),
  };
};
