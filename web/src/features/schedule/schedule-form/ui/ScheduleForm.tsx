import { useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITCheckbox,
  ITConfirmDialog,
  ITButton,
  ITFlex,
  ITInput,
  ITText,
  ITTimePicker,
  ITToast, ITStack } from "@axzydev/axzy_ui_system";
import { FaRegClock, FaSave } from "react-icons/fa";
import { LuCalendarDays, LuCopyCheck, LuPlus, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { scheduleApi, type ScheduleDayInput, type ScheduleInput } from "@entities/schedule";
import { dyn } from "@shared/i18n/dyn";
import { PanelCard } from "@shared/ui/panel-card";
import { formatMinutesAsHhMm } from "@shared/utils/dates";
import { DAY_INITIALS, dayMinutes, daysWorked, restDays, suggestedName, weeklyMinutes } from "../model/summary";
import { i18n } from "@shared/i18n";
import { useGoBack } from "@shared/lib/useGoBack";
import { ContentSkeleton } from "@shared/ui/content-skeleton";

const DEFAULT_START = "08:00";
const DEFAULT_END = "16:00";
const DEFAULT_MEAL_START = "12:00";
const DEFAULT_MEAL_END = "13:00";

const emptyDays = (): ScheduleDayInput[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    startTime: "08:00",
    endTime: "16:00",
    splitStartTime: null,
    splitEndTime: null,
    mealStartTime: weekday === 7 ? null : DEFAULT_MEAL_START,
    mealEndTime: weekday === 7 ? null : DEFAULT_MEAL_END,
    restDay: weekday === 7,
  }));

const emptyForm = (): ScheduleInput => ({
  name: suggestedName(emptyDays()),
  entryToleranceMin: 10,
  exitToleranceMin: 10,
  mealBreakMin: 60,
  minOvertimeMin: 60,
  crossesMidnight: false,
  days: emptyDays(),
});

function ActionBar({
  saving,
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
}: {
  saving: boolean;
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <ITFlex justify="end" gap={2}>
      <ITButton variant="outlined" color="secondary" className="tm-save-button" onClick={onCancel}>
        {cancelLabel}
      </ITButton>
      <ITButton variant="filled" color="primary" className="tm-save-button" onClick={onSave} disabled={saving}>
        <ITFlex align="center" gap={1}>
          <FaSave size={12} />
          <ITText className="font-semibold text-[12px]">{saveLabel}</ITText>
        </ITFlex>
      </ITButton>
    </ITFlex>
  );
}

