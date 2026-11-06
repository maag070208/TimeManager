import { ITAlert, ITPage, ITText } from "@axzydev/axzy_ui_system";
import { FaUserShield } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useUserImport,
  ImportPanel,
  ImportResultCard,
} from "@features/user/import-users";
import { useGoBack } from "@shared/lib/useGoBack";
import { PanelCard } from "@shared/ui/panel-card";
import { LuCircleCheck } from "react-icons/lu";

export default function UserImportPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation(["users", "common", "employees"]);

  const fx = useUserImport();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("import.title")}
      description={tt("import.description")}
      backAction={() => goBack("/employees")}
      breadcrumbs={[
        { label: tt("employees:breadcrumb"), onClick: () => navigate("/employees", { replace: true }) },
        { label: tt("import.breadcrumb") },
      ]}
      icon={<FaUserShield size={20} />}
    >
      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8"><ImportPanel fx={fx} /></div>
        <div className="lg:col-span-4">
          <PanelCard icon={<LuCircleCheck size={16} />} title={tt("import.stepsTitle")} description="Tres pasos y listo.">
            <ol className="flex flex-col gap-2">
              {[tt("import.stepDownload"), tt("import.stepFill"), tt("import.stepUpload")].map((step, index) => (
                <li key={step} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">{index + 1}</span>
                  <ITText className="!text-[12.5px] text-slate-700">{step}</ITText>
                </li>
              ))}
            </ol>
          </PanelCard>
        </div>
      </div>
      <div className="mt-4"><ImportResultCard fx={fx} onGoToList={() => goBack("/employees")} /></div>
    </ITPage>
  );
}