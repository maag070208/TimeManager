import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  timeClockApi,
  type TimeClockDevice,
  type TimeClockInspectCards,
  type TimeClockInspectEvents,
  type TimeClockInspectOverview,
  type TimeClockInspectUsers,
} from "@entities/time-clock";

export type InspectTab = "overview" | "users" | "cards" | "events";

/**
 * Lo que tiene un reloj registrado, leído del propio equipo. Solo lectura: esta
 * pantalla no crea, cambia ni borra nada en el reloj.
 */
export const useTimeClockInspect = (controlledSerial?: string) => {
  const { t } = useTranslation("time-clock");
  const [devices, setDevices] = useState<TimeClockDevice[]>([]);
  const [internalSerial, setInternalSerial] = useState<string>("");
  const serial = controlledSerial ?? internalSerial;
  const setSerial = setInternalSerial;
  const [tab, setTab] = useState<InspectTab>("overview");
  const [days, setDays] = useState(2);
  const [overview, setOverview] = useState<TimeClockInspectOverview | null>(null);
  const [users, setUsers] = useState<TimeClockInspectUsers | null>(null);
  const [cards, setCards] = useState<TimeClockInspectCards | null>(null);
  const [events, setEvents] = useState<TimeClockInspectEvents | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    timeClockApi
      .status()
      .then((s) => {
        setDevices(s.devices);
        setInternalSerial((current) => current || s.devices[0]?.clockSerial || "");
      })
      .catch(() => setError(t("inspect.errors.devices")));
  }, [t]);

  const load = useCallback(() => {
    if (!serial) return;
    setLoading(true);
    setError(null);
    const request =
      tab === "overview"
        ? timeClockApi.inspectOverview(serial).then(setOverview)
        : tab === "users"
          ? timeClockApi.inspectUsers(serial).then(setUsers)
          : tab === "cards"
            ? timeClockApi.inspectCards(serial).then(setCards)
            : timeClockApi.inspectEvents(serial, days).then(setEvents);
    request
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(t("inspect.errors.read", { detail: message }));
      })
      .finally(() => setLoading(false));
  }, [serial, tab, days, t]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    devices,
    serial,
    setSerial,
    tab,
    setTab,
    days,
    setDays,
    overview,
    users,
    cards,
    events,
    loading,
    error,
    reload: load,
  };
};
