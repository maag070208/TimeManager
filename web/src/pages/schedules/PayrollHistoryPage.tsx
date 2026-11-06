import { ITPage, ITText } from "@axzydev/axzy_ui_system";
import { LuHistory } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PayrollHistoryPanel, usePayrollHistory } from "@features/schedule";
import { useGoBack } from "@shared/lib/useGoBack";
import { HelpTip } from "@shared/ui/help-tip";

/**
 * Historial de pre-nóminas cerradas: se llega desde la barra de acciones de
 * Pre-nómina. Lista las semanas con su cierre/reapertura y el detalle de quién
 * revisó cada departamento (y cuándo), con la opción de reabrir.
 */
export default function PayrollHistoryPage() {
  const { t } = useTranslation(["weekly-attendance", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = usePayrollHistory();

  return (
    <ITPage
      className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={t("history.title")}
      description={t("history.description")}
      icon={<LuHistory size={20} />}
      noPadding
      horizontalPadding={"px-0"}
      maxWidth="7xl"
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.hr"), onClick: () => navigate("/employees") },
        { label: t("title"), onClick: () => navigate("/schedules/payroll") },
        { label: t("history.title") },
      ]}
      backAction={() => goBack("/schedules/payroll")}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[#eaf6ef] px-5 py-4 text-slate-900">
          <span className="flex items-center gap-1.5">
            <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-slate-500">
              Cierre de pre-nómina
            </ITText>
            <HelpTip text="Cada cierre guarda la fotografía de la semana (personas, horas, tiempo extra aprobado y faltas) y quién lo hizo. Reabrir no borra el cierre: vuelve a habilitar revisiones y deja rastro en auditoría." />
          </span>
          <ITText className="!text-2xl font-extrabold !text-slate-900">
            {fx.rows?.length ?? 0} semana(s) en el historial
          </ITText>
          <ITText className="!text-[12px] !text-slate-600">
            {fx.canClose
              ? "Puedes reabrir una semana cerrada si hace falta corregir antes de exportar."
              : "Solo lectura: necesitas el permiso de cierre de nómina para reabrir una semana."}
          </ITText>
        </div>

        <PayrollHistoryPanel fx={fx} />
      </div>
    </ITPage>
  );
}
