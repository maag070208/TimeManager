import { ITButton, ITDataTable, ITText, type Column, type ITDataTableFetchParams, type ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuArrowRight, LuBadgeDollarSign, LuClock3, LuKeyRound, LuPause, LuPlay } from "react-icons/lu";
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

  const columns: Column<Tenant>[] = [
    {
      key: "name",
      label: t("platform.table.client"),
      type: "string",
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <ITText className="block truncate font-semibold text-slate-800 dark:text-slate-100">{row.name}</ITText>
          <a
            href={tenantUrl(row.slug)}
            target="_blank"
            rel="noreferrer"
            className="text-[11.5px] text-slate-500 underline-offset-2 hover:underline"
          >
            {tenantHost(row.slug)}
          </a>
        </div>
      ),
    },
    {
      key: "status",
      label: t("platform.table.status"),
      type: "string",
      render: (row) => (
        <ToneChip
          size="sm"
          dot
          tone={row.status === "ACTIVE" ? "success" : "warning"}
          label={t(row.status === "ACTIVE" ? "platform.status.active" : "platform.status.suspended")}
        />
      ),
    },
    {
      key: "people",
      label: t("platform.table.people"),
      type: "number",
      className: "text-right",
      render: (row) => <Usage usage={row.usage.activeUsers} limit={row.limits.people} />,
    },
    {
      key: "clocks",
      label: t("platform.table.clocks"),
      type: "number",
      className: "text-right",
      render: (row) => <Usage usage={row.usage.clocks} limit={row.limits.clocks} />,
    },
    {
      key: "plan",
      label: t("platform.table.plan"),
      type: "string",
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.plan?.name ?? "—"}</span>,
    },
    {
      key: "since",
      label: t("platform.table.since"),
      type: "string",
      sortable: true,
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{date(row.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      type: "actions",
      cellClassName: "min-w-[300px] whitespace-nowrap",
      actions: (row) => {
        const active = row.status === "ACTIVE";
        return (
          <div className="flex flex-nowrap justify-end gap-1.5">
            {canManage && (
              <>
                <ITButton variant="outlined" color="primary" className="tm-icon-button shrink-0" aria-label="Asignar plan" title="Asignar plan" onClick={() => onEditPlan(row)}>
                  <LuBadgeDollarSign size={14} />
                </ITButton>
                <ITButton variant="outlined" color={active ? "warning" : "success"} className="tm-icon-button shrink-0" aria-label={t(active ? "platform.actions.suspend" : "platform.actions.reactivate")} title={t(active ? "platform.actions.suspend" : "platform.actions.reactivate")} onClick={() => onToggleStatus(row)}>
                  {active ? <LuPause size={14} /> : <LuPlay size={14} />}
                </ITButton>
              </>
            )}
            <ITButton variant="outlined" color="secondary" className="tm-icon-button shrink-0" aria-label={t("platform.actions.clocks")} title={t("platform.actions.clocks")} onClick={() => onManageClocks(row)}>
              <LuClock3 size={14} />
            </ITButton>
            <ITButton variant="outlined" color="secondary" className="tm-icon-button shrink-0" aria-label={t("platform.actions.agent")} title={t("platform.actions.agent")} onClick={() => onManageAgent(row)}>
              <LuKeyRound size={14} />
            </ITButton>
            <ITButton variant="filled" color="primary" size="sm" className="shrink-0 whitespace-nowrap" disabled={!active} onClick={() => onEnter(row)}>
              <span className="inline-flex items-center gap-1">{t("platform.actions.enter")} <LuArrowRight size={13} /></span>
            </ITButton>
          </div>
        );
      },
    },
  ];

  const fetchData = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<Tenant>> => {
    const sorted = [...rows];
    const sort = params.sort;
    if (sort?.key) {
      const direction = sort.direction === "desc" ? -1 : 1;
      sorted.sort((a, b) => {
        const left = sort.key === "since" ? a.createdAt : String(a[sort.key as keyof Tenant] ?? "");
        const right = sort.key === "since" ? b.createdAt : String(b[sort.key as keyof Tenant] ?? "");
        return left.localeCompare(right) * direction;
      });
    }
    const start = (params.page - 1) * params.limit;
    return { data: sorted.slice(start, start + params.limit), total: sorted.length };
  };

  return (
    <ITDataTable
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      fetchData={fetchData as unknown as (params: ITDataTableFetchParams) => Promise<ITDataTableResponse<Record<string, unknown>>>}
      reloadTrigger={rows.map((row) => `${row.id}:${row.status}:${row.planId ?? ""}:${row.usage.activeUsers}:${row.usage.clocks}`).join("|")}
      defaultItemsPerPage={8}
      itemsPerPageOptions={[8, 16, 32]}
      layout="auto"
      density="compact"
      showViewToggle={false}
      variant="minimal"
      containerClassName="overflow-x-auto"
    />
  );
}
