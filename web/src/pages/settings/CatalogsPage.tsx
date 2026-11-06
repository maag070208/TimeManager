import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITConfirmDialog,
  ITDataTable,
  ITDialog,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
  ITToast,
  type Column,
  type ITDataTableFetchParams,
  type ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { TabBar } from "@shared/ui/tab-bar";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { RowAction } from "@shared/ui/row-action";
import { DialogHeader } from "@shared/ui/dialog-header";
import { HelpTip } from "@shared/ui/help-tip";
import { LuBookOpen, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { nomApi, type LeaveType } from "@entities/nom";
import { personalApi, type DocumentType } from "@entities/hr";
import { departmentsApi, type Department } from "@entities/department";
import { payrollApi, type PayrollPosition } from "@entities/payroll";

type CatalogKey = "leave" | "documents" | "departments" | "positions";

const CATALOG_LABEL: Record<CatalogKey, string> = {
  leave: "Tipos de permiso",
  documents: "Tipos de documento",
  departments: "Departamentos",
  positions: "Puestos de nómina",
};
const CATALOG_SINGULAR: Record<CatalogKey, string> = {
  leave: "Tipo de permiso",
  documents: "Tipo de documento",
  departments: "Departamento",
  positions: "Puesto de nómina",
};

interface EditTarget { catalog: CatalogKey; row?: LeaveType | DocumentType | Department | PayrollPosition }
type CatalogRow = LeaveType & DocumentType & Department & PayrollPosition;

/** Catálogos maestros del cliente, con alta, edición y baja lógica. */
export default function CatalogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTabState] = useState<CatalogKey>(
    initialTab === "documents" || initialTab === "departments" || initialTab === "positions" ? initialTab : "leave"
  );
  const setTab = (value: CatalogKey) => {
    setTabState(value);
    setSearchParams({ tab: value }, { replace: true });
  };
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<PayrollPosition[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [removing, setRemoving] = useState<EditTarget | null>(null);
  const [form, setForm] = useState({ name: "", key: "", paid: "false", required: "false", jobTitle: "", dailySalary: "" });

  const load = useCallback(async () => {
    try {
      const [nextLeave, nextDocs, nextDepts, nextPositions] = await Promise.all([
        nomApi.leaveTypes(true),
        personalApi.documentTypes(true),
        departmentsApi.list(true),
        payrollApi.positions(),
      ]);
      setLeaveTypes(nextLeave);
      setDocumentTypes(nextDocs);
      setDepartments(nextDepts);
      setPositions(nextPositions);
      setJobTitles([...new Set(nextPositions.map((position) => position.jobTitle?.trim()).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los catálogos.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setForm({ name: "", key: "", paid: "false", required: "false", jobTitle: "", dailySalary: "" });
    setEditing({ catalog: tab });
  };

  const openEdit = (catalog: CatalogKey, row: EditTarget["row"]) => {
    if (!row) return;
    const extra = "paid" in row ? { paid: String(row.paid) } : "required" in row ? { required: String(row.required) } : "dailySalary" in row ? { jobTitle: row.jobTitle ?? "", dailySalary: String(row.dailySalary) } : {};
    setForm({ name: row.name, key: "key" in row ? row.key : "", paid: "false", required: "false", jobTitle: "", dailySalary: "", ...extra });
    setEditing({ catalog, row });
  };

  const save = async () => {
    if (!editing || form.name.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      const id = editing.row?.id;
      if (editing.catalog === "leave" && "key" in (editing.row ?? {})) {
        await nomApi.updateType(id!, { name: form.name.trim(), paid: form.paid === "true" });
        setToast("Tipo de permiso actualizado.");
      } else if (editing.catalog === "leave") {
        await nomApi.createType({ key: form.key || form.name, name: form.name.trim(), paid: form.paid === "true" });
        setToast("Tipo de permiso agregado.");
      } else if (editing.catalog === "documents" && "required" in (editing.row ?? {})) {
        await personalApi.updateDocumentType(id!, { name: form.name.trim(), required: form.required === "true" });
        setToast("Tipo de documento actualizado.");
      } else if (editing.catalog === "documents") {
        await personalApi.createDocumentType(form.name.trim());
        setToast("Tipo de documento agregado.");
      } else if (editing.catalog === "departments" && id) {
        await departmentsApi.update(id, { name: form.name.trim() });
        setToast("Departamento actualizado.");
      } else if (editing.catalog === "departments") {
        await departmentsApi.create({ name: form.name.trim() });
        setToast("Departamento agregado.");
      } else if (editing.catalog === "positions" && id) {
        await payrollApi.updatePosition(id, { name: form.name.trim(), jobTitle: form.jobTitle || null, dailySalary: Number(form.dailySalary) || 0 });
        setToast("Puesto actualizado.");
      } else if (editing.catalog === "positions") {
        await payrollApi.createPosition({ name: form.name.trim(), jobTitle: form.jobTitle || null, dailySalary: Number(form.dailySalary) || 0 });
        setToast("Puesto agregado.");
      }
      setEditing(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el catálogo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing?.row) return;
    setSaving(true);
    try {
      const id = removing.row.id;
      if (removing.catalog === "leave") await nomApi.removeType(id);
      else if (removing.catalog === "documents") await personalApi.removeDocumentType(id);
      else if (removing.catalog === "departments") await departmentsApi.remove(id);
      else await payrollApi.updatePosition(id, { active: false });
      setToast("Registro dado de baja. El historial se conserva.");
      setRemoving(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo dar de baja.");
    } finally {
      setSaving(false);
    }
  };

  const actionsColumn = (catalog: CatalogKey): Column<CatalogRow> => ({
    key: "actions",
    label: "Acciones",
    type: "actions",
    cellClassName: "min-w-[110px] whitespace-nowrap",
    actions: (row) => (
      <div className="flex justify-end gap-1.5">
        <RowAction icon={<LuPencil size={14} />} label="Editar" onClick={() => openEdit(catalog, row as unknown as EditTarget["row"])} />
        <RowAction icon={<LuTrash2 size={14} />} label="Dar de baja" tone="danger" onClick={() => setRemoving({ catalog, row: row as unknown as EditTarget["row"] })} />
      </div>
    ),
  });

  const leaveRows = useMemo(() => leaveTypes, [leaveTypes]);
  const docRows = useMemo(() => documentTypes, [documentTypes]);
  const deptRows = useMemo(() => departments, [departments]);
  const positionRows = useMemo(() => positions, [positions]);
  const activeRows = tab === "leave" ? leaveRows : tab === "documents" ? docRows : tab === "departments" ? deptRows : positionRows;

  const leaveColumns: Column<CatalogRow>[] = [
    { key: "name", label: "Nombre", type: "string", render: (row) => <ITText className="font-semibold !text-[12px]">{row.name}</ITText> },
    { key: "key", label: "Clave", type: "string", width: 220, render: (row) => <span className="font-mono text-[11.5px] text-slate-500">{row.key}</span> },
    { key: "paid", label: "Goce de sueldo", type: "string", width: 160, render: (row) => <ITBadget color={row.paid ? "success" : "gray"} size="sm">{row.paid ? "Con goce" : "Sin goce"}</ITBadget> },
    { key: "active", label: "Estado", type: "string", width: 120, render: (row) => <ITBadget color={row.active ? "success" : "gray"} size="sm">{row.active ? "Activo" : "Inactivo"}</ITBadget> },
    actionsColumn("leave"),
  ];
  const docColumns: Column<CatalogRow>[] = [
    { key: "name", label: "Nombre", type: "string", render: (row) => <ITText className="font-semibold !text-[12px]">{row.name}</ITText> },
    { key: "required", label: "Obligatorio", type: "string", width: 180, render: (row) => <ITBadget color={row.required ? "warning" : "gray"} size="sm">{row.required ? "Obligatorio" : "Opcional"}</ITBadget> },
    { key: "active", label: "Estado", type: "string", width: 120, render: (row) => <ITBadget color={row.active ? "success" : "gray"} size="sm">{row.active ? "Activo" : "Inactivo"}</ITBadget> },
    actionsColumn("documents"),
  ];
  const deptColumns: Column<CatalogRow>[] = [
    { key: "name", label: "Nombre", type: "string", render: (row) => <ITText className="font-semibold !text-[12px]">{row.name}</ITText> },
    { key: "people", label: "Personas", type: "number", width: 140, render: (row) => <span className="tabular-nums text-[12px]">{row._count?.users ?? 0}</span> },
    { key: "active", label: "Estado", type: "string", width: 120, render: (row) => <ITBadget color={row.active ? "success" : "gray"} size="sm">{row.active ? "Activo" : "Inactivo"}</ITBadget> },
    actionsColumn("departments"),
  ];
  const positionColumns: Column<CatalogRow>[] = [
    { key: "name", label: "Puesto", type: "string", render: (row) => <ITText className="font-semibold !text-[12px]">{row.name}</ITText> },
    { key: "jobTitle", label: "Puesto de trabajo", type: "string", render: (row) => <span className="text-[12px] text-slate-600">{row.jobTitle ?? "—"}</span> },
    { key: "salary", label: "Salario diario", type: "number", width: 160, render: (row) => <span className="tabular-nums text-[12px]">${row.dailySalary.toFixed(2)}</span> },
    { key: "people", label: "Personas", type: "number", width: 120, render: (row) => <span className="tabular-nums text-[12px]">{row.employees.length}</span> },
    { key: "active", label: "Estado", type: "string", width: 120, render: (row) => <ITBadget color={row.active ? "success" : "gray"} size="sm">{row.active ? "Activo" : "Inactivo"}</ITBadget> },
    actionsColumn("positions"),
  ];

  const columns = tab === "leave" ? leaveColumns : tab === "documents" ? docColumns : tab === "departments" ? deptColumns : positionColumns;
  const fetchRows = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<Record<string, unknown>>> => {
    const start = (params.page - 1) * params.limit;
    return { data: (activeRows as unknown as Record<string, unknown>[]).slice(start, start + params.limit), total: activeRows.length };
  };

  return (
    <ITPage title="Catálogos" description="Datos maestros del cliente. Aquí se agregan, editan y dan de baja." icon={<LuBookOpen size={20} />}
      actions={<ITButton variant="filled" color="primary" className="tm-row-button" onClick={openCreate}><LuPlus size={13} className="mr-1" /> Agregar</ITButton>}
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}
        <ITAlert variant="warning" dismissible={false}>
          Los catálogos afectan solicitudes, expedientes y nómina. Al dar de baja un registro se conserva el historial; no se borran datos históricos.
        </ITAlert>

        <BentoKpiGrid items={[
          { id: "leave", label: "Tipos de permiso", value: leaveTypes.length, caption: "configurados", icon: <LuBookOpen size={14} />, tone: "info" },
          { id: "docs", label: "Tipos de documento", value: documentTypes.length, caption: "del expediente", tone: "neutral" },
          { id: "depts", label: "Departamentos", value: departments.length, caption: "del cliente", tone: "success" },
          { id: "positions", label: "Puestos de nómina", value: positions.length, caption: "perfiles salariales", tone: "warning" },
        ]} />

        <TabBar items={[
          { id: "leave", label: `Permisos (${leaveTypes.length})` },
          { id: "documents", label: `Documentos (${documentTypes.length})` },
          { id: "departments", label: `Departamentos (${departments.length})` },
          { id: "positions", label: `Puestos (${positions.length})` },
        ]} value={tab} onChange={(id) => setTab(id as CatalogKey)} />

        <ITCard className="tm-hero-card tm-hero-card--sky" contentClassName="!p-5">
          <ITFlex align="center" gap={2}>
            <ITText className="font-bold">{CATALOG_LABEL[tab]}</ITText>
            <HelpTip text={tab === "leave" ? "Tipos que el personal puede solicitar. Con goce paga el día; sin goce no." : tab === "documents" ? "Documentos que el expediente puede solicitar. Los obligatorios marcan faltantes." : tab === "departments" ? "Departamentos usados en personas, filtros y reportes." : "Perfiles de salario usados para calcular la pre-nómina."} />
          </ITFlex>
          <div className="mt-3">
            <ITDataTable
              key={tab}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              fetchData={fetchRows as never}
              showViewToggle={false}
              defaultItemsPerPage={50}
              itemsPerPageOptions={[25, 50, 100]}
              layout="fixed"
              density="compact"
              virtualized
              virtualizedMaxHeight={400}
              rowHeight={50}
            />
          </div>
        </ITCard>
      </div>

      <ITDialog isOpen={!!editing} onClose={() => setEditing(null)} className="max-w-lg">
        <DialogHeader icon={<LuBookOpen size={20} />} title={editing?.row ? `Editar ${CATALOG_SINGULAR[editing.catalog]}` : `Agregar ${editing ? CATALOG_SINGULAR[editing.catalog] : ""}`} subtitle="Los cambios aplican a todo el cliente." />
        <div className="flex flex-col gap-3">
          {editing?.catalog === "leave" && !editing.row && (
            <ITInput name="catalogKey" label="Clave" placeholder="EJ. PERMISO_ESPECIAL" value={form.key} onChange={(event) => setForm((f) => ({ ...f, key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }))} />
          )}
          <ITInput name="catalogName" label="Nombre" value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} />
          {editing?.catalog === "leave" && (
            <ITSearchSelect name="catalogPaid" label="Goce de sueldo" value={form.paid} onChange={(value) => setForm((f) => ({ ...f, paid: String(value) }))} options={[{ value: "false", label: "Sin goce" }, { value: "true", label: "Con goce" }]} />
          )}
          {editing?.catalog === "documents" && editing.row && (
            <ITSearchSelect name="catalogRequired" label="Obligatorio" value={form.required} onChange={(value) => setForm((f) => ({ ...f, required: String(value) }))} options={[{ value: "false", label: "Opcional" }, { value: "true", label: "Obligatorio" }]} />
          )}
          {editing?.catalog === "positions" && (
            <>
              <ITSearchSelect
                name="catalogJobTitle"
                label="Puesto de trabajo"
                value={form.jobTitle}
                onChange={(value) => setForm((f) => ({ ...f, jobTitle: String(value) }))}
                options={[...new Set([form.jobTitle, ...jobTitles].filter(Boolean))].map((value) => ({ value, label: value }))}
                placeholder="Selecciona un puesto del catálogo"
              />
              <ITInput name="catalogSalary" type="number" label="Salario diario" value={form.dailySalary} onChange={(event) => setForm((f) => ({ ...f, dailySalary: event.target.value }))} />
            </>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <ITButton variant="outlined" color="secondary" className="tm-save-button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</ITButton>
          <ITButton variant="filled" color="primary" className="tm-save-button" onClick={() => void save()} disabled={saving || form.name.trim().length < 3}>{saving ? "Guardando…" : "Guardar"}</ITButton>
        </div>
      </ITDialog>

      <ITConfirmDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
        title="Dar de baja del catálogo"
        message="El registro dejará de estar disponible para nuevos movimientos. Si es un puesto de nómina, se quitará a las personas asignadas. El historial y los datos existentes se conservan."
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        variant="danger"
        loading={saving}
      />
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
