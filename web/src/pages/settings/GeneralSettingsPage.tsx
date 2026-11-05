import { useEffect, useState } from "react";
import { ITAlert, ITButton, ITCard, ITInput, ITText, ITToast, ITSelect } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuSettings } from "react-icons/lu";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@app/store";
import { meThunk } from "@entities/user";
import { nomApi, type NomConfigDto } from "@entities/nom";
import { ITPage } from "@axzydev/axzy_ui_system";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Configuración general del cliente: inicio de semana y accesos a horarios. */
export default function GeneralSettingsPage() {
  const { t } = useTranslation("nom");
  const dispatch = useDispatch<AppDispatch>();
  const [weekStartDay, setWeekStartDay] = useState(3);
  const [defaults, setDefaults] = useState({
    entryToleranceMin: 10,
    exitToleranceMin: 10,
    mealBreakMin: 0,
    minOvertimeMin: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    nomApi
      .getConfig()
      .then((config: NomConfigDto) => {
        setWeekStartDay(config.weekStartDay ?? 3);
        setDefaults(config.attendanceDefaults);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await nomApi.updateConfig({
        weekStartDay,
        defaultEntryToleranceMin: defaults.entryToleranceMin,
        defaultExitToleranceMin: defaults.exitToleranceMin,
        defaultMealBreakMin: defaults.mealBreakMin,
        defaultMinOvertimeMin: defaults.minOvertimeMin,
      });
      // Refresca la sesión para que la semana nueva aplique en toda la app.
      await dispatch(meThunk()).unwrap().catch(() => undefined);
      setToast(t("config.weekStartSaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ITPage
      title={t("config.title")}
      description={t("config.description")}
      icon={<LuSettings size={20} />}
      maxWidth="2xl"
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error">{error}</ITAlert>}
        <ITCard contentClassName="!p-5">
          <div className="flex flex-col gap-3">
            <div>
              <ITText className="font-bold">{t("config.weekStartTitle")}</ITText>
              <ITText muted className="mt-1 block !text-[12px]">{t("config.weekStartHint")}</ITText>
            </div>
            <div className="max-w-xs">
              <ITSelect
                name="weekStartDay"
                label={t("config.weekStartLabel")}
                value={String(weekStartDay)}
                onChange={(event) => setWeekStartDay(Number(event.target.value))}
                options={DAYS.map((day, index) => ({ value: String(index), label: day }))}
              />
            </div>
            <div>
              <ITButton variant="filled" color="primary" onClick={() => void save()} disabled={saving || loading}>
                {t("config.save")}
              </ITButton>
            </div>
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <div className="flex flex-col gap-3">
            <div>
              <ITText className="font-bold">{t("config.attendanceTitle")}</ITText>
              <ITText muted className="mt-1 block !text-[12px]">{t("config.attendanceHint")}</ITText>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ITInput
                name="defaultEntryToleranceMin"
                label={t("config.entryTolerance")}
                type="number"
                value={String(defaults.entryToleranceMin)}
                onChange={(event) => setDefaults((prev) => ({ ...prev, entryToleranceMin: Number(event.target.value) }))}
              />
              <ITInput
                name="defaultExitToleranceMin"
                label={t("config.exitTolerance")}
                type="number"
                value={String(defaults.exitToleranceMin)}
                onChange={(event) => setDefaults((prev) => ({ ...prev, exitToleranceMin: Number(event.target.value) }))}
              />
              <ITInput
                name="defaultMealBreakMin"
                label={t("config.mealBreak")}
                type="number"
                value={String(defaults.mealBreakMin)}
                onChange={(event) => setDefaults((prev) => ({ ...prev, mealBreakMin: Number(event.target.value) }))}
              />
              <ITInput
                name="defaultMinOvertimeMin"
                label={t("config.minOvertime")}
                type="number"
                value={String(defaults.minOvertimeMin)}
                onChange={(event) => setDefaults((prev) => ({ ...prev, minOvertimeMin: Number(event.target.value) }))}
              />
            </div>
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">{t("config.retentionTitle")}</ITText>
          <ITText muted className="mt-1 block !text-[12px]">{t("config.retentionText")}</ITText>
          <Link to="/schedules" className="mt-2 inline-block text-[12px] font-semibold text-slate-700 underline-offset-4 hover:underline">
            {t("config.schedulesLink")} →
          </Link>
        </ITCard>
      </div>

      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
