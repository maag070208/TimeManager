import { useState } from "react";
import { ITAlert, ITBentoStatStrip, ITButton, ITInput, ITPage, ITStack } from "@axzydev/axzy_ui_system";
import { LuLayoutDashboard, LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { CreateTenantDialog, TenantsTable, useTenantsConsole, type TenantFilter } from "@features/tenant/tenants-console";
import { tenantHost } from "@shared/api/tenant";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { PanelCard } from "@shared/ui/panel-card";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { TicState } from "@shared/ui/tic";

/** Inicio del equipo TimeManager: clientes, estado y uso. */
export default function PlatformHomePage() {
  const { t } = useTranslation("home");
  const fx = useTenantsConsole();
  const [creating, setCreating] = useState(false);
  const target = fx.statusTarget;
  const suspending = target?.status === "ACTIVE";

  const newClient = fx.canManage ? (
    <ITButton variant="filled" color="primary" onClick={() => setCreating(true)}>
      <span className="flex items-center gap-1.5 text-[12px] font-bold">
        <LuPlus aria-hidden size={14} />
        {t("platform.newClient")}
      </span>
    </ITButton>
  ) : undefined;

  return (
    <ITPage
      className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("platform.title")}
      description={t("platform.description")}
      icon={<LuLayoutDashboard size={20} />}
      actions={newClient}
      loading={fx.tenants === null && !fx.error}
    >
      <ITStack spacing={4}>
        {fx.error && (
          <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
            {fx.error}
          </ITAlert>
        )}

        {fx.tenants && fx.tenants.length > 0 && (
          <ITBentoStatStrip
            items={[
              { id: "all", label: t("platform.kpis.all"), value: fx.counts.all, caption: t("platform.kpis.people", { count: fx.counts.people }), tone: "sea", color: "var(--color-primary-600)" },
              { id: "ACTIVE", label: t("platform.kpis.active"), value: fx.counts.active, tone: "mint", color: "var(--color-success)" },
              { id: "SUSPENDED", label: t("platform.kpis.suspended"), value: fx.counts.suspended, tone: "sun", color: "var(--color-warning)" },
            ]}
            activeId={fx.filter}
            onSelect={(id) => fx.setFilter(id as TenantFilter)}
          />
        )}

        <PanelCard title={t("platform.listTitle")} description={t("platform.listDescription")}>
          {fx.tenants === null ? (
            <ContentSkeleton size="sm" />
          ) : fx.tenants.length === 0 ? (
            <TicState kind="empty" title={t("platform.empty.title")} description={t("platform.empty.description")} action={newClient} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="max-w-sm">
                <ITInput name="tenantSearch" placeholder={t("platform.search")} value={fx.search} onChange={(e) => fx.setSearch(e.target.value)} />
              </div>
              {fx.visible.length === 0 ? (
                <TicState kind="noResults" size="sm" title={t("platform.noResults.title")} description={t("platform.noResults.description")} />
              ) : (
                <TenantsTable rows={fx.visible} canManage={fx.canManage} onEnter={fx.enter} onToggleStatus={fx.setStatusTarget} />
              )}
            </div>
          )}
        </PanelCard>
      </ITStack>

      <CreateTenantDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={fx.reload} />

      <TicConfirm
        isOpen={!!target}
        onClose={() => fx.setStatusTarget(null)}
        onConfirm={() => void fx.confirmStatus()}
        loading={fx.savingStatus}
        variant={suspending ? "danger" : "success"}
        title={target ? t(suspending ? "platform.confirm.suspendTitle" : "platform.confirm.reactivateTitle", { name: target.name }) : undefined}
        message={target ? t(suspending ? "platform.confirm.suspendMessage" : "platform.confirm.reactivateMessage", { host: tenantHost(target.slug) }) : undefined}
        confirmLabel={t(suspending ? "platform.confirm.suspend" : "platform.confirm.reactivate")}
      />
    </ITPage>
  );
}
