import { ITPage } from "@axzydev/axzy_ui_system";
import { FaUserClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AssignSchedules } from "@features/schedule";
import { useGoBack } from "@shared/lib/useGoBack";

export default function AssignSchedulesPage() {
  const { t } = useTranslation(["schedules", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("assign.title")}
      description={t("assign.description")}
      icon={<FaUserClock size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("title"), onClick: () => navigate("/schedules") },
        { label: t("assign.title") },
      ]}
      backAction={() => goBack("/schedules")}
    >
      <AssignSchedules />
    </ITPage>
  );
}
