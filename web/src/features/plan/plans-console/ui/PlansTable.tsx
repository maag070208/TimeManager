import { ITButton, ITText } from "@axzydev/axzy_ui_system";
import { LuPencil, LuPower, LuPowerOff } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Plan } from "@entities/plan";
import { ToneChip } from "@shared/ui/tone-chip";

interface Props {
  rows: Plan[];
  canManage: boolean;
  onEdit: (plan: Plan) => void;
  onToggleStatus: (plan: Plan) => void;
}

/** Catálogo de planes: nombre/clave, límites, precio mensual y estado. */
export default function PlansTable({ rows, canManage, onEdit, onToggleStatus }: Props) {
  const { t, i18n } = useTranslation("plans");
  const money = (price: string | null) =>
    price === null
      ? t("table.noPrice")
      : new Intl.NumberFormat(i18n.language === "en" ? "en-US" : "es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        }).format(Number(price));

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-left text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">{t("table.plan")}</th>
            <th className="px-3 py-2 text-right">{t("table.people")}</th>
            <th className="px-3 py-2 text-right">{t("table.clocks")}</th>
            <th className="px-3 py-2 text-right">{t("table.price")}</th>
            <th className="px-3 py-2">{t("table.status")}</th>
            <th className="px-3 py-2" aria-label={t("table.actions")} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <td className="rounded-l-xl px-3 py-3">
                <ITText className="block font-semibold text-slate-800 dark:text-slate-100">{row.name}</ITText>
                <ITText as="span" className="block font-mono text-[11px] text-slate-500">
                  {row.key}
                </ITText>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{row.employeeLimit.toLocaleString(i18n.language)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{row.clockLimit}</td>
              <td className="px-3 py-3 text-right tabular-nums">{money(row.monthlyPrice)}</td>
              <td className="px-3 py-3">
                <ToneChip
                  size="sm"
                  dot
                  tone={row.active ? "success" : "warning"}
                  label={t(row.active ? "status.active" : "status.inactive")}
                />
              </td>
              <td className="rounded-r-xl px-3 py-3">
                <div className="flex justify-end gap-2">
                  {canManage && (
                    <>
                      <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onEdit(row)}>
                        <span className="flex items-center gap-1.5">
                          <LuPencil aria-hidden size={13} />
                          {t("actions.edit")}
                        </span>
                      </ITButton>
                      <ITButton variant="outlined" color="secondary" size="sm" onClick={() => onToggleStatus(row)}>
                        <span className="flex items-center gap-1.5">
                          {row.active ? <LuPowerOff aria-hidden size={13} /> : <LuPower aria-hidden size={13} />}
                          {t(row.active ? "actions.deactivate" : "actions.activate")}
                        </span>
                      </ITButton>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
