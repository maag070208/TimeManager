import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaFingerprint, FaSpinner } from "react-icons/fa";
import { ITButton, ITDialog, ITFlex, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { timeClockApi, type FingerprintCapture } from "@entities/time-clock";

type Phase = "capturing" | "captured" | "applying" | "done";

/** Error de la API: código para explicarlo y el texto técnico aparte. */
interface FriendlyError {
  code?: string;
  message: string;
}

const toFriendlyError = (e: unknown, fallback: string): FriendlyError => {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message || fallback };
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  number: string;
  serial: string;
  clockName: string;
  finger: number;
  /** Se llama tras dar de alta la huella, para refrescar la sección. */
  onApplied: (message: string) => void;
}

/**
 * Registro de una huella en un diálogo de tres pasos: capturar (la estación espera el dedo),
 * revisar la calidad y dar de alta con confirmación. Al abrirse arranca la captura.
 */
/** Código de error de la API a clave de traducción. */
const errorKey = (code?: string): "stationRejected" | "stationAuth" | "qualityLow" | "clockRejected" | "generic" => {
  switch (code) {
    case "FINGERPRINT_STATION_REJECTED":
      return "stationRejected";
    case "FINGERPRINT_STATION_AUTH":
      return "stationAuth";
    case "FINGERPRINT_QUALITY_LOW":
      return "qualityLow";
    case "TIME_CLOCK_REJECTED":
      return "clockRejected";
    default:
      return "generic";
  }
};

