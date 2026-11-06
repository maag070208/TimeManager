import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITCheckbox,
  ITDialog,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import { FaArrowLeft, FaArrowRight, FaMinus, FaPlus } from "react-icons/fa";
import { LuArrowLeftRight } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { usersApi, type User } from "@entities/user";
import { useDepartmentOptions } from "@entities/department";
import { scheduleApi, type AssignedPerson, type Schedule } from "@entities/schedule";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { TicState } from "@shared/ui/tic";
import { DialogHeader } from "@shared/ui/dialog-header";

const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const personMeta = (employeeNumber?: string | null, jobTitle?: string, department?: string) =>
  [employeeNumber ? `#${employeeNumber}` : null, jobTitle, department].filter(Boolean).join(" · ");

interface Row {
  id: string;
  name: string;
  employeeNumber: string | null;
  jobTitle?: string;
  department: string | null;
  departmentId: string | null;
  currentSchedule?: string | null;
}

/**
 * Asignar horario con dos columnas: a la izquierda quienes ya lo tienen y a la
 * derecha quienes no. Las flechas mueven la selección entre columnas.
 */
export default function AssignSchedules() {
  const { t } = useTranslation("schedules");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [scheduleId, setScheduleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assigned, setAssigned] = useState<AssignedPerson[]>([]);
  const [toAssign, setToAssign] = useState<Set<string>>(new Set());
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<string[] | null>(null);
  const [assignmentByUser, setAssignmentByUser] = useState<Map<string, string>>(new Map());

  const departments = useDepartmentOptions();

  useEffect(() => {
    Promise.all([scheduleApi.list(), usersApi.employees()])
      .then(([h, u]) => {
        setSchedules(h);
        setEmployees(u);
        if (h[0]) setScheduleId(h[0].id);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadAssigned = useCallback((id: string) => {
    if (!id) return;
    scheduleApi
      .scheduleAssignees(id)
      .then(setAssigned)
      .catch(() => setAssigned([]));
  }, []);

  const loadAllAssignments = useCallback(() => {
    scheduleApi
      .assignmentsTable({ page: 1, limit: 1000, filters: {} })
      .then((res) => setAssignmentByUser(new Map(res.data.map((row) => [row.userId, row.scheduleName]))))
      .catch(() => setAssignmentByUser(new Map()));
  }, []);

  useEffect(() => {
    loadAssigned(scheduleId);
    setToAssign(new Set());
    setToRemove(new Set());
  }, [scheduleId, loadAssigned]);

  useEffect(() => {
    loadAllAssignments();
  }, [loadAllAssignments]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.userId)), [assigned]);
  const currentSchedule = schedules.find((h) => h.id === scheduleId);

  const matches = useCallback(
    (name: string, employeeNumber?: string | null) => {
      const term = q.trim().toLowerCase();
      return !term || name.toLowerCase().includes(term) || (employeeNumber ?? "").toLowerCase().includes(term);
    },
    [q],
  );

  const assignedRows = useMemo<Row[]>(
    () =>
      assigned
        .map((a) => {
          const person = employeeById.get(a.userId);
          return {
            id: a.userId,
            name: person?.name ?? a.employeeName,
            employeeNumber: person?.employeeNumber ?? a.employeeNumber,
            jobTitle: person?.jobTitle,
            department: person?.department?.name ?? null,
            departmentId: person?.departmentId ?? null,
          };
        })
        .filter((p) => (!departmentId || p.departmentId === departmentId) && matches(p.name, p.employeeNumber)),
    [assigned, employeeById, departmentId, matches],
  );

  const availableRows = useMemo<Row[]>(
    () =>
      employees
        .filter((e) => !assignedIds.has(e.id))
        .map((e) => ({
          id: e.id,
          name: e.name,
          employeeNumber: e.employeeNumber ?? null,
          jobTitle: e.jobTitle,
          department: e.department?.name ?? null,
          departmentId: e.departmentId ?? null,
          currentSchedule: assignmentByUser.get(e.id) ?? null,
        }))
        .filter((p) => (!departmentId || p.departmentId === departmentId) && matches(p.name, p.employeeNumber)),
    [employees, assignedIds, departmentId, matches, assignmentByUser],
  );

  const toggle = (set: Set<string>, setter: (next: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const selectAll = (rows: Row[], set: Set<string>, setter: (next: Set<string>) => void) => {
    if (rows.length > 0 && rows.every((row) => set.has(row.id))) setter(new Set());
    else setter(new Set(rows.map((row) => row.id)));
  };

  const assign = async (ids: string[]) => {
    if (!scheduleId || ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await scheduleApi.assign({ scheduleId, userIds: ids, from: toDateInput(new Date()) });
      setToast(`Se asignó el horario a ${res.assigned} persona(s).`);
      setToAssign(new Set());
      setPendingAssign(null);
      loadAssigned(scheduleId);
      loadAllAssignments();
    } catch (e) {
      setError((e as Error).message ?? t("assign.error"));
    } finally {
      setSaving(false);
    }
  };

  const requestAssign = (ids: string[]) => {
    if (!scheduleId || ids.length === 0) return;
    const changing = ids.filter((id) => {
      const current = assignmentByUser.get(id);
      return current && current !== currentSchedule?.name;
    });
    if (changing.length > 0) {
      setPendingAssign(ids);
      return;
    }
    void assign(ids);
  };

  const remove = async (ids: string[]) => {
    if (!scheduleId || ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await scheduleApi.removeAssignments({ scheduleId, userIds: ids });
      setToast(`Se quitó el horario a ${res.removed} persona(s).`);
      setToRemove(new Set());
      loadAssigned(scheduleId);
    } catch (e) {
      setError((e as Error).message ?? t("assign.removeError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ContentSkeleton />;

  const scheduleOptions = schedules.map((h) => ({ value: h.id, label: h.name }));
  const departmentOptions = [
    { value: "", label: t("assign.allDepartments") },
    ...departments.data.map((d) => ({ value: d.id, label: d.name })),
  ];

  const pane = (title: string, count: number, rows: Row[], selected: Set<string>, setSelected: (next: Set<string>) => void, side: "left" | "right") => (
    <ITCard className={`tm-hero-card ${side === "left" ? "tm-hero-card--mint" : "tm-hero-card--sky"}`} contentClassName="!p-0">
      <ITFlex align="center" justify="between" className="border-b border-slate-100 px-4 py-3">
        <ITFlex align="center" gap={2}>
          <ITCheckbox
            name={`assign-all-${side}`}
            checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
            indeterminate={rows.some((row) => selected.has(row.id)) && !rows.every((row) => selected.has(row.id))}
            disabled={rows.length === 0}
            onChange={() => selectAll(rows, selected, setSelected)}
          />
          <ITText className="!text-[13px] font-bold !text-slate-800">{title}</ITText>
          <ITBadget color={side === "left" ? "success" : "gray"} size="sm">{count}</ITBadget>
        </ITFlex>
        <ITText muted className="!text-[11px]">{selected.size} seleccionados</ITText>
      </ITFlex>
      <div className="max-h-[430px] min-h-[260px] overflow-y-auto p-2">
        {rows.length === 0 ? (
          <TicState kind="empty" size="sm" title={side === "left" ? "Nadie tiene este horario" : "Todos ya lo tienen"} description={side === "left" ? "Mueve personas desde la derecha." : "No hay personas pendientes con estos filtros."} />
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <div key={row.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-slate-50" onClick={() => toggle(selected, setSelected, row.id)}>
                <ITCheckbox name={`assign-${side}-${row.id}`} checked={selected.has(row.id)} onChange={() => toggle(selected, setSelected, row.id)} />
                <ProfileAvatar name={row.name} size="sm" />
                <ITFlex direction="column" gap={0} className="min-w-0 flex-1">
                  <ITText className="truncate !text-[12.5px] font-semibold">{row.name}</ITText>
                  <ITFlex align="center" gap={1} wrap="wrap">
                    <ITText muted className="truncate !text-[11px]">{personMeta(row.employeeNumber, row.jobTitle, row.department ?? undefined) || "—"}</ITText>
                    {side === "right" && row.currentSchedule && (
                      <ITBadget color="info" size="sm">Actualmente: {row.currentSchedule}</ITBadget>
                    )}
                  </ITFlex>
                </ITFlex>
                <span onClick={(event) => event.stopPropagation()}>
                  <ITButton
                    variant="text"
                    color={side === "left" ? "danger" : "success"}
                    size="sm"
                    title={side === "left" ? "Quitar horario" : "Asignar horario"}
                    onClick={() => (side === "left" ? void remove([row.id]) : requestAssign([row.id]))}
                  >
                    {side === "left" ? <FaMinus size={11} /> : <FaPlus size={11} />}
                  </ITButton>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ITCard>
  );

  return (
    <ITFlex direction="column" gap={4}>
      {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

      <BentoKpiGrid
        items={[
          { id: "assigned", label: "En este horario", value: assigned.length, caption: currentSchedule?.name ?? "—", icon: <FaArrowLeft size={14} />, tone: "success" },
          { id: "pending", label: "Por asignar", value: availableRows.length, caption: "con estos filtros", icon: <FaArrowRight size={14} />, tone: "warning" },
          { id: "people", label: "Personal", value: employees.length, caption: "en el filtro", icon: <FaPlus size={14} />, tone: "info" },
        ]}
      />

      <ITCard contentClassName="!p-4">
        <ITFlex wrap="wrap" align="end" gap={3}>
          <ITFlex className="min-w-[220px] flex-1">
            <ITSearchSelect name="schedule" label={t("assign.schedule")} options={scheduleOptions} value={scheduleId} onChange={(v) => setScheduleId(String(v))} className="w-full min-w-0" />
          </ITFlex>
          <ITFlex className="min-w-[180px] flex-1">
            <ITSearchSelect name="department" label={t("assign.department")} options={departmentOptions} value={departmentId} onChange={(value) => { setDepartmentId(String(value)); setToAssign(new Set()); setToRemove(new Set()); }} className="w-full min-w-0" />
          </ITFlex>
          <ITFlex className="min-w-[180px] flex-1">
            <ITInput name="searchPerson" label={t("assign.searchLabel")} placeholder={t("assign.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-full min-w-0" />
          </ITFlex>
          <HelpTip text="Marca personas en cualquier columna y usa las flechas del centro para moverlas. Una persona solo puede tener un horario vigente: al asignar otro, se reemplaza el anterior. Se aplica al instante." />
        </ITFlex>
      </ITCard>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {pane("Con este horario", assigned.length, assignedRows, toRemove, setToRemove, "left")}

        <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
          <ITButton
            variant="filled"
            color="success"
            className="tm-save-button"
            disabled={saving || toAssign.size === 0}
            title="Asignar seleccionados"
            onClick={() => requestAssign([...toAssign])}
          >
            <FaArrowLeft size={12} />
            <ITText as="span" className="ml-1 font-bold text-[11px] lg:hidden xl:inline">Asignar ({toAssign.size})</ITText>
          </ITButton>
          <ITButton
            variant="outlined"
            color="danger"
            className="tm-save-button"
            disabled={saving || toRemove.size === 0}
            title="Quitar seleccionados"
            onClick={() => void remove([...toRemove])}
          >
            <FaArrowRight size={12} />
            <ITText as="span" className="ml-1 font-bold text-[11px] lg:hidden xl:inline">Quitar ({toRemove.size})</ITText>
          </ITButton>
        </div>

        {pane("Sin este horario", availableRows.length, availableRows, toAssign, setToAssign, "right")}
      </div>

      <ITText muted className="!text-[11px]">{t("assign.immediate")} · Una persona solo puede tener un horario vigente; al asignar otro se reemplaza el anterior.</ITText>

      <ITDialog isOpen={!!pendingAssign} onClose={() => setPendingAssign(null)} className="max-w-xl">
        <DialogHeader
          icon={<LuArrowLeftRight size={20} />}
          title="Cambiar horario"
          subtitle={`Se reemplazará el horario vigente por ${currentSchedule?.name ?? "el horario seleccionado"}.`}
        />
        <div className="max-h-[52vh] overflow-y-auto">
          <div className="mb-2 grid grid-cols-[1.2fr_1fr_auto_1fr] items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span>Persona</span><span>Horario actual</span><span /><span>Nuevo horario</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {(pendingAssign ?? []).map((id) => {
              const person = employeeById.get(id);
              const current = assignmentByUser.get(id);
              return (
                <div key={id} className="grid grid-cols-[1.2fr_1fr_auto_1fr] items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
                  <ITText className="truncate !text-[12.5px] font-semibold !text-slate-800">{person?.name ?? "Persona"}</ITText>
                  <ITBadget color={current ? "warning" : "gray"} size="sm">{current ?? "Sin horario"}</ITBadget>
                  <ITText className="text-center !text-slate-400">→</ITText>
                  <ITBadget color="success" size="sm">{currentSchedule?.name ?? "—"}</ITBadget>
                </div>
              );
            })}
          </div>
          <ITText muted className="mt-3 block !text-[11.5px]">
            Las personas con otro horario quedarán reemplazadas; las que no tenían horario se asignarán por primera vez.
          </ITText>
        </div>
        <ITFlex justify="end" gap={2} className="mt-4">
          <ITButton variant="outlined" color="secondary" className="tm-save-button" onClick={() => setPendingAssign(null)} disabled={saving}>Cancelar</ITButton>
          <ITButton variant="filled" color="primary" className="tm-save-button" onClick={() => pendingAssign && void assign(pendingAssign)} disabled={saving}>
            {saving ? "Cambiando…" : "Cambiar horario"}
          </ITButton>
        </ITFlex>
      </ITDialog>

      {toast && <ITToast message={toast} type="success" position="top-right" duration={3000} onClose={() => setToast(null)} />}
    </ITFlex>
  );
}
