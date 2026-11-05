import { LottieLoader } from "@shared/ui/lottie-loader";
import { useEffect, useMemo, useState } from "react";
import {
  ITAlert,
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
import ScheduleChat, { type ScheduleAgentPatch } from "./ScheduleAgent";
import { formatMinutesAsHhMm } from "@shared/utils/dates";
import { daysWorked, restDays, weeklyMinutes } from "../model/summary";
import { i18n } from "@shared/i18n";
import { useGoBack } from "@shared/lib/useGoBack";

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
  showSave = true,
}: {
  saving: boolean;
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  /** En alta el guardado lo hace Langostín; en edición queda el botón de arriba. */
  showSave?: boolean;
}) {
  return (
    <ITFlex justify="end" gap={2}>
      <ITButton variant="outlined" color="secondary" onClick={onCancel}>
        {cancelLabel}
      </ITButton>
      {showSave && (
        <ITButton variant="filled" color="primary" onClick={onSave} disabled={saving}>
          <ITFlex align="center" gap={1}>
            <FaSave size={12} />
            <ITText className="font-bold text-[11px]">{saveLabel}</ITText>
          </ITFlex>
        </ITButton>
      )}
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
  const [draft, setDraft] = useState<ScheduleAgentPatch | null>(null);

  /** Lo que se ve en el preview: el borrador del chat si ya contestó algo. */
  const view: ScheduleInput = draft
    ? { ...form, name: draft.name ?? form.name, days: form.days.map((d) => draft.days.find((x) => x.weekday === d.weekday) ?? d) }
    : form;
  const viewSummary = useMemo(
    () => ({
      days: daysWorked(view.days),
      rest: restDays(view.days),
      weekly: weeklyMinutes(view.days, view.mealBreakMin ?? 0),
    }),
    [view.days, view.mealBreakMin],
  );
  /** Aplicar el chat = guardar: llena el formulario y pide confirmación. */
  const applyAgent = (patch: ScheduleAgentPatch) => {
    const finalName = (form.name.trim() || patch.name?.trim() || "").trim();
    if (!finalName) {
      setError(t("nameRequired"));
      return;
    }
    setForm((f) => ({
      ...f,
      name: finalName,
      days: f.days.map((d) => {
        const day = patch.days.find((x) => x.weekday === d.weekday);
        return day ? { ...d, ...day } : d;
      }),
      crossesMidnight: patch.days.some((d) => d.endTime && d.startTime && d.endTime < d.startTime),
      entryToleranceMin: patch.entryToleranceMin ?? f.entryToleranceMin,
      exitToleranceMin: patch.exitToleranceMin ?? f.exitToleranceMin,
      mealBreakMin: patch.mealBreakMin ?? f.mealBreakMin,
      minOvertimeMin: patch.minOvertimeMin ?? f.minOvertimeMin,
    }));
    setDraft(null);
    setError(null);
    // Aplicar es guardar: el chat deja el horario listo y se confirma el alta.
    setConfirmOpen(true);
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
          days: h.days.map((d) => ({
            weekday: d.weekday,
            startTime: d.startTime,
            endTime: d.endTime,
            splitStartTime: d.splitStartTime,
            splitEndTime: d.splitEndTime,
            restDay: d.restDay,
          })),
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
      <ITFlex justify="center" className="py-10">
        <LottieLoader size="lg" />
      </ITFlex>
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
        showSave={isEdit}
      />

      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {/* Chat + resumen: Langostín pregunta a la izquierda y el horario se arma a la derecha */}
      <div className="grid gap-4 xl:!grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <ITStack className="min-w-0" spacing={4}>
          <ScheduleChat onApply={applyAgent} onDraft={setDraft} />

        </ITStack>

        {/* Preview del horario: se llena mientras contestas */}
        <PanelCard title={t("agent.summaryTitle")} icon={<FaRegClock size={16} />} className="xl:sticky xl:top-4">
          <ITFlex direction="column" gap={3}>
            <ITInput
              name="name"
              label={t("name")}
              placeholder={t("namePlaceholder")}
              value={view.name}
              onChange={(e) => {
                const value = e.target.value;
                setForm((f) => ({ ...f, name: value }));
                setDraft((d) => (d ? { ...d, name: value } : d));
                setError(null);
              }}
            />

            <ITStack>
              {view.days.map((d) => (
                <div
                  key={d.weekday}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0"
                >
                  <ITText as="span" className="text-[12px] font-semibold text-slate-600">{dyn(t)(`day${d.weekday}`)}</ITText>
                  {d.restDay ? (
                    <ITText as="span" className="text-[11px] font-semibold text-slate-400">{t("rest")}</ITText>
                  ) : (
                    <ITText as="span" className="text-right text-[11px] font-bold tabular-nums text-slate-800">
                      {d.startTime || "—"}–{d.endTime || "—"}
                      {d.splitStartTime ? (
                        <ITText as="span" className="block font-medium text-slate-500">
                          {d.splitStartTime}–{d.splitEndTime}
                        </ITText>
                      ) : null}
                    </ITText>
                  )}
                </div>
              ))}
            </ITStack>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              <div>
                <ITText className="text-[11px] font-semibold text-slate-500">{t("summary.days")}</ITText>
                <ITText className="text-[15px] font-black tabular-nums text-slate-800">{viewSummary.days}/7</ITText>
              </div>
              <div>
                <ITText className="text-[11px] font-semibold text-slate-500">{t("summary.restDays")}</ITText>
                <ITText className="text-[15px] font-black tabular-nums text-slate-800">{viewSummary.rest}</ITText>
              </div>
              <div>
                <ITText className="text-[11px] font-semibold text-slate-500">{t("summary.weeklyHours")}</ITText>
                <ITText className="text-[15px] font-black tabular-nums text-slate-800">{formatMinutesAsHhMm(viewSummary.weekly)}</ITText>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <ITText className="mb-1 text-[11px] font-semibold text-slate-500">
                {t("sections.rules")}
              </ITText>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[11px] text-slate-600">
                <li className="flex justify-between gap-2">
                  <ITText as="span">{t("tolEntry")}</ITText>
                  <ITText as="b">{view.entryToleranceMin}</ITText>
                </li>
                <li className="flex justify-between gap-2">
                  <ITText as="span">{t("tolExit")}</ITText>
                  <ITText as="b">{view.exitToleranceMin}</ITText>
                </li>
                <li className="flex justify-between gap-2">
                  <ITText as="span">{t("meal")}</ITText>
                  <ITText as="b">{view.mealBreakMin}</ITText>
                </li>
                <li className="flex justify-between gap-2">
                  <ITText as="span">{t("minExtra")}</ITText>
                  <ITText as="b">{view.minOvertimeMin}</ITText>
                </li>
                {view.crossesMidnight && <li className="font-semibold text-slate-700">{t("crossesMidnight")}</li>}
              </ul>
            </div>

            <ITText className="text-[11px] text-slate-500">{t("agent.hintHint")}</ITText>
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
