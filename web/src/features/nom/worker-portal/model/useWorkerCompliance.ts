import { useCallback, useEffect, useState } from "react";
import { nomApi } from "@entities/nom";
import type {
  OvertimeRequestRow,
  RecordAgreement,
  WorkRecordAcknowledgment,
} from "@entities/nom";

const toKey = (date: Date): string => date.toISOString().slice(0, 10);

/** Lunes y domingo de la semana actual (fechas locales del contrato). */
const currentWeek = (): { periodStart: string; periodEnd: string } => {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { periodStart: toKey(monday), periodEnd: toKey(sunday) };
};

/**
 * Prueba plena (R-01) y consentimiento de horas extra (F3/1.5) desde el portal
 * del trabajador: acepta método de registro, confirma su semana y responde
 * solicitudes de extra.
 */
export const useWorkerCompliance = () => {
  const [agreement, setAgreement] = useState<RecordAgreement | null>(null);
  const [proposal, setProposal] = useState<{ methods: string[]; text: string; roundingPolicy: string | null; correctionRules: string | null } | null>(null);
  const [acknowledgments, setAcknowledgments] = useState<WorkRecordAcknowledgment[]>([]);
  const [requests, setRequests] = useState<OvertimeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProposal, nextAgreement, nextAcknowledgments, nextRequests] = await Promise.all([
        nomApi.recordProposal(),
        nomApi.myRecordAgreement(),
        nomApi.myRecordAcknowledgments(),
        nomApi.myOvertimeRequests(),
      ]);
      setProposal(nextProposal);
      setAgreement(nextAgreement);
      setAcknowledgments(nextAcknowledgments);
      setRequests(nextRequests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar tu registro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción.");
    } finally {
      setBusy(null);
    }
  };

  const acceptAgreement = () =>
    run("agreement", async () => {
      await nomApi.acceptRecordAgreement({
        methods: proposal?.methods ?? ["CLOCK", "REMOTE"],
        roundingPolicy: "Minutos exactos; el redondeo es solo para nómina",
        correctionRules: "Toda corrección pasa por ajuste documentado y aprobado",
      });
      setNotice("Método de registro aceptado.");
    });

  const acknowledge = (accept: boolean, note?: string) =>
    run(accept ? "ack" : "discrepancy", async () => {
      await nomApi.acknowledgeRecord({ ...currentWeek(), accept, note: note ?? null });
      setNotice(accept ? "Semana confirmada." : "Discrepancia enviada.");
    });

  const decideRequest = (id: string, accept: boolean) =>
    run(`request-${id}`, async () => {
      await nomApi.decideOvertimeRequest(id, { accept });
    });

  return {
    agreement,
    proposal,
    acknowledgments,
    requests,
    loading,
    busy,
    error,
    notice,
    dismissNotice: () => setNotice(null),
    acceptAgreement,
    acknowledge,
    decideRequest,
    refresh: load,
  };
};
