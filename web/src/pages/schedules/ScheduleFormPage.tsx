import { ITPage } from "@axzydev/axzy_ui_system";
import { FaRegClock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScheduleForm } from "@features/schedule";
import { useGoBack } from "@shared/lib/useGoBack";

export default function ScheduleFormPage() {
  const { t } = useTranslation(["schedules", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={isEdit ? t("edit") : t("new")}
      icon={<FaRegClock size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("title"), onClick: () => navigate("/schedules") },
        { label: isEdit ? t("edit") : t("new") },
      ]}
      backAction={() => goBack("/schedules")}
    >
      <ScheduleForm id={id} />
    </ITPage>
  );
}
