import { ITPage } from "@axzydev/axzy_ui_system";
import { FaSearch } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { TimeClockInspectView } from "@features/access/time-clock-inspect";
import { useGoBack } from "@shared/lib/useGoBack";

export default function TimeClockInspectPage() {
  const { t } = useTranslation("time-clock");
  const goBack = useGoBack();

  return (
    <ITPage
      noPadding
      title={t("inspect.title")}
      description={t("inspect.description")}
      icon={<FaSearch size={20} />}
      breadcrumbs={[{ label: t("inspect.title") }]}
      backAction={() => goBack("/time-clocks")}
    >
      <TimeClockInspectView />
    </ITPage>
  );
}
