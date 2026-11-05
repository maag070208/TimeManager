import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITDialog,
  ITInput,
  ITSelect,
  ITToast, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import { FaUndo } from "react-icons/fa";
import { LuShieldCheck } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { usersApi, type PermissionScope, type UserPermissionView } from "@entities/user";
import { DialogHeader } from "@shared/ui/dialog-header";
import { LangostinState } from "@shared/ui/langostin";

const FOLLOW_ROLE = "__role__";

interface Props {
  userId: string;
}

/**
 * Pestaña "Permisos" de la ficha del usuario (Fase 2). Por permiso muestra lo
 * que da su rol, la excepción (si la hay) y el alcance efectivo; permite subir,
 * bajar o quitar el permiso solo para esta persona.
 */
export default function UserPermissionsPanel({ userId }: Props) {
  const { t } = useTranslation(["users", "roles", "common"]);
  const [rows, setRows] = useState<UserPermissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [editing, setEditing] = useState<{ row: UserPermissionView; scope: PermissionScope } | null>(null);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await usersApi.listPermissions(userId));
    } catch (err) {
      setError((err as { message?: string })?.message ?? t("form.permissions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const byModule = useMemo(() => {
    const map = new Map<string, UserPermissionView[]>();
    for (const row of rows) {
      const list = map.get(row.module) ?? [];
      list.push(row);
      map.set(row.module, list);
    }
    return [...map.entries()];
  }, [rows]);

  const optionsFor = (row: UserPermissionView) => {
    const scopes: PermissionScope[] = ["NONE", ...row.scopes.filter((s) => s !== "NONE")];
    return [
      { value: FOLLOW_ROLE, label: t("form.permissions.followRole") },
      ...scopes.map((scope) => ({ value: scope, label: t(`roles:scope.${scope}`) })),
    ];
  };

  const onChange = async (row: UserPermissionView, value: string) => {
    if (value === FOLLOW_ROLE) {
      setSaving(true);
      try {
        setRows(await usersApi.removePermission(userId, row.permission));
        setToast({ message: t("form.permissions.removed"), type: "success" });
      } catch (err) {
        setToast({ message: (err as { message?: string })?.message ?? t("form.permissions.saveError"), type: "error" });
      } finally {
        setSaving(false);
      }
      return;
    }
    setReason("");
    setExpiresAt("");
    setEditing({ row, scope: value as PermissionScope });
  };

  const confirm = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const iso =
        expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(expiresAt)
          ? new Date(`${expiresAt}T00:00:00.000Z`).toISOString()
          : undefined;
      setRows(
        await usersApi.setPermission(userId, editing.row.permission, {
          scope: editing.scope,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(iso ? { expiresAt: iso } : {}),
        })
      );
      setEditing(null);
      setToast({ message: t("form.permissions.saved"), type: "success" });
    } catch (err) {
      setToast({ message: (err as { message?: string })?.message ?? t("form.permissions.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LangostinState kind="loading" size="sm" />;
  }

  if (error) {
    return (
      <ITAlert variant="error" dismissible={false}>
        {error}
      </ITAlert>
    );
  }

  return (
    <ITStack spacing={4}>
      {byModule.map(([module, permissions]) => (
        <section key={module} className="flex flex-col gap-1.5">
          <ITText className="m-0 text-[12px] font-semibold" style={{ color: "var(--it-bento-muted)" }}>
            {module}
          </ITText>
          <ITStack spacing={1.5}>
            {permissions.map((row) => (
              <div
                key={row.permission}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-3 py-2.5"
                style={{ background: "color-mix(in srgb, currentColor 4%, transparent)" }}
              >
                <div className="min-w-[200px] flex-1">
                  <ITFlex align="center" wrap="wrap" gap={2}>
                    <ITText className="m-0 text-[12.5px] font-bold text-slate-800 dark:text-slate-100">{row.name}</ITText>
                    {row.sensitive && (
                      <ITBadget color="warning" size="sm">
                        {t("roles:matrix.sensitive")}
                      </ITBadget>
                    )}
                    {row.exception && (
                      <ITBadget color="info" size="sm">
                        {t("form.permissions.hasException")}
                      </ITBadget>
                    )}
                  </ITFlex>
                  <ITText className="m-0 font-mono text-[10px] text-slate-400">{row.permission}</ITText>
                </div>

                <ITFlex align="center" wrap="wrap" gap={3}>
                  <ITText className="m-0 text-[10px] text-slate-400">
                    {t("form.permissions.roleScope", { scope: t(`roles:scope.${row.roleScope}`) })}
                  </ITText>
                  <ITBadget color={row.effective === "NONE" ? "gray" : "success"} size="sm">
                    {t(`roles:scopePlain.${row.effective}`)}
                  </ITBadget>
                  <div className="w-40 max-w-full">
                    <ITSelect
                      name={`perm_${row.permission}`}
                      size="sm"
                      options={optionsFor(row)}
                      value={row.exception ? row.exception.scope : FOLLOW_ROLE}
                      disabled={saving}
                      onChange={(e) => onChange(row, e.target.value)}
                    />
                  </div>
                </ITFlex>
              </div>
            ))}
          </ITStack>
        </section>
      ))}

      <ITDialog isOpen={editing !== null} onClose={() => setEditing(null)} className="max-w-md">
        <DialogHeader
          icon={<LuShieldCheck size={20} />}
          title={t("form.permissions.dialogTitle", { permission: editing?.row.name ?? "" })}
          subtitle={t("form.permissions.dialogIntro", { scope: t(`roles:scope.${editing?.scope ?? "NONE"}`) })}
          tone="warning"
        />
        <ITStack spacing={4}>
          <ITInput
            name="exception_reason"
            label={t("form.permissions.reason")}
            placeholder={t("form.permissions.reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <ITInput
            name="exception_expiry"
            type="text"
            label={t("form.permissions.expiresAt")}
            placeholder="YYYY-MM-DD"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" color="secondary" onClick={() => setEditing(null)}>
              <ITText as="span" className="font-bold text-[11px]">{t("common:actions.cancel")}</ITText>
            </ITButton>
            <ITButton variant="filled" color="primary" onClick={confirm} disabled={saving}>
              <ITText as="span" className="flex items-center gap-1">
                <FaUndo size={10} />
                <ITText as="span" className="font-bold text-[11px]">{t("common:actions.save")}</ITText>
              </ITText>
            </ITButton>
          </ITFlex>
        </ITStack>
      </ITDialog>

      {toast && (
        <ITToast
          message={toast.message}
          type={toast.type}
          position="bottom-center"
          duration={2500}
          onClose={() => setToast(null)}
        />
      )}
    </ITStack>
  );
}
