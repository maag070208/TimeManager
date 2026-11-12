import { useState, type ReactNode } from "react";
import { ITAlert, ITButton, ITCard, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { LuBuilding2, LuCheck, LuCopy, LuExternalLink, LuGlobe, LuKeyRound, LuLayers, LuPlus, LuRefreshCw, LuUserRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { dyn } from "@shared/i18n";
import { tenantHost, tenantUrl } from "@shared/api/tenant";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { FormSection } from "@shared/ui/form-section";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { LiveSummary, LiveSummaryRow } from "@shared/ui/live-summary";
import { StickyActions } from "@shared/ui/sticky-actions";
import { generatePassword, MX_TIMEZONES } from "../model/slug";
import { useCreateTenant } from "../model/useCreateTenant";

interface Props {
  /** Salir sin crear. */
  onCancel: () => void;
  /** Abrir el detalle del cliente recién creado. */
  onView: (tenantId: string) => void;
}

const tzLabel = (tz: string) => tz.replace("America/", "").replace(/_/g, " ");

/** Opción tipo tarjeta de un grupo de selección única (plan). */
const Choice = ({ selected, onSelect, title, children }: { selected: boolean; onSelect: () => void; title: ReactNode; children?: ReactNode }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={`flex min-w-0 flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
      selected ? "shadow-sm" : "hover:border-slate-300"
    }`}
    style={selected ? { borderColor: "#0f172a", backgroundColor: "#f8fafc" } : { borderColor: "#e2e8f0", backgroundColor: "#ffffff" }}
  >
    <span className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate text-[14px] font-bold text-slate-800">{title}</span>
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={selected ? { borderColor: "#0f172a", backgroundColor: "#0f172a", color: "#ffffff" } : { borderColor: "#cbd5e1" }}
      >
        {selected && <LuCheck size={12} strokeWidth={3} />}
      </span>
    </span>
    {children}
  </button>
);

/**
 * Alta de cliente a página completa: empresa, plan y administrador en secciones
 * numeradas con un resumen vivo de cómo quedará. Al crear, muestra una sola vez
 * los accesos del administrador y qué sigue.
 */
export default function CreateTenantForm({ onCancel, onView }: Props) {
  const { t, i18n } = useTranslation("home");
  const tr = dyn(t);
  const fx = useCreateTenant();
  const [copied, setCopied] = useState<string | null>(null);
  const [customLimit, setCustomLimit] = useState(false);

  const err = (key: keyof typeof fx.errors): string | undefined =>
    fx.errors[key] ? tr(`platform.create.errors.${fx.errors[key]}`) : undefined;
  const money = (price: string) => Number(price).toLocaleString(i18n.language, { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied(null);
    }
  };

  if (fx.created) {
    const { tenant, admin, temporaryPassword, welcomeEmail } = fx.created;
    const password = temporaryPassword ?? fx.form.adminPassword;
    const rows = [
      { id: "url", label: t("platform.create.done.url"), value: tenantHost(tenant.slug), copy: tenantUrl(tenant.slug) },
      { id: "user", label: t("platform.create.done.user"), value: admin.username, copy: admin.username },
      { id: "password", label: t("platform.create.done.password"), value: password, copy: password },
    ];
    const everything = rows.filter((row) => row.copy).map((row) => `${row.label}: ${row.copy}`).join("\n");
    return (
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ITCard contentClassName="!p-6 lg:!p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <LuCheck size={24} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <ITText as="h2" className="m-0 truncate !text-[22px] font-extrabold !text-slate-900">
                {t("platform.create.done.title", { name: tenant.name })}
              </ITText>
              <ITText className="!text-[13px] text-slate-500">{t("platform.create.done.subtitle", { admin: fx.form.adminName.trim() || admin.username })}</ITText>
            </div>
          </div>

          <ul className="mt-6 flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <span className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{row.label}</span>
                  <span className={`block break-all text-[17px] font-bold text-slate-900 ${row.copy ? "font-mono" : ""}`}>{row.value}</span>
                </div>
                {row.copy && (
                  <ITButton
                    variant="outlined"
                    color="secondary"
                    className="tm-icon-button shrink-0"
                    aria-label={t("platform.create.done.copyOne", { label: row.label })}
                    title={t("platform.create.done.copyOne", { label: row.label })}
                    onClick={() => void copy(row.id, row.copy)}
                  >
                    {copied === row.id ? <LuCheck size={14} /> : <LuCopy size={14} />}
                  </ITButton>
                )}
              </li>
            ))}
          </ul>

          <ITText className="mt-3 block !text-[12.5px] text-slate-600">
            {welcomeEmail ? t("platform.create.done.emailed", { email: welcomeEmail }) : t("platform.create.done.notEmailed")}
            {` ${t("platform.create.done.onlyNow")}`}
          </ITText>

          <div className="mt-6 flex flex-wrap gap-2">
            <ITButton variant="filled" color="primary" onClick={() => void copy("all", everything)}>
              <span className="flex items-center gap-1.5">
                {copied === "all" ? <LuCheck aria-hidden size={14} /> : <LuCopy aria-hidden size={14} />}
                {t(copied === "all" ? "platform.create.done.copied" : "platform.create.done.copy")}
              </span>
            </ITButton>
            <ITButton variant="outlined" color="secondary" onClick={() => window.open(tenantUrl(tenant.slug), "_blank", "noopener")}>
              <span className="flex items-center gap-1.5">
                <LuExternalLink aria-hidden size={14} />
                {t("platform.create.done.open")}
              </span>
            </ITButton>
            <ITButton variant="outlined" color="secondary" onClick={() => onView(tenant.id)}>
              {t("platform.create.done.view")}
            </ITButton>
            <ITButton
              variant="text"
              color="primary"
              onClick={() => {
                fx.reset();
                setCopied(null);
                setCustomLimit(false);
              }}
            >
              <span className="flex items-center gap-1.5">
                <LuPlus aria-hidden size={14} />
                {t("platform.create.done.another")}
              </span>
            </ITButton>
          </div>
        </ITCard>

        <ITCard className="self-start" contentClassName="!p-5">
          <ITText as="h3" className="m-0 mb-3 !text-[16px] font-bold !text-slate-800">{t("platform.create.done.nextTitle")}</ITText>
          <ol className="flex flex-col gap-3">
            {(["next1", "next2", "next3"] as const).map((key, index) => (
              <li key={key} className="flex gap-3 text-[12.5px] text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">{index + 1}</span>
                <span>{t(`platform.create.done.${key}`)}</span>
              </li>
            ))}
          </ol>
          <ITText className="mt-4 block rounded-xl bg-amber-50 px-3 py-2 !text-[12px] text-amber-900">
            {t("platform.create.done.useThisUser", { user: admin.username })}
          </ITText>
        </ITCard>
      </div>
    );
  }

  const plan = fx.plans?.find((item) => item.id === fx.form.planId);
  const host = fx.form.slug ? tenantHost(fx.form.slug) : "";
  const sections = [fx.complete.company, fx.complete.plan, fx.complete.admin];

  const submit = async () => {
    const field = await fx.submit();
    if (!field) return;
    if (field === "employeeLimit") setCustomLimit(true);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLElement>(`[name="${field}"]`);
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus({ preventScroll: true });
    });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!fx.saving) void submit();
      }}
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {fx.apiError && (
            <ITAlert variant="error" dismissible onDismiss={() => fx.setApiError(null)}>
              {fx.apiError}
            </ITAlert>
          )}

          <FormSection number={1} icon={<LuBuilding2 size={16} />} title={t("platform.create.company.title")} description={t("platform.create.company.description")} complete={fx.complete.company}>
            <div className="grid gap-4 md:grid-cols-2">
              <ITInput
                name="name"
                label={t("platform.create.company.name")}
                placeholder={t("platform.create.company.namePlaceholder")}
                value={fx.form.name}
                onChange={(e) => fx.set("name", e.target.value)}
                error={err("name")}
                touched={!!fx.errors.name}
                required
                autoFocus
              />
              <ITSearchSelect
                name="timezone"
                label={t("platform.create.company.timezone")}
                options={MX_TIMEZONES.map((tz) => ({ value: tz, label: tzLabel(tz) }))}
                value={fx.form.timezone}
                onChange={(e) => fx.set("timezone", String(e.target.value))}
              />
              <div className="md:col-span-2">
                <ITInput
                  name="slug"
                  label={t("platform.create.company.slug")}
                  value={fx.form.slug}
                  onChange={(e) => fx.setSlug(e.target.value)}
                  error={err("slug")}
                  touched={!!fx.errors.slug}
                  required
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  {host && !fx.errors.slug && fx.complete.company ? (
                    <>
                      <span>{t("platform.create.company.slugPreview")}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-mono text-[12.5px] font-semibold text-emerald-800">
                        <LuGlobe size={12} /> {host}
                      </span>
                    </>
                  ) : (
                    <span>{t("platform.create.company.slugHelp")}</span>
                  )}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection number={2} icon={<LuLayers size={16} />} title={t("platform.create.plan.title")} description={t("platform.create.plan.description")} complete={fx.complete.plan}>
            {fx.plans === null ? (
              <ContentSkeleton size="sm" />
            ) : (
              <>
                <div role="radiogroup" aria-label={t("platform.create.plan.title")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Choice selected={!fx.form.planId} onSelect={() => fx.set("planId", "")} title={t("platform.create.plan.none")}>
                    <span className="text-[12px] text-slate-500">{t("platform.create.plan.noneHint")}</span>
                  </Choice>
                  {fx.plans.map((item) => (
                    <Choice key={item.id} selected={fx.form.planId === item.id} onSelect={() => fx.set("planId", item.id)} title={item.name}>
                      <span className="text-[15px] font-extrabold tabular-nums text-slate-900">
                        {item.monthlyPrice ? (
                          <>
                            {money(item.monthlyPrice)}
                            <span className="text-[12px] font-semibold text-slate-500">{t("platform.create.plan.perMonth")}</span>
                          </>
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-500">{t("platform.create.plan.noPrice")}</span>
                        )}
                      </span>
                      <span className="text-[12px] text-slate-500">
                        {t("platform.create.plan.people", { count: item.employeeLimit })} · {t("platform.create.plan.clocks", { count: item.clockLimit })}
                      </span>
                    </Choice>
                  ))}
                </div>
                {fx.plans.length === 0 && <ITText className="mt-3 block !text-[12px] text-slate-500">{t("platform.create.plan.empty")}</ITText>}
                {customLimit || fx.form.employeeLimit ? (
                  <div className="mt-4 max-w-xs">
                    <ITInput
                      name="employeeLimit"
                      type="number"
                      label={t("platform.create.plan.employeeLimit")}
                      value={fx.form.employeeLimit}
                      onChange={(e) => fx.set("employeeLimit", e.target.value)}
                      error={err("employeeLimit")}
                      touched={!!fx.errors.employeeLimit}
                    />
                    <ITText className="mt-1 block !text-[12px] text-slate-500">{t("platform.create.plan.employeeLimitHint")}</ITText>
                  </div>
                ) : (
                  <button type="button" className="mt-3 text-[12px] font-semibold text-slate-600 underline underline-offset-2" onClick={() => setCustomLimit(true)}>
                    {t("platform.create.plan.customLimit")}
                  </button>
                )}
              </>
            )}
          </FormSection>

          <FormSection number={3} icon={<LuUserRound size={16} />} title={t("platform.create.admin.title")} description={t("platform.create.admin.description")} complete={fx.complete.admin}>
            <div className="grid gap-4 md:grid-cols-2">
              <ITInput
                name="adminName"
                label={t("platform.create.admin.name")}
                placeholder={t("platform.create.admin.namePlaceholder")}
                value={fx.form.adminName}
                onChange={(e) => fx.set("adminName", e.target.value)}
                error={err("adminName")}
                touched={!!fx.errors.adminName}
                required
              />
              <div>
                <ITInput
                  name="adminEmail"
                  type="email"
                  label={t("platform.create.admin.email")}
                  value={fx.form.adminEmail}
                  onChange={(e) => fx.set("adminEmail", e.target.value)}
                  error={err("adminEmail")}
                  touched={!!fx.errors.adminEmail}
                />
                <ITText className="mt-1 block !text-[12px] text-slate-500">{t("platform.create.admin.emailHint")}</ITText>
              </div>
              <div>
                <ITInput
                  name="adminUsername"
                  label={t("platform.create.admin.username")}
                  value={fx.form.adminUsername}
                  onChange={(e) => fx.set("adminUsername", e.target.value.toLowerCase().replace(/\s/g, ""))}
                  error={err("adminUsername")}
                  touched={!!fx.errors.adminUsername}
                  required
                />
                <ITText className="mt-1 block !text-[12px] text-slate-500">{t("platform.create.admin.usernameHint")}</ITText>
              </div>
              <div>
                <ITInput
                  name="adminPassword"
                  label={t("platform.create.admin.password")}
                  value={fx.form.adminPassword}
                  onChange={(e) => fx.set("adminPassword", e.target.value)}
                  error={err("adminPassword")}
                  touched={!!fx.errors.adminPassword}
                  className="font-mono"
                  required
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <ITText className="!text-[12px] text-slate-500">{t("platform.create.admin.passwordHint")}</ITText>
                  <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 underline underline-offset-2" onClick={() => fx.set("adminPassword", generatePassword())}>
                    <LuRefreshCw size={11} /> {t("platform.create.admin.regenerate")}
                  </button>
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        <LiveSummary
          title={t("platform.create.summary.title")}
          total={sections.length}
          done={sections.filter(Boolean).length}
          footer={<ITText className="block !text-[11.5px] text-slate-500">{t("platform.create.summary.note")}</ITText>}
        >
          <div className="mb-1 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[15px] font-extrabold text-slate-600">
              {fx.form.name.trim().slice(0, 1).toUpperCase() || <LuBuilding2 size={18} />}
            </span>
            <div className="min-w-0">
              <ITText className="block truncate !text-[14px] font-bold !text-slate-800">{fx.form.name.trim() || t("platform.create.company.name")}</ITText>
              <ITText className="block truncate font-mono !text-[11.5px] text-slate-500">{host || "…"}</ITText>
            </div>
          </div>
          <LiveSummaryRow label={t("platform.create.summary.timezone")} value={tzLabel(fx.form.timezone)} />
          <LiveSummaryRow
            label={t("platform.create.summary.plan")}
            value={`${plan?.name ?? t("platform.create.plan.none")}${fx.form.employeeLimit ? ` · ${t("platform.create.plan.people", { count: Number(fx.form.employeeLimit) })}` : ""}`}
          />
          <LiveSummaryRow label={t("platform.create.summary.admin")} value={fx.form.adminName.trim()} />
          <LiveSummaryRow label={t("platform.create.summary.user")} value={fx.form.adminUsername.trim()} />
          <LiveSummaryRow
            label={t("platform.create.summary.password")}
            value={
              <span className="inline-flex items-center gap-1">
                <LuKeyRound size={11} /> {fx.form.adminPassword ? "•".repeat(Math.min(fx.form.adminPassword.length, 12)) : "—"}
              </span>
            }
          />
        </LiveSummary>
      </div>

      <StickyActions className="mb-10 pb-4">
        {Object.keys(fx.errors).length > 0 && <ITText className="mr-auto !text-[12.5px] font-semibold text-rose-600">{t("platform.create.fixErrors")}</ITText>}
        <ITButton type="button" variant="outlined" color="secondary" onClick={onCancel} disabled={fx.saving}>
          {t("platform.create.cancel")}
        </ITButton>
        <ITButton type="submit" variant="filled" color="primary" disabled={fx.saving}>
          {t(fx.saving ? "platform.create.saving" : "platform.create.submit")}
        </ITButton>
      </StickyActions>
    </form>
  );
}
