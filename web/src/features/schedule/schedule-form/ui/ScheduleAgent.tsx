import { useEffect, useState } from "react";
import { ITButton, ITFlex, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import type { ScheduleDayInput } from "@entities/schedule";
import { AgentBubble, LangostinChat, UserBubble } from "@shared/ui/langostin-chat";
import OptionChip from "@shared/ui/option-chip/OptionChip";
import { dyn } from "@shared/i18n/dyn";

export interface ScheduleAgentPatch {
  name?: string;
  /** Plantilla de días: los que van en la lista se trabajan, el resto descansa. */
  days: ScheduleDayInput[];
  entryToleranceMin?: number;
  exitToleranceMin?: number;
  mealBreakMin?: number;
  minOvertimeMin?: number;
}

interface Props {
  onApply: (patch: ScheduleAgentPatch) => void;
  /** Borrador en vivo: el preview de la derecha se llena mientras contestas. */
  onDraft?: (patch: ScheduleAgentPatch | null) => void;
}

/** Lunes = 1 … Domingo = 7 (mismo `weekday` que la API). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const DAY_PRESETS: Array<{ key: string; weekdays: number[] }> = [
  { key: "weekdays", weekdays: [1, 2, 3, 4, 5] },
  { key: "weekdaysSaturday", weekdays: [1, 2, 3, 4, 5, 6] },
  { key: "allWeek", weekdays: WEEKDAYS },
  { key: "weekends", weekdays: [6, 7] },
];

const HOUR_PRESETS: Array<{ start: string; end: string; crossesMidnight?: boolean }> = [
  { start: "08:00", end: "16:00" },
  { start: "09:00", end: "18:00" },
  { start: "10:00", end: "19:00" },
  { start: "16:00", end: "00:00", crossesMidnight: true },
  { start: "22:00", end: "06:00", crossesMidnight: true },
];

const SPLIT_PRESETS: Array<{ start: string; end: string }> = [
  { start: "13:00", end: "16:00" },
  { start: "14:00", end: "17:00" },
];

/**
 * Langostín en el alta de horarios: pregunta lo mínimo (nombre, días, horario y
 * jornada partida) y deja el formulario lleno. Al final solo aplica valores; no
 * guarda nada (el guardado sigue siendo el botón del formulario).
 */
export default function ScheduleChat({ onApply, onDraft }: Props) {
  const { t: tt } = useTranslation("schedules");
  const t = dyn(tt);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>(DAY_PRESETS[1].weekdays);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [split, setSplit] = useState(false);
  const [splitStart, setSplitStart] = useState("14:00");
  const [splitEnd, setSplitEnd] = useState("17:00");
  // Lo ya respondido, para pintar la conversación completa al ir y volver.
  const [picked, setPicked] = useState<{ name?: string; days?: string; hours?: string; split?: string; splitTimes?: string; rules?: string }>({});
  const [entryTol, setEntryTol] = useState(10);
  const [exitTol, setExitTol] = useState(10);
  const [meal, setMeal] = useState(0);
  const [minOt, setMinOt] = useState(60);

  const reset = () => {
    setStep(0);
    setName("");
    setWeekdays(DAY_PRESETS[1].weekdays);
    setStart("09:00");
    setEnd("18:00");
    setSplit(false);
    setEntryTol(10);
    setExitTol(10);
    setMeal(0);
    setMinOt(60);
    setPicked({});
  };

  /**
   * La API suma los dos tramos del día. El usuario contesta la jornada completa
   * (09:00–18:00) y, si es partida, **el descanso** (14:00–17:00); se guarda como
   * primer tramo 09:00–14:00 y segundo 17:00–18:00, así las horas no se duplican.
   */
  const splitBlocks = (): { firstEnd: string; secondStart: string } | null => {
    if (!split) return null;
    const toMin = (v: string) => Number(v.split(":")[0]) * 60 + Number(v.split(":")[1]);
    if (toMin(splitStart) <= toMin(start) || toMin(end) <= toMin(splitEnd)) return null;
    return { firstEnd: splitStart, secondStart: splitEnd };
  };

  const buildDays = (): ScheduleDayInput[] => {
    const blocks = splitBlocks();
    return WEEKDAYS.map((weekday) =>
      weekdays.includes(weekday)
        ? {
            weekday,
            startTime: start,
            endTime: blocks ? blocks.firstEnd : end,
            splitStartTime: blocks ? blocks.secondStart : null,
            splitEndTime: blocks ? end : null,
            restDay: false,
          }
        : { weekday, startTime: null, endTime: null, splitStartTime: null, splitEndTime: null, restDay: true },
    );
  };

  // El borrador viaja al preview con cada respuesta (aún sin aplicar).
  useEffect(() => {
    if (!onDraft) return;
    if (step === 0 && !picked.name) {
      onDraft(null);
      return;
    }
    onDraft({
      name: (picked.name ?? name).trim() || undefined,
      days: buildDays(),
      entryToleranceMin: entryTol,
      exitToleranceMin: exitTol,
      mealBreakMin: meal,
      minOvertimeMin: minOt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, picked, weekdays, start, end, split, splitStart, splitEnd, entryTol, exitTol, meal, minOt]);

  const apply = () => {
    const days = buildDays();
    onApply({
      name: name.trim() || undefined,
      days,
      entryToleranceMin: entryTol,
      exitToleranceMin: exitTol,
      mealBreakMin: meal,
      minOvertimeMin: minOt,
    });
  };

  // El avatar va **solo** en la pregunta actual; las anteriores quedan como
  // burbujas sueltas para no repetir la cara en cada paso.
  const bubble = (text: string, withAvatar = false) => <AgentBubble text={text} avatar={withAvatar} />;

  /** Respuesta del usuario, a la derecha, para que se lea como un chat de verdad. */
  const mine = (text: string) => <UserBubble text={text} />;

  const chips = (items: Array<{ label: string; onClick: () => void; emoji?: string }>) => (
    <div className="flex flex-wrap gap-2 pl-11">
      {items.map((item, i) => (
        <OptionChip key={item.label} label={item.label} emoji={item.emoji} delay={i * 40} onClick={item.onClick} />
      ))}
    </div>
  );

  const TOTAL_STEPS = 6;
  const visibleStep = Math.min(step, TOTAL_STEPS);

  const controls = (
    <ITFlex align="center" justify="between" gap={2} wrap="wrap">
      <ITButton
        variant="text"
        color="secondary"
        size="sm"
        onClick={() => setStep((s) => Math.max(0, s - 1))}
        disabled={step === 0}
      >
        <ITText className="text-[11px] font-bold">{t("agent.back")}</ITText>
      </ITButton>
      <ITFlex align="center" gap={2}>
        <ITText className="text-[11px] font-semibold text-slate-400">
          {t("agent.progress", { step: visibleStep + 1, total: TOTAL_STEPS + 1 })}
        </ITText>
        {step >= 6 && (
          <ITButton variant="filled" color="primary" size="sm" onClick={apply}>
            <ITText className="text-[11px] font-bold">{t("agent.apply")}</ITText>
          </ITButton>
        )}
      </ITFlex>
    </ITFlex>
  );

  return (
    <LangostinChat
      title={t("agent.botName")}
      subtitle={t("agent.botSubtitle")}
      online={t("agent.online")}
      restartLabel={t("agent.restart")}
      onRestart={reset}
      height={460}
      footer={controls}
    >
        {/* Conversación: cada pregunta respondida queda en el hilo, así al ir
            atrás y adelante se ve todo lo que ya se contestó. */}
        {bubble(t("agent.hello"))}
        {step >= 2 && bubble(t("agent.qName"))}
        {step >= 1 && picked.name && mine(picked.name)}
        {step >= 3 && bubble(t("agent.qDays"))}
        {step >= 2 && picked.days && mine(picked.days)}
        {step >= 4 && bubble(t("agent.qHours"))}
        {step >= 3 && picked.hours && mine(picked.hours)}
        {step >= 4 && bubble(t("agent.qSplit"))}
        {step >= 4 && picked.split && mine(picked.split)}
        {step >= 5 && split && bubble(t("agent.qSplitTimes"))}
        {step >= 5 && picked.splitTimes && mine(picked.splitTimes)}
        {step >= 6 && bubble(t("agent.qRules"))}
        {step >= 6 && picked.rules && mine(picked.rules)}

        {step === 0 && (
          <>
            {bubble(t("agent.qName"), true)}
            <div className="grid gap-2 pl-11 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <ITInput
                name="agentScheduleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("agent.namePlaceholder")}
                autoFocus
              />
              <ITButton
                variant="filled"
                color="primary"
                size="sm"
                onClick={() => {
                  setPicked((p) => ({ ...p, name: name.trim() || t("agent.namePlaceholder") }));
                  setStep(1);
                }}
              >
                <ITText className="whitespace-nowrap text-[11px] font-bold">{t("agent.next")}</ITText>
              </ITButton>
            </div>
            {chips(
              ["Mañana", "Tarde", "Nocturno", "Administrativo"].map((preset) => ({
                label: preset,
                emoji: "🏷️",
                onClick: () => {
                  setName(preset);
                  setPicked((p) => ({ ...p, name: preset }));
                  setStep(1);
                },
              })),
            )}
          </>
        )}

        {step === 1 && (
          <>
            {bubble(t("agent.qDays"), true)}
            {chips(
              DAY_PRESETS.map((preset) => ({
                label: t(`agent.days.${preset.key}`),
                emoji: "📅",
                onClick: () => {
                  setWeekdays(preset.weekdays);
                  setPicked((p) => ({ ...p, days: t(`agent.days.${preset.key}`) }));
                  setStep(2);
                },
              })),
            )}
          </>
        )}

        {step === 2 && (
          <>
            {bubble(t("agent.qHours"), true)}
            {chips(
              HOUR_PRESETS.map((preset) => ({
                label: `${preset.start} – ${preset.end}`,
                emoji: "🕘",
                onClick: () => {
                  setStart(preset.start);
                  setEnd(preset.end);
                  setPicked((p) => ({ ...p, hours: `${preset.start} – ${preset.end}` }));
                  setStep(3);
                },
              })),
            )}
            <div className="grid gap-2 pl-11 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <ITInput name="agentStart" label={t("entry")} value={start} onChange={(e) => setStart(e.target.value)} placeholder="09:00" />
              <ITInput name="agentEnd" label={t("exit")} value={end} onChange={(e) => setEnd(e.target.value)} placeholder="18:00" />
              <ITButton
                variant="outlined"
                color="secondary"
                size="sm"
                onClick={() => {
                  setPicked((p) => ({ ...p, hours: `${start} – ${end}` }));
                  setStep(3);
                }}
              >
                <ITText className="whitespace-nowrap text-[11px] font-bold">{t("agent.useThese")}</ITText>
              </ITButton>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {bubble(t("agent.qSplit"), true)}
            {chips([
              { label: t("agent.noSplit"), emoji: "➡️", onClick: () => { setSplit(false); setPicked((p) => ({ ...p, split: t("agent.noSplit") })); setStep(5); } },
              { label: t("agent.yesSplit"), emoji: "⏸️", onClick: () => { setSplit(true); setPicked((p) => ({ ...p, split: t("agent.yesSplit") })); setStep(4); } },
            ])}
          </>
        )}

        {step === 4 && split && (
          <>
            {bubble(t("agent.qSplitTimes"), true)}
            {chips(
              SPLIT_PRESETS.map((preset) => ({
                label: `${preset.start} – ${preset.end}`,
                emoji: "🕑",
                onClick: () => {
                  setSplitStart(preset.start);
                  setSplitEnd(preset.end);
                  setPicked((p) => ({ ...p, splitTimes: `${preset.start} – ${preset.end}` }));
                  setStep(5);
                },
              })),
            )}
            <div className="grid gap-2 pl-11 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <ITInput name="agentSplitStart" label={t("secondStart")} value={splitStart} onChange={(e) => setSplitStart(e.target.value)} />
              <ITInput name="agentSplitEnd" label={t("secondEnd")} value={splitEnd} onChange={(e) => setSplitEnd(e.target.value)} />
              <ITButton
                variant="outlined"
                color="secondary"
                size="sm"
                onClick={() => {
                  setPicked((p) => ({ ...p, splitTimes: `${splitStart} – ${splitEnd}` }));
                  setStep(5);
                }}
              >
                <ITText className="whitespace-nowrap text-[11px] font-bold">{t("agent.useThese")}</ITText>
              </ITButton>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            {bubble(t("agent.qRules"), true)}
            <div className="grid gap-2 pl-11 sm:grid-cols-2">
              <ITInput
                name="agentEntryTol"
                label={t("tolEntry")}
                type="number"
                value={String(entryTol)}
                onChange={(e) => setEntryTol(Number(e.target.value))}
              />
              <ITInput
                name="agentExitTol"
                label={t("tolExit")}
                type="number"
                value={String(exitTol)}
                onChange={(e) => setExitTol(Number(e.target.value))}
              />
              <ITInput
                name="agentMeal"
                label={t("meal")}
                type="number"
                value={String(meal)}
                onChange={(e) => setMeal(Number(e.target.value))}
              />
              <ITInput
                name="agentMinOt"
                label={t("minExtra")}
                type="number"
                value={String(minOt)}
                onChange={(e) => setMinOt(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end pl-11">
              <ITButton
                variant="filled"
                color="primary"
                size="sm"
                onClick={() => {
                  setPicked((p) => ({
                    ...p,
                    rules: `${t("tolEntry")} ${entryTol} · ${t("tolExit")} ${exitTol} · ${t("meal")} ${meal} · ${t("minExtra")} ${minOt}`,
                  }));
                  setStep(6);
                }}
              >
                <ITText className="text-[11px] font-bold">{t("agent.useThese")}</ITText>
              </ITButton>
            </div>
          </>
        )}

        {step >= 6 && (
          <>
            {bubble(
              t("agent.summary", {
                days: weekdays.length,
                from: start,
                to: end,
                split: split ? ` · ${splitStart}–${splitEnd}` : "",
              }),
            )}
          </>
        )}
    </LangostinChat>
  );
}
