import { ITFlex, ITPage } from "@axzydev/axzy_ui_system";
import { FaUserClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AccessReportExportActions,
  AccessReportTab,
  useAccessReport,
  type AccessReportSource,
} from "@features/access/report";
import { LinksSummary } from "@features/access/time-clock-employees";
import { timeClockApi } from "@entities/time-clock";
import { downloadTimeClockReportPdf } from "@widgets/reports";
import { useGoBack } from "@shared/lib/useGoBack";

/** El mismo reporte de entradas/salidas, alimentado por las checadas del reloj. */
const TIME_CLOCK_SOURCE: AccessReportSource = {
  people: timeClockApi.people,
  reportExport: timeClockApi.reportExport,
  csvFile: "timeClock",
};

export default function TimeClockReportPage() {
  const { t } = useTranslation(["time-clock", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useAccessReport({ download: downloadTimeClockReportPdf, source: TIME_CLOCK_SOURCE });

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("report.title")}
      description={t("report.description")}
      icon={<FaUserClock size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.hr"), onClick: () => navigate("/employees") },
        { label: t("report.title") },
      ]}
      backAction={() => goBack("/hr/time-clock")}
      actions={<AccessReportExportActions fx={fx} />}
    >
      <ITFlex direction="column" gap={4}>
        <LinksSummary onGoToLink={() => navigate("/hr/time-clock/employees")} />
        <AccessReportTab fx={fx} />
      </ITFlex>
    </ITPage>
  );
}
