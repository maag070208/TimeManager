import { useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITDataTable,
  ITDatePicker,
  ITDialog,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
  type Column,
  type ITDataTableFetchParams,
  type ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { ITPage } from "@shared/ui/page";
import { LuShieldCheck } from "react-icons/lu";
import { auditApi, type AuditLog } from "@entities/audit-log";
import { tenantApi, type Tenant } from "@entities/tenant";
import { usersApi, type User } from "@entities/user";
import { formatDateTime } from "@shared/utils/dates";
import { DialogHeader } from "@shared/ui/dialog-header";
import { HelpTip } from "@shared/ui/help-tip";
import { useClientContext } from "@features/tenant/tenant-switcher";

const MODULES = ["Auth", "User", "Tenant", "Plan", "Payroll", "Schedule", "LeaveType", "DocumentType", "Department", "Permission", "Role", "TimeClock", "Access", "Nom", "Hr", "Config"];
const COMMON_ACTIONS = [
  "LOGIN",
  "ACCESS_DENIED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "USER_PASSWORD_CHANGED",
  "SCHEDULE_ASSIGNED",
  "REMOTE_PUNCH_RECORDED",
  "PUNCH_DISCREPANCY_REPORTED",
  "OVERTIME_REQUESTED",
  "OVERTIME_APPROVAL_DECISION",
  "PAYROLL_WEEK_CLOSED",
  "STPS_EXPORT_DOWNLOADED",
  "LEAVE_TYPE_CREATED",
  "LEAVE_TYPE_UPDATED",
  "LEAVE_TYPE_DEACTIVATED",
  "TENANT_UPDATED",
  "TENANT_IMPERSONATED",
  "PLAN_UPDATED",
];

/** `STPS_EXPORT_DOWNLOADED` → `Stps export downloaded` cuando no hay traducción. */
const humanize = (code: string): string => {
  const words = code.toLowerCase().split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Consola de auditoría: logs inmutables con filtros y detalle. */
export default function AuditLogPage() {
  const { t } = useTranslation("audit");
  const { isPlatform } = useClientContext();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filters, setFilters] = useState({ tenantId: "", userId: "", module: "", action: "", q: "" });

  useEffect(() => {
    if (isPlatform) tenantApi.list().then(setTenants).catch(() => setTenants([]));
    usersApi.people().then(setPeople).catch(() => setPeople([]));
  }, [isPlatform]);

  const tenantName = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant.name])), [tenants]);
  const personName = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);

  const actionLabel = (code: string) => t(`actions.${code}`, { defaultValue: humanize(code) });
  const moduleLabel = (code: string) => t(`modules.${code}`, { defaultValue: code });
  const tenantLabel = (row: AuditLog) => (row.tenantId ? tenantName.get(row.tenantId) ?? row.tenantId : t("platform"));
  const userLabel = (row: AuditLog) => row.userName ?? (row.userId ? personName.get(row.userId) ?? row.userId.slice(0, 8) : t("system"));

  const columns: Column<AuditLog>[] = [
    { key: "createdAt", label: t("columns.date"), type: "string", width: 150, render: (row) => <span className="text-[12px] tabular-nums">{formatDateTime(row.createdAt)}</span> },
    ...(isPlatform ? [{ key: "tenant", label: t("columns.tenant"), type: "string" as const, width: 160, render: (row: AuditLog) => <span className="block truncate text-[12px] text-slate-600">{tenantLabel(row)}</span> }] : []),
    { key: "user", label: t("columns.user"), type: "string", width: 170, render: (row) => <span className="block truncate text-[12px] font-semibold text-slate-700">{userLabel(row)}</span> },
    { key: "module", label: t("columns.module"), type: "string", width: 150, render: (row) => <ITBadget color="info" size="sm">{moduleLabel(row.module ?? row.entityType)}</ITBadget> },
    { key: "action", label: t("columns.action"), type: "string", width: 260, render: (row) => <span className="block truncate text-[12px] text-slate-700" title={row.action}>{actionLabel(row.action)}</span> },
    { key: "entity", label: t("columns.entity"), type: "string", width: 200, render: (row) => <span className="block truncate text-[11.5px] text-slate-500">{row.entityType} · {row.entityId.slice(0, 8)}</span> },
    { key: "ip", label: t("columns.ip"), type: "string", width: 120, render: (row) => <span className="font-mono text-[11px] text-slate-500">{row.ipAddress ?? "—"}</span> },
  ];

  const fetchData = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<AuditLog>> => {
    const result = await auditApi.list({ ...filters, start: range[0]?.toISOString(), end: range[1]?.toISOString(), page: params.page, limit: params.limit });
    return { data: result.data, total: result.total };
  };
  const tableKey = JSON.stringify({ filters, from: range[0]?.toISOString(), to: range[1]?.toISOString() });

  return (
    <ITPage title={t("title")} description={t("description")} icon={<LuShieldCheck size={20} />}>
      <div className="flex flex-col gap-4 pb-12">
        <ITAlert variant="warning" dismissible={false}>
          {isPlatform ? t("alert.platform") : t("alert.client")}
        </ITAlert>

        <ITCard contentClassName="!p-4">
          <ITFlex align="end" wrap="wrap" gap={2}>
            {isPlatform && (
              <div className="min-w-[190px] flex-1"><ITSearchSelect name="auditTenant" label={t("filters.tenant")} value={filters.tenantId} onChange={(value) => setFilters((f) => ({ ...f, tenantId: String(value) }))} options={[{ value: "", label: t("filters.allTenants") }, ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))]} /></div>
            )}
            <div className="min-w-[190px] flex-1"><ITSearchSelect name="auditUser" label={t("filters.person")} value={filters.userId} onChange={(value) => setFilters((f) => ({ ...f, userId: String(value) }))} options={[{ value: "", label: t("filters.allPeople") }, ...people.map((person) => ({ value: person.id, label: person.name }))]} /></div>
            <div className="min-w-[170px] flex-1"><ITSearchSelect name="auditModule" label={t("filters.module")} value={filters.module} onChange={(value) => setFilters((f) => ({ ...f, module: String(value) }))} options={[{ value: "", label: t("filters.allModules") }, ...MODULES.map((module) => ({ value: module, label: moduleLabel(module) }))]} /></div>
            <div className="min-w-[200px] flex-1"><ITSearchSelect name="auditAction" label={t("filters.action")} value={filters.action} onChange={(value) => setFilters((f) => ({ ...f, action: String(value) }))} options={[{ value: "", label: t("filters.allActions") }, ...COMMON_ACTIONS.map((action) => ({ value: action, label: actionLabel(action) }))]} /></div>
            <div className="min-w-[260px] flex-[1.4]"><ITInput name="auditSearch" label={t("filters.search")} placeholder={t("filters.searchPlaceholder")} value={filters.q} onChange={(event) => setFilters((f) => ({ ...f, q: event.target.value }))} /></div>
          </ITFlex>
          <ITFlex className="mt-3" align="end" gap={2} wrap="wrap">
            <div className="min-w-[260px] flex-1"><ITDatePicker name="auditRange" label={t("filters.range")} range value={range} onChange={(event) => { const next = event.target.value; if (Array.isArray(next)) setRange(next as [Date | null, Date | null]); }} /></div>
            <ITButton variant="outlined" color="gray" onClick={() => { setFilters({ tenantId: "", userId: "", module: "", action: "", q: "" }); setRange([null, null]); }}>{t("filters.clear")}</ITButton>
            <HelpTip text={t("filters.help")} />
          </ITFlex>
        </ITCard>

        <ITCard className="tm-hero-card tm-hero-card--slate" contentClassName="!p-5">
          <ITDataTable key={tableKey} columns={columns as unknown as Column<Record<string, unknown>>[]} fetchData={fetchData as never} showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={480} rowHeight={50} onRowClick={(row) => setSelected(row as unknown as AuditLog)} />
        </ITCard>
      </div>

      <ITDialog isOpen={!!selected} onClose={() => setSelected(null)} className="max-w-2xl">
        <DialogHeader icon={<LuShieldCheck size={20} />} title={t("detail.title")} subtitle={t("detail.subtitle")} />
        {selected && (
          <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[12px]">
              <Info label={t("detail.date")} value={formatDateTime(selected.createdAt)} />
              <Info label={t("detail.tenant")} value={tenantLabel(selected)} />
              <Info label={t("detail.user")} value={userLabel(selected)} />
              <Info label={t("detail.module")} value={moduleLabel(selected.module ?? selected.entityType)} />
              <Info label={t("detail.action")} value={actionLabel(selected.action)} />
              <Info label={t("detail.code")} value={selected.action} />
              <Info label={t("detail.entity")} value={`${selected.entityType} · ${selected.entityId}`} />
              <Info label={t("detail.ip")} value={selected.ipAddress ?? "—"} />
              <Info label={t("detail.agent")} value={selected.userAgent ?? "—"} wide />
            </div>
            <JsonBlock title={t("detail.roles")} value={selected.roles} />
            <JsonBlock title={t("detail.permissions")} value={selected.permissions} />
            <JsonBlock title={t("detail.previous")} value={selected.previousState} />
            <JsonBlock title={t("detail.next")} value={selected.newState} />
            <JsonBlock title={t("detail.metadata")} value={selected.metadata} />
          </div>
        )}
        <ITFlex justify="end" className="mt-4"><ITButton variant="filled" color="primary" className="tm-save-button" onClick={() => setSelected(null)}>{t("detail.close")}</ITButton></ITFlex>
      </ITDialog>
    </ITPage>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <ITText className="block !text-[10px] font-bold uppercase tracking-wide !text-slate-400">{label}</ITText>
      <ITText className="block break-all !text-[12px] text-slate-700">{value}</ITText>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value?: Record<string, any> | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <ITText className="block !text-[11px] font-bold !text-slate-500">{title}</ITText>
      <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-[10.5px] leading-relaxed text-slate-700">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
