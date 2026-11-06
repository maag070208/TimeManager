import { useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import type { RootState } from "@app/store";
import { LoginForm, useLogin } from "@features/auth/login";
import LoginBrandPanel from "@features/auth/login/ui/LoginBrandPanel";
import { useLoginBrandingState } from "@features/auth/login/model/useLoginBranding";
import "@features/auth/login/ui/login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { token } = useSelector((s: RootState) => s.auth);
  const login = useLogin();
  const tenant = useLoginBrandingState();
  const tenantInvalid = Boolean(tenant.slug) && !tenant.loading && !tenant.branding?.slug;

  if (token) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    if (tenantInvalid) return;
    const ok = await login.handleSubmit(e);
    if (ok) navigate("/", { replace: true });
  };

  return (
    <div className="login-canvas flex min-h-screen items-center justify-center p-0 sm:p-8 lg:p-12">
      <div
        className="login-card flex w-full flex-col overflow-hidden sm:rounded-[32px] lg:flex-row"
        style={{ maxWidth: "980px" }}
      >
        <LoginBrandPanel branding={tenant.branding} />
        <LoginForm
          tenantSlug={login.tenantSlug}
          tenantName={tenant.branding?.name ?? null}
          tenantChecking={tenant.loading}
          tenantInvalid={tenantInvalid}
          username={login.username}
          password={login.password}
          setUsername={login.setUsername}
          setPassword={login.setPassword}
          errors={login.errors}
          deactivatedMsg={login.deactivatedMsg}
          isSubmitting={login.isSubmitting}
          canSubmit={login.canSubmit && !tenantInvalid}
          toast={login.toast}
          dismissToast={login.dismissToast}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
