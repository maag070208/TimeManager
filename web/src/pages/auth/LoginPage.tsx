import { useSelector } from "react-redux";
import { ITButton, ITText } from "@axzydev/axzy_ui_system";
import { LuShieldAlert } from "react-icons/lu";
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
        {tenant.slug && tenant.loading ? (
          <section className="login-form-panel flex flex-1 items-center justify-center px-[24px] py-[40px] sm:px-[32px] lg:px-[40px] lg:py-[44px]">
            <div className="w-full max-w-[22rem]">
              <ITText as="span" className="login-badge inline-block rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]">
                {`Validando cliente`}
              </ITText>
              <ITText as="h1" className="login-heading mt-6 text-[26px] font-extrabold tracking-tight sm:text-[30px]">
                Un momento…
              </ITText>
              <ITText className="login-muted mt-2 block text-[13px]">Estamos validando el acceso del cliente.</ITText>
            </div>
          </section>
        ) : tenantInvalid ? (
          <section className="login-form-panel flex flex-1 items-center justify-center px-[24px] py-[40px] sm:px-[32px] lg:px-[40px] lg:py-[44px]">
            <div className="w-full max-w-[22rem]">
              <ITText as="span" className="login-badge inline-block rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]">
                Acceso no disponible
              </ITText>
              <ITText as="h1" className="login-heading mt-6 flex items-center gap-2 text-[26px] font-extrabold tracking-tight sm:text-[28px]">
                <LuShieldAlert size={26} className="shrink-0" /> Cliente no encontrado
              </ITText>
              <ITText className="login-muted mt-2 block text-[13px] leading-relaxed">
                La ruta no corresponde a un cliente activo. Revisa la dirección o entra con una cuenta de plataforma.
              </ITText>
              <ITButton
                variant="filled"
                color="primary"
                className="tm-save-button mt-6 w-full"
                onClick={() => window.location.assign("/#/login")}
              >
                Ir al acceso de plataforma
              </ITButton>
            </div>
          </section>
        ) : (
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
        )}
      </div>
    </div>
  );
}
