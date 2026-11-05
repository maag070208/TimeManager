import { ITButton, ITText } from "@axzydev/axzy_ui_system";
import { LuArrowRight, LuClock3, LuKeyRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Tenant } from "@entities/tenant";
import { tenantHost, tenantUrl } from "@shared/api/tenant";
import { ToneChip } from "@shared/ui/tone-chip";

interface Props {
  rows: Tenant[];
  canManage: boolean;
  onEnter: (t: Tenant) => void;
  onToggleStatus: (t: Tenant) => void;
  onEditPlan: (t: Tenant) => void;
  onManageAgent: (t: Tenant) => void;
  /** F3-07: abre relojes operando como el cliente (alta/probar/sync/estación). */
  onManageClocks: (t: Tenant) => void;
}

/** Uso contra límite del plan; en rojo cuando ya se rebasó (p. ej. tras bajar de plan). */
const Usage = ({ usage, limit }: { usage: number; limit: number | null }) => (
  <span className={limit !== null && usage > limit ? "font-semibold text-rose-600" : undefined}>
    {usage}
    {limit !== null ? <span className="text-slate-400"> / {limit}</span> : null}
  </span>
);

/** Clientes de la plataforma: subdominio, estado, uso, plan y acciones. */
export default function TenantsTable({ rows, canManage, onEnter, onToggleStatus, onEditPlan, onManageAgent, onManageClocks }: Props) {
  const { t, i18n } = useTranslation("home");
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-left text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">{t("platform.table.client")}</th>
            <th className="px-3 py-2">{t("platform.table.status")}</th>
            <th className="px-3 py-2 text-right">{t("platform.table.people")}</th>
            <th className="px-3 py-2 text-right">{t("platform.table.clocks")}</th>
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
                  <Usage usage={row.usage.activeUsers} limit={row.limits.people} />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <Usage usage={row.usage.clocks} limit={row.limits.clocks} />
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.plan?.name ?? "—"}</td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{date(row.createdAt)}</td>
                <td className="rounded-r-xl px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <>
                        <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onEditPlan(row)}>
                          {t("platform.actions.plan")}
                        </ITButton>
                        <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onToggleStatus(row)}>
                          {t(active ? "platform.actions.suspend" : "platform.actions.reactivate")}
                        </ITButton>
                      </>
                    )}
                    <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onManageClocks(row)}>
                      <span className="flex items-center gap-1.5">
                        <LuClock3 size={11} />
                        <ITText className="font-bold text-[11px]">{t("platform.actions.clocks")}</ITText>
                      </span>
                    </ITButton>
                    <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onManageAgent(row)}>
                      <span className="flex items-center gap-1.5">
                        <LuKeyRound aria-hidden size={12} />
                        {t("platform.actions.agent")}
                      </span>
                    </ITButton>
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
