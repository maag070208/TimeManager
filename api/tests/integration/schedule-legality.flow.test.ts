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
    assert.match(String(tooLong.body?.message), /la semana suma 54 h y el máximo legal es \d+ h/, "el mensaje explica el tope sin códigos");

    const noRest = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Sin descanso",
        mealBreakMin: 0,
        days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => day(weekday)),
      },
    });
    expectError(noRest, 400, "SCHEDULE_ILLEGAL", "semana sin día de descanso");
    assert.match(String(noRest.body?.message), /marca al menos uno de descanso/, "el mensaje dice qué hacer");
    assert.doesNotMatch(String(noRest.body?.message), /SIN_DIA_DE_DESCANSO|SEMANA_MAYOR_LEGAL/, "sin códigos internos");
  });

  test("la comida puede ser distinta cada día y se guarda por día", async () => {
    const admin = await clientSession("CLIENT_ADMIN");
    const created = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Comida por día",
        mealBreakMin: 60,
        days: [
          { ...day(1), mealStartTime: "12:00", mealEndTime: "13:00" },
          { ...day(2), mealStartTime: "14:00", mealEndTime: "15:00" },
          day(3),
          { weekday: 7, restDay: true },
        ],
      },
    });
    expectStatus(created, 201, "horario con comida por día");
    const days = created.body?.days as Array<{ weekday: number; mealStartTime: string | null; mealEndTime: string | null }>;
    assert.deepEqual(days.find((row) => row.weekday === 2), { ...days.find((row) => row.weekday === 2), mealStartTime: "14:00", mealEndTime: "15:00" });
    assert.equal(days.find((row) => row.weekday === 3)?.mealStartTime, null, "sin ventana usa los minutos del horario");

    const incomplete = await api("POST", "/schedules", {
      token: admin.token,
      body: { name: "Comida incompleta", days: [{ ...day(1), mealStartTime: "12:00" }, { weekday: 7, restDay: true }] },
    });
    assert.equal(incomplete.status, 400, "la comida necesita inicio y fin");
  });

  test("los defaults de asistencia del cliente aplican a horarios nuevos", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const saved = await api("PUT", "/nom/config", {
      token: admin.token,
      body: {
        defaultEntryToleranceMin: 5,
        defaultExitToleranceMin: 15,
        defaultMealBreakMin: 30,
        defaultMinOvertimeMin: 0,
      },
    });
    expectStatus(saved, 200, "política de asistencia");

    const created = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Horario con defaults",
        days: [1, 2, 3, 4, 5].map((weekday) => day(weekday, "08:00", "17:00")),
      },
    });
    expectStatus(created, 201, "horario con defaults");
    assert.equal(created.body?.entryToleranceMin, 5);
    assert.equal(created.body?.exitToleranceMin, 15);
    assert.equal(created.body?.mealBreakMin, 30);
    assert.equal(created.body?.minOvertimeMin, 0);
  });

  test("la semana laboral del cliente se configura (jueves → miércoles)", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const saved = await api("PUT", "/nom/config", {
      token: admin.token,
      body: { weekStartDay: 4 },
    });
    expectStatus(saved, 200, "semana configurada");
    assert.equal(saved.body?.weekStartDay, 4);

    const invalid = await api("PUT", "/nom/config", {
      token: admin.token,
      body: { weekStartDay: 9 },
    });
    expectError(invalid, 400, "VALIDATION_ERROR", "día de inicio inválido");

    const report = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: "2027-03-10" },
    });
    expectStatus(report, 200, "reporte semanal con semana del cliente");
    assert.ok(
      String(report.body?.range?.start).startsWith("2027-03-04"),
      "la semana inicia el jueves 4 de marzo"
    );
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