export default function FingerprintEnrollDialog({ isOpen, onClose, userId, userName, number, serial, clockName, finger, onApplied }: Props) {
  const { t } = useTranslation("time-clock");
  const [phase, setPhase] = useState<Phase>("capturing");
  const [capture, setCapture] = useState<FingerprintCapture | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<FriendlyError | null>(null);
  const startedAt = useRef(0);
  /** Si el usuario canceló mientras la estación esperaba el dedo, su respuesta se descarta. */
  const cancelled = useRef(false);

  const cancel = () => {
    cancelled.current = true;
    onClose();
  };

  const runCapture = async () => {
    setPhase("capturing");
    setCapture(null);
    setError(null);
    setElapsed(0);
    startedAt.current = Date.now();
    cancelled.current = false;
    try {
      const result = await timeClockApi.fingerprintCapture(userId, serial, finger);
      if (cancelled.current) return;
      setCapture(result);
      setPhase("captured");
    } catch (e) {
      if (cancelled.current) return;
      setError(toFriendlyError(e, t("employeeClock.fingerprint.error")));
      setPhase("captured");
    }
  };

  // Al abrir el diálogo arranca la captura; al cerrarlo se olvida el estado.
  useEffect(() => {
    if (isOpen) void runCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, finger]);

  // Contador de segundos mientras la estación espera el dedo.
  useEffect(() => {
    if (phase !== "capturing") return;
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 250) / 4), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const apply = async () => {
    if (!capture) return;
    setPhase("applying");
    setError(null);
    try {
      await timeClockApi.fingerprintApply(userId, serial, capture.captureId);
      setPhase("done");
      onApplied(t("employeeClock.fingerprint.applied", { clock: clockName }));
    } catch (e) {
      setError(toFriendlyError(e, t("employeeClock.fingerprint.error")));
      setPhase("captured");
    }
  };

  const steps = [t("employeeClock.fingerprint.steps.capture"), t("employeeClock.fingerprint.steps.review"), t("employeeClock.fingerprint.steps.apply")];
  const stepIndex = phase === "capturing" ? 0 : phase === "captured" ? 1 : 2;

  return (
    <ITDialog
      isOpen={isOpen}
      onClose={() => {
        if (phase === "applying") return;
        cancel();
      }}
      title={t("employeeClock.fingerprint.dialogTitle", { finger, clock: clockName })}
      className="max-w-lg"
    >
      <ITFlex direction="column" gap={5} className="mt-2">
        {/* Pasos */}
        <ol className="grid grid-cols-3 gap-2 text-[11px] font-semibold">
          {steps.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                i === stepIndex && phase !== "done" ? "bg-slate-900 text-white" : i < stepIndex || phase === "done" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"
              }`}
            >
              <ITText as="span" className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--it-card-bg)]/20 text-[10px]">
                {i < stepIndex || phase === "done" ? <FaCheck size={9} /> : i + 1}
              </ITText>
              {label}
            </li>
          ))}
        </ol>

        {/* Escáner: la estación espera el dedo */}
        {phase === "capturing" && (
          <ITFlex direction="column" align="center" gap={3} className="py-4">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-300" />
              <ITText as="span" className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[var(--it-card-bg)] text-emerald-600 shadow">
                <FaFingerprint size={40} />
              </ITText>
            </div>
            <ITText className="text-sm font-semibold text-slate-900">{t("employeeClock.fingerprint.placeFinger")}</ITText>
            <ITText className="text-xs text-slate-500">{t("employeeClock.fingerprint.waitingFinger", { finger, seconds: elapsed })}</ITText>
          </ITFlex>
        )}

        {/* Calidad */}
        {(phase === "captured" || phase === "applying") && capture && (
          <ITFlex direction="column" gap={3} className="rounded-xl border border-slate-200 p-4">
            <ITFlex align="center" justify="between" gap={3}>
              <ITText className="text-sm font-semibold text-slate-900">{t("employeeClock.fingerprint.captured", { finger: capture.fingerNo })}</ITText>
              <ITText as="span"
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                  capture.acceptable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {t("employeeClock.fingerprint.qualityValue", { quality: capture.quality })}
              </ITText>
            </ITFlex>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={capture.quality} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${capture.acceptable ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${capture.quality}%` }}
              />
              <span className="absolute top-0 h-full w-px bg-slate-900/60" style={{ left: `${capture.minQuality}%` }} />
            </div>
            <ITText className="text-xs text-slate-500">
              {capture.acceptable
                ? t("employeeClock.fingerprint.qualityOk", { min: capture.minQuality })
                : t("employeeClock.fingerprint.qualityLow", { min: capture.minQuality })}
            </ITText>
          </ITFlex>
        )}

        {/* Alta en curso */}
        {phase === "applying" && (
          <ITFlex align="center" gap={3} className="rounded-xl border border-slate-200 p-4">
            <FaSpinner size={16} className="animate-spin text-slate-700" />
            <ITText className="text-sm text-slate-700">{t("employeeClock.fingerprint.applying")}</ITText>
          </ITFlex>
        )}

        {/* Listo */}
        {phase === "done" && (
          <ITFlex align="center" gap={3} className="rounded-xl bg-emerald-50 p-4">
            <ITText as="span" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--it-card-bg)] text-emerald-600">
              <FaCheck size={14} />
            </ITText>
            <ITText className="text-sm font-semibold text-emerald-700">
              {t("employeeClock.fingerprint.applied", { clock: clockName })}
            </ITText>
          </ITFlex>
        )}

        {error && (
          <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <ITText as="span" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--it-card-bg)] text-red-600">!</ITText>
            <ITStack className="min-w-0" spacing={1}>
              <ITText className="text-sm font-semibold text-red-800">{t(`employeeClock.fingerprint.errors.${errorKey(error.code)}.title`)}</ITText>
              <ITText className="text-xs text-red-700">{t(`employeeClock.fingerprint.errors.${errorKey(error.code)}.hint`)}</ITText>
              <details className="mt-1 text-[11px] text-red-600/80">
                <summary className="cursor-pointer select-none">{t("employeeClock.fingerprint.errors.details")}</summary>
                <ITText className="mt-1 break-words font-mono">{error.message}</ITText>
              </details>
            </ITStack>
          </div>
        )}

        {/* Acciones */}
        <ITFlex justify="end" gap={2}>
          {phase === "done" ? (
            <ITButton variant="filled" color="primary" onClick={onClose}>
              {t("employeeClock.fingerprint.close")}
            </ITButton>
          ) : (
            <>
              <ITButton variant="outlined" color="secondary" disabled={phase === "applying"} onClick={cancel}>
                {t("employeeClock.fingerprint.cancel")}
              </ITButton>
              {phase === "captured" && (
                <ITButton variant="outlined" color="secondary" onClick={() => void runCapture()}>
                  {t("employeeClock.fingerprint.captureAgain")}
                </ITButton>
              )}
              {phase === "captured" && capture?.acceptable && (
                <ITButton variant="filled" color="primary" onClick={() => void apply()}>
                  {t("employeeClock.fingerprint.apply")}
                </ITButton>
              )}
            </>
          )}
        </ITFlex>

        <ITText className="text-[11px] text-slate-400">
          {t("employeeClock.fingerprint.confirmBody", { finger, name: userName, number, clock: clockName })}
        </ITText>
      </ITFlex>
    </ITDialog>
  );
}
