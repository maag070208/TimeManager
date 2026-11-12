import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWorkday, type WorkdaySchedule } from "./workday-rules";
import { scheduleOn, type LoadedAssignment } from "./schedule-assignments";

/** Jueves 2026-11-05, horario 08:00–17:00 con 10 min de tolerancia de entrada. */
const schedule: WorkdaySchedule = {
  name: "Oficina",
  entryToleranceMin: 10,
  exitToleranceMin: 0,
  mealBreakMin: 60,
  minOvertimeMin: 60,
  crossesMidnight: false,
  days: [
    {
      weekday: 4,
      startTime: "08:00",
      endTime: "17:00",
      splitStartTime: null,
      splitEndTime: null,
      restDay: false,
    },
  ],
};

test("retardo usa la zona del cliente, no la del servidor", () => {
  // El mismo instante de entrada (15:30 UTC) cae distinto según el cliente:
  // CDMX (UTC−6) = 09:30 → 90 min de retardo; Tijuana (UTC−8) = 07:30 → a tiempo.
  const entryAt = "2026-11-05T15:30:00.000Z";
  const sessions = [{ entryAt, exitAt: "2026-11-06T00:00:00.000Z", workedMinutes: 8 * 60 }];

  const cdmx = computeWorkday("2026-11-05", sessions, schedule, "America/Mexico_City");
  const tijuana = computeWorkday("2026-11-05", sessions, schedule, "America/Tijuana");

  assert.equal(cdmx.lateMin, 90, "CDMX: 09:30 local contra entrada 08:00 (+10 de tolerancia)");
  assert.equal(tijuana.lateMin, 0, "Tijuana: 07:30 local llega antes de la entrada");
});

test("tiempo extra respeta el corte de día del cliente", () => {
  // Salida 2026-11-06T01:30Z: en CDMX es 19:30 del día 5 (2.5 h extra, ≥ mínimo);
  // en Tijuana es 17:30 del día 5 (después de 17:00, 30 min: no alcanza el mínimo).
  const sessions = [{ entryAt: "2026-11-05T15:00:00.000Z", exitAt: "2026-11-06T01:30:00.000Z", workedMinutes: 10 * 60 }];
  const cdmx = computeWorkday("2026-11-05", sessions, schedule, "America/Mexico_City");
  const tijuana = computeWorkday("2026-11-05", sessions, schedule, "America/Tijuana");
  assert.ok(cdmx.extraMin > 0, "CDMX acumula tiempo extra");
  assert.equal(tijuana.extraMin, 0, "Tijuana no alcanza el mínimo de tiempo extra");
});

// ── F2-05 · retardo mal calculado (caso DEMO-911) ─────────────────────────────

const TZ = "America/Mexico_City";
/** Jueves 2026-11-05. */
const LATE_DAY = "2026-11-05";
/** Entrada 14:58:59 en CDMX (turno vespertino de 15:00 → a tiempo). */
const DEMO_ENTRY = "2026-11-05T20:58:59.000Z";
const DEMO_SESSIONS = [{ entryAt: DEMO_ENTRY, exitAt: "2026-11-06T04:00:00.000Z", workedMinutes: 421 }];

const daySchedule = (
  name: string,
  start: string | null,
  end: string | null,
  overrides: Partial<Omit<WorkdaySchedule, "days">> = {}
): WorkdaySchedule => ({
  name,
  entryToleranceMin: 10,
  exitToleranceMin: 10,
  mealBreakMin: 60,
  minOvertimeMin: 60,
  crossesMidnight: false,
  ...overrides,
  days: [{ weekday: 4, startTime: start, endTime: end, splitStartTime: null, splitEndTime: null, restDay: false }],
});

/** Día de descanso (o día sin `ScheduleDay` para ese weekday). */
const restSchedule = (): WorkdaySchedule => ({
  ...daySchedule("Descanso", null, null),
  days: [{ weekday: 4, startTime: null, endTime: null, splitStartTime: null, splitEndTime: null, restDay: true }],
});