export default function ScheduleForm({ id }: { id?: string }) {
  const { t } = useTranslation("schedules");
  const goBack = useGoBack();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<ScheduleInput>(emptyForm());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Mientras no escriban el nombre, se propone a partir de los días y horas.
  const [nameTouched, setNameTouched] = useState(isEdit);
  // Horario base: se aplica a todos los días laborales con un botón.
  const [base, setBase] = useState({ start: DEFAULT_START, end: DEFAULT_END, mealStart: DEFAULT_MEAL_START, mealEnd: DEFAULT_MEAL_END });
  // Días donde se abrió el segundo turno (jornada partida).
  const [splitOpen, setSplitOpen] = useState<number[]>([]);

  const view = form;
  const viewSummary = useMemo(
    () => ({
      days: daysWorked(view.days),
      rest: restDays(view.days),
      weekly: weeklyMinutes(view.days, view.mealBreakMin ?? 0),
    }),
    [view.days, view.mealBreakMin],
  );

  const setDays = (change: (days: ScheduleDayInput[]) => ScheduleDayInput[]) => {
    setForm((current) => {
      const days = change(current.days);
      const crossesMidnight = days.some((day) => !day.restDay && day.startTime && day.endTime && day.endTime < day.startTime);
      return { ...current, days, crossesMidnight, name: nameTouched ? current.name : suggestedName(days) };
    });
    setError(null);
  };

  const updateDay = (weekday: number, patch: Partial<ScheduleDayInput>) =>
    setDays((days) => days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));

  /** Prender/apagar un día: al volverlo laboral llega con el horario base si no tenía horas. */
  const toggleWorkday = (weekday: number) =>
    setDays((days) =>
      days.map((day) =>
        day.weekday !== weekday
          ? day
          : day.restDay
            ? {
                ...day,
                restDay: false,
                startTime: day.startTime || base.start,
                endTime: day.endTime || base.end,
                mealStartTime: day.mealStartTime || base.mealStart || null,
                mealEndTime: day.mealEndTime || base.mealEnd || null,
              }
            : { ...day, restDay: true }
      )
    );

  /** Copia el horario base (entrada, salida y comida) a todos los días laborales, sin tocar descansos ni segundos turnos. */
  const applyBase = () =>
    setDays((days) =>
      days.map((day) =>
        day.restDay
          ? day
          : { ...day, startTime: base.start, endTime: base.end, mealStartTime: base.mealStart || null, mealEndTime: base.mealEnd || null }
      )
    );

  const closeSplit = (weekday: number) => {
    setSplitOpen((open) => open.filter((n) => n !== weekday));
    updateDay(weekday, { splitStartTime: null, splitEndTime: null });
  };

  useEffect(() => {
    if (!id) return;
    scheduleApi
      .list(true)
      .then((rows) => {
        const h = rows.find((x) => x.id === id);
        if (!h) {
          setError(i18n.t("schedules:form.notFound"));
          return;
        }
        setForm({
          name: h.name,
          entryToleranceMin: h.entryToleranceMin,
          exitToleranceMin: h.exitToleranceMin,
          mealBreakMin: h.mealBreakMin,
          minOvertimeMin: h.minOvertimeMin,
          crossesMidnight: h.crossesMidnight,
          days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const existing = h.days.find((day) => day.weekday === weekday);
            return existing
              ? {
                  weekday,
                  startTime: existing.startTime,
                  endTime: existing.endTime,
                  splitStartTime: existing.splitStartTime,
                  splitEndTime: existing.splitEndTime,
                  mealStartTime: existing.mealStartTime ?? null,
                  mealEndTime: existing.mealEndTime ?? null,
                  restDay: existing.restDay,
                }
              : {
                  weekday,
                  startTime: "09:00",
                  endTime: "18:00",
                  splitStartTime: null,
                  splitEndTime: null,
                  restDay: true,
                };
          }),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Al editar, el horario base arranca con el primer día laboral del horario cargado.
  useEffect(() => {
    if (!isEdit || loading) return;
    const first = form.days.find((day) => !day.restDay);
    if (first?.startTime && first.endTime) {
      setBase({ start: first.startTime, end: first.endTime, mealStart: first.mealStartTime ?? "", mealEnd: first.mealEndTime ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, loading]);


  /** Pide el nombre y abre la confirmación: guardar un horario es un alta. */
  const save = () => {
    if (!form.name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (form.days.some((day) => !day.restDay && Boolean(day.mealStartTime) !== Boolean(day.mealEndTime))) {
      setError(t("form.mealIncomplete"));
      return;
    }
    setConfirmOpen(true);
  };

  const doSave = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setError(null);
    try {
      if (isEdit) await scheduleApi.update(id!, form);
      else await scheduleApi.create(form);
      setToast(t("save"));
      setTimeout(() => goBack("/schedules"), 500);
    } catch (e) {
      setError((e as Error).message ?? t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Lo que el API rechazaría al guardar: se avisa antes, en el resumen.
  const longDays = form.days.filter((day) => dayMinutes(day, form.mealBreakMin ?? 0) > 12 * 60).map((day) => day.weekday);

  const summary = useMemo(
    () => ({
      days: daysWorked(form.days),
      rest: restDays(form.days),
      weekly: weeklyMinutes(form.days, form.mealBreakMin ?? 0),
    }),
    [form.days, form.mealBreakMin]
  );

  if (loading) {
    return (
      <ContentSkeleton />
    );
  }





  return (
    <ITFlex direction="column" gap={4}>
      {/* Acciones arriba */}
      <ActionBar
        saving={saving}
        cancelLabel={t("cancel")}
        saveLabel={t("save")}
        onCancel={() => goBack("/schedules")}
        onSave={save}
      />

      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      <div className="grid items-start gap-4 xl:!grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PanelCard title="Datos del horario" icon={<FaRegClock size={16} />} className="tm-hero-card tm-hero-card--mint">
            <ITFlex direction="column" gap={4}>
              <ITInput
                name="name"
                label={t("name")}
                placeholder={t("namePlaceholder")}
                value={view.name}
                onChange={(event) => {
                  setNameTouched(true);
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
              />
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <ITInput name="entryToleranceMin" type="number" label={t("tolEntry")} value={String(form.entryToleranceMin)} onChange={(event) => setForm((current) => ({ ...current, entryToleranceMin: Number(event.target.value) }))} />
                <ITInput name="exitToleranceMin" type="number" label={t("tolExit")} value={String(form.exitToleranceMin)} onChange={(event) => setForm((current) => ({ ...current, exitToleranceMin: Number(event.target.value) }))} />
                <ITInput name="mealBreakMin" type="number" label={t("mealFallback")} value={String(form.mealBreakMin)} onChange={(event) => setForm((current) => ({ ...current, mealBreakMin: Number(event.target.value) }))} />
                <ITInput name="minOvertimeMin" type="number" label={t("minExtra")} value={String(form.minOvertimeMin)} onChange={(event) => setForm((current) => ({ ...current, minOvertimeMin: Number(event.target.value) }))} />
              </div>
            </ITFlex>
          </PanelCard>

          <PanelCard title="Días y horario" icon={<LuCalendarDays size={16} />} className="tm-hero-card tm-hero-card--amber">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <ITText className="!text-[13px] font-bold !text-slate-800">{t("form.baseTitle")}</ITText>
              <div>
                <ITText className="mb-1.5 block !text-[12px] font-semibold text-slate-600">{t("form.workdays")}</ITText>
                <div className="flex flex-wrap gap-1.5">
                  {form.days.map((day) => (
                    <button
                      key={day.weekday}
                      type="button"
                      aria-pressed={!day.restDay}
                      title={dyn(t)(`day${day.weekday}`)}
                      onClick={() => toggleWorkday(day.weekday)}
                      className="h-9 w-9 rounded-full text-[12.5px] font-bold transition hover:brightness-95"
                      style={day.restDay ? { backgroundColor: "#f1f5f9", color: "#94a3b8" } : { backgroundColor: "#0f172a", color: "#ffffff" }}
                    >
                      {DAY_INITIALS[day.weekday - 1]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <ITTimePicker name="baseStart" label={t("entry")} value={base.start} onChange={(event) => setBase((current) => ({ ...current, start: event.target.value }))} />
                <ITTimePicker name="baseEnd" label={t("exit")} value={base.end} onChange={(event) => setBase((current) => ({ ...current, end: event.target.value }))} />
                <ITTimePicker name="baseMealStart" label={t("form.mealFrom")} value={base.mealStart} onChange={(event) => setBase((current) => ({ ...current, mealStart: event.target.value }))} />
                <ITTimePicker name="baseMealEnd" label={t("form.mealTo")} value={base.mealEnd} onChange={(event) => setBase((current) => ({ ...current, mealEnd: event.target.value }))} />
                <ITButton variant="filled" color="primary" onClick={applyBase}>
                  <span className="inline-flex items-center gap-1.5">
                    <LuCopyCheck size={14} /> {t("form.applyAll")}
                  </span>
                </ITButton>
              </div>
              <ITText muted className="block !text-[11.5px]">{t("form.baseHint")}</ITText>
            </div>

            <div className="hidden px-3 pb-1 md:grid md:grid-cols-[110px_1fr_1fr_1fr_1fr_auto] md:gap-3">
              {["", t("entry"), t("exit"), t("form.mealFrom"), t("form.mealTo"), ""].map((label, index) => (
                <ITText key={index} muted className="!text-[11px] font-semibold uppercase tracking-[0.06em]">{label}</ITText>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {form.days.map((day) => {
                const hasSplit = splitOpen.includes(day.weekday) || Boolean(day.splitStartTime || day.splitEndTime);
                return (
                  <div key={day.weekday} className={`rounded-xl p-3 ${day.restDay ? "bg-slate-50/40" : "bg-slate-50/70"}`}>
                    <div className="grid items-center gap-3 md:grid-cols-[110px_1fr_1fr_1fr_1fr_auto]">
                      <ITText className={`!text-[12.5px] font-bold ${day.restDay ? "!text-slate-400" : "!text-slate-700"}`}>{dyn(t)(`day${day.weekday}`)}</ITText>
                      {day.restDay ? (
                        <ITText muted className="!text-[12px] md:col-span-4">{t("rest")}</ITText>
                      ) : (
                        <>
                          <ITTimePicker name={`start-${day.weekday}`} size="sm" value={day.startTime ?? ""} onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })} />
                          <ITTimePicker name={`end-${day.weekday}`} size="sm" value={day.endTime ?? ""} onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })} />
                          <ITTimePicker name={`mealStart-${day.weekday}`} size="sm" placeholder={t("form.noMeal")} value={day.mealStartTime ?? ""} onChange={(event) => updateDay(day.weekday, { mealStartTime: event.target.value || null })} />
                          <ITTimePicker name={`mealEnd-${day.weekday}`} size="sm" placeholder={t("form.noMeal")} value={day.mealEndTime ?? ""} onChange={(event) => updateDay(day.weekday, { mealEndTime: event.target.value || null })} />
                        </>
                      )}
                      <ITCheckbox
                        name={`restDay-${day.weekday}`}
                        label={t("rest")}
                        checked={day.restDay}
                        onChange={() => toggleWorkday(day.weekday)}
                      />
                    </div>
                    {!day.restDay && (
                      hasSplit ? (
                        <div className="mt-2 grid items-end gap-3 md:grid-cols-[110px_1fr_1fr_auto]">
                          <ITText muted className="!text-[11.5px] font-semibold">{t("second")}</ITText>
                          <ITTimePicker name={`splitStart-${day.weekday}`} size="sm" value={day.splitStartTime ?? ""} onChange={(event) => updateDay(day.weekday, { splitStartTime: event.target.value || null })} />
                          <ITTimePicker name={`splitEnd-${day.weekday}`} size="sm" value={day.splitEndTime ?? ""} onChange={(event) => updateDay(day.weekday, { splitEndTime: event.target.value || null })} />
                          <ITButton variant="text" color="secondary" size="sm" aria-label={t("form.removeSecond")} title={t("form.removeSecond")} onClick={() => closeSplit(day.weekday)}>
                            <LuX size={14} />
                          </ITButton>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-800"
                          onClick={() => setSplitOpen((open) => [...open, day.weekday])}
                        >
                          <LuPlus size={12} /> {t("form.addSecond")}
                        </button>
                      )
                    )}
                    {!day.restDay && Boolean(day.mealStartTime) !== Boolean(day.mealEndTime) && (
                      <ITText className="mt-2 block !text-[11.5px] font-semibold text-amber-700">{t("form.mealIncomplete")}</ITText>
                    )}
                    {!day.restDay && day.startTime && day.endTime && day.endTime < day.startTime && (
                      <ITText className="mt-2 block !text-[11.5px] font-semibold text-amber-700">{t("form.nextDay")}</ITText>
                    )}
                  </div>
                );
              })}
            </div>
          </PanelCard>
        </div>

        <PanelCard title="Resumen del horario" icon={<FaRegClock size={16} />} className="tm-hero-card tm-hero-card--sky xl:sticky xl:top-4">
          <ITFlex direction="column" gap={3}>
            <ITStack>
              {view.days.map((d) => (
                <div key={d.weekday} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
                  <ITText as="span" className="text-[12px] font-semibold text-slate-600">{dyn(t)(`day${d.weekday}`)}</ITText>
                  {d.restDay ? (
                    <ITText as="span" className="text-[11px] font-semibold text-slate-400">{t("rest")}</ITText>
                  ) : (
                    <ITText as="span" className="text-right text-[11px] font-bold tabular-nums text-slate-800">
                      {d.startTime || "—"}–{d.endTime || "—"}
                      {d.splitStartTime ? <ITText as="span" className="block font-medium text-slate-500">{t("second")} {d.splitStartTime}–{d.splitEndTime}</ITText> : null}
                      {d.mealStartTime && d.mealEndTime ? <ITText as="span" className="block font-medium text-slate-500">{t("form.mealShort")} {d.mealStartTime}–{d.mealEndTime}</ITText> : null}
                    </ITText>
                  )}
                </div>
              ))}
            </ITStack>

            {(viewSummary.rest === 0 || longDays.length > 0) && (
              <div className="flex flex-col gap-1 rounded-xl bg-amber-50 px-3 py-2">
                {viewSummary.rest === 0 && <ITText className="block !text-[12px] font-semibold text-amber-800">{t("form.needsRest")}</ITText>}
                {longDays.map((weekday) => (
                  <ITText key={weekday} className="block !text-[12px] font-semibold text-amber-800">{t("form.over12", { day: dyn(t)(`day${weekday}`) })}</ITText>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              <div><ITText className="text-[11px] font-semibold text-slate-500">{t("summary.days")}</ITText><ITText className="block text-[15px] font-black tabular-nums text-slate-800">{viewSummary.days}/7</ITText></div>
              <div><ITText className="text-[11px] font-semibold text-slate-500">{t("summary.restDays")}</ITText><ITText className="block text-[15px] font-black tabular-nums text-slate-800">{viewSummary.rest}</ITText></div>
              <div><ITText className="text-[11px] font-semibold text-slate-500">{t("summary.weeklyHours")}</ITText><ITText className="block text-[15px] font-black tabular-nums text-slate-800">{formatMinutesAsHhMm(viewSummary.weekly)}</ITText></div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <ITText className="mb-1 text-[11px] font-semibold text-slate-500">{t("sections.rules")}</ITText>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[11px] text-slate-600">
                <li className="flex justify-between gap-2"><ITText as="span">{t("tolEntry")}</ITText><ITText as="b">{view.entryToleranceMin}</ITText></li>
                <li className="flex justify-between gap-2"><ITText as="span">{t("tolExit")}</ITText><ITText as="b">{view.exitToleranceMin}</ITText></li>
                <li className="flex justify-between gap-2"><ITText as="span">{t("mealFallback")}</ITText><ITText as="b">{view.mealBreakMin}</ITText></li>
                <li className="flex justify-between gap-2"><ITText as="span">{t("minExtra")}</ITText><ITText as="b">{view.minOvertimeMin}</ITText></li>
                {view.crossesMidnight && <li className="font-semibold text-slate-700">{t("crossesMidnight")}</li>}
              </ul>
            </div>
            <ITText className="text-[11px] text-slate-500">Se actualiza mientras editas el horario.</ITText>
          </ITFlex>
        </PanelCard>
      </div>

      <ITConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void doSave()}
        title={t("form.confirmTitle")}
        message={t("form.confirmMessage", {
          name: form.name.trim(),
          days: summary.days,
          weekly: formatMinutesAsHhMm(summary.weekly),
        })}
        confirmLabel={t("save")}
        cancelLabel={t("cancel")}
      />

      {toast && (
        <ITToast
          message={toast}
          type="success"
          position="bottom-center"
          duration={2000}
          onClose={() => setToast(null)}
        />
      )}
    </ITFlex>
  );
}
