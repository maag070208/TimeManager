import { useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITConfirmDialog, ITDataTable, ITDialog, ITInput, ITText, ITToast, type Column, type ITDataTableFetchParams, type ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuPencil, LuPlus, LuPower, LuPowerOff, LuUserCheck, LuWallet } from "react-icons/lu";
import { payrollApi, type PayrollPosition } from "@entities/payroll";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { DialogHeader } from "@shared/ui/dialog-header";
import { useNavigate } from "react-router-dom";
import { RowAction } from "@shared/ui/row-action";

type Filter = "all" | "active" | "inactive";
const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function PayrollPositionsPanel() {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<PayrollPosition[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PayrollPosition | "new" | null>(null);
  const [statusTarget, setStatusTarget] = useState<PayrollPosition | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [form, setForm] = useState({ name: "", jobTitle: "", dailySalary: "", sbcDaily: "" });

  const load = async () => {
    try {
      setPositions(await payrollApi.positions());
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
      setReloadToken((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el perfil.");
    } finally { setSaving(false); }
  };
  const confirmToggleActive = async () => {
    if (!statusTarget) return;
    setSaving(true);
    try {
      await payrollApi.updatePosition(statusTarget.id, { active: !statusTarget.active });
      setToast(statusTarget.active ? "Perfil desactivado." : "Perfil activado.");
      setStatusTarget(null);
      await load();
      setReloadToken((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el perfil."); }
    finally { setSaving(false); }
  };
  const visible = positions.filter((position) => filter === "all" || (filter === "active" ? position.active : !position.active));
  const assigned = positions.reduce((sum, position) => sum + position.employees.length, 0);
  const columns: Column<PayrollPosition>[] = [
    { key: "name", label: "Puesto", type: "string", sortable: true, render: (row) => <div><ITText className="block font-semibold">{row.name}</ITText><ITText muted className="!text-[11.5px]">{row.jobTitle ?? "Sin cargo"}</ITText></div> },
    { key: "dailySalary", label: "Salario diario", type: "number", render: (row) => <span className="tabular-nums">{money(row.dailySalary)}</span> },
    { key: "sbcDaily", label: "SBC diario", type: "number", render: (row) => <span className="tabular-nums">{row.sbcDaily != null ? money(row.sbcDaily) : "—"}</span> },
    { key: "employees", label: "Personal", type: "number", render: (row) => <ITBadget color={row.employees.length ? "success" : "gray"} size="sm">{row.employees.length} asignados</ITBadget> },
    { key: "active", label: "Estado", type: "string", render: (row) => <ITBadget color={row.active ? "success" : "warning"} size="sm">{row.active ? "Activo" : "Inactivo"}</ITBadget> },
    { key: "actions", label: "", type: "actions", actions: (row) => (
      <div className="flex justify-end gap-1.5">
        <RowAction icon={<LuPencil size={14} />} label="Editar perfil" onClick={() => openEdit(row)} />
        <RowAction icon={<LuUserCheck size={14} />} label="Asignar personal" tone="success" onClick={() => navigate(`/payroll/assign?position=${row.id}`)} />
        <RowAction icon={row.active ? <LuPowerOff size={14} /> : <LuPower size={14} />} label={row.active ? "Desactivar perfil" : "Activar perfil"} tone={row.active ? "warning" : "success"} onClick={() => setStatusTarget(row)} />
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <HelpTip text="Cada puesto define salario diario y SBC. Asigna personas para que su pre-nómina use esos valores. Los mismos puestos se administran en Configuración → Catálogos." />
        <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => navigate("/settings/catalogs?tab=positions")}>Catálogo de puestos</ITButton>
        <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" onClick={openNew}><LuPlus size={14} className="mr-1" /> Nuevo puesto</ITButton>
      </div>
      <BentoFilterCards items={[{ id: "all", label: "Puestos", value: positions.length, caption: `${assigned} personas asignadas` }, { id: "active", label: "Activos", value: positions.filter((position) => position.active).length, caption: "disponibles" }, { id: "inactive", label: "Inactivos", value: positions.filter((position) => !position.active).length, caption: "fuera de uso" }]} activeId={filter} onSelect={(id) => setFilter(id as Filter)} />
      <ITDataTable key={`${filter}-${reloadToken}`} showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50} columns={columns as unknown as Column<Record<string, unknown>>[]} fetchData={fetchData as never} variant="minimal" onRowClick={(row) => openEdit(row as unknown as PayrollPosition)} />
      <ITDialog isOpen={editing !== null} onClose={() => setEditing(null)} className="max-w-xl">
        <DialogHeader
          icon={<LuWallet size={20} />}
          title={editing === "new" ? "Nuevo puesto de nómina" : "Editar puesto de nómina"}
          subtitle="Los cambios se reflejan en Catálogos y en la pre-nómina."
        />
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
      <ITConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void confirmToggleActive()}
        title={statusTarget?.active ? "Desactivar perfil de nómina" : "Activar perfil de nómina"}
        message={statusTarget?.active
          ? `El perfil "${statusTarget.name}" dejará de estar disponible para nuevas asignaciones. El personal ya asignado conserva su historial.`
          : `El perfil "${statusTarget?.name ?? ""}" volverá a estar disponible para asignar personal.`}
        confirmLabel={statusTarget?.active ? "Desactivar" : "Activar"}
        cancelLabel="Cancelar"
        variant={statusTarget?.active ? "warning" : "success"}
        loading={saving}
      />
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </div>
  );
}
