import { ITAlert, ITButton, ITInput, ITToast, ITText } from "@axzydev/axzy_ui_system";
import { LuLogIn, LuUser } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import "./login.css";

interface LoginFormProps {
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
  return (
    <>
      <section className="login-form-panel flex flex-1 items-center justify-center px-6 py-9 sm:px-8 lg:px-10 lg:py-10">
        <div className="w-full max-w-[22rem]">
          <ITText as="span" className="login-badge login-rise inline-block rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]">
            {tt("login.badge")}
          </ITText>

          <ITText as="h1" className="login-heading mt-6 text-[26px] font-extrabold tracking-tight sm:text-[30px] sm:leading-[1.1]">
            {tt("login.title")}
          </ITText>
          <ITText className="login-muted login-rise login-rise-2 mt-2 block text-[13px] leading-relaxed">{tt("login.subtitle")}</ITText>

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
                label={tt("login.userLabel")}
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
                <LuLogIn aria-hidden size={16} />
                {isSubmitting ? tt("login.submitting") : tt("login.submit")}
              </ITText>
            </ITButton>
          </form>

          <footer className="login-muted mt-8 flex items-center justify-between text-[11.5px]">
            <ITText as="span">{tt("login.footer")}</ITText>
            <ITText as="span" className="font-medium">v{__APP_VERSION__}</ITText>
          </footer>
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
