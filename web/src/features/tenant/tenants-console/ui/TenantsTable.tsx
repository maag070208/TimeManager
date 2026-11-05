import { ITButton, ITText } from "@axzydev/axzy_ui_system";
import { LuArrowRight } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Tenant } from "@entities/tenant";
import { tenantHost, tenantUrl } from "@shared/api/tenant";
import { ToneChip } from "@shared/ui/tone-chip";

interface Props {
  rows: Tenant[];
  canManage: boolean;
  onEnter: (t: Tenant) => void;
  onToggleStatus: (t: Tenant) => void;
}

/** Clientes de la plataforma: subdominio, estado, uso y acciones. */
export default function TenantsTable({ rows, canManage, onEnter, onToggleStatus }: Props) {
  const { t, i18n } = useTranslation("home");
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-left text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">{t("platform.table.client")}</th>
            <th className="px-3 py-2">{t("platform.table.status")}</th>
            <th className="px-3 py-2 text-right">{t("platform.table.people")}</th>
            <th className="px-3 py-2">{t("platform.table.plan")}</th>
            <th className="px-3 py-2">{t("platform.table.since")}</th>
            <th className="px-3 py-2" aria-label={t("platform.table.actions")} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = row.status === "ACTIVE";
            return (
              <tr key={row.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <td className="rounded-l-xl px-3 py-3">
                  <ITText className="block font-semibold text-slate-800 dark:text-slate-100">{row.name}</ITText>
                  <a
                    href={tenantUrl(row.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-500 underline-offset-2 hover:underline"
                  >
                    {tenantHost(row.slug)}
                  </a>
                </td>
                <td className="px-3 py-3">
                  <ToneChip
                    size="sm"
                    dot
                    tone={active ? "success" : "warning"}
                    label={t(active ? "platform.status.active" : "platform.status.suspended")}
                  />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {row.usage.activeUsers}
                  {row.employeeLimit ? <span className="text-slate-400"> / {row.employeeLimit}</span> : null}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.plan ?? "—"}</td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{date(row.createdAt)}</td>
                <td className="rounded-r-xl px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onToggleStatus(row)}>
                        {t(active ? "platform.actions.suspend" : "platform.actions.reactivate")}
                      </ITButton>
                    )}
                    <ITButton variant="filled" color="primary" size="sm" disabled={!active} onClick={() => onEnter(row)}>
                      <span className="flex items-center gap-1.5">
                        {t("platform.actions.enter")}
                        <LuArrowRight aria-hidden size={13} />
                      </span>
                    </ITButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
