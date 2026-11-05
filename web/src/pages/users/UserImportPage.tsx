import { ITAlert, ITPage } from "@axzydev/axzy_ui_system";
import { FaUserShield } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useUserImport,
  ImportPanel,
  ImportResultCard,
} from "@features/user/import-users";
import { useGoBack } from "@shared/lib/useGoBack";

export default function UserImportPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation("users");

  const fx = useUserImport();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("import.title")}
      description={tt("import.description")}
      backAction={() => goBack("/users")}
      breadcrumbs={[
        { label: tt("list.breadcrumb"), onClick: () => navigate("/users", { replace: true }) },
        { label: tt("import.breadcrumb") },
      ]}
      icon={<FaUserShield size={20} />}
    >
      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}

      <ImportPanel fx={fx} />
      <ImportResultCard fx={fx} onGoToList={() => goBack("/users")} />
    </ITPage>
  );
}