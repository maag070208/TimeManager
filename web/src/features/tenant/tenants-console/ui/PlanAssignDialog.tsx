import { ITAlert, ITButton, ITDialog, ITText } from "@axzydev/axzy_ui_system";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { LuBadgeDollarSign } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Tenant } from "@entities/tenant";
import { DialogHeader } from "@shared/ui/dialog-header";
import { usePlanAssign } from "../model/usePlanAssign";

interface Props {
  isOpen: boolean;
  tenant: Tenant | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Ficha del plan del cliente: selector, uso actual y límites contratados. */
export default function PlanAssignDialog({ isOpen, tenant, onClose, onSaved }: Props) {
  const { t } = useTranslation("home");
  const fx = usePlanAssign(tenant, () => {
    onSaved();
    onClose();
  });

  const people = tenant?.limits.people ?? null;
  const clocks = tenant?.limits.clocks ?? null;
  const overPeople = tenant !== null && people !== null && tenant.usage.activeUsers > people;
  const overClocks = tenant !== null && clocks !== null && tenant.usage.clocks > clocks;

  return (
    <ITDialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader
        icon={<LuBadgeDollarSign />}
        title={t("platform.plan.title", { name: tenant?.name ?? "" })}
        subtitle={t("platform.plan.subtitle")}
      />
      {fx.error && (
        <div className="mb-3">
          <ITAlert variant="error">{fx.error}</ITAlert>
        </div>
      )}
      <div className="grid gap-4">
        <ITSearchSelect
          name="planId"
          label={t("platform.plan.select")}
          value={fx.planId}
          onChange={(e) => fx.setPlanId(e.target.value)}
          options={[
            { value: "", label: t("platform.plan.none") },
            ...(fx.plans ?? []).map((plan) => ({
              value: plan.id,
              label: `${plan.name} — ${t("platform.plan.limitSummary", {
                people: plan.employeeLimit.toLocaleString(),
                clocks: plan.clockLimit,
              })}`,
            })),
          ]}
        />
        {tenant && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
            <ITText as="h3" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t("platform.plan.usage")}
            </ITText>
            <ul className="m-0 grid list-none gap-1 p-0">
              <li className={overPeople ? "font-semibold text-rose-600" : "text-slate-700 dark:text-slate-200"}>
                {people === null
                  ? t("platform.plan.unlimited")
                  : t("platform.plan.people", { usage: tenant.usage.activeUsers, limit: people })}
              </li>
              <li className={overClocks ? "font-semibold text-rose-600" : "text-slate-700 dark:text-slate-200"}>
                {clocks === null
                  ? t("platform.plan.unlimited")
                  : t("platform.plan.clocks", { usage: tenant.usage.clocks, limit: clocks })}
              </li>
            </ul>
            {tenant.plan && (
              <ITText className="mt-2 block text-xs text-slate-500">
                {tenant.plan.name}
                {tenant.plan.monthlyPrice === null
                  ? ""
                  : ` · ${new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "MXN",
                      maximumFractionDigits: 0,
                    }).format(Number(tenant.plan.monthlyPrice))}`}
              </ITText>
            )}
            {(overPeople || overClocks) && (
              <div className="mt-3">
                <ITAlert variant="warning">{t("platform.plan.overLimit")}</ITAlert>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <ITButton variant="outlined" color="secondary" onClick={onClose} disabled={fx.saving}>
            {t("platform.plan.cancel")}
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={() => void fx.submit()} disabled={fx.saving}>
            {t(fx.saving ? "platform.plan.saving" : "platform.plan.save")}
          </ITButton>
        </div>
      </div>
    </ITDialog>
  );
}
