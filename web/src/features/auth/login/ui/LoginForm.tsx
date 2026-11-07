import { useState } from "react";
import { ITAlert, ITButton, ITInput, ITToast, ITText } from "@axzydev/axzy_ui_system";
import { Link, useNavigate } from "react-router-dom";
import { LuLogIn, LuUser } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import "./login.css";

interface LoginFormProps {
  /** Cliente del subdominio; `null` = acceso de plataforma. */
  tenantSlug?: string | null;
  tenantName?: string | null;
  tenantChecking?: boolean;
  tenantInvalid?: boolean;
  username: string;
  password: string;
  setUsername: React.Dispatch<React.SetStateAction<string>>;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  errors: { username?: string; password?: string };
  deactivatedMsg?: string | null;
  isSubmitting: boolean;
  canSubmit: boolean;
  toast: { message: string; type: "error" | "success" } | null;
  dismissToast: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function LoginForm({
  tenantSlug,
  tenantName,
  tenantChecking,
  tenantInvalid,
  username,
  password,
  setUsername,
  setPassword,
  errors,
  deactivatedMsg,
  isSubmitting,
  canSubmit,
  toast,
  dismissToast,
  onSubmit,
}: LoginFormProps) {
  const { t: tt } = useTranslation(["auth"]);
  const navigate = useNavigate();
  const [companyCode, setCompanyCode] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const shortTenant = tenantName?.replace(/^Cliente\s+(E2E\s+)?/i, "") ?? tenantName;
  return (
    <>
      <section className="login-form-panel flex flex-1 items-center justify-center px-[24px] py-[40px] sm:px-[32px] lg:px-[40px] lg:py-[44px]">
        <div className="w-full max-w-[22rem]">
          <ITText as="span" className="login-badge login-rise inline-block rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]">
            {tt("login.badge")}
          </ITText>

          <ITText as="h1" className="login-heading mt-6 text-[26px] font-extrabold tracking-tight sm:text-[30px] sm:leading-[1.1]">
            {tt("login.title")}
          </ITText>
          <ITText className="login-muted login-rise login-rise-2 mt-2 block text-[13px] leading-relaxed">{tt("login.subtitle")}</ITText>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tenantSlug ? (
              tenantChecking ? (
                <ITText as="span" className="login-muted text-[12px]">{tt("login.tenantChecking")}</ITText>
              ) : tenantInvalid ? (
                <ITText as="span" className="rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-semibold text-red-700">
                  {tt("login.tenantInvalid")}
                </ITText>
              ) : (
                <ITText as="span" className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700">
                  {tt("login.tenantAccess", { name: tenantName ?? tenantSlug })}
                </ITText>
              )
            ) : (
              <ITText as="span" className="login-muted text-[12px]">{tt("login.platform")}</ITText>
            )}
          </div>
          {tenantInvalid && (
            <div className="mt-4">
              <ITAlert variant="warning">{tt("login.tenantInvalidHint")}</ITAlert>
              <Link to="/login" className="login-muted mt-3 inline-block text-[12px] font-semibold underline-offset-4 hover:underline">
                {tt("login.platformAccess")} →
              </Link>
            </div>
          )}

          {deactivatedMsg && (
            <div className="mt-6">
              <ITAlert variant="warning">{deactivatedMsg}</ITAlert>
            </div>
          )}

          <form onSubmit={onSubmit} className="bento-stagger mt-6 space-y-4" noValidate>
            <div>
              <ITInput
                name="username"
                size="lg"
                label={tenantSlug ? tt("login.userLabelTenant") : tt("login.userLabel")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
                iconRight={<LuUser aria-hidden size={16} />}
                aria-invalid={!!errors.username}
              />
              {errors.username && (
                <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">
                  {errors.username}
                </ITText>
              )}
            </div>
            <div>
              <ITInput
                name="password"
                size="lg"
                type="password"
                label={tt("login.passwordLabel")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <ITText as="span" role="alert" className="text-red-500 text-xs mt-1 block">
                  {errors.password}
                </ITText>
              )}
            </div>

            <ITButton
              type="submit"
              variant="filled"
              color="primary"
              size="lg"
              disabled={isSubmitting || !canSubmit}
              className="login-submit w-full flex items-center justify-center gap-2 py-3"
            >
              <ITText as="span" className="flex items-center justify-center gap-2 text-sm font-bold">
                <LuLogIn aria-hidden size={16} className="login-submit-icon" />
                {isSubmitting
                  ? tt("login.submitting")
                  : tenantSlug && tenantName
                    ? tt("login.submitTenant", { name: shortTenant })
                    : tt("login.submit")}
              </ITText>
            </ITButton>
          </form>

          {tenantSlug ? (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="login-muted mt-5 flex w-full items-center justify-center gap-1 text-[12px] font-semibold hover:underline"
            >
              {tt("login.tenantSwitch")}
            </button>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <button
                type="button"
                onClick={() => setCompanyOpen((open) => !open)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <span>
                  <ITText className="block !text-[12px] font-bold !text-slate-700">{tt("login.company.title")}</ITText>
                  <ITText className="block !text-[11.5px] !text-slate-500">{tt("login.company.text")}</ITText>
                </span>
                <span aria-hidden className="mt-0.5 text-slate-400">→</span>
              </button>
              {companyOpen && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const code = companyCode.trim().toLowerCase();
                    if (code) navigate(`/${encodeURIComponent(code)}/login`);
                  }}
                  className="mt-3 flex gap-2"
                >
                  <ITInput
                    name="companyCode"
                    size="sm"
                    placeholder={tt("login.company.placeholder")}
                    value={companyCode}
                    onChange={(event) => setCompanyCode(event.target.value)}
                  />
                  <ITButton type="submit" variant="filled" color="primary" size="sm" disabled={!companyCode.trim()}>
                    {tt("login.company.go")}
                  </ITButton>
                </form>
              )}
            </div>
          )}

          <footer className="login-muted mt-8 flex items-center justify-between text-[11.5px]">
            <ITText as="span">{tt("login.footer")}</ITText>
            <ITText as="span" className="font-medium">v{__APP_VERSION__}</ITText>
          </footer>
          <div className="mt-6 text-center">
            <Link to="/landing" className="login-muted text-[12px] font-semibold underline-offset-4 hover:underline">
              Conoce CheckLab
            </Link>
          </div>
        </div>
      </section>

      {toast && (
        <ITToast
          message={toast.message}
          type={toast.type}
          position="bottom-center"
          duration={2500}
          onClose={dismissToast}
        />
      )}
    </>
  );
}
