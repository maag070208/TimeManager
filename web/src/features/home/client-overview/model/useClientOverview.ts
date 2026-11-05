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
import { useCan } from "@entities/user";

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
  const onboarding =
    people && setup && scheduleCount != null && (can.createUsers || can.manageSchedules)
      ? [
          { id: "staff", done: people.active > 1, to: "/users/new", hintCount: 0 },
          { id: "schedules", done: scheduleCount > 0, to: "/schedules/new", hintCount: 0 },
          { id: "assign", done: people.active > 1 && setup.personalWithoutSchedule === 0, to: "/schedules/assign", hintCount: setup.personalWithoutSchedule },
          { id: "clock", done: people.active > 1 && setup.personalWithoutClock === 0, to: "/hr/time-clock/employees", hintCount: setup.personalWithoutClock },
        ]
      : null;

  const hasAny = can.attendance || can.records || can.overtime || can.setup;

  return { can, attendance, people, records, overtime, setup, onboarding, hasAny };
};
