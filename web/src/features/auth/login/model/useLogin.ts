import { useState } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { loginThunk } from "@entities/user";
import type { AppDispatch } from "@app/store";
import { i18n } from "@shared/i18n";

export const useLogin = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { t: tt } = useTranslation(["auth"]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [deactivatedMsg, setDeactivatedMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const validate = (): boolean => {
    const e: { username?: string; password?: string } = {};
    if (!username.trim()) e.username = i18n.t("auth:login.validation.usernameRequired");
    else if (username.trim().length < 3) e.username = i18n.t("auth:login.validation.usernameMin", { min: 3 });
    if (!password) e.password = i18n.t("auth:login.validation.passwordRequired");
    else if (password.length < 6) e.password = i18n.t("auth:login.validation.passwordMin", { min: 6 });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!validate()) return false;
    setIsSubmitting(true);
    setDeactivatedMsg(null);
    const action = await dispatch(loginThunk({ username, password }));
    if (loginThunk.fulfilled.match(action)) {
      return true;
    }
    setIsSubmitting(false);
    // Diferenciamos cuenta dada de baja vs credenciales inválidas.
    const rejected = action.payload as unknown;
    if (
      rejected &&
      typeof rejected === "object" &&
      "code" in (rejected as Record<string, unknown>)
    ) {
      const code = (rejected as { code?: string }).code;
      if (code === "ACCOUNT_DEACTIVATED") {
        const reason = (rejected as { details?: { reason?: string } }).details?.reason;
        setDeactivatedMsg(
          reason
            ? i18n.t("auth:login.deactivatedWithReason", { reason })
            : i18n.t("auth:login.deactivated")
        );
        return false;
      }
    }
    setToast({ message: tt("login.invalidCredentials"), type: "error" });
    return false;
  };

  const canSubmit = !!username && !!password;

  return {
    username,
    password,
    setUsername,
    setPassword,
    errors,
    isSubmitting,
    canSubmit,
    deactivatedMsg,
    toast,
    dismissToast: () => setToast(null),
    handleSubmit,
  };
};