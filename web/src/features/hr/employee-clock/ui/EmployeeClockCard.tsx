import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ITButton, ITDialog, ITFlex, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { useCan } from "@entities/user";
import type { EmployeeClockStatus } from "@entities/time-clock";
import { useEmployeeClock } from "../model/useEmployeeClock";
import FingerprintPanel from "./FingerprintPanel";

type ClockRow = EmployeeClockStatus["clocks"][number];

const STATE_TONE: Record<NonNullable<ClockRow["state"]> | "NO_RESPONSE", string> = {
  DADA_DE_ALTA: "border-emerald-200 text-emerald-700",
  SIN_ALTA: "border-slate-200 text-slate-600",
  NO_RESPONSE: "border-red-200 text-red-700",
};

/** Alta de la persona en los relojes: estado por reloj, resumen, huellas y alta con confirmación. */
export default function EmployeeClockCard({
  userName,
  userId,
  renderDetail,
  onNumber,
}: {
  userName: string;
  userId: string;
  /** Datos de la persona en un reloj (los pinta la pantalla que sabe de fichas; las features no se importan entre sí). */
  renderDetail?: (serial: string, number: string, aside: React.ReactNode) => React.ReactNode;
  onNumber?: (number: string | null) => void;
}) {
  const { t } = useTranslation("time-clock");
  const fx = useEmployeeClock(userId, true);
  const [target, setTarget] = useState<ClockRow | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const canWrite = useCan("time_clock.write");

  const number = fx.status?.employeeNumber ?? null;
  useEffect(() => {
    onNumber?.(number);
  }, [number, onNumber]);

  const confirm = async () => {
    if (!target) return;
    const ok = await fx.alta(target.serial);
    if (ok) setDone(t("employeeClock.done", { name: userName, clock: target.name }));
    setTarget(null);
  };

  if (fx.loading && !fx.status) return <ITText className="text-sm text-slate-400">{t("employeeClock.loading")}</ITText>;

  return (
    <ITFlex direction="column" gap={3}>
      {!number && <ITText className="text-sm text-amber-700">{t("employeeClock.noNumber")}</ITText>}
      {fx.error && <ITText role="alert" className="text-sm text-red-600">{fx.error}</ITText>}
      {done && <ITText role="status" className="text-sm text-emerald-700">{done}</ITText>}
      {fx.status && fx.status.clocks.length === 0 && <ITText className="text-sm text-slate-400">{t("employeeClock.empty")}</ITText>}

      <ITStack spacing={5}>
        {fx.status?.clocks.map((c) => {
          const tone = c.connection === "NO_RESPONSE" ? STATE_TONE.NO_RESPONSE : STATE_TONE[c.state ?? "SIN_ALTA"];
          const label = c.connection === "NO_RESPONSE" ? t("employeeClock.state.NO_RESPONSE") : t(`employeeClock.state.${c.state ?? "SIN_ALTA"}`);
          const canAdd = canWrite && !!number && c.connection === "ONLINE" && c.state === "SIN_ALTA" && c.canAlta;
          const enrolled = c.state === "DADA_DE_ALTA" && c.connection === "ONLINE" && !!number;
          return (
            <section key={c.serial} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[var(--it-card-bg)] p-5 shadow-sm">
              <header className="flex items-center justify-between gap-3">
                <ITText as="h3" className="truncate text-base font-black text-slate-900">{c.name}</ITText>
                <ITText as="span" className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{label}</ITText>
              </header>

              {enrolled && renderDetail &&
                renderDetail(
                  c.serial,
                  number,
                  c.canAlta ? (
                    <FingerprintPanel
                      userId={userId}
                      userName={userName}
                      number={number}
                      serial={c.serial}
                      clockName={c.name}
                      canWrite={canWrite}
                      onApplied={fx.reload}
                    />
                  ) : null
                )}

              {!enrolled && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
                  <ITText className="text-sm text-slate-500">
                    {c.connection === "NO_RESPONSE" ? t("employeeClock.state.NO_RESPONSE") : t("employeeClock.notEnrolled")}
                  </ITText>
                  {canAdd ? (
                    <ITButton variant="filled" color="primary" size="sm" onClick={() => setTarget(c)}>
                      {t("employeeClock.alta")}
                    </ITButton>
                  ) : (
                    !c.canAlta && <ITText className="text-xs text-slate-400">{t("employeeClock.readOnly")}</ITText>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </ITStack>

      <ITDialog
        isOpen={!!target}
        onClose={() => setTarget(null)}
        title={t("employeeClock.confirmTitle", { clock: target?.name ?? "" })}
        className="max-w-md"
      >
        <ITFlex direction="column" gap={4} className="mt-2">
          <ITText className="text-sm text-slate-600">
            {t("employeeClock.confirmBody", { name: userName, number: number ?? "", clock: target?.name ?? "" })}
          </ITText>
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" color="secondary" onClick={() => setTarget(null)}>
              {t("people.actions.no")}
            </ITButton>
            <ITButton variant="filled" color="primary" disabled={fx.loading} onClick={() => void confirm()}>
              {t("employeeClock.alta")}
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>
    </ITFlex>
  );
}
