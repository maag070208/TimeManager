import { useEffect, useState } from "react";
import { ITButton, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuLink2, LuTriangleAlert } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { timeClockApi, type TimeClockEmployeesSummary } from "@entities/time-clock";
import { InsightNote } from "@shared/ui/bento-bits";

/**
 * Aviso del reporte de entradas/salidas del reloj, en el estilo de las notas de
 * lectura del sistema. Solo aparece cuando hay algo que corregir: si todos los
 * empleados del reloj están vinculados no dice nada, y el botón «Vincular» solo
 * sale cuando hay personas sin vincular.
 */
export default function LinksSummary({ onGoToLink }: { onGoToLink: () => void }) {
  const { t } = useTranslation(["time-clock", "common"]);
  const [summary, setSummary] = useState<TimeClockEmployeesSummary | null>(null);

  useEffect(() => {
    let active = true;
    timeClockApi
      .employees({ page: 1, limit: 1, filters: {} })
      .then((res) => {
        if (active) setSummary(res.summary);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!summary) return null;

  const noEmployees = summary.total === 0;
  const pending = summary.withoutLink;
  // Todo vinculado: nada que avisar.
  if (!noEmployees && pending === 0) return null;

  return (
    <ITFlex align="center" wrap="wrap" gap={3}>
      <InsightNote className="min-w-0 flex-1" icon={<LuTriangleAlert size={14} />}>
        {noEmployees
          ? t("report.noEmployees")
          : t("report.unlinkedNotice", { count: pending, total: summary.total })}
      </InsightNote>
      {pending > 0 && (
        <ITButton variant="outlined" color="primary" size="sm" onClick={onGoToLink}>
          <ITFlex align="center" gap={1}>
            <LuLink2 size={12} />
            <ITText className="font-bold text-[11px]">{t("report.link")}</ITText>
          </ITFlex>
        </ITButton>
      )}
    </ITFlex>
  );
}
