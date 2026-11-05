import { ITPage } from "@axzydev/axzy_ui_system";
import { FaDoorOpen } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AccessReportExportActions, AccessReportTab, useAccessReport } from "@features/access/report";
import { downloadAccessReportPDF } from "@widgets/reports";
import { useGoBack } from "@shared/lib/useGoBack";

export default function AccessReportPage() {
  const { t } = useTranslation(["access-report", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useAccessReport({ download: downloadAccessReportPDF });

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("title")}
      description={t("description")}
      icon={<FaDoorOpen size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.accessLog"), onClick: () => navigate("/access") },
        { label: t("title") },
      ]}
      backAction={() => goBack("/access")}
      actions={<AccessReportExportActions fx={fx} />}
    >
      <AccessReportTab fx={fx} />
    </ITPage>
  );
}
