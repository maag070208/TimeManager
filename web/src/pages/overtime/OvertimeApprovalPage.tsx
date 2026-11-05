import { ITPage } from "@axzydev/axzy_ui_system";
import { FaClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import { OvertimeApprovalTable, OvertimeExportActions, useOvertimeApproval } from "@features/schedule";
import { downloadOvertimePDF } from "@widgets/reports";
import { useGoBack } from "@shared/lib/useGoBack";

export default function OvertimeApprovalPage() {
  const { t } = useTranslation(["overtime", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const canApprove = useCan("overtime.approve");
  const fx = useOvertimeApproval({ canApprove, downloadPdf: downloadOvertimePDF });

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={t("title")}
      description={t("description")}
      icon={<FaClock size={20} />}
      noPadding
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.schedules"), onClick: () => navigate("/schedules") },
        { label: t("title") },
      ]}
      backAction={() => goBack("/schedules")}
      actions={<OvertimeExportActions fx={fx} />}
    >
      <OvertimeApprovalTable fx={fx} />
    </ITPage>
  );
}
