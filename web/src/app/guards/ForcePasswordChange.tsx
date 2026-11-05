import { useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { ITButton, ITInput, ITText } from "@axzydev/axzy_ui_system";
import type { AppDispatch } from "@app/store";
import { authApi, meThunk } from "@entities/user";

/**
 * Bloqueo obligatorio para quien entra con contraseña provisional.
 *
 * No se puede cerrar: no hay botón de cierre, no se cierra al tocar el fondo y
 * el fondo cubre toda la app (los hijos de `PrivateRoutes` no se montan).
 * Al guardar se refresca la sesión (`/auth/me`) y el API deja de marcarla como
 * provisional.
 */
export default function ForcePasswordChange() {
  const { t: tt } = useTranslation(["auth"]);
  const dispatch = useDispatch<AppDispatch>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError(tt("forceChange.min"));
      return;
    }
    if (newPassword !== confirm) {
      setError(tt("forceChange.mismatch"));
      return;
    }
    if (newPassword === currentPassword) {
      setError(tt("forceChange.same"));
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      // Refresca la sesión: la marca de contraseña provisional queda en false.
      await dispatch(meThunk()).unwrap();
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      setError(
        code === "INVALID_PASSWORD"
          ? tt("forceChange.wrongCurrent")
          : code === "PASSWORD_UNCHANGED"
            ? tt("forceChange.same")
            : tt("forceChange.error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-password-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h1 id="force-password-title" className="text-lg font-black text-slate-800">
          {tt("forceChange.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{tt("forceChange.subtitle")}</p>

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <ITInput
            name="currentPassword"
            type="password"
            label={tt("forceChange.current")}
            value={currentPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
            autoFocus
          />
          <ITInput
            name="newPassword"
            type="password"
            label={tt("forceChange.new")}
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
          />
          <ITInput
            name="confirm"
            type="password"
            label={tt("forceChange.confirm")}
            value={confirm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
          />
          {error && (
            <span role="alert" className="block text-xs text-red-500">
              {error}
            </span>
          )}
          <ITButton
            type="submit"
            variant="filled"
            color="primary"
            disabled={saving || !currentPassword || !newPassword || !confirm}
            className="w-full"
          >
            <ITText className="font-bold text-[11px]">
              {saving ? tt("forceChange.saving") : tt("forceChange.submit")}
            </ITText>
          </ITButton>
        </form>
      </div>
    </div>
  );
}
