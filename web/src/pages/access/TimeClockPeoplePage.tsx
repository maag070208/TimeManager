import { ITPage } from "@axzydev/axzy_ui_system";
import { FaUsersCog } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { TimeClockPeopleView } from "@features/access/time-clock-people";
import { useGoBack } from "@shared/lib/useGoBack";

export default function TimeClockPeoplePage() {
  const { t } = useTranslation("time-clock");
  const goBack = useGoBack();

  return (
    <ITPage
      noPadding
      title={t("people.title")}
      description={t("people.description")}
      icon={<FaUsersCog size={20} />}
      breadcrumbs={[{ label: t("people.title") }]}
      backAction={() => goBack("/time-clocks")}
    >
      <TimeClockPeopleView />
    </ITPage>
  );
}
