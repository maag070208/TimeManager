import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITDataTable, ITDialog, ITInput, ITText, ITToast, type Column, type ITDataTableFetchParams, type ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuPencil, LuPlus, LuPower, LuPowerOff, LuUserCheck } from "react-icons/lu";
import { payrollApi, type PayrollPosition } from "@entities/payroll";
import { usersApi, type User } from "@entities/user";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { RowAction } from "@shared/ui/row-action";

type Filter = "all" | "active" | "inactive";
const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function PayrollPositionsPanel() {
  const [positions, setPositions] = useState<PayrollPosition[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PayrollPosition | "new" | null>(null);
  const [assigning, setAssigning] = useState<PayrollPosition | null>(null);
  const [form, setForm] = useState({ name: "", jobTitle: "", dailySalary: "", sbcDaily: "" });
  const [selected, setSelected] = useState<string[]>([]);

  const load = async () => {
    try {
      const [nextPositions, nextUsers] = await Promise.all([payrollApi.positions(), usersApi.list()]);
      setPositions(nextPositions);
      setEmployees(nextUsers.filter((user) => user.tenant?.id || true));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los perfiles de nómina.");
    }
  };

  useEffect(() => { void load(); }, []);

  const openNew = () => {
    setForm({ name: "", jobTitle: "", dailySalary: "", sbcDaily: "" });
    setEditing("new");
  };
  const openEdit = (position: PayrollPosition) => {
    setForm({ name: position.name, jobTitle: position.jobTitle ?? "", dailySalary: String(position.dailySalary), sbcDaily: position.sbcDaily != null ? String(position.sbcDaily) : "" });
    setEditing(position);
  };
  const save = async () => {
    if (!form.name.trim() || !Number(form.dailySalary)) return;
    setSaving(true);
    try {
      const body = { name: form.name, jobTitle: form.jobTitle || null, dailySalary: Number(form.dailySalary), sbcDaily: form.sbcDaily ? Number(form.sbcDaily) : null };
      if (editing === "new") await payrollApi.createPosition(body);
      else if (editing) await payrollApi.updatePosition(editing.id, body);
      setToast(editing === "new" ? "Perfil de nómina creado." : "Perfil actualizado.");
      setEditing(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el perfil.");
    } finally { setSaving(false); }
  };
  const toggleActive = async (position: PayrollPosition) => {
    try {
      await payrollApi.updatePosition(position.id, { active: !position.active });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el perfil."); }
  };
  const openAssign = async (position: PayrollPosition) => {
    setAssigning(position);
    setSelected(position.employees.map((employee) => employee.id));
  };
  const saveAssign = async () => {
    if (!assigning) return;
    setSaving(true);
    try {
      await payrollApi.assignPosition(assigning.id, selected);
      setToast("Personal asignado al perfil.");
      setAssigning(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo asignar el personal.");
    } finally { setSaving(false); }
  };

  const visible = positions.filter((position) => filter === "all" || (filter === "active" ? position.active : !position.active));
  const assigned = positions.reduce((sum, position) => sum + position.employees.length, 0);
  const columns: Column<PayrollPosition>[] = [
    { key: "name", label: "Perfil", type: "string", sortable: true, render: (row) => <div><ITText className="block font-semibold">{row.name}</ITText><ITText muted className="!text-[11.5px]">{row.jobTitle ?? "Sin cargo"}</ITText></div> },
    { key: "dailySalary", label: "Salario diario", type: "number", render: (row) => <span className="tabular-nums">{money(row.dailySalary)}</span> },
    { key: "sbcDaily", label: "SBC diario", type: "number", render: (row) => <span className="tabular-nums">{row.sbcDaily != null ? money(row.sbcDaily) : "—"}</span> },
    { key: "employees", label: "Personal", type: "number", render: (row) => <ITBadget color={row.employees.length ? "success" : "gray"} size="sm">{row.employees.length} asignados</ITBadget> },
    { key: "active", label: "Estado", type: "string", render: (row) => <ITBadget color={row.active ? "success" : "warning"} size="sm">{row.active ? "Activo" : "Inactivo"}</ITBadget> },
    { key: "actions", label: "", type: "actions", actions: (row) => (
      <div className="flex justify-end gap-1.5">
        <RowAction icon={<LuPencil size={14} />} label="Editar perfil" onClick={() => openEdit(row)} />
        <RowAction icon={<LuUserCheck size={14} />} label="Asignar personal" tone="success" onClick={() => void openAssign(row)} />
        <RowAction icon={row.active ? <LuPowerOff size={14} /> : <LuPower size={14} />} label={row.active ? "Desactivar perfil" : "Activar perfil"} tone={row.active ? "warning" : "success"} onClick={() => void toggleActive(row)} />
      </div>
    ) },
  ];
  const fetchData = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<PayrollPosition>> => {
    const start = (params.page - 1) * params.limit;
    return { data: visible.slice(start, start + params.limit), total: visible.length };
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}
      <div className="flex items-center justify-end gap-2">
        <HelpTip text="Cada perfil define salario diario y SBC por cargo. Asigna personas para que su pre-nómina use esos valores." />
        <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" onClick={openNew}><LuPlus size={14} className="mr-1" /> Nuevo perfil</ITButton>
      </div>
      <BentoFilterCards items={[{ id: "all", label: "Perfiles", value: positions.length, caption: `${assigned} personas asignadas` }, { id: "active", label: "Activos", value: positions.filter((position) => position.active).length, caption: "disponibles" }, { id: "inactive", label: "Inactivos", value: positions.filter((position) => !position.active).length, caption: "fuera de uso" }]} activeId={filter} onSelect={(id) => setFilter(id as Filter)} />
      <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50} columns={columns as unknown as Column<Record<string, unknown>>[]} fetchData={fetchData as never} variant="minimal" onRowClick={(row) => openEdit(row as unknown as PayrollPosition)} />
      <ITDialog isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuevo perfil de nómina" : "Editar perfil de nómina"}>
        <div className="flex flex-col gap-3">
          <ITInput name="payrollProfileName" label="Nombre del perfil" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Operativo, Administrativo…" />
          <ITInput name="payrollProfileJob" label="Cargo" value={form.jobTitle} onChange={(event) => setForm((prev) => ({ ...prev, jobTitle: event.target.value }))} placeholder="Analista, Gerente…" />
          <ITInput name="payrollProfileSalary" label="Salario diario (MXN)" type="number" value={form.dailySalary} onChange={(event) => setForm((prev) => ({ ...prev, dailySalary: event.target.value }))} />
          <ITInput name="payrollProfileSbc" label="SBC diario (opcional)" type="number" value={form.sbcDaily} onChange={(event) => setForm((prev) => ({ ...prev, sbcDaily: event.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setEditing(null)}>Cancelar</ITButton>
            <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" disabled={saving} onClick={() => void save()}>Guardar</ITButton>
          </div>
        </div>
      </ITDialog>
      <ITDialog isOpen={assigning !== null} onClose={() => setAssigning(null)} title={`Asignar personal · ${assigning?.name ?? ""}`}>
        <div className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
          {employees.filter((employee) => employee.active).map((employee) => (
            <label key={employee.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(employee.id)} onChange={(event) => setSelected((prev) => event.target.checked ? [...prev, employee.id] : prev.filter((id) => id !== employee.id))} />
              <span className="min-w-0 flex-1 truncate">{employee.name}</span>
              <span className="text-[11px] text-slate-400">{employee.jobTitle ?? ""}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setAssigning(null)}>Cancelar</ITButton>
          <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" disabled={saving} onClick={() => void saveAssign()}>Guardar asignación</ITButton>
        </div>
      </ITDialog>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </div>
  );
}
