import type { ReactNode } from "react";
import { ITBadget } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuCheck, LuClock, LuCoffee, LuLock, LuLogIn, LuLogOut, LuMapPin, LuUtensils } from "react-icons/lu";
import type { PunchType, RecordAgreementProposal } from "@entities/nom";
import { useTenantTimezone } from "@entities/user";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { dayLabelOf } from "./format";
import { HeroCard, HeroHeader, Notice, QuietLink, SolidButton, type HeroTone } from "./shared";
import type { PunchStage } from "../model/useMyWorkday";

const icon = (type: PunchType, size: number): ReactNode =>
  ({
    ENTRY: <LuLogIn size={size} />,
    LUNCH_START: <LuUtensils size={size} />,
    LUNCH_END: <LuCoffee size={size} />,
    EXIT: <LuLogOut size={size} />,
  })[type];

/** Tono bento de cada paso: color sólido del botón y tono de su KPI. */
const STEP_TONE: Record<PunchType, { solid: string; kpi: "success" | "warning" | "info" | "neutral" }> = {
  ENTRY: { solid: "#059669", kpi: "success" },
  LUNCH_START: { solid: "#d97706", kpi: "warning" },
  LUNCH_END: { solid: "#0284c7", kpi: "info" },
  EXIT: { solid: "#1e293b", kpi: "neutral" },
};

/** Ola del hero según el estado del día. */
const HERO_TONE: Record<string, HeroTone> = {
  success: "mint",
  warning: "amber",
  gray: "slate",
};

export interface PunchCardProps {
  className?: string;
  tr: (key: string, vars?: Record<string, unknown>) => string;
  /** Hora que se muestra en grande (reloj de la página). */
  clock: string;
  status: { label: string; tone: string };
  labels: Record<PunchType, string>;
  /** Pasos del día en orden, con la hora en que se registró cada uno. */
  steps: Array<{ type: PunchType; time: string | null }>;
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

/** Checada del día en bento: reloj, avance, botón del siguiente paso y los pasos como KPIs. */
export const PunchCard = ({
  className, tr, clock, status, labels, steps, nextTypes, canPunch, hasClock, appOnly, geoEnabled,
  agreementLocked, proposal, stage, onPunch, onAcceptAndPunch,
}: PunchCardProps) => {
  const timezone = useTenantTimezone();
  const primaryNext = nextTypes[0];
  const busy = stage !== null;
  const stageLabel = stage ? tr(`punch.stage.${stage}`) : null;
  const actionLabel = (type: PunchType) =>
    type === "ENTRY" || type === "EXIT" ? tr("punch.register", { action: labels[type] }) : labels[type];
  const done = steps.filter((step) => step.time !== null).length;

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <HeroCard tone={HERO_TONE[status.tone] ?? "sky"}>
          <HeroHeader
            eyebrow={tr("punch.today")}
            title={<span className="capitalize">{dayLabelOf(new Date(), timezone)}</span>}
            aside={<ITBadget color={status.tone as never} size="sm">{status.label}</ITBadget>}
          />

          <div className="mt-3 flex items-end justify-between gap-2">
            <span className="text-[48px] font-black leading-none tracking-tight tabular-nums">{clock}</span>
            <span className="pb-1 text-[11.5px] font-semibold text-slate-500">{done} de {steps.length} checadas</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70">
            <div className="dash-bar h-full rounded-full bg-emerald-400" style={{ width: `${steps.length ? Math.round((done / steps.length) * 100) : 0}%` }} />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {!canPunch ? (
              <Notice
                icon={<LuClock size={18} />}
                chip="bg-slate-100 text-slate-600"
                title={tr(hasClock ? "punch.clockOnlyTitle" : appOnly ? "punch.appOnlyTitle" : "punch.remoteOffTitle")}
                hint={tr(hasClock ? "punch.clockOnlyHint" : appOnly ? "punch.appOnlyHint" : "punch.remoteOffHint")}
              />
            ) : agreementLocked ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-amber-50/80 p-4">
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <LuLock size={18} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-amber-700">{tr("punch.agreementLockedEyebrow")}</span>
                    <span className="text-[17px] font-extrabold leading-tight text-slate-900">{tr("agreements.methodTitle")}</span>
                  </span>
                </span>
                {proposal && (
                  <>
                    <span className="text-[13px] leading-relaxed text-slate-700">{proposal.text}</span>
                    <span className="flex flex-wrap gap-1">
                      {proposal.methods.map((method) => (
                        <ITBadget key={method} color="info" size="sm">{tr(`agreements.methods.${method}`)}</ITBadget>
                      ))}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  disabled={!proposal || busy}
                  aria-busy={busy}
                  onClick={onAcceptAndPunch}
                  style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                  className="relative flex w-full items-center gap-2 overflow-hidden rounded-2xl px-4 py-3 text-left text-[15px] font-bold transition disabled:cursor-progress"
                >
                  <LuCheck size={18} />
                  <span aria-live="polite">
                    {stageLabel ?? (primaryNext ? tr("punch.acceptAndPunch", { action: labels[primaryNext].toLowerCase() }) : tr("agreements.methodAccept"))}
                  </span>
                  {busy && <span className="tm-punch-progress" />}
                </button>
              </div>
            ) : primaryNext ? (
              <>
                <SolidButton
                  color={STEP_TONE[primaryNext].solid}
                  icon={icon(primaryNext, 24)}
                  eyebrow={busy ? actionLabel(primaryNext) : tr("punch.next")}
                  label={stageLabel ?? actionLabel(primaryNext)}
                  busy={busy}
                  cta
                  onClick={() => onPunch(primaryNext)}
                />
                {nextTypes.includes("EXIT") && primaryNext !== "EXIT" && (
                  <QuietLink disabled={busy} onClick={() => onPunch("EXIT")}>
                    {primaryNext === "LUNCH_START" ? "¿No sales a comer? Registrar salida" : "Registrar salida"}
                  </QuietLink>
                )}
              </>
            ) : (
              <Notice
                icon={<LuCalendarCheck size={18} />}
                chip="bg-emerald-50 text-emerald-700"
                title={tr("punch.dayClosed")}
                hint={tr("punch.dayClosedHint")}
              />
            )}
            {canPunch && geoEnabled && (
              <span className="mt-1 flex items-start gap-1.5 text-[11.5px] text-slate-500">
                <LuMapPin size={13} className="mt-0.5 shrink-0" />
                <span>{tr("punch.locationNotice")}</span>
              </span>
            )}
          </div>
      </HeroCard>

      <BentoKpiGrid
        minItemWidth={140}
        items={steps.map((step) => ({
          id: step.type,
          label: labels[step.type],
          value: step.time ?? "—",
          caption: step.time ? "Registrada" : step.type === primaryNext ? "Siguiente" : "Pendiente",
          icon: step.time ? <LuCheck size={14} /> : icon(step.type, 14),
          tone: step.time ? STEP_TONE[step.type].kpi : "neutral",
        }))}
      />
    </div>
  );
};
