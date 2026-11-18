import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { PeopleAttendanceService, type AttendanceSessionSource } from "./people-attendance.service";
import type { AccessReportPerson, AccessReportSessionRow } from "@modules/access/models/entity/access.entity";

const DAY = "2026-11-05";
const person = (id: string): AccessReportPerson => ({ id, name: id, employeeNumber: null, jobTitle: null, department: null, active: true });
const session = (employeeId: string, entryAt: string): AccessReportSessionRow => ({
  id: `${employeeId}-s`,
  employeeId,
  employeeName: employeeId,
  employeeNumber: null,
  jobTitle: null,
  departmentId: null,
  departmentName: null,
  active: true,
  date: DAY,
  entryAt,
  exitAt: "2026-11-06T00:00:00.000Z",
  workedMinutes: 8 * 60,
  incident: null,
  crossesMidnight: false,
});

const schedule = {
  name: "Oficina",
  entryToleranceMin: 10,
  exitToleranceMin: 0,
  mealBreakMin: 60,
  minOvertimeMin: 60,
  crossesMidnight: false,
  days: [{ weekday: 4, startTime: "08:00", endTime: "17:00", splitStartTime: null, splitEndTime: null, restDay: false }],
};

const service = () => {
  const source: AttendanceSessionSource = {
    sessions: async () => ({
      people: [person("puntual"), person("tarde"), person("falta")],
      rows: [session("puntual", "2026-11-05T13:55:00.000Z"), session("tarde", "2026-11-05T15:30:00.000Z")],
      range: { start: new Date("2026-11-05T06:00:00.000Z"), end: new Date("2026-11-06T06:00:00.000Z"), timezone: "America/Mexico_City", period: "DAY" },
    }),
  };
  const db = {
    scheduleAssignment: {
      findMany: async () =>
        ["puntual", "tarde", "falta"].map((userId) => ({
          id: `a-${userId}`,
          userId,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          schedule,
        })),
    },
  } as unknown as PrismaClient;
  return new PeopleAttendanceService({ ACCESS: source, CLOCK: source } as never, db, () => Date.parse("2026-11-10T18:00:00.000Z"));
};

const namesIn = async (view: string) => {
  const res = await service().report("CLOCK" as never, { page: 1, limit: 50, filters: { view } } as never);
  return (res.data as Array<{ employeeName: string }>).map((row) => row.employeeName);
};

test("las vistas del inicio filtran a tiempo, con retardo y faltas", async () => {
  assert.deepEqual(await namesIn("ON_TIME"), ["puntual"]);
  assert.deepEqual(await namesIn("LATE"), ["tarde"]);
  assert.deepEqual(await namesIn("ABSENT"), ["falta"]);
  assert.deepEqual(await namesIn("ALL"), ["falta", "puntual", "tarde"]);
});

test("la comida es la pausa entre el primer y el segundo tramo del día", async () => {
  const source: AttendanceSessionSource = {
    sessions: async () => ({
      people: [person("karla")],
      rows: [
        { ...session("karla", "2026-11-05T20:00:00.000Z"), id: "s2", exitAt: "2026-11-05T23:00:00.000Z" },
        { ...session("karla", "2026-11-05T13:55:00.000Z"), id: "s1", exitAt: "2026-11-05T19:00:00.000Z" },
      ],
      range: { start: new Date("2026-11-05T06:00:00.000Z"), end: new Date("2026-11-06T06:00:00.000Z"), timezone: "America/Mexico_City", period: "DAY" },
    }),
  };
  const db = { scheduleAssignment: { findMany: async () => [] } } as unknown as PrismaClient;
  const res = await new PeopleAttendanceService({ CLOCK: source } as never, db, () => Date.parse("2026-11-10T18:00:00.000Z")).report(
    "CLOCK" as never,
    { page: 1, limit: 50, filters: {} } as never
  );
  const [day] = (res.data as unknown as Array<{ days: Array<Record<string, unknown>> }>)[0].days;
  assert.equal(day.entryAt, "2026-11-05T13:55:00.000Z");
  assert.equal(day.lunchStartAt, "2026-11-05T19:00:00.000Z");
  assert.equal(day.lunchEndAt, "2026-11-05T20:00:00.000Z");
  assert.equal(day.exitAt, "2026-11-05T23:00:00.000Z");
});
