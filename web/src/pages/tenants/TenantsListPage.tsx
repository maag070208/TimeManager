import { useState } from "react";
import { ITButton, ITInput, ITPage, ITText } from "@axzydev/axzy_ui_system";
import { LuBuilding2, LuPlus, LuUserCheck, LuUsersRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { AgentTokenDialog, CreateTenantDialog, PlanAssignDialog, TenantsTable, useTenantsConsole } from "@features/tenant/tenants-console";
import { tenantHost } from "@shared/api/tenant";
import type { Tenant } from "@entities/tenant";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { PanelCard } from "@shared/ui/panel-card";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { TicState } from "@shared/ui/tic";

/** Consola de clientes de la plataforma (solo ADMIN/SUPPORT). */
export default function TenantsListPage() {
  const { t } = useTranslation("home");
  const fx = useTenantsConsole();
  const [creating, setCreating] = useState(false);
  const [planTarget, setPlanTarget] = useState<Tenant | null>(null);
  const [agentTarget, setAgentTarget] = useState<Tenant | null>(null);
  const tenants = fx.tenants ?? [];
  const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  const suspended = tenants.filter((tenant) => tenant.status === "SUSPENDED").length;
  const people = tenants.filter((tenant) => tenant.status === "ACTIVE").reduce((sum, tenant) => sum + tenant.usage.activeUsers, 0);

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title="Clientes"
      description="Alta, plan, estado y módulos de cada cliente de TimeManager."
      icon={<LuBuilding2 size={20} />}
      actions={
        fx.canManage ? (
          <ITButton variant="filled" color="primary" className="tm-row-button" onClick={() => setCreating(true)}>
            <span className="inline-flex items-center gap-1"><LuPlus size={14} /> {t("platform.newClient")}</span>
          </ITButton>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pb-12">
        <BentoKpiGrid
          items={[
            { id: "total", label: "Clientes", value: tenants.length, caption: "en la plataforma", icon: <LuBuilding2 size={14} /> },
            { id: "active", label: "Activos", value: active, caption: "operando", icon: <LuUserCheck size={14} />, tone: "success" },
            { id: "suspended", label: "Suspendidos", value: suspended, caption: "sin acceso", icon: <LuUserCheck size={14} />, tone: "warning" },
            { id: "people", label: "Personas", value: people, caption: "en clientes activos", icon: <LuUsersRound size={14} />, tone: "info" },
          ]}
        />

        <PanelCard title="Todos los clientes" description="Entra a un cliente para operar sus pantallas como soporte.">
          <div className="flex flex-col gap-3">
            <div className="max-w-sm">
              <ITInput name="tenantSearch" placeholder={t("platform.search")} value={fx.search} onChange={(event) => fx.setSearch(event.target.value)} />
            </div>
            {fx.tenants === null ? (
              <ContentSkeleton size="sm" />
            ) : fx.visible.length === 0 ? (
              <TicState kind="noResults" size="sm" title={t("platform.noResults.title")} description={t("platform.noResults.description")} />
            ) : (
              <TenantsTable
                rows={fx.visible}
                canManage={fx.canManage}
                onEnter={fx.enter}
                onToggleStatus={fx.setStatusTarget}
                onEditPlan={setPlanTarget}
                onManageAgent={setAgentTarget}
                onManageClocks={fx.manageClocks}
              />
            )}
            <ITText muted className="!text-[11.5px]">Abre el detalle de un cliente para activar o apagar módulos completos.</ITText>
          </div>
        </PanelCard>
      </div>

      <CreateTenantDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={fx.reload} />
      <PlanAssignDialog isOpen={!!planTarget} tenant={planTarget} onClose={() => setPlanTarget(null)} onSaved={fx.reload} />
      <AgentTokenDialog isOpen={!!agentTarget} tenant={agentTarget} onClose={() => setAgentTarget(null)} />
      <TicConfirm
        isOpen={!!fx.statusTarget}
        onClose={() => fx.setStatusTarget(null)}
        onConfirm={() => void fx.confirmStatus()}
        loading={fx.savingStatus}
        variant={fx.statusTarget?.status === "ACTIVE" ? "danger" : "success"}
        title={fx.statusTarget ? t(fx.statusTarget.status === "ACTIVE" ? "platform.confirm.suspendTitle" : "platform.confirm.reactivateTitle", { name: fx.statusTarget.name }) : undefined}
        message={fx.statusTarget ? t(fx.statusTarget.status === "ACTIVE" ? "platform.confirm.suspendMessage" : "platform.confirm.reactivateMessage", { host: tenantHost(fx.statusTarget.slug) }) : undefined}
        confirmLabel={t(fx.statusTarget?.status === "ACTIVE" ? "platform.confirm.suspend" : "platform.confirm.reactivate")}
      />
    </ITPage>
  );
}
