import { useEffect, useState } from "react";
import { ITButton, ITDialog, ITInput, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import type { PermissionCatalog } from "@entities/permission";
import { usersApi, type PermissionScope } from "@entities/user";
import { grantableScopes, isScopedPermission } from "../../model/access-levels";
import { ChoiceCard, DialogFooter, DialogSection } from "../shared/DialogParts";

type Expiry = "default" | "never" | "date";

interface Props {
  isOpen: boolean;
  userId: string;
  personName: string;
  permission: PermissionCatalog | null;
  /** `grant` = darle (o cambiarle el alcance); `revoke` = quitárselo aunque su rol lo tenga. */
  mode: "grant" | "revoke";
  onClose: () => void;
  onSaved: (message: string) => void;
}

const SCOPE_EXAMPLE: Record<Exclude<PermissionScope, "NONE">, "help.scopeOwnExample" | "help.scopeAreaExample" | "help.scopeAllExample"> = {
  OWN: "help.scopeOwnExample",
  AREA: "help.scopeAreaExample",
  ALL: "help.scopeAllExample",
};

/** Fin del día local elegido, en ISO (la excepción vale todo ese día). */
const endOfDayIso = (date: string): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
};

/**
 * Excepción para una sola persona: no toca su rol. Sirve para cubrir a alguien
 * o un caso temporal ("dale aprobar horas extra mientras el jefe está de
 * vacaciones"). Pregunta qué alcance, por qué y hasta cuándo.
 */
export default function ExceptionDialog({ isOpen, userId, personName, permission, mode, onClose, onSaved }: Props) {
  const { t } = useTranslation("roles");
  const [scope, setScope] = useState<PermissionScope>("ALL");
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState<Expiry>("default");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !permission) return;
    const scopes = grantableScopes(permission);
    setScope(mode === "revoke" ? "NONE" : scopes.includes("ALL") ? "ALL" : scopes[0] ?? "ALL");
    setReason("");
    setExpiry("default");
    setDate("");
    setError(null);
  }, [isOpen, permission, mode]);

  if (!permission) return null;
  const firstName = personName.split(/\s+/)[0] ?? personName;

  const save = async () => {
    if (expiry === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(t("exception.errors.date"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.setPermission(userId, permission.key, {
        scope,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(expiry === "never" ? { expiresAt: null } : expiry === "date" ? { expiresAt: endOfDayIso(date) } : {}),
      });
      onSaved(mode === "revoke" ? t("exception.revoked", { name: firstName }) : t("exception.granted", { name: firstName }));
      onClose();
    } catch (err) {
      setError((err as { message?: string })?.message ?? t("exception.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ITDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "revoke"
          ? t("exception.revokeTitle", { name: firstName })
          : t("exception.grantTitle", { name: firstName })
      }
      useFormHeader
    >
      <ITStack spacing={4}>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <ITText className="text-[13px] font-bold text-slate-800">{permission.name}</ITText>
          <ITText className="text-[11px] text-slate-500">
            {mode === "revoke" ? t("exception.revokeIntro", { name: firstName }) : t("exception.grantIntro", { name: firstName })}
          </ITText>
        </div>

        {mode === "grant" && isScopedPermission(permission) && (
          <DialogSection step={1} title={t("exception.scopeQuestion")}>
            <div className="grid gap-2">
              {grantableScopes(permission).map((item) => (
                <ChoiceCard
                  key={item}
                  selected={scope === item}
                  onClick={() => setScope(item)}
                  title={t(`scopePlain.${item}`)}
                  description={item === "NONE" ? undefined : t(SCOPE_EXAMPLE[item])}
                />
              ))}
            </div>
          </DialogSection>
        )}

        <DialogSection
          step={mode === "grant" && isScopedPermission(permission) ? 2 : 1}
          title={t("exception.reasonQuestion")}
          hint={t("exception.reasonHint")}
        >
          <ITInput
            name="exception_reason"
            placeholder={t("exception.reasonPlaceholder")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogSection>

        <DialogSection step={mode === "grant" && isScopedPermission(permission) ? 3 : 2} title={t("exception.expiryQuestion")}>
          <div className="grid gap-2 sm:!grid-cols-3">
            <ChoiceCard
              selected={expiry === "default"}
              onClick={() => setExpiry("default")}
              title={t("exception.expiry.default")}
              description={t("exception.expiry.defaultHint")}
            />
            <ChoiceCard
              selected={expiry === "date"}
              onClick={() => setExpiry("date")}
              title={t("exception.expiry.date")}
              description={t("exception.expiry.dateHint")}
            />
            <ChoiceCard
              selected={expiry === "never"}
              onClick={() => setExpiry("never")}
              title={t("exception.expiry.never")}
              description={t("exception.expiry.neverHint")}
            />
          </div>
          {expiry === "date" && (
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 rounded-lg border border-slate-300 bg-[var(--it-card-bg)] px-3 py-1.5 text-[12px] text-slate-700 focus:border-primary-500 focus:outline-none"
            />
          )}
        </DialogSection>

        {error && <ITText className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</ITText>}

        <DialogFooter>
          <ITButton variant="outlined" color="secondary" onClick={onClose}>
            <ITText as="span" className="text-[11px] font-bold">{t("roleDialog.cancel")}</ITText>
          </ITButton>
          <ITButton variant="filled" color={mode === "revoke" ? "danger" : "primary"} onClick={save} disabled={saving}>
            <ITText as="span" className="text-[11px] font-bold">
              {saving ? t("roleDialog.saving") : mode === "revoke" ? t("exception.revokeConfirm") : t("exception.grantConfirm")}
            </ITText>
          </ITButton>
        </DialogFooter>
      </ITStack>
    </ITDialog>
  );
}
