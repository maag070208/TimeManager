/**
 * F2 — Validación legal de horarios (H-02) y asistente de transición (H-03).
 * La semana ordinaria no puede pasar del máximo del año; debe haber descanso.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { api, clientSession, createTenant, expectError, expectStatus, setupSuite, stopSuite } from "./harness";

const day = (weekday: number, startTime = "08:00", endTime = "17:00", restDay = false) => ({
  weekday,
  startTime: restDay ? null : startTime,
  endTime: restDay ? null : endTime,
  splitStartTime: null,
  splitEndTime: null,
  restDay,
});

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("F2 horarios legales y transición 2027", () => {
  test("rechaza una semana de más de 48 h (2026) y sin descanso", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const tooLong = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Semana 54h",
        mealBreakMin: 0,
        days: [1, 2, 3, 4, 5, 6].map((weekday) => day(weekday)),
      },
    });
    expectError(tooLong, 400, "SCHEDULE_ILLEGAL", "semana mayor al tope legal");

    const noRest = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Sin descanso",
        mealBreakMin: 0,
        days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => day(weekday)),
      },
    });
    expectError(noRest, 400, "SCHEDULE_ILLEGAL", "semana sin día de descanso");
  });

  test("acepta un horario legal y el asistente reporta los que dejan de serlo", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const legal = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Legal 2026",
        mealBreakMin: 60,
        days: [1, 2, 3, 4, 5].map((weekday) => day(weekday, "09:00", "19:00")),
      },
    });
    expectStatus(legal, 201, "horario legal 2026");

    const transition = await api("GET", "/schedules/legal-transition?year=2028", {
      token: admin.token,
    });
    expectStatus(transition, 200, "asistente de transición");
    const rows = transition.body as unknown as Array<{
      id: string;
      name: string;
      weeklyMinutes: number;
      legalWeeklyMinutes: number;
      violations: string[];
    }>;
    const row = rows.find((item) => item.id === legal.body?.id);
    assert.ok(row, "el horario de 45 h aparece para 2028");
    assert.equal(row?.legalWeeklyMinutes, 44 * 60);
    assert.ok(row?.violations.includes("SEMANA_MAYOR_LEGAL"));
  });
});
