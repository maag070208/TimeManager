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
} from "@axzydev/axzy_ui_system";
import type { Column, ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { FaMinus, FaPlus } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { usersApi, type User } from "@entities/user";
import { useDepartmentOptions } from "@entities/department";
import { scheduleApi, type AssignedPerson, type Schedule } from "@entities/schedule";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { TicState } from "@shared/ui/tic";

const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "#número · puesto · departamento": lo justo para reconocer a la persona. */
function personMeta(employeeNumber?: string | null, jobTitle?: string, department?: string) {
  return [employeeNumber ? `#${employeeNumber}` : null, jobTitle, department].filter(Boolean).join(" · ");
}

/** Filtro de la tabla: todas, ya asignadas al horario o por asignar. */
type AssignView = "all" | "assigned" | "pending";

/** Renglón de la tabla: persona del catálogo + si ya tiene el horario elegido. */
interface AssignRow {
  id: string;
  name: string;
  employeeNumber: string | null;
  jobTitle?: string;
  department: string | null;
  departmentId: string | null;
  isAssigned: boolean;
}

/**
 * Asignar horario: elegir el horario, filtrar por departamento y marcar a varias
 * personas para **asignar** o **quitar** de una vez (o una por una con el botón
 * del renglón). Sin modos ni arrastrar: dos listas y dos botones.
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
  const [view, setView] = useState<AssignView>("all");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    loadAssigned(scheduleId);
    setToAssign(new Set());
    setToRemove(new Set());
  }, [scheduleId, loadAssigned]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.userId)), [assigned]);
  const currentSchedule = schedules.find((h) => h.id === scheduleId);

  const matches = useCallback(
    (name: string, employeeNumber: string | null | undefined) => {
      const term = q.trim().toLowerCase();
      if (!term) return true;
      return name.toLowerCase().includes(term) || (employeeNumber ?? "").toLowerCase().includes(term);
    },
    [q],
  );

  // Personas que todavía no tienen este horario (con departamento y búsqueda).
  const available = useMemo(
    () =>
      employees.filter((e) => {
        if (assignedIds.has(e.id)) return false;
        if (departmentId && e.departmentId !== departmentId) return false;
        return matches(e.name, e.employeeNumber);
      }),
    [employees, assignedIds, departmentId, matches],
  );

  // Personas que ya lo tienen: el nombre viene del horario y los datos del catálogo.
  const assignedRows = useMemo(
    () =>
      assigned
        .map((a) => {
          const person = employeeById.get(a.userId);
          return {
            id: a.userId,
            name: person?.name ?? a.employeeName,
            employeeNumber: person?.employeeNumber ?? a.employeeNumber,
            jobTitle: person?.jobTitle,
            department: person?.department?.name,
            departmentId: person?.departmentId ?? null,
          };
        })
        .filter((p) => {
          if (departmentId && p.departmentId !== departmentId) return false;
          return matches(p.name, p.employeeNumber);
        }),
    [assigned, employeeById, departmentId, matches],
  );

  const availableRows = useMemo<AssignRow[]>(
    () =>
      available.map((person) => ({
        id: person.id,
        name: person.name,
        employeeNumber: person.employeeNumber ?? null,
        jobTitle: person.jobTitle,
        department: person.department?.name ?? null,
        departmentId: person.departmentId ?? null,
        isAssigned: false,
      })),
    [available],
  );

  const assignedTableRows = useMemo<AssignRow[]>(
    () =>
      assignedRows.map((person) => ({
        ...person,
        department: person.department ?? null,
        isAssigned: true,
      })),
    [assignedRows],
  );

  const tableRows = useMemo<AssignRow[]>(
    () =>
      view === "assigned"
        ? assignedTableRows
        : view === "pending"
          ? availableRows
          : [...assignedTableRows, ...availableRows],
    [view, assignedTableRows, availableRows],
  );

  const fetchData = useMemo(() => {
    const fetch = makeClientTableFetch<AssignRow>(() => Promise.resolve(tableRows), {
      name: { value: (row) => row.name, match: "text" },
      employeeNumber: { value: (row) => row.employeeNumber ?? "", match: "text" },
      department: { value: (row) => row.department ?? "", match: "text" },
      status: {
        value: (row) => (row.isAssigned ? t("assign.inSchedule") : t("assign.available")),
        match: "text",
      },
    });
    return (params: ITDataTableFetchParams) => fetch(params);
  }, [tableRows, t]);

  const toggle = (set: Set<string>, setSet: (next: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };

  const assign = async (ids: string[]) => {
    if (!scheduleId || ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await scheduleApi.assign({ scheduleId, userIds: ids, from: toDateInput(new Date()) });
      setToast(t("assign.success", { count: res.assigned }));
      setToAssign(new Set());
      loadAssigned(scheduleId);
    } catch (e) {
      setError((e as Error).message ?? t("assign.error"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ids: string[]) => {
    if (!scheduleId || ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await scheduleApi.removeAssignments({ scheduleId, userIds: ids });
      setToast(t("assign.removed", { count: res.removed }));
      setToRemove(new Set());
      loadAssigned(scheduleId);
    } catch (e) {
      setError((e as Error).message ?? t("assign.removeError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ContentSkeleton />;
  }

  const scheduleOptions = schedules.map((h) => ({ value: h.id, label: h.name }));
  const departmentOptions = [
    { value: "", label: t("assign.allDepartments") },
    ...departments.data.map((d) => ({ value: d.id, label: d.name })),
  ];

  const departmentName = departmentId
    ? departments.data.find((d) => d.id === departmentId)?.name ?? t("assign.allDepartments")
    : t("assign.allDepartments");

  const isPicked = (row: AssignRow): boolean =>
    row.isAssigned ? toRemove.has(row.id) : toAssign.has(row.id);

  const togglePick = (row: AssignRow): void =>
    row.isAssigned ? toggle(toRemove, setToRemove, row.id) : toggle(toAssign, setToAssign, row.id);

  const visiblePendingIds = tableRows.filter((row) => !row.isAssigned).map((row) => row.id);
  const visibleAssignedIds = tableRows.filter((row) => row.isAssigned).map((row) => row.id);
  const allVisibleSelected = tableRows.length > 0 && tableRows.every(isPicked);
  const someVisibleSelected = tableRows.some(isPicked);
  const pickedCount = toAssign.size + toRemove.size;

  const toggleVisible = (checked: boolean): void => {
    setToAssign(checked ? new Set(visiblePendingIds) : new Set());
    setToRemove(checked ? new Set(visibleAssignedIds) : new Set());
  };

  const clearPicks = (): void => {
    setToAssign(new Set());
    setToRemove(new Set());
  };

  const columns: Column<AssignRow>[] = [
    {
      key: "select",
      // El kit pinta `label` tal cual: aquí va la casilla de "seleccionar visibles".
      label: (
        <ITCheckbox
          name="assignVisibleAll"
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected}
          disabled={tableRows.length === 0}
          onChange={toggleVisible}
        />
      ) as unknown as string,
      type: "actions",
      width: 48,
      actions: (row) => (
        <ITCheckbox name={`assign-row-${row.id}`} checked={isPicked(row)} onChange={() => togglePick(row)} />
      ),
    },
    {
      key: "name",
      label: t("assign.people"),
      type: "string",
      width: 290,
      render: (row) => (
        <ITFlex
          align="center"
          gap={2}
          className="min-w-0 cursor-pointer"
          onClick={() => togglePick(row)}
        >
          <ProfileAvatar name={row.name} size="sm" />
          <ITFlex direction="column" gap={0} className="min-w-0">
            <ITText className="truncate !text-[12.5px] font-semibold">{row.name}</ITText>
            <ITText muted className="truncate !text-[11px]">
              {personMeta(row.employeeNumber, row.jobTitle, row.department ?? undefined)}
            </ITText>
          </ITFlex>
        </ITFlex>
      ),
    },
    {
      key: "department",
      label: t("assign.department"),
      type: "string",
      width: 170,
      render: (row) => <ITText className="!text-[12px]">{row.department ?? "—"}</ITText>,
    },
    {
      key: "status",
      label: t("assign.schedule"),
      type: "string",
      width: 190,
      sortable: false,
      render: (row) => (
        <ITBadget color={row.isAssigned ? "success" : "gray"} size="sm">
          {row.isAssigned ? currentSchedule?.name ?? "—" : t("assign.available")}
        </ITBadget>
      ),
    },
    {
      key: "rowAction",
      label: "",
      type: "actions",
      width: 64,
      render: (row) => (
        <ITButton
          variant="text"
          color={row.isAssigned ? "error" : "success"}
          size="sm"
          icon={row.isAssigned ? <FaMinus size={12} /> : <FaPlus size={12} />}
          ariaLabel={row.isAssigned ? t("assign.removeOne") : t("assign.assignOne")}
          title={row.isAssigned ? t("assign.removeOne") : t("assign.assignOne")}
          onClick={() => void (row.isAssigned ? remove([row.id]) : assign([row.id]))}
        />
      ),
    },
  ];

  return (
    <ITFlex direction="column" gap={4}>
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {/* Contexto de la asignación: cuántas personas ya tienen el horario y cuántas faltan. */}
      <BentoFilterCards
        activeId={view}
        onSelect={(id: string) => setView(id as AssignView)}
        items={[
          {
            id: "assigned",
            label: t("assign.inSchedule"),
            value: assigned.length,
            caption: `${t("assign.assignedTo")} ${currentSchedule?.name ?? "—"}`,
          },
          {
            id: "pending",
            label: t("assign.pending"),
            value: available.length,
            caption: t("assign.pendingCaption"),
          },
          {
            id: "all",
            label: t("assign.people"),
            value: employees.length,
            caption: departmentName,
          },
        ]}
      />

      {/* Una sola tarjeta: filtros, acciones masivas compactas y la tabla de personas. */}
      <ITCard contentClassName="!p-0">
        <ITFlex wrap="wrap" align="end" gap={3} className="border-b border-slate-200/70 px-5 py-4">
          <ITFlex className="min-w-[220px] flex-1">
            <ITSearchSelect
              name="schedule"
              label={t("assign.schedule")}
              options={scheduleOptions}
              value={scheduleId}
              onChange={(v) => setScheduleId(String(v))}
              className="w-full min-w-0"
            />
          </ITFlex>
          <ITFlex className="min-w-[180px] flex-1">
            <ITSearchSelect
              name="department"
              label={t("assign.department")}
              options={departmentOptions}
              value={departmentId}
              onChange={(value) => {
                setDepartmentId(String(value));
                setToAssign(new Set());
                setToRemove(new Set());
              }}
              className="w-full min-w-0"
            />
          </ITFlex>
          <ITFlex className="min-w-[180px] flex-1">
            <ITInput
              name="searchPerson"
              label={t("assign.searchLabel")}
              placeholder={t("assign.search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full min-w-0"
            />
          </ITFlex>
          <ITFlex align="center" gap={1}>
            <HelpTip text="La asignación se aplica desde hoy y cierra la vigencia anterior de esa persona. Márcala por casilla para asignar o quitar en lote; el cambio se guarda al instante." />
          </ITFlex>
        </ITFlex>

        <ITFlex align="center" wrap="wrap" gap={2} className="px-5 pt-3">
          <ITText muted className="!text-[11.5px]">
            {t("assign.picked", { count: pickedCount })}
          </ITText>
          <ITButton variant="text" color="gray" size="sm" disabled={pickedCount === 0} onClick={clearPicks}>
            <ITText className="text-[11px] font-bold">{t("assign.clear")}</ITText>
          </ITButton>
          <ITFlex align="center" gap={2} className="ml-auto">
            <ITButton
              variant="outlined"
              color="danger"
              size="sm"
              disabled={saving || toRemove.size === 0}
              onClick={() => void remove([...toRemove])}
            >
              <ITFlex align="center" gap={1}>
                <FaMinus size={10} />
                <ITText className="font-bold text-[11px]">{t("assign.remove", { count: toRemove.size })}</ITText>
              </ITFlex>
            </ITButton>
            <ITButton
              variant="filled"
              color="success"
              size="sm"
              disabled={saving || toAssign.size === 0}
              onClick={() => void assign([...toAssign])}
            >
              <ITFlex align="center" gap={1}>
                <FaPlus size={10} />
                <ITText className="font-bold text-[11px]">{t("assign.apply", { count: toAssign.size })}</ITText>
              </ITFlex>
            </ITButton>
          </ITFlex>
        </ITFlex>

        {tableRows.length === 0 ? (
          <TicState
            kind="empty"
            title={t("assign.noPeople")}
            description={departmentId || q.trim() ? t("assign.noPeopleFiltered") : t("assign.pendingCaption")}
          />
        ) : (
          <ITDataTable
            showViewToggle={false}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            fetchData={
              fetchData as unknown as (
                p: ITDataTableFetchParams
              ) => Promise<ITDataTableResponse<Record<string, unknown>>>
            }
            defaultItemsPerPage={25}
            itemsPerPageOptions={[25, 50, 100]}
            layout="fixed"
            density="compact"
            rowHeight={52}
            virtualized
            virtualizedMaxHeight={520}
          />
        )}

        <ITText muted className="px-5 pb-4 pt-2 !text-[11px]">
          {t("assign.immediate")} · {t("assign.removeHint")}
        </ITText>
      </ITCard>

      {toast && (
        <ITToast message={toast} type="success" position="top-right" duration={3000} onClose={() => setToast(null)} />
      )}
    </ITFlex>
  );
}
