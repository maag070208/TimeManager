import { useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import type { RootState } from "@app/store";
import { LoginForm, useLogin } from "@features/auth/login";
import LoginBrandPanel from "@features/auth/login/ui/LoginBrandPanel";
import "@features/auth/login/ui/login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { token } = useSelector((s: RootState) => s.auth);
  const login = useLogin();

  if (token) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    const ok = await login.handleSubmit(e);
    if (ok) navigate("/", { replace: true });
  };

  return (
    <div className="login-canvas flex min-h-screen items-center justify-center p-0 sm:p-8 lg:p-12">
      <div
        className="login-card flex w-full flex-col overflow-hidden sm:rounded-[32px] lg:flex-row"
        style={{ maxWidth: "980px" }}
      >
        <LoginBrandPanel />
        <LoginForm
          username={login.username}
          password={login.password}
          setUsername={login.setUsername}
          setPassword={login.setPassword}
          errors={login.errors}
          deactivatedMsg={login.deactivatedMsg}
          isSubmitting={login.isSubmitting}
          canSubmit={login.canSubmit}
          toast={login.toast}
          dismissToast={login.dismissToast}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
