import { LuBuilding2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CreateTenantForm } from "@features/tenant/tenants-console";
import { ITPage } from "@shared/ui/page";

/** Alta de cliente a pantalla completa: empresa, plan y administrador, con resumen vivo. */
export default function TenantCreatePage() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title={t("platform.create.title")}
      description={t("platform.create.subtitle")}
      icon={<LuBuilding2 size={20} />}
      backAction={() => navigate("/tenants")}
      breadcrumbs={[{ label: "Clientes", onClick: () => navigate("/tenants") }, { label: t("platform.create.title") }]}
    >
      <CreateTenantForm onCancel={() => navigate("/tenants")} onView={(id) => navigate(`/tenants/${id}`)} />
    </ITPage>
  );
}
