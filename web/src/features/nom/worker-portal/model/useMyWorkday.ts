import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  nomApi,
  type MeTelework,
  type MyPunch,
  type PunchType,
  type TeleworkChecklistKind,
} from "@entities/nom";
import { newId } from "@shared/lib/newId";

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Etapa visible de una checada en curso. */
export type PunchStage = "locating" | "sending";

/** Una lectura de hace menos de un minuto sigue siendo «el momento de marcar». */
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 };

const locate = (): Promise<GeolocationPosition | null> =>
  new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), GEO_OPTIONS);
  });

export interface PunchOptions {
  /** Ubicación en el momento de marcar; la decide la empresa (`remoteGeolocationEnabled`). */
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
  const [punchStage, setPunchStage] = useState<PunchStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Id de idempotencia pendiente por tipo: se reutiliza mientras el servidor no
  // confirme, para que un reintento tras un corte no duplique la checada.
  const pendingEventIds = useRef<Partial<Record<PunchType, string>>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [rows, state] = await Promise.all([
        nomApi.myPunches({ from, to, limit: 200 }),
        nomApi.myTelework(),
      ]);
      setPunches(rows);
      setTelework(state);
    } catch (err) {
      if (!silent) setError(messageOf(err));
    } finally {
      if (!silent) setLoading(false);
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

  /**
   * Registra la checada y la pinta con la respuesta del API: el botón se libera
   * en cuanto el servidor confirma y la lista se reconcilia en segundo plano.
   */
  const punch = async (type: PunchType, options: PunchOptions = {}) => {
    setError(null);
    try {
      const clientEventId = pendingEventIds.current[type] ?? newId();
      pendingEventIds.current[type] = clientEventId;
      // La ubicación (si se comparte) se pide EN ESTE MOMENTO y viaja solo con
      // el marcaje: no hay rastreo continuo.
      let position: GeolocationPosition | null = null;
      if (options.withGeolocation && "geolocation" in navigator) {
        setPunchStage("locating");
        position = await locate();
      }
      setPunchStage("sending");
      // La modalidad la pone el API según el registro de teletrabajo de la persona.
      const { punch: saved } = await nomApi.punch({
        type,
        clientEventId,
        latitude: position?.coords.latitude,
        longitude: position?.coords.longitude,
        gpsAccuracyMeters: position?.coords.accuracy,
      });
      // Confirmada: el siguiente marcaje del mismo tipo estrena id.
      delete pendingEventIds.current[type];
      setPunches((rows) =>
        rows.some((row) => row.id === saved.id)
          ? rows
          : [
              {
                id: saved.id,
                source: "REMOTE",
                type: saved.type,
                occurredAt: saved.occurredAt,
                method: saved.workMode,
                clockSerial: null,
                latitude: saved.latitude,
                longitude: saved.longitude,
              },
              ...rows,
            ]
      );
      void load(true);
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setPunchStage(null);
    }
  };

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
    punchStage,
    error,
    refresh: () => load(),
    punch,
    reportDiscrepancy,
    acceptPolicy,
    submitChecklist,
  };
};
