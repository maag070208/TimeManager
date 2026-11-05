import { useEffect } from "react";
import { ITButton, ITPage, ITText, ITFlex } from "@axzydev/axzy_ui_system";
import { FaPlus, FaQuestionCircle, FaUserShield } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import { RolesWorkspace, useRolesWorkspace } from "@features/roles/roles-console";
import { useGoBack } from "@shared/lib/useGoBack";

/** Consola de control de acceso: roles, matriz, acceso por persona, políticas, catálogo y actividad. */
function RolesConsole() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t } = useTranslation(["roles", "common"]);
  const workspace = useRolesWorkspace();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("title")}
      description={t("description")}
      backAction={() => goBack("/")}
      icon={<FaUserShield size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("title") },
      ]}
      actions={
        <ITFlex align="center" gap={2}>
          <ITButton variant="outlined" color="secondary" onClick={() => workspace.setHelpOpen(true)}>
            <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
              <FaQuestionCircle size={12} /> {t("help.open")}
            </ITText>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={workspace.openCreateRole}>
            <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
              <FaPlus size={11} /> {t("access.newRole")}
            </ITText>
          </ITButton>
        </ITFlex>
      }
    >
      <RolesWorkspace workspace={workspace} />
    </ITPage>
  );
}

export default function RolesPage() {
  const navigate = useNavigate();
  const canAdminRoles = useCan("roles.manage");

  useEffect(() => {
    if (!canAdminRoles) navigate("/", { replace: true });
  }, [canAdminRoles, navigate]);

  if (!canAdminRoles) return null;
  return <RolesConsole />;
}
