import { ITAlert, ITButton, ITDialog, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { LuBadgeDollarSign } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Plan } from "@entities/plan";
import { dyn } from "@shared/i18n";
import { DialogHeader } from "@shared/ui/dialog-header";
import { usePlanForm } from "../model/usePlanForm";

interface Props {
  isOpen: boolean;
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Alta/edición de un plan: nombre, límites y precio mensual de lista. */
export default function PlanFormDialog({ isOpen, plan, onClose, onSaved }: Props) {
  const { t } = useTranslation("plans");
  const fx = usePlanForm(plan, () => {
    onSaved();
    onClose();
  });
  const tr = dyn(t);
  const err = (key: keyof typeof fx.errors): string | undefined =>
    fx.errors[key] ? tr(`form.errors.${fx.errors[key]}`) : undefined;

  return (
    <ITDialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader
        icon={<LuBadgeDollarSign />}
        title={t(plan ? "form.editTitle" : "form.createTitle")}
        subtitle={t(plan ? "form.editSubtitle" : "form.createSubtitle")}
      />
      {fx.apiError && (
        <div className="mb-3">
          <ITAlert variant="error">{fx.apiError}</ITAlert>
        </div>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void fx.submit();
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <ITInput
          name="name"
          label={t("form.name")}
          value={fx.form.name}
          onChange={(e) => fx.set("name", e.target.value)}
          error={err("name")}
          touched={!!fx.errors.name}
          required
          autoFocus
          containerClassName="sm:col-span-2"
        />
        <ITInput
          name="employeeLimit"
          type="number"
          label={t("form.employeeLimit")}
          value={fx.form.employeeLimit}
          onChange={(e) => fx.set("employeeLimit", e.target.value)}
          error={err("employeeLimit")}
          touched={!!fx.errors.employeeLimit}
          required
        />
        <ITInput
          name="clockLimit"
          type="number"
          label={t("form.clockLimit")}
          value={fx.form.clockLimit}
          onChange={(e) => fx.set("clockLimit", e.target.value)}
          error={err("clockLimit")}
          touched={!!fx.errors.clockLimit}
          required
        />
        <ITInput
          name="monthlyPrice"
          type="number"
          label={t("form.monthlyPrice")}
          value={fx.form.monthlyPrice}
          onChange={(e) => fx.set("monthlyPrice", e.target.value)}
          error={err("monthlyPrice")}
          touched={!!fx.errors.monthlyPrice}
          containerClassName="sm:col-span-2"
        />
        <ITText className="block text-xs text-slate-500 sm:col-span-2">{t("form.priceHint")}</ITText>

        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
          <ITButton type="button" variant="outlined" color="secondary" onClick={onClose} disabled={fx.saving}>
            {t("form.cancel")}
          </ITButton>
          <ITButton type="submit" variant="filled" color="primary" disabled={fx.saving}>
            {t(fx.saving ? "form.saving" : "form.submit")}
          </ITButton>
        </div>
      </form>
    </ITDialog>
  );
}
