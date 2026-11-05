import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaFingerprint } from "react-icons/fa";
import { ITButton, ITFlex, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { timeClockApi, type FingerprintStatus } from "@entities/time-clock";
import FingerprintEnrollDialog from "./FingerprintEnrollDialog";

const MAX_FINGERS = 10;

interface Props {
  userId: string;
  userName: string;
  number: string;
  serial: string;
  clockName: string;
  /** Solo quien tiene `time_clock.write` puede registrar huellas. */
  canWrite: boolean;
  onApplied: () => void;
}

/**
 * Huellas de una persona en un reloj: los diez dedos a la vista, elegir uno libre y
 * registrarlo en un diálogo de pasos (capturar, revisar calidad, dar de alta).
 */
export default function FingerprintPanel({ userId, userName, number, serial, clockName, canWrite, onApplied }: Props) {
  const { t } = useTranslation("time-clock");
  const [status, setStatus] = useState<FingerprintStatus | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = () =>
    timeClockApi
      .fingerprintStatus(userId, serial)
      .then((s) => {
        setStatus(s);
        setSelected((current) => (current && !s.fingerIds.includes(current) ? current : null));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("employeeClock.fingerprint.error")));

  useEffect(() => {
    setDone(null);
    void load();
    // Se consulta al cambiar de persona o de reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, serial]);

  const taken = new Set(status?.fingerIds ?? []);
  const count = status?.fingerprints ?? 0;
  const full = count >= MAX_FINGERS;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[var(--it-card-bg)] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <ITFlex align="center" gap={3}>
          <ITText as="span" className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FaFingerprint size={18} />
          </ITText>
          <ITStack>
            <ITText className="text-sm font-bold text-slate-900">{t("employeeClock.fingerprint.title")}</ITText>
            <ITText className="text-xs text-slate-500">{clockName}</ITText>
          </ITStack>
        </ITFlex>
        <ITText as="span" className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ${full ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
          {count} / {MAX_FINGERS}
        </ITText>
      </header>

      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: MAX_FINGERS }, (_, i) => i + 1).map((fingerNo) => {
          const registered = taken.has(fingerNo);
          const isSelected = selected === fingerNo;
          const disabled = !canWrite || registered || full;
          return (
            <button
              key={fingerNo}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(fingerNo)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 text-xs font-semibold transition ${
                registered
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow-md"
                    : "border-dashed border-slate-300 text-slate-500 hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              {registered ? <FaCheck size={14} /> : <FaFingerprint size={16} className={isSelected ? "text-white" : "text-slate-400"} />}
              <ITText as="span">{fingerNo}</ITText>
            </button>
          );
        })}
      </div>

      <ITFlex align="center" justify="between" gap={3} wrap="wrap">
        <ITText className="text-xs text-slate-500">
          {selected === null
            ? t("employeeClock.fingerprint.legendPick")
            : t("employeeClock.fingerprint.readyToCapture", { finger: selected })}
        </ITText>
        {canWrite && (
          <ITButton
            variant="filled"
            color="primary"
            size="sm"
            disabled={selected === null || full}
            onClick={() => setEnrollOpen(true)}
          >
            {selected === null ? t("employeeClock.fingerprint.capture") : t("employeeClock.fingerprint.register", { finger: selected })}
          </ITButton>
        )}
      </ITFlex>

      {error && <ITText role="alert" className="text-sm text-red-600">{error}</ITText>}
      {done && <ITText role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">{done}</ITText>}
      {!canWrite && <ITText className="text-xs text-slate-400">{t("employeeClock.fingerprint.readOnly")}</ITText>}

      {selected !== null && (
        <FingerprintEnrollDialog
          isOpen={enrollOpen}
          onClose={() => {
            setEnrollOpen(false);
            setSelected(null);
          }}
          userId={userId}
          userName={userName}
          number={number}
          serial={serial}
          clockName={clockName}
          finger={selected}
          onApplied={(message) => {
            setDone(message);
            void load();
            onApplied();
          }}
        />
      )}
    </section>
  );
}
