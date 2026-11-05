import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ITAlert, ITButton, ITCard, ITFlex, ITSelect, ITText } from "@axzydev/axzy_ui_system";
import { FaUndo } from "react-icons/fa";
import {
  DEFAULT_WEEK_START_DAY,
  WEEKDAYS,
  invalidateWeekStartDay,
  isWeekday,
  type Weekday,
} from "@entities/sys-config";
import { useGetSysConfig, useUpdateSysConfig } from "@features/sys-config";

const WEEK_START_DAY_KEY = "WEEK_START_DAY";

const toWeekday = (raw: string | null | undefined): Weekday =>
  isWeekday(raw) ? (raw.trim().toUpperCase() as Weekday) : DEFAULT_WEEK_START_DAY;

interface Props {
  onResult: (message: string, type: "success" | "error") => void;
}

/**
 * Primer día de la semana laboral (`sys_config.WEEK_START_DAY`): define el borde
 * de los rangos semanales de los filtros Diaria/Semanal/Mensual. El cliente
 * opera miércoles→miércoles, así que ese es el valor por defecto.
 */
export default function WeekStartCard({ onResult }: Props) {
  const { t, i18n } = useTranslation(["catalog", "common"]);
  const { data, loading, error, reload } = useGetSysConfig(WEEK_START_DAY_KEY);
  const { mutate, loading: saving, error: saveError } = useUpdateSysConfig(WEEK_START_DAY_KEY);

  const [day, setDay] = useState<Weekday>(DEFAULT_WEEK_START_DAY);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDay(toWeekday(data?.value));
  }, [data, dirty]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    try {
      await mutate(day);
      // Los filtros ya montados no releen; el cache se invalida para que la
      // próxima pantalla que abra un rango semanal use el día nuevo.
      invalidateWeekStartDay();
      setDirty(false);
      onResult(t("sysConfig.weekStartSaved"), "success");
      await reload();
    } catch {
      onResult(t("sysConfig.weekStartSaveError"), "error");
    }
  };

  const handleReset = () => {
    setDay(toWeekday(data?.value));
    setDirty(false);
  };

  return (
    <ITCard
      title={t("sysConfig.weekStartLabel")}
      className="!p-5 border border-slate-200"
      actions={
        <ITFlex justify="end" gap={2}>
          <ITButton variant="outlined" color="secondary" onClick={handleReset} disabled={!dirty || saving}>
            <ITFlex align="center" gap={1}>
              <FaUndo size={12} />
              <ITText className="font-bold text-[11px]">{t("common:actions.cancel")}</ITText>
            </ITFlex>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={handleSave} disabled={!dirty || saving}>
            <ITText className="font-bold text-[11px]">
              {saving ? t("sysConfig.saving") : t("sysConfig.save")}
            </ITText>
          </ITButton>
        </ITFlex>
      }
    >
      {(error || saveError) && (
        <ITAlert variant="error" dismissible onDismiss={() => undefined}>
          {error ?? saveError}
        </ITAlert>
      )}

      <ITSelect
        name="weekStartDay"
        label={t("sysConfig.weekStartLabel")}
        options={WEEKDAYS.map((d) => ({
          value: d,
          label: t(`sysConfig.weekdays.${d}`),
        }))}
        value={day}
        disabled={loading || saving}
        onChange={(e) => {
          setDay(toWeekday(e.target.value));
          setDirty(true);
        }}
      />

      <ITText className="mt-2 block text-[11px] text-slate-500">
        {t("sysConfig.weekStartHelp")}
      </ITText>

      {data?.updatedBy && (
        <ITText className="mt-3 block text-[10px] text-slate-400">
          {data.updatedBy.name} · {new Date(data.updatedAt).toLocaleString(i18n.language)}
        </ITText>
      )}
    </ITCard>
  );
}