const loadedAssignment = (
  id: string,
  workday: WorkdaySchedule,
  validFrom: string,
  validTo: string | null,
  createdAt: string
): LoadedAssignment =>
  ({
    id,
    userId: "u1",
    scheduleId: workday.name,
    validFrom: new Date(`${validFrom}T00:00:00.000Z`),
    validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`) : null,
    createdAt: new Date(createdAt),
    schedule: workday,
  }) as unknown as LoadedAssignment;

test("DEMO-911: con reasignación encimada gana el horario que entró en vigor al final", () => {
  const matutino = daySchedule("Matutino", "09:00", "18:00");
  const vespertino = daySchedule("Vespertino", "15:00", "23:00");
  // Corrección hacia atrás: el Vespertino se capturó después y arranca el día 3,
  // pero la asignación vieja al Matutino (día 1) nunca se cerró → se enciman.
  const assignments = [
    loadedAssignment("a-matutino", matutino, "2026-11-01", null, "2026-10-20T10:00:00.000Z"),
    loadedAssignment("a-vespertino", vespertino, "2026-11-03", null, "2026-11-02T10:00:00.000Z"),
  ];

  const chosen = scheduleOn(assignments, "u1", LATE_DAY);
  assert.equal(chosen?.name, "Vespertino", "gana la asignación más reciente, no la vieja");
  assert.equal(
    computeWorkday(LATE_DAY, DEMO_SESSIONS, chosen, TZ).lateMin,
    0,
    "entró 14:58:59 para el turno de 15:00: no hay retardo"
  );

  // El "Retardo 5:59 h" del ticket venía de comparar contra el Matutino 09:00.
  assert.equal(
    computeWorkday(LATE_DAY, DEMO_SESSIONS, matutino, TZ).lateMin,
    359,
    "5:58:59 contra 09:00 redondeado a 359 min = 5:59 h"
  );
});

test("la vigencia por día manda: una asignación futura no adelanta el horario de hoy", () => {
  const matutino = daySchedule("Matutino", "09:00", "18:00");
  const vespertino = daySchedule("Vespertino", "15:00", "23:00");
  const nocturno = daySchedule("Nocturno", "22:00", "06:00", { crossesMidnight: true });
  // Horario viejo vencido el 2, corrección vigente desde el 3 y un alta futura.
  const assignments = [
    loadedAssignment("a-matutino", matutino, "2026-11-01", "2026-11-02", "2026-10-20T10:00:00.000Z"),
    loadedAssignment("a-vespertino", vespertino, "2026-11-03", null, "2026-11-02T10:00:00.000Z"),
    loadedAssignment("a-futuro", nocturno, "2026-12-01", null, "2026-11-04T10:00:00.000Z"),
  ];

  assert.equal(scheduleOn(assignments, "u1", "2026-11-02")?.name, "Matutino", "último día del horario viejo");
  assert.equal(scheduleOn(assignments, "u1", "2026-11-03")?.name, "Vespertino", "primer día de la corrección");
  assert.equal(scheduleOn(assignments, "u1", LATE_DAY)?.name, "Vespertino", "el alta futura no aplica todavía");
  assert.equal(scheduleOn(assignments, "u1", "2026-11-30")?.name, "Vespertino", "un día antes del alta futura sigue la corrección");
});

test("retardo en minutos contra la entrada programada y su tolerancia", () => {
  // Entrada 09:05 en CDMX.
  const sessions = [{ entryAt: "2026-11-05T15:05:00.000Z", exitAt: "2026-11-05T23:00:00.000Z", workedMinutes: 475 }];
  assert.equal(
    computeWorkday(LATE_DAY, sessions, daySchedule("Oficina", "09:00", "18:00", { entryToleranceMin: 0 }), TZ).lateMin,
    5,
    "5 minutos de retardo, no 5:59 h"
  );
  assert.equal(
    computeWorkday(LATE_DAY, sessions, daySchedule("Oficina", "09:00", "18:00"), TZ).lateMin,
    0,
    "con la tolerancia de 10 min del horario, los 5 minutos no son retardo"
  );
  // Entrar antes de la entrada programada nunca genera retardo negativo.
  const early = [{ entryAt: "2026-11-05T14:55:00.000Z", exitAt: "2026-11-05T23:00:00.000Z", workedMinutes: 485 }];
  assert.equal(
    computeWorkday(LATE_DAY, early, daySchedule("Oficina", "09:00", "18:00", { entryToleranceMin: 0 }), TZ).lateMin,
    0,
    "llegar antes no genera retardo"
  );
});

test("día sin turno (descanso o sin ScheduleDay) no inventa retardo", () => {
  assert.equal(computeWorkday(LATE_DAY, DEMO_SESSIONS, restSchedule(), TZ).lateMin, 0, "día de descanso");
  assert.equal(computeWorkday(LATE_DAY, DEMO_SESSIONS, restSchedule(), TZ).restDay, true);

  // El horario no tiene fila para el viernes 6: se trata como descanso.
  const friday = "2026-11-06";
  const fridaySessions = [{ entryAt: "2026-11-06T20:58:59.000Z", exitAt: "2026-11-07T04:00:00.000Z", workedMinutes: 421 }];
  assert.equal(computeWorkday(friday, fridaySessions, daySchedule("Matutino", "09:00", "18:00"), TZ).lateMin, 0);
});

test("sin horario asignado no hay retardo (no se compara contra nada)", () => {
  const workday = computeWorkday(LATE_DAY, DEMO_SESSIONS, null, TZ);
  assert.equal(workday.withoutSchedule, true);
  assert.equal(workday.scheduleName, null);
  assert.equal(workday.lateMin, 0);
  assert.equal(workday.extraMin, 0);
});

test("turno nocturno: el retardo se mide contra la entrada del turno y cruza medianoche", () => {
  const nocturno = daySchedule("Nocturno", "22:00", "06:00", {
    crossesMidnight: true,
    entryToleranceMin: 5,
    exitToleranceMin: 0,
  });
  // 21:58 CDMX del jueves (03:58Z del viernes) → llega antes.
  const onTime = [{ entryAt: "2026-11-06T03:58:00.000Z", exitAt: "2026-11-06T12:00:00.000Z", workedMinutes: 482 }];
  assert.equal(computeWorkday(LATE_DAY, onTime, nocturno, TZ).lateMin, 0);

  // 22:07 CDMX del jueves (04:07Z del viernes): 7 min, pasados los 5 de tolerancia.
  const late = [{ entryAt: "2026-11-06T04:07:00.000Z", exitAt: "2026-11-06T12:00:00.000Z", workedMinutes: 473 }];
  assert.equal(computeWorkday(LATE_DAY, late, nocturno, TZ).lateMin, 7);
  assert.equal(computeWorkday(LATE_DAY, late, nocturno, TZ).restDay, false);
});

test("la comida del día se descuenta en vez de la del horario", async () => {
  const { mealMinutesOf, validateScheduleLegality } = await import("./workday-rules");
  assert.equal(mealMinutesOf({}, 60), 60, "sin ventana usa los minutos del horario");
  assert.equal(mealMinutesOf({ mealStartTime: "14:00", mealEndTime: "14:30" }, 60), 30, "con ventana usa la ventana");

  const withWindow: WorkdaySchedule = {
    ...schedule,
    days: [{ ...schedule.days[0], mealStartTime: "13:00", mealEndTime: "15:00" }],
  };
  const sessions = [{ entryAt: "2026-11-05T14:00:00.000Z", exitAt: "2026-11-05T23:00:00.000Z", workedMinutes: 9 * 60 }];
  assert.equal(computeWorkday("2026-11-05", sessions, schedule, "America/Mexico_City").scheduledMin, 8 * 60);
  assert.equal(computeWorkday("2026-11-05", sessions, withWindow, "America/Mexico_City").scheduledMin, 7 * 60, "comida de 2 h ese día");

  const day = (weekday: number, meal: Partial<{ mealStartTime: string; mealEndTime: string }> = {}) => ({
    weekday, startTime: "08:00", endTime: "17:00", splitStartTime: null, splitEndTime: null, restDay: weekday === 7, ...meal,
  });
  const legality = validateScheduleLegality({
    mealBreakMin: 0,
    days: [day(1, { mealStartTime: "12:00", mealEndTime: "13:00" }), day(2, { mealStartTime: "14:00", mealEndTime: "15:00" }), day(3), day(7)],
  });
  assert.equal(legality.weeklyMinutes, 8 * 60 + 8 * 60 + 9 * 60, "cada día descuenta su propia comida");
  assert.deepEqual(legality.warnings.filter((w) => !w.endsWith(":3")), [], "los días con su comida no tienen avisos");
  assert.ok(legality.warnings.includes("DESCANSO_NO_DECLARADO:3"), "el día sin comida avisa que no declara descanso");
});
