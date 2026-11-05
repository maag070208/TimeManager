import { ITPage } from "@axzydev/axzy_ui_system";
import { FaClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TimeClocksTab, useTimeClocks } from "@features/access/time-clocks";
import { useGoBack } from "@shared/lib/useGoBack";

export default function TimeClocksPage() {
  const { t } = useTranslation(["time-clock", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useTimeClocks();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("clocks.title")}
      description={t("clocks.description")}
      icon={<FaClock size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("clocks.title") },
      ]}
      backAction={() => goBack("/")}
    >
      <TimeClocksTab fx={fx} />
    </ITPage>
  );
}
