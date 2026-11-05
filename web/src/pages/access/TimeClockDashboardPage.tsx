import { ITPage } from "@axzydev/axzy_ui_system";
import { FaHouseUser } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { TimeClockDashboardView } from "@widgets/time-clock-dashboard";
import { useGoBack } from "@shared/lib/useGoBack";

export default function TimeClockDashboardPage() {
  const { t } = useTranslation("time-clock");
  const goBack = useGoBack();

  return (
    <ITPage
      noPadding
      className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={t("dashboard.title")}
      description={t("dashboard.description")}
      icon={<FaHouseUser size={20} />}
      breadcrumbs={[{ label: t("dashboard.title") }]}
      backAction={() => goBack("/time-clocks")}
    >
      <TimeClockDashboardView />
    </ITPage>
  );
}
