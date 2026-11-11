import type { ReactNode } from "react";
import { ITDataTable, ITText, type Column, type ITDataTableFetchParams, type ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuBlocks, LuClock3, LuExternalLink, LuUsersRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Tenant } from "@entities/tenant";
import { tenantHost, tenantUrl } from "@shared/api/tenant";
import { TENANT_MODULES } from "@shared/lib/tenant-modules";
import { ToneChip } from "@shared/ui/tone-chip";

interface Props {
  rows: Tenant[];
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

/** Uso contra límite con barra; en rojo cuando ya se rebasó (p. ej. tras bajar de plan). */
const Usage = ({ icon, usage, limit, unlimited }: { icon: ReactNode; usage: number; limit: number | null; unlimited: string }) => {
  const over = limit !== null && usage > limit;
  const percent = limit ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
  return (
    <div className="min-w-0">
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <span className="text-slate-400">{icon}</span>
        <span className={over ? "font-semibold text-rose-600" : "font-semibold"}>{usage}</span>
        <span className="text-slate-400">/ {limit ?? unlimited}</span>
      </span>
      {limit !== null && (
        <span className="mt-1 block h-1 w-full max-w-[96px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <span
            className={`block h-full rounded-full ${over ? "bg-rose-500" : percent >= 85 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.max(percent, usage > 0 ? 4 : 0)}%` }}
          />
        </span>
      )}
    </div>
  );
};

/** Clientes de la plataforma: entrada, estado, plan y uso contra límites; las acciones viven en el detalle. */
export default function TenantsTable({ rows }: Props) {
  const { t, i18n } = useTranslation("home");
  const navigate = useNavigate();
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });
  const money = (value: string) => Number(value).toLocaleString(i18n.language, { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const columns: Column<Tenant>[] = [
    {
      key: "name",
      label: t("platform.table.client"),
      type: "string",
      cellClassName: "min-w-[220px]",
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[12px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {initials(row.name)}
          </span>
          <div className="min-w-0">
            <ITText className="block truncate font-semibold text-slate-800 dark:text-slate-100">{row.name}</ITText>
            <a
              href={tenantUrl(row.slug)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-[11.5px] text-slate-500 underline-offset-2 hover:underline"
            >
              <span className="truncate">{tenantHost(row.slug)}</span>
              <LuExternalLink size={11} className="shrink-0" />
            </a>
          </div>
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
      key: "plan",
      label: t("platform.table.plan"),
      type: "string",
      render: (row) =>
        row.plan ? (
          <div className="min-w-0">
            <span className="block truncate font-semibold">{row.plan.name}</span>
            {row.plan.monthlyPrice && (
              <span className="block text-[11.5px] text-slate-400 tabular-nums">
                {money(row.plan.monthlyPrice)}
                {t("platform.table.perMonth")}
              </span>
            )}
          </div>
        ) : (
          <span className="font-semibold text-amber-600">{t("platform.table.noPlan")}</span>
        ),
    },
    {
      key: "people",
      label: t("platform.table.people"),
      type: "number",
      render: (row) => <Usage icon={<LuUsersRound size={13} />} usage={row.usage.activeUsers} limit={row.limits.people} unlimited={t("platform.table.unlimited")} />,
    },
    {
      key: "clocks",
      label: t("platform.table.clocks"),
      type: "number",
      render: (row) => <Usage icon={<LuClock3 size={13} />} usage={row.usage.clocks} limit={row.limits.clocks} unlimited={t("platform.table.unlimited")} />,
    },
    {
      key: "modules",
      label: t("platform.table.modules"),
      type: "number",
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <LuBlocks size={13} className="text-slate-400" />
          <span className="font-semibold">{TENANT_MODULES.length - (row.disabledModules?.length ?? 0)}</span>
          <span className="text-slate-400">/ {TENANT_MODULES.length}</span>
        </span>
      ),
    },
    {
      key: "createdAt",
      label: t("platform.table.since"),
      type: "string",
      render: (row) => (
        <div className="min-w-0">
          <span className="block whitespace-nowrap">{date(row.createdAt)}</span>
          <span className="block truncate text-[11.5px] text-slate-400">{row.timezone.replace("America/", "").replace(/_/g, " ")}</span>
        </div>
      ),
    },
  ];

  const fetchData = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<Tenant>> => {
    const start = (params.page - 1) * params.limit;
    return { data: rows.slice(start, start + params.limit), total: rows.length };
  };

  const version = rows.map((row) => `${row.id}:${row.status}:${row.plan?.id ?? ""}:${row.slug}`).join("|");

  return (
    <ITDataTable
      showViewToggle={false}
      defaultItemsPerPage={25}
      itemsPerPageOptions={[25, 50, 100]}
      density="compact"
      reloadTrigger={version}
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      fetchData={fetchData as never}
      onRowClick={(row) => navigate(`/tenants/${(row as unknown as Tenant).id}`)}
    />
  );
}
