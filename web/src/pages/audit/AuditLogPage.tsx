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
import { ITPage } from "@shared/ui/page";
import { LuShieldCheck } from "react-icons/lu";
import { auditApi, type AuditLog } from "@entities/audit-log";
import { tenantApi, type Tenant } from "@entities/tenant";
import { usersApi, type User } from "@entities/user";
import { formatDateTime } from "@shared/utils/dates";
import { DialogHeader } from "@shared/ui/dialog-header";
import { HelpTip } from "@shared/ui/help-tip";

const MODULES = ["Auth", "User", "Tenant", "Plan", "Payroll", "Schedule", "LeaveType", "DocumentType", "Department", "Permission", "Role", "TimeClock", "Access", "Nom", "Hr", "Config"];
const COMMON_ACTIONS = ["LOGIN", "ACCESS_DENIED", "LEAVE_TYPE_CREATED", "LEAVE_TYPE_UPDATED", "LEAVE_TYPE_DEACTIVATED", "USER_CREATED", "USER_UPDATED", "USER_DEACTIVATED", "TENANT_UPDATED", "PLAN_UPDATED"];

/** Consola de auditoría de plataforma: logs inmutables con filtros y detalle. */
export default function AuditLogPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filters, setFilters] = useState({ tenantId: "", userId: "", module: "", action: "", q: "" });

  useEffect(() => {
    tenantApi.list().then(setTenants).catch(() => setTenants([]));
    usersApi.people().then(setPeople).catch(() => setPeople([]));
  }, []);

  const tenantName = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant.name])), [tenants]);

  const columns: Column<AuditLog>[] = [
    { key: "createdAt", label: "Fecha y hora", type: "string", width: 180, render: (row) => <span className="text-[12px] tabular-nums">{formatDateTime(row.createdAt)}</span> },
    { key: "tenant", label: "Cliente", type: "string", width: 170, render: (row) => <span className="text-[12px] text-slate-600">{row.tenantId ? tenantName.get(row.tenantId) ?? row.tenantId : "Plataforma"}</span> },
    { key: "user", label: "Usuario", type: "string", width: 170, render: (row) => <span className="text-[12px] font-semibold text-slate-700">{row.userName ?? row.userId ?? "—"}</span> },
    { key: "module", label: "Módulo", type: "string", width: 140, render: (row) => <ITBadget color="info" size="sm">{row.module ?? row.entityType}</ITBadget> },
    { key: "action", label: "Acción", type: "string", render: (row) => <span className="font-mono text-[11px] text-slate-700">{row.action}</span> },
    { key: "entity", label: "Entidad", type: "string", width: 220, render: (row) => <span className="text-[11.5px] text-slate-500">{row.entityType} · {row.entityId.slice(0, 8)}</span> },
    { key: "ip", label: "IP", type: "string", width: 130, render: (row) => <span className="font-mono text-[11px] text-slate-500">{row.ipAddress ?? "—"}</span> },
  ];

  const fetchData = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<AuditLog>> => {
    const result = await auditApi.list({ ...filters, start: range[0]?.toISOString(), end: range[1]?.toISOString(), page: params.page, limit: params.limit });
    return { data: result.data, total: result.total };
  };
  const tableKey = JSON.stringify({ filters, from: range[0]?.toISOString(), to: range[1]?.toISOString() });

  return (
    <ITPage title="Auditoría" description="Registro inmutable de acciones: quién, qué módulo, qué acción, cuándo y con qué accesos." icon={<LuShieldCheck size={20} />}>
      <div className="flex flex-col gap-4 pb-12">
        <ITAlert variant="warning" dismissible={false}>
          Los logs de auditoría no se editan ni se borran. Se conservan como evidencia de operación para todos los clientes.
        </ITAlert>

        <ITCard contentClassName="!p-4">
          <ITFlex align="end" wrap="wrap" gap={2}>
            <div className="min-w-[190px] flex-1"><ITSearchSelect name="auditTenant" label="Cliente" value={filters.tenantId} onChange={(value) => setFilters((f) => ({ ...f, tenantId: String(value) }))} options={[{ value: "", label: "Todos los clientes" }, ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))]} /></div>
            <div className="min-w-[190px] flex-1"><ITSearchSelect name="auditUser" label="Persona" value={filters.userId} onChange={(value) => setFilters((f) => ({ ...f, userId: String(value) }))} options={[{ value: "", label: "Todas las personas" }, ...people.map((person) => ({ value: person.id, label: person.name }))]} /></div>
            <div className="min-w-[170px] flex-1"><ITSearchSelect name="auditModule" label="Módulo" value={filters.module} onChange={(value) => setFilters((f) => ({ ...f, module: String(value) }))} options={[{ value: "", label: "Todos los módulos" }, ...MODULES.map((module) => ({ value: module, label: module }))]} /></div>
            <div className="min-w-[200px] flex-1"><ITSearchSelect name="auditAction" label="Acción" value={filters.action} onChange={(value) => setFilters((f) => ({ ...f, action: String(value) }))} options={[{ value: "", label: "Todas las acciones" }, ...COMMON_ACTIONS.map((action) => ({ value: action, label: action }))]} /></div>
            <div className="min-w-[260px] flex-[1.4]"><ITInput name="auditSearch" label="Buscar" placeholder="Usuario, acción, entidad…" value={filters.q} onChange={(event) => setFilters((f) => ({ ...f, q: event.target.value }))} /></div>
          </ITFlex>
          <ITFlex className="mt-3" align="end" gap={2} wrap="wrap">
            <div className="min-w-[260px] flex-1"><ITDatePicker name="auditRange" label="Rango de fechas" range value={range} onChange={(event) => { const next = event.target.value; if (Array.isArray(next)) setRange(next as [Date | null, Date | null]); }} /></div>
            <ITButton variant="outlined" color="gray" onClick={() => { setFilters({ tenantId: "", userId: "", module: "", action: "", q: "" }); setRange([null, null]); }}>Limpiar filtros</ITButton>
            <HelpTip text="Filtra por cualquier combinación. Los logs son de solo lectura." />
          </ITFlex>
        </ITCard>

        <ITCard className="tm-hero-card tm-hero-card--slate" contentClassName="!p-5">
          <ITDataTable key={tableKey} columns={columns as unknown as Column<Record<string, unknown>>[]} fetchData={fetchData as never} showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={480} rowHeight={50} onRowClick={(row) => setSelected(row as unknown as AuditLog)} />
        </ITCard>
      </div>

      <ITDialog isOpen={!!selected} onClose={() => setSelected(null)} className="max-w-2xl">
        <DialogHeader icon={<LuShieldCheck size={20} />} title="Detalle del log" subtitle="Evidencia inmutable de la operación." />
        {selected && (
          <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[12px]">
              <Info label="Fecha" value={formatDateTime(selected.createdAt)} />
              <Info label="Cliente" value={selected.tenantId ? tenantName.get(selected.tenantId) ?? selected.tenantId : "Plataforma"} />
              <Info label="Usuario" value={selected.userName ?? selected.userId ?? "—"} />
              <Info label="Módulo" value={selected.module ?? selected.entityType} />
              <Info label="Acción" value={selected.action} />
              <Info label="Entidad" value={`${selected.entityType} · ${selected.entityId}`} />
              <Info label="IP" value={selected.ipAddress ?? "—"} />
              <Info label="Navegador" value={selected.userAgent ?? "—"} wide />
            </div>
            <JsonBlock title="Roles al momento" value={selected.roles} />
            <JsonBlock title="Permisos / excepciones al momento" value={selected.permissions} />
            <JsonBlock title="Estado anterior" value={selected.previousState} />
            <JsonBlock title="Estado nuevo" value={selected.newState} />
            <JsonBlock title="Metadatos" value={selected.metadata} />
          </div>
        )}
        <ITFlex justify="end" className="mt-4"><ITButton variant="filled" color="primary" className="tm-save-button" onClick={() => setSelected(null)}>Cerrar</ITButton></ITFlex>
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
