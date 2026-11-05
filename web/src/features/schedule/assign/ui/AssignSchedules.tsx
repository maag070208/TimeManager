import { LottieLoader } from "@shared/ui/lottie-loader";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITBentoStatStrip,
  ITButton,
  ITCard,
  ITCheckbox,
  ITFlex,
  ITGrid,
  ITInput,
  ITSearchSelect,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import { FaArrowLeft, FaArrowRight, FaMinus, FaPlus } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { usersApi, type User } from "@entities/user";
import { useDepartmentOptions } from "@entities/department";
import { scheduleApi, type AssignedPerson, type Schedule } from "@entities/schedule";
import { ProfileAvatar } from "@shared/ui/profile-avatar";

const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "#número · puesto · departamento": lo justo para reconocer a la persona. */
function personMeta(employeeNumber?: string | null, jobTitle?: string, department?: string) {
  return [employeeNumber ? `#${employeeNumber}` : null, jobTitle, department].filter(Boolean).join(" · ");
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

  const allPending = available.length > 0 && available.every((e) => toAssign.has(e.id));
  const somePending = toAssign.size > 0 && !allPending;
  const allAssigned = assignedRows.length > 0 && assignedRows.every((p) => toRemove.has(p.id));
  const someAssigned = toRemove.size > 0 && !allAssigned;

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
    return (
      <ITFlex justify="center" className="py-10">
        <LottieLoader size="lg" />
      </ITFlex>
    );
  }

  const scheduleOptions = schedules.map((h) => ({ value: h.id, label: h.name }));
  const departmentOptions = [
    { value: "", label: t("assign.allDepartments") },
    ...departments.data.map((d) => ({ value: d.id, label: d.name })),
  ];

  const departmentName = departmentId
    ? departments.data.find((d) => d.id === departmentId)?.name ?? t("assign.allDepartments")
    : t("assign.allDepartments");

  return (
    <ITFlex direction="column" gap={4}>
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {/* Cifras de la asignación: en el horario, por asignar y el filtro activo */}
      <ITBentoStatStrip
        items={[
          {
            id: "inSchedule",
            label: t("assign.inSchedule"),
            value: assigned.length,
            caption: currentSchedule?.name ?? "—",
            tone: "mint",
          },
          {
            id: "pending",
            label: t("assign.pending"),
            value: available.length,
            caption: t("assign.pendingCaption"),
            tone: "sun",
          },
          {
            id: "people",
            label: t("assign.people"),
            value: employees.length,
            caption: departmentId ? departmentName : t("assign.allDepartments"),
            tone: "sea",
          },
        ]}
      />

      {/* Una tarjeta: filtros arriba y las dos listas debajo */}
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
              onChange={(v) => {
                setDepartmentId(String(v));
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
        </ITFlex>

        <ITGrid container columns={12} spacing={0}>
          {/* Por asignar */}
          <ITGrid item xs={12} lg={6} className="min-w-0 lg:border-r lg:border-slate-200/70">
            <ITFlex align="center" justify="between" gap={2} className="px-5 pb-2 pt-4">
              <ITFlex align="center" gap={1.5}>
                <ITCheckbox
                  name="pending-all"
                  checked={allPending}
                  indeterminate={somePending}
                  disabled={available.length === 0}
                  onChange={(value) => setToAssign(value ? new Set(available.map((e) => e.id)) : new Set())}
                />
                <ITText className="!text-[12.5px] font-bold">{t("assign.available")}</ITText>
                <ITText as="span" className="rounded-full bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] px-2 py-0.5 !text-[11px] font-bold text-[color:var(--color-warning)]">
                  {available.length}
                </ITText>
              </ITFlex>
              <ITText muted className="!text-[11.5px]">
                {t("assign.picked", { count: toAssign.size })}
              </ITText>
            </ITFlex>

            <ITFlex direction="column" gap={0} className="max-h-[44vh] overflow-y-auto px-3 pb-3">
              {available.length === 0 ? (
                <ITText muted className="px-2 py-6 !text-[12px]">
                  {departmentId ? t("assign.noPeopleFiltered") : t("assign.noPeople")}
                </ITText>
              ) : (
                available.map((e) => {
                  const picked = toAssign.has(e.id);
                  return (
                    <ITFlex
                      key={e.id}
                      align="center"
                      gap={2}
                      onClick={() => toggle(toAssign, setToAssign, e.id)}
                      className={`cursor-pointer rounded-xl px-2 py-1.5 transition-colors ${
                        picked
                          ? "bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]"
                          : "hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)]"
                      }`}
                    >
                      <ITText as="span" onClick={(ev) => ev.stopPropagation()}>
                        <ITCheckbox name={`assign-${e.id}`} checked={picked} onChange={() => toggle(toAssign, setToAssign, e.id)} />
                      </ITText>
                      <ProfileAvatar name={e.name} size="sm" />
                      <ITFlex direction="column" gap={0} className="min-w-0 flex-1">
                        <ITText className="truncate !text-[12.5px] font-semibold">{e.name}</ITText>
                        <ITText muted className="truncate !text-[11px]">
                          {personMeta(e.employeeNumber, e.jobTitle, e.department?.name)}
                        </ITText>
                      </ITFlex>
                      <ITText as="span" aria-hidden className="shrink-0" style={{ color: "var(--color-success)" }}>
                        <FaArrowRight size={12} />
                      </ITText>
                    </ITFlex>
                  );
                })
              )}
            </ITFlex>

            <ITFlex align="center" justify="between" gap={2} className="  px-5 py-3">
              <ITText muted className="!text-[11.5px]">
                {t("assign.immediate")}
              </ITText>
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
          </ITGrid>

          {/* Ya lo tienen */}
          <ITGrid item xs={12} lg={6} className="min-w-0">
            <ITFlex align="center" justify="between" gap={2} className="px-5 pb-2 pt-4">
              <ITFlex align="center" gap={1.5}>
                <ITCheckbox
                  name="assigned-all"
                  checked={allAssigned}
                  indeterminate={someAssigned}
                  disabled={assignedRows.length === 0}
                  onChange={(value) => setToRemove(value ? new Set(assignedRows.map((p) => p.id)) : new Set())}
                />
                <ITText className="!text-[12.5px] font-bold">
                  {t("assign.assignedTo")} {currentSchedule?.name ?? "—"}
                </ITText>
                <ITText as="span" className="rounded-full bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] px-2 py-0.5 !text-[11px] font-bold text-[color:var(--color-success)]">
                  {assignedRows.length}
                </ITText>
              </ITFlex>
              <ITText muted className="!text-[11.5px]">
                {t("assign.picked", { count: toRemove.size })}
              </ITText>
            </ITFlex>

            <ITFlex direction="column" gap={0} className="max-h-[44vh] overflow-y-auto px-3 pb-3">
              {assignedRows.length === 0 ? (
                <ITText muted className="px-2 py-6 !text-[12px]">
                  {t("assign.noAssigned")}
                </ITText>
              ) : (
                assignedRows.map((p) => {
                  const picked = toRemove.has(p.id);
                  return (
                    <ITFlex
                      key={p.id}
                      align="center"
                      gap={2}
                      onClick={() => toggle(toRemove, setToRemove, p.id)}
                      className={`cursor-pointer rounded-xl px-2 py-1.5 transition-colors ${
                        picked
                          ? "bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
                          : "hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)]"
                      }`}
                    >
                      <ITText as="span" onClick={(ev) => ev.stopPropagation()}>
                        <ITCheckbox name={`remove-${p.id}`} checked={picked} onChange={() => toggle(toRemove, setToRemove, p.id)} />
                      </ITText>
                      <ProfileAvatar name={p.name} size="sm" />
                      <ITFlex direction="column" gap={0} className="min-w-0 flex-1">
                        <ITText className="truncate !text-[12.5px] font-semibold">{p.name}</ITText>
                        <ITText muted className="truncate !text-[11px]">
                          {personMeta(p.employeeNumber, p.jobTitle, p.department)}
                        </ITText>
                      </ITFlex>
                      <ITText as="span" aria-hidden className="shrink-0" style={{ color: "var(--color-danger)" }}>
                        <FaArrowLeft size={12} />
                      </ITText>
                    </ITFlex>
                  );
                })
              )}
            </ITFlex>

            <ITFlex align="center" justify="between" gap={2} className="  px-5 py-3">
              <ITText muted className="!text-[11.5px]">
                {t("assign.removeHint")}
              </ITText>
              <ITButton
                variant="filled"
                color="error"
                size="sm"
                disabled={saving || toRemove.size === 0}
                onClick={() => void remove([...toRemove])}
              >
                <ITFlex align="center" gap={1}>
                  <FaMinus size={10} />
                  <ITText className="font-bold text-[11px]">{t("assign.remove", { count: toRemove.size })}</ITText>
                </ITFlex>
              </ITButton>
            </ITFlex>
          </ITGrid>
        </ITGrid>
      </ITCard>

      {toast && (
        <ITToast message={toast} type="success" position="top-right" duration={3000} onClose={() => setToast(null)} />
      )}
    </ITFlex>
  );
}
