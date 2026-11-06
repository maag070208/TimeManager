import { useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITCheckbox,
  ITConfirmDialog,
  ITButton,
  ITFlex,
  ITInput,
  ITText,
  ITToast, ITStack } from "@axzydev/axzy_ui_system";
import { FaRegClock, FaSave } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { scheduleApi, type ScheduleDayInput, type ScheduleInput } from "@entities/schedule";
import { dyn } from "@shared/i18n/dyn";
import { PanelCard } from "@shared/ui/panel-card";
import { formatMinutesAsHhMm } from "@shared/utils/dates";
import { daysWorked, restDays, weeklyMinutes } from "../model/summary";
import { i18n } from "@shared/i18n";
import { useGoBack } from "@shared/lib/useGoBack";
import { ContentSkeleton } from "@shared/ui/content-skeleton";

const emptyDays = (): ScheduleDayInput[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    startTime: "08:00",
    endTime: "16:00",
    splitStartTime: null,
    splitEndTime: null,
    restDay: weekday === 7,
  }));

const emptyForm = (): ScheduleInput => ({
  name: "",
  entryToleranceMin: 10,
  exitToleranceMin: 10,
  mealBreakMin: 0,
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

  const view = form;
  const viewSummary = useMemo(
    () => ({
      days: daysWorked(view.days),
      rest: restDays(view.days),
      weekly: weeklyMinutes(view.days, view.mealBreakMin ?? 0),
    }),
    [view.days, view.mealBreakMin],
  );

  const updateDay = (weekday: number, patch: Partial<ScheduleDayInput>) => {
    setForm((current) => {
      const days = current.days.map((day) => day.weekday === weekday ? { ...day, ...patch } : day);
      const crossesMidnight = days.some((day) => !day.restDay && day.startTime && day.endTime && day.endTime < day.startTime);
      return { ...current, days, crossesMidnight };
    });
    setError(null);
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


  /** Pide el nombre y abre la confirmación: guardar un horario es un alta. */
  const save = () => {
    if (!form.name.trim()) {
      setError(t("nameRequired"));
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

      <div className="grid gap-4 xl:!grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <PanelCard title="Datos del horario" icon={<FaRegClock size={16} />} className="min-w-0">
          <ITFlex direction="column" gap={4}>
            <ITInput
              name="name"
              label={t("name")}
              placeholder={t("namePlaceholder")}
              value={view.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />

            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <ITInput name="entryToleranceMin" type="number" label={t("tolEntry")} value={String(form.entryToleranceMin)} onChange={(event) => setForm((current) => ({ ...current, entryToleranceMin: Number(event.target.value) }))} />
              <ITInput name="exitToleranceMin" type="number" label={t("tolExit")} value={String(form.exitToleranceMin)} onChange={(event) => setForm((current) => ({ ...current, exitToleranceMin: Number(event.target.value) }))} />
              <ITInput name="mealBreakMin" type="number" label={t("meal")} value={String(form.mealBreakMin)} onChange={(event) => setForm((current) => ({ ...current, mealBreakMin: Number(event.target.value) }))} />
              <ITInput name="minOvertimeMin" type="number" label={t("minExtra")} value={String(form.minOvertimeMin)} onChange={(event) => setForm((current) => ({ ...current, minOvertimeMin: Number(event.target.value) }))} />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <ITText className="block font-bold !text-[13px]">Días y horario</ITText>
              <ITText muted className="mt-0.5 block !text-[11.5px]">
                Si la salida es menor que la entrada, el turno termina al día siguiente.
              </ITText>
              <div className="mt-3 flex flex-col gap-2">
                {form.days.map((day) => (
                  <div key={day.weekday} className="rounded-xl border border-slate-100 p-3">
                    <ITFlex align="center" justify="between" gap={2} wrap="wrap">
                      <ITText className="!text-[12.5px] font-bold !text-slate-700">{dyn(t)(`day${day.weekday}`)}</ITText>
                      <ITCheckbox
                        name={`restDay-${day.weekday}`}
                        label="Descanso"
                        checked={day.restDay}
                        onChange={(checked) => updateDay(day.weekday, { restDay: checked })}
                      />
                    </ITFlex>
                    {!day.restDay && (
                      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
                        <ITInput name={`start-${day.weekday}`} type="text" placeholder="HH:MM" label="Entrada" value={day.startTime ?? ""} onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })} />
                        <ITInput name={`end-${day.weekday}`} type="text" placeholder="HH:MM" label="Salida" value={day.endTime ?? ""} onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })} />
                        <ITInput name={`splitStart-${day.weekday}`} type="text" placeholder="HH:MM" label="Comida inicio (opcional)" value={day.splitStartTime ?? ""} onChange={(event) => updateDay(day.weekday, { splitStartTime: event.target.value || null })} />
                        <ITInput name={`splitEnd-${day.weekday}`} type="text" placeholder="HH:MM" label="Comida fin (opcional)" value={day.splitEndTime ?? ""} onChange={(event) => updateDay(day.weekday, { splitEndTime: event.target.value || null })} />
                      </div>
                    )}
                    {!day.restDay && day.startTime && day.endTime && day.endTime < day.startTime && (
                      <ITText className="mt-2 block !text-[11.5px] font-semibold text-amber-700">Este turno termina al día siguiente.</ITText>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ITFlex>
        </PanelCard>

        <PanelCard title="Resumen del horario" icon={<FaRegClock size={16} />} className="xl:sticky xl:top-4">
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
                      {d.splitStartTime ? <ITText as="span" className="block font-medium text-slate-500">{d.splitStartTime}–{d.splitEndTime}</ITText> : null}
                    </ITText>
                  )}
                </div>
              ))}
            </ITStack>

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
                <li className="flex justify-between gap-2"><ITText as="span">{t("meal")}</ITText><ITText as="b">{view.mealBreakMin}</ITText></li>
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
