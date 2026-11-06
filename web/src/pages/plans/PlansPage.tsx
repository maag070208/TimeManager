import { useState } from "react";
import { ITAlert, ITButton, ITStack, ITText } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { LuBadgeDollarSign, LuCircleCheck, LuCirclePause, LuLayers, LuPlus } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  PlanFormDialog,
  PlansTable,
  usePlansConsole,
} from "@features/plan/plans-console";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { PanelCard } from "@shared/ui/panel-card";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { TicState } from "@shared/ui/tic";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { useGoBack } from "@shared/lib/useGoBack";

/** Consola de planes del SaaS: catálogo, límites y precio de lista (solo plataforma). */
export default function PlansPage() {
  const { t } = useTranslation(["plans", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = usePlansConsole();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const rows = (fx.plans ?? []).filter((plan) => filter === "all" || (filter === "active" ? plan.active : !plan.active));

  const newPlan = fx.canManage ? (
    <ITButton variant="filled" color="primary" onClick={fx.openCreate}>
      <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
        <LuPlus aria-hidden size={13} />
        {t("new")}
      </ITText>
    </ITButton>
  ) : undefined;

  return (
    <ITPage
      className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("title")}
      description={t("description")}
      backAction={() => goBack("/")}
      icon={<LuBadgeDollarSign size={20} />}
      breadcrumbs={[{ label: t("common:breadcrumbs.home"), onClick: () => navigate("/") }, { label: t("title") }]}
      actions={newPlan}
      loading={fx.plans === null && !fx.error}
    >
      <ITStack spacing={4}>
        {fx.error && (
          <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
            {fx.error}
          </ITAlert>
        )}

        {fx.plans && fx.plans.length > 0 && (
          <BentoFilterCards
            activeId={filter}
            onSelect={(id) => setFilter(id as "all" | "active" | "inactive")}
            items={[
              { id: "all", label: t("kpis.all"), value: fx.counts.all, caption: "en el catálogo", icon: <LuLayers size={14} /> },
              { id: "active", label: t("kpis.active"), value: fx.counts.active, caption: "disponibles", icon: <LuCircleCheck size={14} /> },
              { id: "inactive", label: t("kpis.inactive"), value: fx.counts.inactive, caption: "dados de baja", icon: <LuCirclePause size={14} /> },
            ]}
          />
        )}

        <PanelCard
          title={t("listTitle")}
          description={t("listDescription")}
          actions={
            <HelpTip text="Cada plan define cuántas personas activas y relojes incluye el cliente, y su precio mensual de lista. Bajar de plan no borra nada: solo bloquea altas nuevas si el uso queda por encima del límite." />
          }
        >
          {fx.plans === null ? (
            <ContentSkeleton size="sm" />
          ) : fx.plans.length === 0 ? (
            <TicState
              kind="empty"
              title={t("empty")}
              description={t("listDescription")}
              action={
                fx.canManage ? (
                  <ITButton variant="filled" color="primary" onClick={fx.openCreate}>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold">
                      <LuPlus aria-hidden size={13} />
                      {t("new")}
                    </span>
                  </ITButton>
                ) : undefined
              }
            />
          ) : (
            <PlansTable
              rows={rows}
              canManage={fx.canManage}
              onEdit={fx.openEdit}
              onToggleStatus={fx.setStatusTarget}
            />
          )}
        </PanelCard>
      </ITStack>

      <PlanFormDialog
        key={`${fx.editing?.id ?? "new"}-${fx.creating || fx.editing !== null}`}
        isOpen={fx.creating || fx.editing !== null}
        plan={fx.editing}
        onClose={fx.closeForm}
        onSaved={fx.reload}
      />

      <TicConfirm
        isOpen={!!fx.statusTarget}
        onClose={() => fx.setStatusTarget(null)}
        onConfirm={() => void fx.confirmStatus()}
        loading={fx.savingStatus}
        variant={fx.statusTarget?.active ? "danger" : "success"}
        title={
          fx.statusTarget
            ? t(fx.statusTarget.active ? "confirm.deactivateTitle" : "confirm.activateTitle", {
                name: fx.statusTarget.name,
              })
            : undefined
        }
        message={
          fx.statusTarget
            ? t(fx.statusTarget.active ? "confirm.deactivateMessage" : "confirm.activateMessage")
            : undefined
        }
        confirmLabel={t(fx.statusTarget?.active ? "confirm.deactivate" : "confirm.activate")}
      />
    </ITPage>
  );
}
