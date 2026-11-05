import { ITPage } from "@axzydev/axzy_ui_system";
import { FaExchangeAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  TimeClockDifferencesTab,
  useTimeClockDifferences,
} from "@features/access/time-clock-differences";
import { useGoBack } from "@shared/lib/useGoBack";

export default function TimeClockDifferencesPage() {
  const { t } = useTranslation(["time-clock", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useTimeClockDifferences();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("differences.title")}
      description={t("differences.description")}
      icon={<FaExchangeAlt size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.hr"), onClick: () => navigate("/employees") },
        { label: t("employees.title"), onClick: () => navigate("/hr/time-clock/employees") },
        { label: t("differences.title") },
      ]}
      backAction={() => goBack("/hr/time-clock/employees")}
    >
      <TimeClockDifferencesTab fx={fx} />
    </ITPage>
  );
}
