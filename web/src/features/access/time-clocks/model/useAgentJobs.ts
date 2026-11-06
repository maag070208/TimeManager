import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { agentApi, type AgentJob, type PanelJobType } from "@entities/agent";
import { useCan } from "@entities/user";
import type { TimeClockDevice } from "@entities/time-clock";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isActive = (job: AgentJob): boolean => job.status === "PENDING" || job.status === "RUNNING";

/**
 * Cola del agente local desde el panel de relojes (F3-07): encola altas/bajas
 * de personas y tarjetas para que el `CheckLab Agent` del cliente las
 * ejecute contra el reloj, y muestra el estado de los últimos trabajos.
 */
export const useAgentJobs = (clocks: TimeClockDevice[]) => {
  const { t } = useTranslation(["time-clock", "common"]);
  const canWrite = useCan("time_clock.write");

  const [jobs, setJobs] = useState<AgentJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [clockSerial, setClockSerial] = useState("");
  const [action, setAction] = useState<PanelJobType>("PERSON_ADD");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [name, setName] = useState("");
  const [cardNo, setCardNo] = useState("");

  useEffect(() => {
    if (clockSerial) return;
    const first = clocks[0];
    if (first) setClockSerial(first.clockSerial);
  }, [clocks, clockSerial]);

  const loadJobs = useCallback(async () => {
    try {
      const response = await agentApi.recentJobs(10);
      setJobs(response.jobs);
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // Solo se refresca solo mientras hay trabajos en curso.
  const active = (jobs ?? []).some(isActive);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => void loadJobs(), 5_000);
    return () => window.clearInterval(timer);
  }, [active, loadJobs]);

  const clock = clocks.find((item) => item.clockSerial === clockSerial) ?? null;
  const readOnly = !!clock && !clock.writeEnabled;
  const needsEmployee = action !== "SYNC";
  const needsName = action === "PERSON_ADD";
  const needsCard = action === "CARD_ADD";

  const canSubmit =
    canWrite &&
    !busy &&
    !!clock &&
    (!needsEmployee || employeeNumber.trim() !== "") &&
    (!needsName || name.trim() !== "") &&
    (!needsCard || cardNo.trim() !== "");

  const submit = async () => {
    if (!canSubmit || !clock) return;
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const payload: Record<string, unknown> = {};
      if (needsEmployee) payload.employeeNumber = employeeNumber.trim();
      if (needsName) payload.name = name.trim();
      if (needsCard) payload.cardNo = cardNo.trim();
      await agentApi.enqueue({
        type: action,
        clockSerial: clock.clockSerial,
        ...(action === "SYNC" ? {} : { payload }),
      });
      setToast(t("agentJobs.queued"));
      setEmployeeNumber("");
      setName("");
      setCardNo("");
      await loadJobs();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    t,
    canWrite,
    jobs,
    error,
    setError,
    toast,
    setToast,
    busy,
    clockSerial,
    setClockSerial,
    action,
    setAction,
    employeeNumber,
    setEmployeeNumber,
    name,
    setName,
    cardNo,
    setCardNo,
    clock,
    readOnly,
    needsEmployee,
    needsName,
    needsCard,
    canSubmit,
    submit,
    reload: loadJobs,
  };
};
