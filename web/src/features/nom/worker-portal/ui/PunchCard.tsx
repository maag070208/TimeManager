import type { ReactNode } from "react";
import { ITBadget, ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuCheck, LuClock, LuCoffee, LuLock, LuLogIn, LuLogOut, LuMapPin, LuUtensils } from "react-icons/lu";
import type { PunchType, RecordAgreementProposal } from "@entities/nom";
import { useTenantTimezone } from "@entities/user";
import { dayLabelOf } from "./format";
import type { PunchStage } from "../model/useMyWorkday";

const PUNCH_ICON: Record<PunchType, ReactNode> = {
  ENTRY: <LuLogIn size={18} />,
  LUNCH_START: <LuUtensils size={18} />,
  LUNCH_END: <LuCoffee size={18} />,
  EXIT: <LuLogOut size={18} />,
};

export interface PunchCardProps {
  className?: string;
  tr: (key: string, vars?: Record<string, unknown>) => string;
  /** Hora que se muestra en el botón (reloj de la página). */
  clock: string;
  status: { label: string; tone: string };
  labels: Record<PunchType, string>;
  /** Pasos que la secuencia permite ahora; el primero es el botón grande. */
  nextTypes: PunchType[];
  canPunch: boolean;
  hasClock: boolean;
  appOnly: boolean;
  geoEnabled: boolean;
  /** Falta aceptar el acuerdo de método: el botón acepta y checa en un clic. */
  agreementLocked: boolean;
  proposal: RecordAgreementProposal | null;
  /** Etapa de la checada en curso; `null` si no hay ninguna. */
  stage: PunchStage | "accepting" | null;
  onPunch: (type: PunchType) => void;
  onAcceptAndPunch: () => void;
}

const Notice = ({ icon, tone, title, hint }: { icon: ReactNode; tone: string; title: string; hint: string }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
    <span className="flex flex-col">
      <span className="text-[18px] font-extrabold leading-tight text-slate-900">{title}</span>
      <span className="text-[12.5px] text-slate-600">{hint}</span>
    </span>
  </div>
);

/** Checada del día: un botón grande con el siguiente paso y su avance mientras se registra. */
export const PunchCard = ({
  className, tr, clock, status, labels, nextTypes, canPunch, hasClock, appOnly, geoEnabled,
  agreementLocked, proposal, stage, onPunch, onAcceptAndPunch,
}: PunchCardProps) => {
  const timezone = useTenantTimezone();
  const primaryNext = nextTypes[0];
  const busy = stage !== null;
  const stageLabel = stage ? tr(`punch.stage.${stage}`) : null;
  const primaryLabel = !primaryNext
    ? ""
    : primaryNext === "ENTRY" || primaryNext === "EXIT"
      ? tr("punch.register", { action: labels[primaryNext] })
      : labels[primaryNext];

  return (
    <ITCard className={`tm-hero-card tm-hero-card--mint ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
      <ITFlex direction="column" gap={4}>
        <ITFlex align="center" justify="between" gap={2} wrap="wrap">
          <ITFlex direction="column" gap={0.5}>
            <ITText muted className="!text-[11px] font-semibold uppercase tracking-[0.08em]">{tr("punch.today")}</ITText>
            <ITText className="!text-[15px] font-bold">
              {dayLabelOf(new Date(), timezone)}
            </ITText>
          </ITFlex>
          <ITBadget color={status.tone as never} size="sm">{status.label}</ITBadget>
        </ITFlex>

        {!canPunch ? (
          <Notice
            icon={<LuClock size={18} />}
            tone="bg-slate-200 text-slate-600"
            title={tr(hasClock ? "punch.clockOnlyTitle" : appOnly ? "punch.appOnlyTitle" : "punch.remoteOffTitle")}
            hint={tr(hasClock ? "punch.clockOnlyHint" : appOnly ? "punch.appOnlyHint" : "punch.remoteOffHint")}
          />
        ) : agreementLocked ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <LuLock size={18} />
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">{tr("punch.agreementLockedEyebrow")}</span>
                <span className="text-[18px] font-extrabold leading-tight text-slate-900">{tr("agreements.methodTitle")}</span>
              </span>
            </span>
            {proposal && (
              <>
                <span className="text-[13px] leading-relaxed text-slate-700">{proposal.text}</span>
                <ITFlex gap={1} wrap="wrap">
                  {proposal.methods.map((method) => (
                    <ITBadget key={method} color="info" size="sm">{tr(`agreements.methods.${method}`)}</ITBadget>
                  ))}
                </ITFlex>
              </>
            )}
            <button
              type="button"
              disabled={!proposal || busy}
              aria-busy={busy}
              onClick={onAcceptAndPunch}
              className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl bg-slate-900 px-4 py-3 text-left text-white transition hover:bg-slate-800 disabled:cursor-progress"
            >
              <span className="flex items-center gap-2 text-[15px] font-bold" aria-live="polite">
                <LuCheck size={18} />
                {stageLabel ?? (primaryNext ? tr("punch.acceptAndPunch", { action: labels[primaryNext].toLowerCase() }) : tr("agreements.methodAccept"))}
              </span>
              <span className="text-[18px] font-black tabular-nums">{clock}</span>
              {busy && <span className="tm-punch-progress" />}
            </button>
          </div>
        ) : primaryNext ? (
          <>
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => onPunch(primaryNext)}
              className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-4 text-left text-slate-900 transition hover:brightness-[0.99] disabled:cursor-progress"
              style={{ backgroundColor: "#eaf6ef", borderColor: "#d1fae5", color: "#0f172a" }}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  {PUNCH_ICON[primaryNext]}
                </span>
                <span className="flex flex-col" aria-live="polite">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {busy ? primaryLabel : tr("punch.next")}
                  </span>
                  <span className="text-[18px] font-extrabold leading-tight text-slate-900">{stageLabel ?? primaryLabel}</span>
                </span>
              </span>
              <span className="text-[20px] font-black tabular-nums text-slate-900">{clock}</span>
              {busy && <span className="tm-punch-progress" />}
            </button>
            {nextTypes.slice(1).map((type) => (
              <ITButton key={type} variant="outlined" color="secondary" className="w-full" disabled={busy} onClick={() => onPunch(type)}>
                <span className="inline-flex items-center justify-center gap-2">
                  {PUNCH_ICON[type]}
                  {type === "EXIT" ? tr("punch.register", { action: labels[type] }) : labels[type]}
                </span>
              </ITButton>
            ))}
          </>
        ) : (
          <Notice
            icon={<LuCalendarCheck size={18} />}
            tone="bg-emerald-100 text-emerald-700"
            title={tr("punch.dayClosed")}
            hint={tr("punch.dayClosedHint")}
          />
        )}
        {canPunch && !agreementLocked && (
          <ITText muted className="!text-[11.5px]">{tr(hasClock ? "punch.channelHint" : "punch.channelHintNoClock")}</ITText>
        )}
        {canPunch && geoEnabled && (
          <ITText muted className="flex items-start gap-1.5 !text-[11.5px]">
            <LuMapPin size={13} className="mt-0.5 shrink-0" />
            <span>{tr("punch.locationNotice")}</span>
          </ITText>
        )}
      </ITFlex>
    </ITCard>
  );
};
