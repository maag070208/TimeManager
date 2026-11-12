import { useEffect, useState } from "react";
import {
  dashboardApi,
  type AttendanceTodayWidget,
  type HrRecordsWidget,
  type OvertimeWeekWidget,
  type PeopleWidget,
  type SetupGapsWidget,
} from "@entities/dashboard";
import { scheduleApi } from "@entities/schedule";
import { useCan, useHasPunchChannel } from "@entities/user";

/** Estado de un bloque del inicio: `undefined` = cargando, `null` = falló. */
type Slot<T> = T | null | undefined;

const load = <T,>(enabled: boolean, fetch: () => Promise<T>, set: (v: Slot<T>) => void, alive: () => boolean) => {
  if (!enabled) return;
  fetch()
    .then((v) => alive() && set(v))
    .catch(() => alive() && set(null));
};

/**
 * Inicio del cliente: cada bloque se pide solo si la persona tiene el permiso
 * y carga por su cuenta (uno lento no detiene a los demás).
 */
export const useClientOverview = () => {
  const can = {
    attendance: useCan("attendance.view"),
    records: useCan("hr.records"),
    overtime: useCan("overtime.view"),
    setup: useCan("time_clock.link"),
    schedules: useCan("schedules.view"),
    createUsers: useCan("users.create"),
    manageSchedules: useCan("schedules.manage"),
  };
  const [attendance, setAttendance] = useState<Slot<AttendanceTodayWidget>>();
  const [people, setPeople] = useState<Slot<PeopleWidget>>();
  const [records, setRecords] = useState<Slot<HrRecordsWidget>>();
  const [overtime, setOvertime] = useState<Slot<OvertimeWeekWidget>>();
  const [setup, setSetup] = useState<Slot<SetupGapsWidget>>();
  const [scheduleCount, setScheduleCount] = useState<Slot<number>>();
  /** Sin canal CLOCK la vista del cliente no muestra nada de reloj checador. */
  const hasClock = useHasPunchChannel("CLOCK") ?? true;

  useEffect(() => {
    let active = true;
    const alive = () => active;
    load(can.attendance, dashboardApi.attendanceToday, setAttendance, alive);
    load(can.records, dashboardApi.people, setPeople, alive);
    load(can.records, dashboardApi.hrRecords, setRecords, alive);
    load(can.overtime, dashboardApi.overtimeWeek, setOvertime, alive);
    load(can.setup, dashboardApi.setupGaps, setSetup, alive);
    load(can.schedules, () => scheduleApi.list().then((r) => r.length), setScheduleCount, alive);
    return () => {
      active = false;
    };
  }, [can.attendance, can.records, can.overtime, can.setup, can.schedules]);

  // Primeros pasos: solo con los datos para decidirlos y alguien que pueda hacerlos.
  // El alta del reloj checador solo aplica si el cliente tiene canal CLOCK.
  const onboarding =
    people && setup && scheduleCount != null && (can.createUsers || can.manageSchedules)
      ? [
          { id: "staff", done: people.active > 1, to: "/employees/new", hintCount: 0 },
          { id: "schedules", done: scheduleCount > 0, to: "/schedules/new", hintCount: 0 },
          { id: "assign", done: people.active > 1 && setup.personalWithoutSchedule === 0, to: "/schedules/assign", hintCount: setup.personalWithoutSchedule },
          ...(hasClock
            ? [{ id: "clock", done: people.active > 1 && setup.personalWithoutClock === 0, to: "/hr/time-clock/employees", hintCount: setup.personalWithoutClock }]
            : []),
        ]
      : null;

  const hasAny = can.attendance || can.records || can.overtime || can.setup;

  /** Primera carga: algún bloque con permiso aún no responde. El inicio muestra su esqueleto completo. */
  const loading =
    (can.attendance && attendance === undefined) ||
    (can.records && (people === undefined || records === undefined)) ||
    (can.overtime && overtime === undefined) ||
    (can.setup && setup === undefined) ||
    (can.schedules && scheduleCount === undefined);

  return { can, hasClock, attendance, people, records, overtime, setup, onboarding, hasAny, loading };
};
