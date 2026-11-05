import { ITPage } from "@axzydev/axzy_ui_system";
import { LuHistory } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PayrollHistoryPanel, usePayrollHistory } from "@features/schedule";
import { useGoBack } from "@shared/lib/useGoBack";

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
      <PayrollHistoryPanel fx={fx} />
    </ITPage>
  );
}
