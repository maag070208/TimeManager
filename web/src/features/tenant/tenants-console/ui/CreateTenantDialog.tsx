import { useState } from "react";
import { ITAlert, ITButton, ITDialog, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { LuBuilding2, LuCopy, LuCheck } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { dyn } from "@shared/i18n";
import { tenantHost, tenantUrl } from "@shared/api/tenant";
import { DialogHeader } from "@shared/ui/dialog-header";
import { MX_TIMEZONES } from "../model/slug";
import { useCreateTenant } from "../model/useCreateTenant";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/** Alta de cliente en un paso; al terminar, datos de acceso de su administrador (una sola vez). */
export default function CreateTenantDialog({ isOpen, onClose, onCreated }: Props) {
  const { t } = useTranslation("home");
  const fx = useCreateTenant(onCreated);
  const [copied, setCopied] = useState(false);

  const close = () => {
    fx.reset();
    setCopied(false);
    onClose();
  };
  const tr = dyn(t);
  const err = (key: keyof typeof fx.errors): string | undefined =>
    fx.errors[key] ? tr(`platform.create.errors.${fx.errors[key]}`) : undefined;

  if (fx.created) {
    const { tenant, admin, temporaryPassword, welcomeEmail } = fx.created;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(
          `${tenantUrl(tenant.slug)}\n${t("platform.create.done.user")}: ${admin.username}\n${t("platform.create.done.password")}: ${temporaryPassword ?? ""}`
        );
        setCopied(true);
      } catch {
        setCopied(false);
      }
    };
    return (
      <ITDialog isOpen={isOpen} onClose={close}>
        <DialogHeader icon={<LuCheck />} tone="success" title={t("platform.create.done.title", { name: tenant.name })} subtitle={t("platform.create.done.subtitle")} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
          <dt className="text-slate-500">{t("platform.create.done.url")}</dt>
          <dd className="font-semibold">{tenantHost(tenant.slug)}</dd>
          <dt className="text-slate-500">{t("platform.create.done.user")}</dt>
          <dd className="font-semibold">{admin.username}</dd>
          {temporaryPassword && (
            <>
              <dt className="text-slate-500">{t("platform.create.done.password")}</dt>
              <dd className="font-mono font-semibold">{temporaryPassword}</dd>
            </>
          )}
        </dl>
        <ITText className="mt-3 block text-xs text-slate-500">{t("platform.create.done.hint")}</ITText>
        <ITText className="mt-1 block text-xs text-slate-500">
          {welcomeEmail ? t("platform.create.done.emailed", { email: welcomeEmail }) : t("platform.create.done.notEmailed")}
        </ITText>
        <div className="mt-5 flex justify-end gap-2">
          <ITButton variant="outlined" color="secondary" onClick={copy}>
            <span className="flex items-center gap-1.5">
              {copied ? <LuCheck aria-hidden size={14} /> : <LuCopy aria-hidden size={14} />}
              {t(copied ? "platform.create.done.copied" : "platform.create.done.copy")}
            </span>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={close}>
            {t("platform.create.done.close")}
          </ITButton>
        </div>
      </ITDialog>
    );
  }

  return (
    <ITDialog isOpen={isOpen} onClose={close}>
      <DialogHeader icon={<LuBuilding2 />} title={t("platform.create.title")} subtitle={t("platform.create.subtitle")} />
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
        <ITText as="h3" className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">
          {t("platform.create.company")}
        </ITText>
        <ITInput name="name" label={t("platform.create.name")} value={fx.form.name} onChange={(e) => fx.set("name", e.target.value)} error={err("name")} touched={!!fx.errors.name} required autoFocus containerClassName="sm:col-span-2" />
        <div className="sm:col-span-2">
          <ITInput name="slug" label={t("platform.create.slug")} value={fx.form.slug} onChange={(e) => fx.setSlug(e.target.value)} error={err("slug")} touched={!!fx.errors.slug} required />
          <ITText className="mt-1 block text-xs text-slate-500">
            {t("platform.create.slugHint", { host: fx.form.slug ? tenantHost(fx.form.slug) : "…" })}
          </ITText>
        </div>
        <ITSearchSelect
          name="timezone"
          label={t("platform.create.timezone")}
          options={MX_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace("America/", "").replace("_", " ") }))}
          value={fx.form.timezone}
          onChange={(e) => fx.set("timezone", e.target.value)}
        />
        <ITSearchSelect
          name="planId"
          label={t("platform.create.plan")}
          value={fx.form.planId}
          onChange={(e) => fx.set("planId", e.target.value)}
          options={[
            { value: "", label: t("platform.create.planNone") },
            ...fx.plans.map((plan) => ({
              value: plan.id,
              label: `${plan.name} — ${t("platform.plan.limitSummary", {
                people: plan.employeeLimit.toLocaleString(),
                clocks: plan.clockLimit,
              })}`,
            })),
          ]}
        />
        <ITInput name="employeeLimit" type="number" label={t("platform.create.employeeLimit")} value={fx.form.employeeLimit} onChange={(e) => fx.set("employeeLimit", e.target.value)} error={err("employeeLimit")} touched={!!fx.errors.employeeLimit} />
        {fx.plans.length === 0 && (
          <ITText className="block text-xs text-slate-500 sm:col-span-2">{t("platform.plan.empty")}</ITText>
        )}

        <ITText as="h3" className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">
          {t("platform.create.admin")}
        </ITText>
        <ITInput name="adminName" label={t("platform.create.adminName")} value={fx.form.adminName} onChange={(e) => fx.set("adminName", e.target.value)} error={err("adminName")} touched={!!fx.errors.adminName} required />
        <ITInput name="adminUsername" label={t("platform.create.adminUsername")} value={fx.form.adminUsername} onChange={(e) => fx.set("adminUsername", e.target.value)} error={err("adminUsername")} touched={!!fx.errors.adminUsername} required />
        <ITInput name="adminEmail" type="email" label={t("platform.create.adminEmail")} value={fx.form.adminEmail} onChange={(e) => fx.set("adminEmail", e.target.value)} error={err("adminEmail")} touched={!!fx.errors.adminEmail} containerClassName="sm:col-span-2" />

        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
          <ITButton type="button" variant="outlined" color="secondary" onClick={close} disabled={fx.saving}>
            {t("platform.create.cancel")}
          </ITButton>
          <ITButton type="submit" variant="filled" color="primary" disabled={fx.saving}>
            {t(fx.saving ? "platform.create.saving" : "platform.create.submit")}
          </ITButton>
        </div>
      </form>
    </ITDialog>
  );
}
