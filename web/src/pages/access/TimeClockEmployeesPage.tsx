import { ITButton, ITFlex, ITPage, ITText } from "@axzydev/axzy_ui_system";
import { FaExchangeAlt, FaLink, FaMagic, FaUsersCog } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TimeClockEmployeesTab, useTimeClockEmployees } from "@features/access/time-clock-employees";
import { useGoBack } from "@shared/lib/useGoBack";

export default function TimeClockEmployeesPage() {
  const { t } = useTranslation(["time-clock", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useTimeClockEmployees();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("employees.title")}
      description={t("employees.description")}
      icon={<FaLink size={20} />}
      // Las acciones de la pantalla, en el encabezado (como en Checadas).
      actions={
        <ITFlex align="center" wrap="wrap" gap={2}>
          <ITButton variant="outlined" color="secondary" size="sm" onClick={() => navigate("/hr/time-clock/roster")}>
            <ITFlex align="center" gap={1}>
              <FaUsersCog size={11} />
              <ITText className="font-bold text-[11px]">{t("roster.title")}</ITText>
            </ITFlex>
          </ITButton>
          <ITButton
            variant="outlined"
            color="secondary"
            size="sm"
            onClick={() => navigate("/hr/time-clock/employees/differences")}
          >
            <ITFlex align="center" gap={1}>
              <FaExchangeAlt size={11} />
              <ITText className="font-bold text-[11px]">{t("differences.open")}</ITText>
            </ITFlex>
          </ITButton>
          {fx.canLink && (
            <ITButton
              variant="filled"
              color="primary"
              size="sm"
              disabled={fx.saving || !fx.summary?.registrationSuggestions}
              onClick={() => void fx.linkSuggested()}
            >
              <ITFlex align="center" gap={1}>
                <FaMagic size={11} />
                <ITText className="font-bold text-[11px]">
                  {t("employees.actions.linkSuggested", {
                    count: fx.summary?.registrationSuggestions ?? 0,
                  })}
                </ITText>
              </ITFlex>
            </ITButton>
          )}
        </ITFlex>
      }
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.hr"), onClick: () => navigate("/employees") },
        { label: t("employees.title") },
      ]}
      backAction={() => goBack("/hr/time-clock")}
    >
      <TimeClockEmployeesTab
        fx={fx}
        onSeeReport={() => navigate("/hr/time-clock/entries-exits")}
      />
    </ITPage>
  );
}
