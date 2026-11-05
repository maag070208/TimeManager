import { ITAlert, ITButton, ITDialog, ITText } from "@axzydev/axzy_ui_system";
import { FaCheck, FaExclamationTriangle, FaMinus, FaPlus, FaUndo } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { PermissionCatalog } from "@entities/permission";
import { roleLabel } from "@entities/user";
import { isScopedPermission } from "../../model/access-levels";
import type { MatrixChangeDetail } from "../../model/useRolesAdmin";
import RoleAvatar from "./RoleAvatar";

interface BarProps {
  changes: readonly MatrixChangeDetail[];
  saving: boolean;
  onDiscard: () => void;
  onReview: () => void;
}

/** Barra fija con los cambios sin guardar de la matriz. */
export function PendingChangesBar({ changes, saving, onDiscard, onReview }: BarProps) {
  const { t } = useTranslation("roles");
  if (changes.length === 0) return null;
  const roles = new Set(changes.map((change) => change.role)).size;
  return (
    <div className="sticky bottom-3 z-40 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-[var(--it-card-bg)]/95 px-3 py-2 shadow-lg backdrop-blur">
      <ITText as="span" className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
      </ITText>
      <ITText className="flex-1 text-[12px] font-bold text-slate-700">
        {t("changes.summary", { count: changes.length, roles })}
      </ITText>
      <ITButton variant="outlined" color="secondary" size="sm" disabled={saving} onClick={onDiscard}>
        <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
          <FaUndo size={10} /> {t("matrix.discard")}
        </ITText>
      </ITButton>
      <ITButton variant="filled" color="primary" size="sm" disabled={saving} onClick={onReview}>
        <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
          <FaCheck size={10} /> {t("changes.review")}
        </ITText>
      </ITButton>
    </div>
  );
}

interface DialogProps {
  isOpen: boolean;
  changes: readonly MatrixChangeDetail[];
  catalog: readonly PermissionCatalog[];
  /** Personas que tienen cada rol (a quién le llega el cambio). */
  peopleOf: (role: string) => number;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** Revisión de los cambios agrupados por rol antes de guardarlos. */
export function ChangesReviewDialog({ isOpen, changes, catalog, peopleOf, saving, error, onClose, onConfirm }: DialogProps) {
  const { t } = useTranslation("roles");
  const definition = (key: string) => catalog.find((item) => item.key === key);
  const byRole = new Map<string, MatrixChangeDetail[]>();
  for (const change of changes) byRole.set(change.role, [...(byRole.get(change.role) ?? []), change]);
  const sensitiveGrants = changes.filter(
    (change) => change.from === "NONE" && change.scope !== "NONE" && definition(change.permission)?.sensitive
  );

  const scopeText = (key: string, scope: MatrixChangeDetail["scope"]) => {
    const permission = definition(key);
    if (scope === "NONE") return t("scopePlain.NONE");
    return permission && isScopedPermission(permission) ? t(`scope.${scope}`) : t("matrix.granted");
  };

  return (
    <ITDialog isOpen={isOpen} onClose={onClose} title={t("changes.title")}>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
        <ITText className="text-[12px] text-slate-600">
          {t("changes.headline", {
            count: changes.length,
            roles: byRole.size,
            people: [...byRole.keys()].reduce((sum, role) => sum + peopleOf(role), 0),
          })}
        </ITText>
        {error && (
          <ITAlert variant="error" dismissible={false}>
            {error}
          </ITAlert>
        )}
        {[...byRole.entries()].map(([role, list]) => (
          <div key={role} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <RoleAvatar role={role} size="sm" />
              <ITText as="span" className="text-[12px] font-black text-slate-700">{roleLabel(role)}</ITText>
              <ITText as="span" className="ml-auto text-[10px] font-bold text-slate-400">
                {t("changes.roleImpact", { count: list.length, people: peopleOf(role) })}
              </ITText>
            </div>
            <ul className="divide-y divide-slate-100">
              {list.map((change) => {
                const added = change.from === "NONE";
                const removed = change.scope === "NONE";
                return (
                  <li key={change.permission} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                    <ITText as="span"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                        added ? "bg-emerald-50 text-emerald-600" : removed ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {added ? <FaPlus size={8} /> : removed ? <FaMinus size={8} /> : <ITText as="span" className="text-[10px] font-black">~</ITText>}
                    </ITText>
                    <ITText as="span" className="min-w-0 flex-1 truncate text-slate-700">
                      {definition(change.permission)?.name ?? change.permission}
                      {definition(change.permission)?.sensitive && (
                        <FaExclamationTriangle size={9} className="ml-1 inline text-amber-500" />
                      )}
                    </ITText>
                    <ITText as="span" className="shrink-0 text-[11px]">
                      {!added && <ITText as="span" className="text-slate-400 line-through">{scopeText(change.permission, change.from)}</ITText>}
                      {!added && !removed && <ITText as="span" className="mx-1 text-slate-300">→</ITText>}
                      {!removed && <ITText as="b" className="text-slate-700">{scopeText(change.permission, change.scope)}</ITText>}
                    </ITText>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {sensitiveGrants.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <FaExclamationTriangle size={12} className="mt-0.5 shrink-0" />
            <ITText as="span">
              {t("changes.sensitive", {
                count: sensitiveGrants.length,
                names: sensitiveGrants.map((change) => definition(change.permission)?.name ?? change.permission).join(", "),
              })}
            </ITText>
          </div>
        )}
        <ITText className="text-[10px] text-slate-400">{t("changes.applies")}</ITText>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <ITButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          <ITText as="span" className="text-[11px] font-bold">{t("changes.keepEditing")}</ITText>
        </ITButton>
        <ITButton variant="filled" color="primary" onClick={onConfirm} disabled={saving || changes.length === 0}>
          <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
            <FaCheck size={10} /> {saving ? t("matrix.saving") : t("changes.confirm")}
          </ITText>
        </ITButton>
      </div>
    </ITDialog>
  );
}
