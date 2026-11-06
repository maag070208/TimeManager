import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITCheckbox,
  ITDataTable,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
  ITToast,
  type Column,
  type ITDataTableFetchParams,
} from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { TicState } from "@shared/ui/tic";
import { FaMinus, FaPlus } from "react-icons/fa";
import { LuWallet } from "react-icons/lu";
import { useNavigate, useSearchParams } from "react-router-dom";
import { payrollApi, type PayrollPosition } from "@entities/payroll";
import { usersApi, type User } from "@entities/user";
import { useDepartmentOptions } from "@entities/department";
import { useGoBack } from "@shared/lib/useGoBack";
import { makeClientTableFetch } from "@shared/api/clientTable";

type AssignView = "assigned" | "pending" | "all";
interface Row { id: string; name: string; employeeNumber: string | null; jobTitle?: string; department: string | null; departmentId: string | null; isAssigned: boolean; currentPosition: string | null }

const meta = (employeeNumber?: string | null, jobTitle?: string, department?: string) =>
  [employeeNumber ? `#${employeeNumber}` : null, jobTitle, department].filter(Boolean).join(" · ");

/** Asignar personal a un puesto de nómina con el mismo patrón que Asignar horario. */
export default function AssignPayrollPositionPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [params] = useSearchParams();
  const [positions, setPositions] = useState<PayrollPosition[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [positionId, setPositionId] = useState(params.get("position") ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<AssignView>("all");
  const [toAssign, setToAssign] = useState<Set<string>>(new Set());
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const departments = useDepartmentOptions();

  const load = useCallback(async () => {
    try {
      const [nextPositions, nextPeople] = await Promise.all([payrollApi.positions(), usersApi.people()]);
      setPositions(nextPositions);
      setPeople(nextPeople);
      setPositionId((current) => {
        const selected = nextPositions.find((item) => item.id === current);
        if (selected?.active) return current;
        return nextPositions.find((item) => item.active)?.id ?? "";
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la asignación.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setToAssign(new Set()); setToRemove(new Set()); }, [positionId]);

  const position = positions.find((row) => row.id === positionId);
  const assignedIds = useMemo(() => new Set(position?.employees.map((employee) => employee.id) ?? []), [position]);
  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const positionByPerson = useMemo(() => {
    const map = new Map<string, string>();
    positions.forEach((item) => item.employees.forEach((employee) => map.set(employee.id, item.name)));
    return map;
  }, [positions]);

  const matches = useCallback((name: string, employeeNumber?: string | null) => {
    const term = q.trim().toLowerCase();
    return !term || name.toLowerCase().includes(term) || (employeeNumber ?? "").toLowerCase().includes(term);
  }, [q]);

  const assignedRows = useMemo<Row[]>(() =>
    (position?.employees ?? []).map((employee) => {
      const person = personById.get(employee.id);
      return {
        id: employee.id,
        name: person?.name ?? employee.name,
        employeeNumber: person?.employeeNumber ?? null,
        jobTitle: person?.jobTitle,
        department: person?.department?.name ?? null,
        departmentId: person?.departmentId ?? null,
        isAssigned: true,
        currentPosition: position?.name ?? null,
      };
    }).filter((row) => (!departmentId || row.departmentId === departmentId) && matches(row.name, row.employeeNumber)),
  [position, personById, departmentId, matches]);

  const pendingRows = useMemo<Row[]>(() =>
    people.filter((person) => person.active && !assignedIds.has(person.id)).map((person) => ({
      id: person.id,
      name: person.name,
      employeeNumber: person.employeeNumber ?? null,
      jobTitle: person.jobTitle,
      department: person.department?.name ?? null,
      departmentId: person.departmentId ?? null,
      isAssigned: false,
      currentPosition: positionByPerson.get(person.id) ?? null,
    })).filter((row) => (!departmentId || row.departmentId === departmentId) && matches(row.name, row.employeeNumber)),
  [people, assignedIds, positionByPerson, departmentId, matches]);

  const rows = useMemo(() => view === "assigned" ? assignedRows : view === "pending" ? pendingRows : [...assignedRows, ...pendingRows], [view, assignedRows, pendingRows]);
  const fetchData = useMemo(() => makeClientTableFetch<Row>(() => Promise.resolve(rows), {
    name: { value: (row) => row.name, match: "text" },
    employeeNumber: { value: (row) => row.employeeNumber ?? "", match: "text" },
    department: { value: (row) => row.department ?? "", match: "text" },
    status: { value: (row) => (row.isAssigned ? "En este puesto" : "Por asignar"), match: "text" },
  }), [rows]);
  const tableFetch = (params: ITDataTableFetchParams) => fetchData(params);

  const isPicked = (row: Row) => row.isAssigned ? toRemove.has(row.id) : toAssign.has(row.id);
  const togglePick = (row: Row) => {
    const [set, setter] = row.isAssigned ? [toRemove, setToRemove] : [toAssign, setToAssign];
    const next = new Set(set);
    if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
    setter(next);
  };
  const allSelected = rows.length > 0 && rows.every(isPicked);
  const someSelected = rows.some(isPicked);
  const toggleVisible = (checked: boolean) => {
    setToAssign(checked ? new Set(pendingRows.map((row) => row.id)) : new Set());
    setToRemove(checked ? new Set(assignedRows.map((row) => row.id)) : new Set());
  };
  const picked = toAssign.size + toRemove.size;

  const apply = async (assignIds?: string[], removeIds?: string[]) => {
    if (!positionId) return;
    if (!position?.active) {
      setError("El puesto está inactivo. Actívalo en el catálogo antes de asignar personal.");
      return;
    }
    const next = new Set(position?.employees.map((employee) => employee.id) ?? []);
    (removeIds ?? [...toRemove]).forEach((id) => next.delete(id));
    (assignIds ?? [...toAssign]).forEach((id) => next.add(id));
    setSaving(true);
    setError(null);
    try {
      await payrollApi.assignPosition(positionId, [...next]);
      setToast(assignIds || removeIds ? "Asignación actualizada." : "Personal asignado al puesto.");
      setToAssign(new Set());
      setToRemove(new Set());
      await load();
      setReloadToken((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo asignar el personal.");
    } finally { setSaving(false); }
  };

  const columns: Column<Row>[] = [
    {
      key: "select",
      label: <ITCheckbox name="payrollAssignAll" checked={allSelected} indeterminate={someSelected} disabled={rows.length === 0} onChange={toggleVisible} /> as unknown as string,
      type: "actions",
      width: 48,
      actions: (row) => <ITCheckbox name={`payroll-assign-${row.id}`} checked={isPicked(row)} onChange={() => togglePick(row)} />,
    },
    {
      key: "name",
      label: "Personal",
      type: "string",
      width: 290,
      render: (row) => (
        <ITFlex align="center" gap={2} className="min-w-0 cursor-pointer" onClick={() => togglePick(row)}>
          <ProfileAvatar name={row.name} size="sm" />
          <ITFlex direction="column" gap={0} className="min-w-0">
            <ITText className="truncate !text-[12.5px] font-semibold">{row.name}</ITText>
            <ITText muted className="truncate !text-[11px]">{meta(row.employeeNumber, row.jobTitle, row.department ?? undefined) || "—"}</ITText>
          </ITFlex>
        </ITFlex>
      ),
    },
    { key: "department", label: "Departamento", type: "string", width: 180, render: (row) => <ITText className="!text-[12px]">{row.department ?? "—"}</ITText> },
    {
      key: "status",
      label: "Puesto de nómina",
      type: "string",
      width: 220,
      render: (row) => <ITBadget color={row.isAssigned ? "success" : row.currentPosition ? "info" : "gray"} size="sm">{row.isAssigned ? position?.name ?? "En este puesto" : row.currentPosition ?? "Por asignar"}</ITBadget>,
    },
    {
      key: "rowAction",
      label: "",
      type: "actions",
      width: 64,
      render: (row) => (
        <ITButton variant="text" color={row.isAssigned ? "error" : "success"} size="sm" icon={row.isAssigned ? <FaMinus size={12} /> : <FaPlus size={12} />} ariaLabel={row.isAssigned ? "Quitar del puesto" : "Asignar al puesto"} title={row.isAssigned ? "Quitar del puesto" : "Asignar al puesto"} onClick={() => void (row.isAssigned ? apply(undefined, [row.id]) : apply([row.id]))} />
      ),
    },
  ];

  if (loading) return <ITPage title="Asignar personal" loading><div /></ITPage>;

  return (
    <ITPage
      title="Asignar personal a puesto"
      description="Asigna un puesto de nómina a varias personas a la vez."
      icon={<LuWallet size={20} />}
      backAction={() => goBack("/payroll/settings")}
      breadcrumbs={[{ label: "Nómina", onClick: () => navigate("/payroll/settings") }, { label: "Asignar personal" }]}
    >
      <ITFlex direction="column" gap={4}>
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        <BentoFilterCards
          activeId={view}
          onSelect={(id) => setView(id as AssignView)}
          items={[
            { id: "assigned", label: "En este puesto", value: assignedRows.length, caption: position?.name ?? "—" },
            { id: "pending", label: "Por asignar", value: pendingRows.length, caption: "con estos filtros" },
            { id: "all", label: "Personal", value: people.filter((person) => person.active).length, caption: departmentId ? departments.data.find((d) => d.id === departmentId)?.name ?? "Todos los departamentos" : "Todos los departamentos" },
          ]}
        />

        <ITCard contentClassName="!p-0">
          <ITFlex wrap="wrap" align="end" gap={3} className="border-b border-slate-200/70 px-5 py-4">
            <ITFlex className="min-w-[220px] flex-1"><ITSearchSelect name="payrollPosition" label="Puesto de nómina" options={positions.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name }))} value={positionId} onChange={(value) => setPositionId(String(value))} className="w-full min-w-0" /></ITFlex>
            <ITFlex className="min-w-[180px] flex-1"><ITSearchSelect name="payrollDepartment" label="Departamento" options={[{ value: "", label: "Todos los departamentos" }, ...departments.data.map((d) => ({ value: d.id, label: d.name }))]} value={departmentId} onChange={(value) => { setDepartmentId(String(value)); setToAssign(new Set()); setToRemove(new Set()); }} className="w-full min-w-0" /></ITFlex>
            <ITFlex className="min-w-[180px] flex-1"><ITInput name="payrollSearch" label="Buscar" placeholder="Buscar persona…" value={q} onChange={(event) => setQ(event.target.value)} className="w-full min-w-0" /></ITFlex>
            <HelpTip text="Marca personas y usa Asignar o Quitar. El cambio se guarda al instante y mueve a la persona al puesto seleccionado." />
          </ITFlex>

          <ITFlex align="center" wrap="wrap" gap={2} className="px-5 pt-3">
            <ITText muted className="!text-[11.5px]">{picked} seleccionada(s)</ITText>
            <ITButton variant="text" color="gray" size="sm" disabled={picked === 0} onClick={() => { setToAssign(new Set()); setToRemove(new Set()); }}><ITText className="text-[11px] font-bold">Limpiar selección</ITText></ITButton>
            <ITFlex align="center" gap={2} className="ml-auto">
              <ITButton variant="outlined" color="danger" size="sm" disabled={saving || toRemove.size === 0} onClick={() => void apply()}><FaMinus size={10} /><ITText className="ml-1 font-bold text-[11px]">{`Quitar (${toRemove.size})`}</ITText></ITButton>
              <ITButton variant="filled" color="success" size="sm" disabled={saving || toAssign.size === 0} onClick={() => void apply()}><FaPlus size={10} /><ITText className="ml-1 font-bold text-[11px]">{`Asignar (${toAssign.size})`}</ITText></ITButton>
            </ITFlex>
          </ITFlex>

          {rows.length === 0 ? (
            <TicState kind="empty" title="Sin personas con estos filtros" description="Cambia el departamento o la búsqueda para ver más personal." />
          ) : (
            <ITDataTable key={`${positionId}-${reloadToken}-${view}-${departmentId}-${q}`} showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              fetchData={tableFetch as never}
              onRowClick={(row) => togglePick(row as unknown as Row)}
            />
          )}
          <ITText muted className="px-5 pb-4 pt-2 !text-[11px]">Se aplica al instante. Al asignar, la persona cambia a este puesto de nómina.</ITText>
        </ITCard>
      </ITFlex>

      {toast && <ITToast message={toast} type="success" position="top-right" duration={3000} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
