import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  nomApi,
  type MeTelework,
  type MyPunch,
  type PunchType,
  type RemoteWorkMode,
  type TeleworkChecklistKind,
} from "@entities/nom";
import { newId } from "@shared/lib/newId";

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface PunchOptions {
  workMode?: RemoteWorkMode;
  note?: string;
  withGeolocation?: boolean;
}

/** Estado y acciones del portal personal (marcaje, marcajes, teletrabajo). */
export const useMyWorkday = () => {
  const today = useMemo(() => isoDay(new Date()), []);
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    return isoDay(date);
  });
  const [to, setTo] = useState(today);
  const [punches, setPunches] = useState<MyPunch[]>([]);
  const [telework, setTelework] = useState<MeTelework | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Id de idempotencia pendiente por tipo: se reutiliza mientras el servidor no
  // confirme, para que un reintento tras un corte no duplique la checada.
  const pendingEventIds = useRef<Partial<Record<PunchType, string>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, state] = await Promise.all([
        nomApi.myPunches({ from, to, limit: 200 }),
        nomApi.myTelework(),
      ]);
      setPunches(rows);
      setTelework(state);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const punch = async (type: PunchType, options: PunchOptions = {}) =>
    run(async () => {
      const clientEventId = pendingEventIds.current[type] ?? newId();
      pendingEventIds.current[type] = clientEventId;
      const base = { type, clientEventId, workMode: options.workMode, note: options.note };
      // La ubicación (si se comparte) se pide EN ESTE MOMENTO y viaja solo con
      // el marcaje: no hay rastreo continuo.
      if (!options.withGeolocation || !("geolocation" in navigator)) {
        await nomApi.punch(base);
      } else {
        const position = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        });
        await nomApi.punch({
          ...base,
          latitude: position?.coords.latitude,
          longitude: position?.coords.longitude,
          gpsAccuracyMeters: position?.coords.accuracy,
        });
      }
      // Confirmada: el siguiente marcaje del mismo tipo estrena id.
      delete pendingEventIds.current[type];
    });

  const reportDiscrepancy = (punchId: string, reason: string) =>
    run(() => nomApi.reportDiscrepancy({ punchId, reason }));

  const acceptPolicy = () =>
    run(() => {
      if (!telework) throw new Error("no telework state");
      return nomApi.acceptTeleworkPolicy({
        policyVersion: telework.policy.policyVersion,
        privacyNoticeVersion: telework.policy.privacyNoticeVersion,
      });
    });

  const submitChecklist = (kind: TeleworkChecklistKind, answers: Record<string, "YES" | "NO">) =>
    run(() => nomApi.submitTeleworkChecklist({ kind, answers }));

  return {
    from,
    to,
    setFrom,
    setTo,
    today,
    punches,
    telework,
    loading,
    busy,
    error,
    refresh: load,
    punch,
    reportDiscrepancy,
    acceptPolicy,
    submitChecklist,
  };
};
