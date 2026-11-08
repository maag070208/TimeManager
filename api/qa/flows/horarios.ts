import { randomBytes } from "node:crypto";
import type { Cast } from "../cast";
import { Bot, addDays, localDate, type Report, type Res } from "../lib";

/**
 * Horarios, asignaciones, asistencia semanal y pre-nómina de punta a punta.
 * Las checadas las hacen empleados EXTRA que crea este flujo (no el reparto).
 */

type Day = {
  weekday: number;
  startTime?: string | null;
  endTime?: string | null;
  splitStartTime?: string | null;
  splitEndTime?: string | null;
  restDay?: boolean;
};

const WEEK = [1, 2, 3, 4, 5, 6, 7];

const weekdayOf = (dateKey: string): number => {
  const js = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
};

const hhmm = (minutes: number): string => {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const localMinutesNow = (timezone: string): number => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
};

const short = (res: Res) => `${res.status} ${res.text.slice(0, 300)}`;

export default async function horarios(cast: Cast, r: Report): Promise<void> {
  const { admin, hr } = cast;
  const staff = cast.employees[0];
  const tz = cast.file.timezone;
  const { almacen, oficina } = cast.file.departments;
  const slug = cast.file.tenant.slug;
  const today = localDate(new Date(), tz);
  const todayWd = weekdayOf(today);
  const tag = randomBytes(2).toString("hex");

  // ── 1. Catálogo de horarios y legalidad ────────────────────────────────
  const matutinoDays: Day[] = WEEK.map((weekday) =>
    weekday === 7 ? { weekday, restDay: true } : { weekday, startTime: "08:00", endTime: "17:00" }
  );
  const matutino = await hr.post("/schedules", {
    name: `Matutino con comida ${tag}`,
    mealBreakMin: 60,
    entryToleranceMin: 10,
    days: matutinoDays,
  });
  r.expect("RH crea el Matutino (L-S 08-17, 60 min de comida, descanso dominical)", matutino, 201);
  const matutinoId: string = matutino.body?.id;
  r.check(
    "el Matutino guarda 7 días con el domingo de descanso",
    matutino.body?.days?.length === 7 && matutino.body?.days?.find((d: any) => d.weekday === 7)?.restDay === true,
    JSON.stringify(matutino.body?.days)
  );
  r.check("el Matutino guarda la comida de 60 min", matutino.body?.mealBreakMin === 60, `mealBreakMin=${matutino.body?.mealBreakMin}`);

  const corrido = await admin.post("/schedules", {
    name: `Corrido sin comida ${tag}`,
    mealBreakMin: 0,
    days: WEEK.map((weekday) => (weekday <= 5 ? { weekday, startTime: "07:00", endTime: "15:00" } : { weekday, restDay: true })),
  });
  r.expect("el admin crea el Corrido (L-V 07-15 sin comida)", corrido, 201);
  const corridoId: string = corrido.body?.id;
  const warnings = corrido.body?.warnings ?? corrido.body?.legality?.warnings;
  if (!r.check("al crear un corrido de 8 h sin comida se devuelven avisos (DESCANSO_NO_DECLARADO)", Array.isArray(warnings), `body sin warnings: ${Object.keys(corrido.body ?? {}).join(",")}`)) {
    r.finding(
      "BAJA",
      "Crear/editar horario no devuelve los avisos de legalidad",
      `POST /schedules con L-V 07:00-15:00 y mealBreakMin 0 → 201 sin campo warnings; docs/modules/schedules.md (H-02) dice que POST/PATCH "devuelven avisos (no bloquean)". El servicio solo usa legality.valid y descarta legality.warnings (api/src/modules/schedules/services/schedule.service.ts:93-114).`
    );
  }

  const dupName = await hr.post("/schedules", { name: `Matutino con comida ${tag}`, days: matutinoDays, mealBreakMin: 60 });
  r.expect("no se repite el nombre de un horario (409 SCHEDULE_NAME_TAKEN)", dupName, 409, "SCHEDULE_NAME_TAKEN");

  const overWeek = await hr.post("/schedules", {
    name: `Semana de 60 h ${tag}`,
    mealBreakMin: 0,
    days: WEEK.map((weekday) => (weekday <= 6 ? { weekday, startTime: "08:00", endTime: "18:00" } : { weekday, restDay: true })),
  });
  r.expect("semana de 60 h se rechaza (400 SCHEDULE_ILLEGAL)", overWeek, 400, "SCHEDULE_ILLEGAL");
  r.check(
    "el rechazo explica SEMANA_MAYOR_LEGAL",
    JSON.stringify(overWeek.body ?? {}).includes("SEMANA_MAYOR_LEGAL"),
    short(overWeek)
  );

  const noRest = await hr.post("/schedules", {
    name: `Sin descanso ${tag}`,
    mealBreakMin: 0,
    days: WEEK.map((weekday) => ({ weekday, startTime: "09:00", endTime: "14:00" })),
  });
  r.expect("7 días trabajados se rechaza (400 SCHEDULE_ILLEGAL)", noRest, 400, "SCHEDULE_ILLEGAL");
  r.check("el rechazo explica SIN_DIA_DE_DESCANSO", JSON.stringify(noRest.body ?? {}).includes("SIN_DIA_DE_DESCANSO"), short(noRest));

  const longDay = await hr.post("/schedules", {
    name: `Día de 13 h ${tag}`,
    mealBreakMin: 60,
    days: [{ weekday: 1, startTime: "06:00", endTime: "20:00" }, ...[2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, restDay: true }))],
  });
  r.expect("un día de 13 h netas se rechaza (400 SCHEDULE_ILLEGAL)", longDay, 400, "SCHEDULE_ILLEGAL");
  r.check("el rechazo explica DIA_MAYOR_12H", JSON.stringify(longDay.body ?? {}).includes("DIA_MAYOR_12H"), short(longDay));

  const badHour = await hr.post("/schedules", { name: `Hora mala ${tag}`, days: [{ weekday: 1, startTime: "25:00", endTime: "26:00" }] });
  r.expect("hora 25:00 se rechaza (400)", badHour, 400);
  const badWeekday = await hr.post("/schedules", { name: `Día 8 ${tag}`, days: [{ weekday: 8, startTime: "09:00", endTime: "17:00" }] });
  r.expect("weekday 8 se rechaza (400)", badWeekday, 400);
  const noDays = await hr.post("/schedules", { name: `Sin días ${tag}`, days: [] });
  r.expect("horario sin días se rechaza (400)", noDays, 400);
  const dupWeekday = await hr.post("/schedules", {
    name: `Lunes doble ${tag}`,
    mealBreakMin: 0,
    days: [
      { weekday: 1, startTime: "09:00", endTime: "13:00" },
      { weekday: 1, startTime: "14:00", endTime: "18:00" },
      { weekday: 7, restDay: true },
    ],
  });
  if (!r.check("el mismo weekday dos veces se rechaza (400/409, no 500 ni 201)", dupWeekday.status === 400 || dupWeekday.status === 409, short(dupWeekday))) {
    r.finding(
      dupWeekday.status >= 500 ? "MEDIA" : "BAJA",
      "Horario con el mismo día dos veces no se valida en el DTO",
      `POST /schedules con days [{weekday:1,...},{weekday:1,...}] → ${short(dupWeekday)}. ScheduleCreateDto (api/src/modules/schedules/models/dto/schedule.dto.ts:49-60) no exige weekdays únicos; la BD tiene @@unique([scheduleId, weekday]) (prisma/schema.prisma:663) y la violación llega como error de BD en vez de un 400 de validación.`
    );
  }
  const missingEnd = await hr.post("/schedules", {
    name: `Sin salida ${tag}`,
    days: [{ weekday: 1, startTime: "09:00" }, { weekday: 7, restDay: true }],
  });
  if (!r.check("un día laboral con entrada pero sin salida se rechaza (400)", missingEnd.status === 400, short(missingEnd))) {
    r.finding(
      "BAJA",
      "Se acepta un día laboral con entrada y sin salida",
      `POST /schedules days [{weekday:1,startTime:"09:00"}] → ${missingEnd.status}; el día queda sin hora de salida, la validación de legalidad lo ignora (cuenta 0 h) y el cálculo de jornada no tiene salida programada. schedule.dto.ts:40-47 permite endTime opcional sin regla cruzada.`
    );
    if (missingEnd.body?.id) await hr.delete(`/schedules/${missingEnd.body.id}`);
  }

  // Edición
  const renamed = await hr.patch(`/schedules/${corridoId}`, { name: `Corrido 7-15 ${tag}`, entryToleranceMin: 5 });
  r.expect("RH edita nombre y tolerancia del Corrido", renamed, 200);
  r.check("la edición se guarda", renamed.body?.name === `Corrido 7-15 ${tag}` && renamed.body?.entryToleranceMin === 5, short(renamed));
  const illegalEdit = await hr.patch(`/schedules/${corridoId}`, {
    days: WEEK.map((weekday) => ({ weekday, startTime: "07:00", endTime: "15:00" })),
  });
  r.expect("editar el Corrido a 7 días se rechaza (400 SCHEDULE_ILLEGAL)", illegalEdit, 400, "SCHEDULE_ILLEGAL");
  const afterIllegal = await hr.get("/schedules");
  const corridoRow = (afterIllegal.body ?? []).find((s: any) => s.id === corridoId);
  r.check(
    "la edición ilegal no tocó los días del Corrido",
    corridoRow?.days?.filter((d: any) => !d.restDay).length === 5,
    JSON.stringify(corridoRow?.days)
  );
  const missing404 = await hr.patch(`/schedules/00000000-0000-4000-8000-000000000000`, { name: "x" });
  r.expect("editar un horario inexistente → 404", missing404, 404);

  // Transición legal 2027 (46 h): el Matutino de 48 h deja de ser legal
  const transition = await hr.get("/schedules/legal-transition?year=2027");
  r.expect("RH consulta la transición legal 2027", transition, 200);
  const trRow = (transition.body ?? []).find((s: any) => s.id === matutinoId);
  r.check(
    "el Matutino de 48 h aparece como ilegal en 2027 (tope 46 h)",
    trRow?.weeklyMinutes === 48 * 60 && trRow?.legalWeeklyMinutes === 46 * 60,
    JSON.stringify(trRow ?? transition.body)
  );
  r.check("el Corrido de 40 h no aparece en la transición 2027", !(transition.body ?? []).some((s: any) => s.id === corridoId), "");

  // ── 2. Empleados extra (los que checan en este flujo) ──────────────────
  const extra: Record<string, Bot> = {};
  const people = [
    { key: "valeria", name: "Valeria Ortega Luna", dept: almacen },
    { key: "tomas", name: "Tomás Reyes Mora", dept: oficina },
    { key: "ramiro", name: "Ramiro Díaz Sol", dept: null },
    { key: "sofia", name: "Sofía Garza León", dept: almacen },
    { key: "irene", name: "Irene Vidal Paz", dept: oficina },
    { key: "paola", name: "Paola Núñez Ríos", dept: almacen },
  ] as const;
  for (const [i, p] of people.entries()) {
    const username = `${slug}.hx.${p.key}`;
    const password = `Qa-${randomBytes(6).toString("hex")}`;
    const res = await admin.post("/users", {
      username,
      password,
      name: p.name,
      role: "CLIENT_STAFF",
      employeeNumber: String(301 + i),
      jobTitle: "Operativo",
      ...(p.dept ? { departmentId: p.dept } : {}),
    });
    if (!r.expect(`el admin da de alta a ${p.name}${p.dept ? "" : " (sin departamento)"}`, res, 201)) throw new Error(res.text);
    extra[p.key] = await new Bot(p.name.split(" ")[0], username, password, slug, "CLIENT_STAFF").login();
  }
  const { valeria, tomas, ramiro, sofia, irene, paola } = extra;

  // ── 3. Permisos ────────────────────────────────────────────────────────
  r.expect("un CLIENT_STAFF no crea horarios (403)", await staff.post("/schedules", { name: "Hack", days: matutinoDays }), 403);
  r.expect("un CLIENT_STAFF no edita horarios (403)", await staff.patch(`/schedules/${matutinoId}`, { name: "Hack" }), 403);
  r.expect(
    "un CLIENT_STAFF no asigna horarios (403)",
    await staff.post("/schedules/assignments", { scheduleId: matutinoId, userIds: [staff.id], from: today }),
    403
  );
  r.expect("un CLIENT_STAFF no ve la pre-nómina semanal (403)", await staff.post("/schedules/weekly-attendance", { date: today }), 403);
  r.expect("un CLIENT_STAFF no ve el estado de la pre-nómina (403)", await staff.get(`/schedules/payroll/review-state?weekStart=${today}`), 403);
  r.expect("un CLIENT_STAFF no cierra la semana (403)", await staff.post("/schedules/payroll/close", { weekStart: today, departmentIds: [] }), 403);
  r.expect("un CLIENT_STAFF no ve los puestos de nómina (403)", await staff.get("/payroll/positions"), 403);
  r.expect("un CLIENT_STAFF no crea puestos (403)", await staff.post("/payroll/positions", { name: "Hack", dailySalary: 1 }), 403);
  r.expect("RH ve el catálogo de horarios", await hr.get("/schedules"), 200);

  // ── 4. Asignaciones por departamento ───────────────────────────────────
  const probe = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
  r.expect("RH abre la pre-nómina de la semana actual", probe, 200);
  const days: string[] = probe.body?.range?.days ?? [];
  const weekStart = days[0];
  if (!r.check("la semana trae 7 días e incluye hoy", days.length === 7 && days.includes(today), JSON.stringify(probe.body?.range))) return;
  const prevWeek = addDays(weekStart, -7);

  const assignAlmacen = await hr.post("/schedules/assignments", {
    scheduleId: matutinoId,
    userIds: [valeria.id, paola.id],
    from: prevWeek,
  });
  r.expect("RH asigna el Matutino a Almacén (Valeria, Paola) desde la semana pasada", assignAlmacen, 201);
  r.check("se asignaron 2 personas", assignAlmacen.body?.assigned === 2, short(assignAlmacen));
  const assignOficina = await hr.post("/schedules/assignments", {
    scheduleId: corridoId,
    userIds: [tomas.id, irene.id],
    from: prevWeek,
  });
  r.expect("RH asigna el Corrido a Oficina (Tomás, Irene) desde la semana pasada", assignOficina, 201);

  const queryAssignments = async (filters: Record<string, unknown>) =>
    hr.post("/schedules/assignments/query", { page: 1, limit: 100, filters });
  const qAlm = await queryAssignments({ departmentId: almacen });
  r.expect("RH consulta asignaciones de Almacén", qAlm, 200);
  const almRows: any[] = qAlm.body?.data ?? qAlm.body?.rows ?? [];
  r.check(
    "Almacén lista a Valeria y Paola con el Matutino y no a la gente de Oficina",
    almRows.some((a) => a.userId === valeria.id && a.scheduleId === matutinoId) &&
      almRows.some((a) => a.userId === paola.id) &&
      !almRows.some((a) => a.userId === tomas.id || a.userId === irene.id),
    JSON.stringify(almRows.map((a) => [a.employeeName, a.scheduleName]))
  );
  const assignees = await hr.get(`/schedules/${corridoId}/assignees`);
  r.expect("RH consulta quién tiene el Corrido", assignees, 200);
  r.check(
    "el Corrido lo tienen Tomás e Irene",
    (assignees.body ?? []).length === 2 && (assignees.body ?? []).every((a: any) => [tomas.id, irene.id].includes(a.userId)),
    JSON.stringify(assignees.body)
  );
  const list1 = await hr.get("/schedules");
  r.check(
    "el catálogo cuenta 2 asignados en Matutino y 2 en Corrido",
    (list1.body ?? []).find((s: any) => s.id === matutinoId)?.assigned === 2 && (list1.body ?? []).find((s: any) => s.id === corridoId)?.assigned === 2,
    JSON.stringify((list1.body ?? []).map((s: any) => [s.name, s.assigned]))
  );

  // Horarios "de hoy" para medir retardo y puntualidad con la hora del servidor.
  const nowMin = localMinutesNow(tz);
  const canLate = nowMin >= 150;
  const canOnTime = nowMin >= 10 && nowMin <= 23 * 60 - 10;
  const restAfterToday = (todayWd % 7) + 1;
  const yesterday = addDays(today, -1);
  const restYesterday = weekdayOf(yesterday);
  const lateStart = hhmm(nowMin - 120);
  const lateEnd = hhmm(nowMin - 60);
  const onTimeStart = hhmm(nowMin - 5);
  const onTimeEnd = hhmm(Math.min(nowMin - 5 + 120, 23 * 60 + 59));
  const lateDef: Day[] = WEEK.map((weekday) =>
    weekday === restAfterToday
      ? { weekday, restDay: true }
      : weekday === todayWd
        ? { weekday, startTime: lateStart, endTime: lateEnd }
        : { weekday, startTime: "09:00", endTime: "17:00" }
  );
  const onTimeDef: Day[] = WEEK.map((weekday) =>
    weekday === restYesterday
      ? { weekday, restDay: true }
      : weekday === todayWd
        ? { weekday, startTime: onTimeStart, endTime: onTimeEnd }
        : { weekday, startTime: "09:00", endTime: "17:00" }
  );
  const lateSched = await hr.post("/schedules", {
    name: `QA hoy tarde ${tag}`,
    mealBreakMin: 0,
    entryToleranceMin: 10,
    exitToleranceMin: 10,
    minOvertimeMin: 30,
    days: lateDef,
  });
  r.expect("RH crea el horario 'hoy tarde' (entrada hace 2 h)", lateSched, 201);
  const onTimeSched = await hr.post("/schedules", {
    name: `QA hoy a tiempo ${tag}`,
    mealBreakMin: 0,
    entryToleranceMin: 10,
    exitToleranceMin: 10,
    minOvertimeMin: 30,
    days: onTimeDef,
  });
  r.expect("RH crea el horario 'hoy a tiempo' (entrada hace 5 min, descanso ayer)", onTimeSched, 201);
  const lateId: string = lateSched.body?.id;
  const onTimeId: string = onTimeSched.body?.id;

  // Reasignación: una sola asignación activa por persona
  const reValeria = await hr.post("/schedules/assignments", { scheduleId: lateId, userIds: [valeria.id], from: weekStart });
  r.expect("RH reasigna a Valeria al horario 'hoy tarde' desde el inicio de semana", reValeria, 201);
  const reTomas = await hr.post("/schedules/assignments", { scheduleId: onTimeId, userIds: [tomas.id, ramiro.id], from: weekStart });
  r.expect("RH reasigna a Tomás y asigna a Ramiro (sin depto) 'hoy a tiempo'", reTomas, 201);
  const reIrene = await hr.post("/schedules/assignments", { scheduleId: matutinoId, userIds: [irene.id], from: today });
  r.expect("RH pasa a Irene del Corrido al Matutino desde hoy", reIrene, 201);

  const qAll = await queryAssignments({});
  const allRows: any[] = qAll.body?.data ?? [];
  const activeOf = (id: string) => allRows.filter((a) => a.userId === id);
  r.check(
    "cada persona reasignada tiene UNA sola asignación activa",
    [valeria.id, tomas.id, irene.id, ramiro.id].every((id) => activeOf(id).length === 1),
    JSON.stringify(allRows.map((a) => [a.employeeName, a.scheduleName, a.from]))
  );
  r.check("la activa de Valeria es 'hoy tarde'", activeOf(valeria.id)[0]?.scheduleId === lateId, JSON.stringify(activeOf(valeria.id)));
  r.check("la activa de Irene es el Matutino", activeOf(irene.id)[0]?.scheduleId === matutinoId, JSON.stringify(activeOf(irene.id)));
  r.check("Sofía no tiene asignación", activeOf(sofia.id).length === 0, JSON.stringify(activeOf(sofia.id)));
  const qByName = await queryAssignments({ q: "Ramiro" });
  r.check(
    "la búsqueda por nombre encuentra a Ramiro sin departamento",
    (qByName.body?.data ?? []).length === 1 && qByName.body.data[0].departmentId === null,
    short(qByName)
  );
  const badAssign = await hr.post("/schedules/assignments", { scheduleId: matutinoId, userIds: [valeria.id], from: "2026-13-40" });
  if (!r.expect("fecha 'desde' inválida se rechaza (400)", badAssign, 400)) {
    r.finding(
      badAssign.status >= 500 ? "MEDIA" : "BAJA",
      "Asignar horario con fecha imposible truena",
      `POST /schedules/assignments {from:"2026-13-40"} → ${badAssign.status} ${badAssign.body?.code ?? ""} (Prisma: Invalid tx.scheduleAssignment.deleteMany() con fecha inválida; además el 500 devuelve en details el stack/consulta de Prisma con rutas del servidor). AssignmentCreateDto solo valida el formato \\d{4}-\\d{2}-\\d{2} (schedule.dto.ts:82-85) y toUtcDate produce Invalid Date (schedule.service.ts:225-232).`
    );
  }

  // ── 5. Checadas de los extra (hora del servidor) ───────────────────────
  for (const bot of [valeria, tomas, ramiro, sofia, paola]) {
    const acc = await bot.post("/nom/me/record-agreement/accept", {
      methods: ["CLOCK", "REMOTE"],
      roundingPolicy: "Minutos exactos",
      correctionRules: "Ajuste aprobado",
    });
    r.check(`${bot.label} acepta el acuerdo de registro con checada web`, acc.status < 300, short(acc));
  }
  const punch = async (bot: Bot, type: string) => {
    const res = await bot.post("/nom/me/punch", { type, workMode: "PRESENCIAL" });
    r.expect(`${bot.label} checa ${type}`, res, 201);
    return res.body?.punch?.occurredAt as string | undefined;
  };
  const punches: Record<string, string[]> = {};
  punches.valeria = [await punch(valeria, "ENTRY"), await punch(valeria, "EXIT")].filter(Boolean) as string[];
  const tomasEntry = await punch(tomas, "ENTRY");
  const tomasAt = Date.now();
  punches.ramiro = [
    await punch(ramiro, "ENTRY"),
    await punch(ramiro, "LUNCH_START"),
    await punch(ramiro, "LUNCH_END"),
    await punch(ramiro, "EXIT"),
  ].filter(Boolean) as string[];
  punches.sofia = [await punch(sofia, "ENTRY"), await punch(sofia, "EXIT")].filter(Boolean) as string[];
  punches.paola = [await punch(paola, "ENTRY")].filter(Boolean) as string[];
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 125_000 - (Date.now() - tomasAt))));
  punches.tomas = [tomasEntry, await punch(tomas, "EXIT")].filter(Boolean) as string[];

  // ── 6. Asistencia semanal ──────────────────────────────────────────────
  const weekly = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
  r.expect("RH consulta la asistencia semanal", weekly, 200);
  const rows: any[] = weekly.body?.rows ?? [];
  const rowOf = (bot: Bot) => rows.find((x) => x.userId === bot.id);
  const dayOf = (bot: Bot, date: string) => rowOf(bot)?.days?.find((d: any) => d.date === date);
  const pastDays = days.filter((d) => d < today);
  const futureDays = days.filter((d) => d > today);

  const expectedPast = (def: Day[], from: string) => (date: string) => {
    if (date < from) return "NO_INFO";
    const d = def.find((x) => x.weekday === weekdayOf(date));
    return !d || d.restDay ? "REST" : "ABSENCE";
  };
  const checkPast = (bot: Bot, def: Day[], label: string) => {
    const exp = expectedPast(def, weekStart);
    const got = pastDays.map((d) => [d, dayOf(bot, d)?.status, exp(d)]);
    r.check(`${bot.label}: días pasados sin checadas = falta / descanso según ${label}`, got.every(([, g, e]) => g === e), JSON.stringify(got));
    const absences = got.filter(([, , e]) => e === "ABSENCE").length;
    r.check(`${bot.label}: total de faltas = ${absences}`, rowOf(bot)?.totals?.absences === absences, `totals.absences=${rowOf(bot)?.totals?.absences}`);
  };
  const checkFuture = (bot: Bot) =>
    r.check(
      `${bot.label}: los días después de hoy salen FUTURE`,
      futureDays.every((d) => dayOf(bot, d)?.status === "FUTURE"),
      JSON.stringify(futureDays.map((d) => [d, dayOf(bot, d)?.status]))
    );
  const duplicated: string[] = [];
  const checkSessionsMatch = (bot: Bot, key: string, sessions: number) => {
    const d = dayOf(bot, today);
    const sig = (d?.sessions ?? []).map((s: any) => `${s.entryAt}|${s.exitAt}`);
    if (sig.length > new Set(sig).size) duplicated.push(`${bot.label}: ${sig.length} sesiones para ${sessions} reales, workedMin=${d?.workedMin}`);
    const entries = (d?.sessions ?? []).map((s: any) => s.entryAt).filter(Boolean);
    const exits = (d?.sessions ?? []).map((s: any) => s.exitAt).filter(Boolean);
    const sent = punches[key] ?? [];
    r.check(
      `${bot.label}: hoy tiene ${sessions} sesión(es) con las horas exactas que checó`,
      d?.sessions?.length === sessions && d?.entryAt === sent[0] && d?.exitAt === sent[sent.length - 1] &&
        sent.every((t) => entries.includes(t) || exits.includes(t)),
      JSON.stringify({ sent, sessions: d?.sessions, entryAt: d?.entryAt, exitAt: d?.exitAt })
    );
    const worked = (d?.sessions ?? []).reduce((a: number, s: any) => a + s.workedMinutes, 0);
    r.check(`${bot.label}: workedMin del día = suma de sus sesiones`, d?.workedMin === worked, `workedMin=${d?.workedMin} suma=${worked}`);
  };

  // Valeria: retardo de ~2 h, entra y sale después de la salida programada
  if (rowOf(valeria)) {
    checkPast(valeria, lateDef, "'hoy tarde'");
    checkFuture(valeria);
    checkSessionsMatch(valeria, "valeria", 1);
    r.check("Valeria aparece con horario 'hoy tarde'", rowOf(valeria).scheduleName === `QA hoy tarde ${tag}` && rowOf(valeria).withoutSchedule === false, rowOf(valeria).scheduleName);
    const d = dayOf(valeria, today);
    if (canLate) {
      const expectedLate = Math.round((Date.parse(punches.valeria[0]) - Date.parse(d.scheduledStartAt)) / 60000);
      r.check(
        `Valeria: retardo ≈ ${expectedLate} min (entrada vs. ${lateStart})`,
        Math.abs(d.lateMin - expectedLate) <= 1 && d.lateMin > 100,
        `lateMin=${d.lateMin} scheduledStartAt=${d.scheduledStartAt}`
      );
      if (!r.check("Valeria: el tiempo extra no excede lo trabajado", d.extraMin <= d.workedMin, `extraMin=${d.extraMin} workedMin=${d.workedMin} status=${d.status}`)) {
        r.finding(
          "ALTA",
          "Tiempo extra inventado: se cuenta desde la salida programada aunque la persona entró después",
          `POST /schedules/weekly-attendance: Valeria tenía turno ${lateStart}-${lateEnd} hoy, checó ENTRY ${punches.valeria[0]} y EXIT ${punches.valeria[1]} (workedMin=${d.workedMin}); el día sale status=${d.status} con extraMin=${d.extraMin} (approval=${d.approval}). computeWorkday mide última salida − salida programada sin acotarlo a lo trabajado después de esa hora (api/src/modules/schedules/services/workday-rules.ts:213-226). Ese número alimenta tiempo extra a aprobar y pre-nómina.`
        );
      }
    } else r.check("retardo no medible a esta hora local (antes de 02:30)", true);
  } else r.check("Valeria aparece en la asistencia semanal", false, JSON.stringify(rows.map((x) => x.name)));

  // Tomás: puntual (5 min, dentro de tolerancia), descanso ayer
  if (rowOf(tomas)) {
    checkPast(tomas, onTimeDef, "'hoy a tiempo'");
    checkFuture(tomas);
    checkSessionsMatch(tomas, "tomas", 1);
    const d = dayOf(tomas, today);
    if (canOnTime) {
      r.check("Tomás: sin retardo (5 min dentro de la tolerancia de 10)", d.lateMin === 0, `lateMin=${d.lateMin}`);
      r.check("Tomás: día trabajado (WORKED) sin tiempo extra", d.status === "WORKED" && d.extraMin === 0, `status=${d.status} extra=${d.extraMin}`);
      r.check(
        "Tomás: faltante = programado − trabajado",
        d.missingMin === Math.max(0, d.scheduledMin - d.workedMin),
        `missing=${d.missingMin} scheduled=${d.scheduledMin} worked=${d.workedMin}`
      );
    }
    if (yesterday >= weekStart) r.check("Tomás: ayer sale REST (su día de descanso)", dayOf(tomas, yesterday)?.status === "REST", dayOf(tomas, yesterday)?.status);
  } else r.check("Tomás aparece en la asistencia semanal", false, "");

  // Ramiro: sin departamento, con comida → 2 sesiones
  if (rowOf(ramiro)) {
    r.check("Ramiro aparece con departmentId null", rowOf(ramiro).departmentId === null && rowOf(ramiro).departmentName === null, JSON.stringify([rowOf(ramiro).departmentId, rowOf(ramiro).departmentName]));
    checkSessionsMatch(ramiro, "ramiro", 2);
    r.check("Ramiro: hoy trabajado", ["WORKED", "OVERTIME"].includes(dayOf(ramiro, today)?.status), dayOf(ramiro, today)?.status);
  } else r.check("Ramiro (sin departamento) aparece en la asistencia semanal", false, "");

  // Sofía: sin horario
  if (rowOf(sofia)) {
    r.check("Sofía sale sin horario (withoutSchedule)", rowOf(sofia).withoutSchedule === true && rowOf(sofia).scheduleName === null, JSON.stringify(rowOf(sofia).scheduleName));
    r.check("Sofía: hoy trabajado sin tiempo extra ni retardo", dayOf(sofia, today)?.status === "WORKED" && dayOf(sofia, today)?.extraMin === 0 && dayOf(sofia, today)?.lateMin === 0, JSON.stringify(dayOf(sofia, today)));
    r.check(
      "Sofía: días pasados sin horario no se cuentan como falta (NO_INFO)",
      pastDays.every((d) => dayOf(sofia, d)?.status === "NO_INFO") && rowOf(sofia).totals.absences === 0,
      JSON.stringify(pastDays.map((d) => dayOf(sofia, d)?.status))
    );
  } else r.check("Sofía aparece en la asistencia semanal", false, "");

  // Paola: solo entrada (en sitio)
  if (rowOf(paola)) {
    const d = dayOf(paola, today);
    if (!r.check("Paola (entrada sin salida hoy) muestra su hora de entrada", d?.entryAt === punches.paola[0], JSON.stringify(d))) {
      r.finding(
        "MEDIA",
        "Entrada web/app sin salida desaparece de la asistencia semanal",
        `Paola checó ENTRY ${punches.paola[0]} (POST /nom/me/punch 201) y no ha salido. En POST /schedules/weekly-attendance su día de hoy sale status=${d?.status}, entryAt=${d?.entryAt}, sessions=${JSON.stringify(d?.sessions)}. El emparejado de checadas remotas solo agrega la sesión al cerrar (EXIT/LUNCH_START); la entrada abierta queda en remoteOpenByUser y se descarta (api/src/modules/schedules/services/weekly-attendance.service.ts:164-180). Consecuencia: una entrada sin salida de un día pasado se reporta como ABSENCE en vez de INCOMPLETE (las sesiones remotas siempre llevan incident null), y la pre-nómina descuenta una falta a quien sí se presentó.`
      );
    }
  }

  // Irene: Corrido en los días pasados, Matutino hoy
  if (rowOf(irene)) {
    const pastShifts = pastDays.filter((d) => d >= weekStart).map((d) => [d, dayOf(irene, d)?.shift]);
    const corridoShift = (d: string) => (weekdayOf(d) <= 5 ? "07:00-15:00" : null);
    r.check(
      "Irene: los días antes de hoy se calculan con el Corrido",
      pastShifts.every(([d, s]) => s === corridoShift(d as string)),
      JSON.stringify(pastShifts)
    );
    r.check("Irene: hoy se calcula con el Matutino", dayOf(irene, today)?.shift === (todayWd === 7 ? null : "08:00-17:00"), dayOf(irene, today)?.shift);
    r.check("Irene no checó: sin vínculo, sus días pasados no son falta (NO_INFO)", pastDays.every((d) => dayOf(irene, d)?.status === "NO_INFO"), JSON.stringify(pastDays.map((d) => dayOf(irene, d)?.status)));
  }

  const tomasDay = dayOf(tomas, today);
  const tomasReal = punches.tomas.length === 2 ? Math.round((Date.parse(punches.tomas[1]) - Date.parse(punches.tomas[0])) / 60000) : -1;
  r.check(`Tomás: horas trabajadas = lo que checó (${tomasReal} min)`, tomasDay?.workedMin === tomasReal, `workedMin=${tomasDay?.workedMin} sesiones=${tomasDay?.sessions?.length}`);
  if (duplicated.length > 0) {
    r.finding(
      "ALTA",
      "Asistencia semanal / pre-nómina cuenta dos veces las checadas web/app",
      `POST /schedules/weekly-attendance devuelve cada sesión de checada remota duplicada y suma ambas: ${duplicated.join("; ")}. Tomás checó ENTRY ${punches.tomas[0]} y EXIT ${punches.tomas[1]} (${tomasReal} min) y el reporte dice workedMin=${tomasDay?.workedMin}. timeClockReport.reportExport ya incluye las sesiones remotas (RJ-02, api/src/modules/time-clock/services/time-clock-report.service.ts:170-221) y WeeklyAttendanceService vuelve a armarlas desde remotePunch y las concatena (api/src/modules/schedules/services/weekly-attendance.service.ts:156-180 y 213-221). Horas trabajadas y totales de pre-nómina salen al doble para quien checa por web/app.`
    );
  }

  // Totales del reporte
  const sumOf = (key: string) => rows.reduce((a, x) => a + (x.totals?.[key] ?? 0), 0);
  r.check(
    "summary.absences / workedMin = suma de las filas",
    weekly.body?.summary?.absences === sumOf("absences") && weekly.body?.summary?.workedMin === sumOf("workedMin"),
    JSON.stringify({ summary: weekly.body?.summary, absences: sumOf("absences"), worked: sumOf("workedMin") })
  );
  r.check(
    "summary.withoutSchedule cuenta a quienes no tienen horario (incluye a Sofía)",
    weekly.body?.summary?.withoutSchedule === rows.filter((x) => x.withoutSchedule).length && rows.some((x) => x.userId === sofia.id && x.withoutSchedule),
    `withoutSchedule=${weekly.body?.summary?.withoutSchedule}`
  );
  const rowTotalsOk = rows.every((x) => x.totals.absences === x.days.filter((d: any) => d.status === "ABSENCE").length);
  r.check("en cada fila totals.absences = días ABSENCE", rowTotalsOk, "");

  const weeklyAlm = await hr.post("/schedules/weekly-attendance", { date: today, departmentId: almacen, refresh: true });
  r.expect("RH filtra la asistencia por Almacén", weeklyAlm, 200);
  r.check(
    "el filtro de Almacén no trae gente de Oficina ni sin departamento",
    (weeklyAlm.body?.rows ?? []).length > 0 && (weeklyAlm.body?.rows ?? []).every((x: any) => x.departmentId === almacen),
    JSON.stringify((weeklyAlm.body?.rows ?? []).map((x: any) => [x.name, x.departmentName]))
  );

  // Corrección hacia atrás: asignar desde antes de la vigencia vigente
  const backdate = addDays(weekStart, -14);
  const corr = await hr.post("/schedules/assignments", { scheduleId: onTimeId, userIds: [irene.id], from: backdate });
  r.expect("RH corrige a Irene: 'hoy a tiempo' desde hace dos semanas", corr, 201);
  const qIrene = await queryAssignments({ q: "Irene" });
  r.check(
    "tras la corrección Irene tiene una sola asignación activa ('hoy a tiempo')",
    (qIrene.body?.data ?? []).length === 1 && qIrene.body.data[0].scheduleId === onTimeId,
    JSON.stringify(qIrene.body?.data)
  );
  const weekly2 = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
  const irene2 = (weekly2.body?.rows ?? []).find((x: any) => x.userId === irene.id);
  const expShift = (d: string) => {
    const def = onTimeDef.find((x) => x.weekday === weekdayOf(d));
    return !def || def.restDay ? null : `${def.startTime}-${def.endTime}`;
  };
  const shifts2 = pastDays.map((d) => [d, irene2?.days?.find((x: any) => x.date === d)?.shift, expShift(d)]);
  if (pastDays.length > 0 && !r.check("tras la corrección, los días pasados de Irene usan 'hoy a tiempo'", shifts2.every(([, g, e]) => g === e), JSON.stringify(shifts2))) {
    r.finding(
      "MEDIA",
      "Reasignar hacia atrás no reemplaza la vigencia cerrada que empezó después",
      `Irene: Corrido desde ${prevWeek}, Matutino desde ${today}, luego POST /schedules/assignments {scheduleId:'hoy a tiempo', from:${backdate}} → 201 y assignments/query muestra solo 'hoy a tiempo'. Pero la asistencia semanal de los días ${pastDays.join(",")} sigue usando el Corrido (${JSON.stringify(shifts2)}). assignBulk borra solo asignaciones ABIERTAS con validFrom > from y recorta las que cubren 'from'; la cerrada [${prevWeek}, ${addDays(today, -1)}] queda viva y scheduleOn la prefiere por tener validFrom más reciente (api/src/modules/schedules/services/schedule.service.ts:228-246, schedule-assignments.ts:44-55). La consulta de asignaciones y el cálculo dicen cosas distintas.`
    );
  }

  // ── 7. Puestos de nómina ───────────────────────────────────────────────
  const almacenista = await hr.post("/payroll/positions", { name: `Almacenista ${tag}`, jobTitle: "Almacenista", dailySalary: 315.04 });
  r.expect("RH da de alta el puesto Almacenista (315.04 diario)", almacenista, 201);
  const administrativo = await admin.post("/payroll/positions", { name: `Administrativo ${tag}`, dailySalary: 400, sbcDaily: 418.6 });
  r.expect("el admin da de alta el puesto Administrativo (400 diario)", administrativo, 201);
  const almId: string = almacenista.body?.id;
  const admId: string = administrativo.body?.id;
  r.check("el salario diario se guarda como número", almacenista.body?.dailySalary === 315.04 && administrativo.body?.sbcDaily === 418.6, short(almacenista));
  r.expect("puesto con salario 0 se rechaza (400)", await hr.post("/payroll/positions", { name: "Cero", dailySalary: 0 }), 400);
  r.expect("puesto con nombre de 1 letra se rechaza (400)", await hr.post("/payroll/positions", { name: "X", dailySalary: 100 }), 400);

  const asg1 = await hr.put(`/payroll/positions/${almId}/assign`, { userIds: [valeria.id, sofia.id] });
  r.expect("RH asigna Almacenista a Valeria y Sofía", asg1, 200);
  r.check("el puesto lista 2 empleados", asg1.body?.employees?.length === 2, short(asg1));
  const asg2 = await hr.put(`/payroll/positions/${admId}/assign`, { userIds: [tomas.id, ramiro.id] });
  r.expect("RH asigna Administrativo a Tomás y Ramiro", asg2, 200);
  const raise = await hr.patch(`/payroll/positions/${almId}`, { dailySalary: 330.5 });
  r.expect("RH sube el salario del Almacenista a 330.50", raise, 200);
  r.check("el nuevo salario se guarda", raise.body?.dailySalary === 330.5, short(raise));

  const weeklyPay = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
  const payRows: any[] = weeklyPay.body?.rows ?? [];
  const payOf = (bot: Bot) => payRows.find((x) => x.userId === bot.id)?.payrollPosition;
  r.check(
    "la pre-nómina muestra el puesto y salario de cada quien",
    payOf(valeria)?.dailySalary === 330.5 && payOf(sofia)?.dailySalary === 330.5 && payOf(tomas)?.dailySalary === 400 && payOf(ramiro)?.sbcDaily === 418.6 && !payOf(paola),
    JSON.stringify([payOf(valeria), payOf(sofia), payOf(tomas), payOf(ramiro), payOf(paola)])
  );
  const expectedDaily = payRows.reduce((a, x) => a + (x.payrollPosition?.dailySalary ?? 0), 0);
  r.check(
    "summary: salario diario total y costo semanal (×7) cuadran",
    Math.abs((weeklyPay.body?.summary?.dailySalaryTotal ?? -1) - expectedDaily) < 0.01 &&
      Math.abs(weeklyPay.body?.summary?.weeklySalaryCost - expectedDaily * 7) < 0.01 &&
      weeklyPay.body?.summary?.withSalary === 4,
    JSON.stringify({ summary: weeklyPay.body?.summary, expectedDaily })
  );

  const off = await hr.patch(`/payroll/positions/${admId}`, { active: false });
  r.expect("RH desactiva el puesto Administrativo", off, 200);
  r.check("al desactivarlo se desasigna a su personal", off.body?.active === false && (off.body?.employees ?? []).length === 0, short(off));
  r.expect("no se asigna gente a un puesto inactivo (400)", await hr.put(`/payroll/positions/${admId}/assign`, { userIds: [tomas.id] }), 400, "PAYROLL_POSITION_INACTIVE");
  r.expect("no se edita un puesto inactivo sin reactivarlo (400)", await hr.patch(`/payroll/positions/${admId}`, { dailySalary: 500 }), 400, "PAYROLL_POSITION_INACTIVE");
  const on = await hr.patch(`/payroll/positions/${admId}`, { active: true });
  r.expect("RH reactiva el puesto Administrativo", on, 200);
  r.check("reactivado y sin personal", on.body?.active === true && (on.body?.employees ?? []).length === 0, short(on));
  const posList = await hr.get("/payroll/positions");
  r.check("la lista trae los 2 puestos del cliente", (posList.body ?? []).filter((p: any) => [almId, admId].includes(p.id)).length === 2, short(posList));

  // ── 8. Revisión por departamento y cierre de semana ────────────────────
  const depts: (string | null)[] = [almacen, oficina, null];
  const st0 = await hr.get(`/schedules/payroll/review-state?weekStart=${weekStart}`);
  r.expect("RH consulta el estado de la semana", st0, 200);
  r.check("la semana arranca abierta y sin revisiones", st0.body?.closed === false && (st0.body?.reviews ?? []).length === 0, short(st0));
  const early = await hr.post("/schedules/payroll/close", { weekStart, departmentIds: depts });
  r.expect("cerrar sin revisar se rechaza (409 DEPARTMENTS_PENDING_REVIEW)", early, 409, "DEPARTMENTS_PENDING_REVIEW");

  r.expect("RH revisa Almacén", await hr.put("/schedules/payroll/reviews", { weekStart, departmentId: almacen, reviewed: true }), 200);
  const revNull = await hr.put("/schedules/payroll/reviews", { weekStart, departmentId: null, reviewed: true });
  r.expect("RH revisa «Sin departamento» (departmentId null)", revNull, 200);
  r.check(
    "la revisión de «Sin departamento» queda con departmentId null y quién la hizo",
    (revNull.body?.reviews ?? []).some((x: any) => x.departmentId === null && x.reviewedBy?.id === hr.id && x.bulk === false),
    JSON.stringify(revNull.body?.reviews)
  );
  const revNull2 = await hr.put("/schedules/payroll/reviews", { weekStart, departmentId: null, reviewed: true });
  r.check("revisar dos veces «Sin departamento» no duplica la fila", (revNull2.body?.reviews ?? []).filter((x: any) => x.departmentId === null).length === 1, JSON.stringify(revNull2.body?.reviews));
  const markAll = await admin.post("/schedules/payroll/reviews/mark-all", { weekStart, departmentIds: depts });
  r.expect("el admin marca todo como revisado", markAll, 200);
  const revs: any[] = markAll.body?.reviews ?? [];
  r.check(
    "quedan 3 revisiones: Almacén y Sin depto individuales, Oficina en bloque",
    revs.length === 3 &&
      revs.find((x) => x.departmentId === oficina)?.bulk === true &&
      revs.find((x) => x.departmentId === almacen)?.bulk === false &&
      revs.find((x) => x.departmentId === null)?.bulk === false,
    JSON.stringify(revs.map((x) => [x.departmentName, x.bulk]))
  );

  const snapshotBefore = weeklyPay.body?.summary;
  const closed = await hr.post("/schedules/payroll/close", { weekStart, departmentIds: depts, snapshot: { workedMin: snapshotBefore?.workedMin, absences: snapshotBefore?.absences } });
  r.expect("RH cierra la semana", closed, 200);
  r.check("la semana queda cerrada con quién la cerró", closed.body?.closed === true && closed.body?.closure?.closedBy?.id === hr.id, short(closed));
  const closures = await hr.get("/schedules/payroll/closures");
  r.expect("RH consulta el historial de cierres", closures, 200);
  const cl = (closures.body ?? []).find((x: any) => x.weekStart === weekStart);
  r.check(
    "el historial guarda la foto con las 3 revisiones (incluye Sin departamento)",
    cl?.closed === true && (cl?.snapshot?.reviews ?? []).length === 3 && (cl?.snapshot?.reviews ?? []).some((x: any) => x.departmentId === null),
    JSON.stringify(cl)
  );

  // Editar algo de la semana cerrada
  const unreview = await hr.put("/schedules/payroll/reviews", { weekStart, departmentId: almacen, reviewed: false });
  const stAfter = await hr.get(`/schedules/payroll/review-state?weekStart=${weekStart}`);
  const stillReviewed = (stAfter.body?.reviews ?? []).some((x: any) => x.departmentId === almacen);
  if (!r.check("con la semana cerrada no se puede quitar la revisión de un departamento", unreview.status >= 400 && stillReviewed, `PUT reviews reviewed:false → ${unreview.status}; Almacén sigue revisado=${stillReviewed}`)) {
    r.finding(
      "MEDIA",
      "Una semana cerrada sigue aceptando cambios de revisión",
      `Con ${weekStart} cerrada (closed=true), PUT /schedules/payroll/reviews {weekStart:${weekStart}, departmentId:Almacén, reviewed:false} → ${unreview.status}; review-state queda closed=${stAfter.body?.closed} con Almacén sin revisar. setReviewed/reviewAll no consultan PayrollWeekClosure (api/src/modules/schedules/services/payroll-review.service.ts:134-190); ningún módulo valida el cierre (grep payrollWeekClosure solo aparece en ese servicio).`
    );
    await hr.put("/schedules/payroll/reviews", { weekStart, departmentId: almacen, reviewed: true });
  }
  const sofiaBefore = payRows.find((x) => x.userId === sofia.id);
  const lateAssign = await hr.post("/schedules/assignments", { scheduleId: matutinoId, userIds: [sofia.id], from: weekStart });
  const weeklyClosed = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
  const sofiaAfter = (weeklyClosed.body?.rows ?? []).find((x: any) => x.userId === sofia.id);
  const changed = sofiaBefore?.withoutSchedule !== sofiaAfter?.withoutSchedule || sofiaBefore?.totals?.absences !== sofiaAfter?.totals?.absences;
  if (!r.check("asignar horario con vigencia dentro de una semana cerrada se bloquea", lateAssign.status >= 400 || !changed, `assign → ${lateAssign.status}; cambió la pre-nómina=${changed}`)) {
    r.finding(
      "MEDIA",
      "Asignar horario hacia atrás cambia las cifras de una semana ya cerrada",
      `Semana ${weekStart} cerrada. POST /schedules/assignments {Matutino, Sofía, from:${weekStart}} → ${lateAssign.status}. La asistencia de esa semana cambia: Sofía withoutSchedule ${sofiaBefore?.withoutSchedule}→${sofiaAfter?.withoutSchedule}, faltas ${sofiaBefore?.totals?.absences}→${sofiaAfter?.totals?.absences}, mientras el cierre guardó otra foto. assignBulk no revisa cierres (api/src/modules/schedules/services/schedule.service.ts:216).`
    );
  }

  r.expect("un CLIENT_STAFF no reabre la semana (403)", await staff.post("/schedules/payroll/reopen", { weekStart }), 403);
  const reopened = await hr.post("/schedules/payroll/reopen", { weekStart });
  r.expect("RH reabre la semana", reopened, 200);
  r.check("reabierta, con quién la reabrió", reopened.body?.closed === false && reopened.body?.closure?.reopenedBy?.id === hr.id, short(reopened));
  r.expect("reabrir de nuevo → 409 PAYROLL_NOT_CLOSED", await hr.post("/schedules/payroll/reopen", { weekStart }), 409, "PAYROLL_NOT_CLOSED");
  const reclose = await hr.post("/schedules/payroll/close", { weekStart, departmentIds: depts });
  r.expect("RH vuelve a cerrar la semana", reclose, 200);
  r.check("cerrada otra vez", reclose.body?.closed === true, short(reclose));

  const forced = await hr.post("/schedules/payroll/close", { weekStart: prevWeek, departmentIds: [] });
  const stPrev = await hr.get(`/schedules/payroll/review-state?weekStart=${prevWeek}`);
  if (!r.check("no se cierra una semana sin ninguna revisión mandando la lista vacía", forced.status >= 400, `close ${prevWeek} departmentIds:[] → ${forced.status}, closed=${stPrev.body?.closed}`)) {
    r.finding(
      "MEDIA",
      "El cierre de semana confía en la lista de departamentos que manda el cliente",
      `POST /schedules/payroll/close {weekStart:${prevWeek}, departmentIds:[]} → ${forced.status} y la semana queda closed=${stPrev.body?.closed} sin una sola revisión, aunque esa semana tuvo personal en Almacén, Oficina y sin departamento. close() solo exige revisión de los ids recibidos (api/src/modules/schedules/services/payroll-review.service.ts:193-201); el servidor no deriva los departamentos de la semana.`
    );
  }
  const offWeek = addDays(weekStart, 2);
  const wrongKey = await hr.put("/schedules/payroll/reviews", { weekStart: offWeek, departmentId: almacen, reviewed: true });
  if (!r.check("una revisión con weekStart que no es inicio de semana se rechaza", wrongKey.status === 400, `PUT reviews weekStart=${offWeek} → ${wrongKey.status}`)) {
    r.finding(
      "BAJA",
      "La pre-nómina acepta como semana cualquier fecha",
      `PUT /schedules/payroll/reviews {weekStart:${offWeek}} (miércoles+2, no inicio de semana; inicio real ${weekStart}) → ${wrongKey.status}. La revisión/cierre quedan colgados de una clave que ninguna pantalla consulta. PayrollWeekStart solo valida formato YYYY-MM-DD (schedule.dto.ts:131).`
    );
  }
  const ghostDept = await hr.put("/schedules/payroll/reviews", { weekStart, departmentId: "00000000-0000-4000-8000-000000000000", reviewed: true });
  if (!r.check("revisar un departamento inexistente da 4xx (no 500 ni 200)", ghostDept.status >= 400 && ghostDept.status < 500, short(ghostDept))) {
    r.finding(
      ghostDept.status >= 500 ? "MEDIA" : "BAJA",
      "Revisión de pre-nómina con departamento inexistente",
      `PUT /schedules/payroll/reviews {departmentId: uuid inexistente} → ${short(ghostDept)}. setReviewed no valida que el departamento exista (payroll-review.service.ts:134-150).`
    );
  }

  // ── 9. Baja de horarios ────────────────────────────────────────────────
  const offSched = await hr.patch(`/schedules/${corridoId}`, { active: false });
  r.expect("RH desactiva el Corrido", offSched, 200);
  const activeList = await hr.get("/schedules");
  const allList = await hr.get("/schedules?includeInactive=true");
  r.check(
    "el Corrido inactivo no sale en la lista normal pero sí con includeInactive",
    !(activeList.body ?? []).some((s: any) => s.id === corridoId) && (allList.body ?? []).some((s: any) => s.id === corridoId && s.active === false),
    ""
  );
  r.expect("no se asigna un horario inactivo (400 INVALID_SCHEDULE)", await hr.post("/schedules/assignments", { scheduleId: corridoId, userIds: [paola.id], from: today }), 400, "INVALID_SCHEDULE");
  const delAssigned = await hr.delete(`/schedules/${matutinoId}`);
  r.expect("borrar el Matutino con gente asignada lo desactiva (soft)", delAssigned, 200);
  r.check("el borrado del Matutino es lógico", delAssigned.body?.soft === true && delAssigned.body?.data?.active === false, short(delAssigned));
  const stillAssigned = await hr.get(`/schedules/${matutinoId}/assignees`);
  r.check("el Matutino desactivado conserva a su gente asignada", (stillAssigned.body ?? []).length >= 1, short(stillAssigned));
  const delHistoric = await hr.delete(`/schedules/${corridoId}`);
  if (!r.check("borrar un horario inactivo con historial de asignaciones no truena", delHistoric.status === 200, short(delHistoric))) {
    r.finding(
      delHistoric.status >= 500 ? "MEDIA" : "BAJA",
      "Borrar un horario inactivo con asignaciones pasadas falla",
      `DELETE /schedules/${corridoId} (Corrido inactivo, sin asignaciones abiertas pero con asignaciones cerradas de Tomás/Irene) → ${short(delHistoric)}. remove() hace delete físico cuando no hay asignaciones abiertas (schedule.service.ts:200-212).`
    );
  } else {
    const histAfter = await hr.post("/schedules/weekly-attendance", { date: prevWeek, refresh: true });
    const tomasPrev = (histAfter.body?.rows ?? []).find((x: any) => x.userId === tomas.id);
    const lostShift = (tomasPrev?.days ?? []).filter((d: any) => weekdayOf(d.date) <= 5).every((d: any) => d.shift === null);
    if (!r.check("tras borrar el Corrido, la semana pasada de Tomás conserva su horario", !lostShift, JSON.stringify((tomasPrev?.days ?? []).map((d: any) => d.shift)))) {
      r.finding(
        "MEDIA",
        "Borrar un horario desactivado borra el historial de asignaciones y cambia semanas pasadas",
        `DELETE /schedules/${corridoId} → ${delHistoric.status} soft=${delHistoric.body?.soft}: delete físico en cascada de ScheduleAssignment. Después, la asistencia de la semana ${prevWeek} de Tomás sale sin horario (shift null, withoutSchedule=${tomasPrev?.withoutSchedule}) aunque en esa semana tenía el Corrido. schedule.service.ts:200-212 solo cuenta asignaciones abiertas antes de borrar.`
      );
    }
  }

  // ── 10. Aislamiento ────────────────────────────────────────────────────
  const intruder = cast.intruderAdmin;
  const iList = await intruder.get("/schedules?includeInactive=true");
  r.expect("el admin intruso lista sus horarios", iList, 200);
  r.check("el intruso no ve horarios de este cliente", !(iList.body ?? []).some((s: any) => [matutinoId, lateId, onTimeId].includes(s.id)), "");
  r.expect("el intruso no edita un horario ajeno (404)", await intruder.patch(`/schedules/${lateId}`, { name: "Robado" }), 404);
  r.expect("el intruso no borra un horario ajeno (404)", await intruder.delete(`/schedules/${lateId}`), 404);
  const iAssignees = await intruder.get(`/schedules/${lateId}/assignees`);
  r.check("el intruso no ve quién tiene un horario ajeno", iAssignees.status === 404 || (iAssignees.status === 200 && (iAssignees.body ?? []).length === 0), short(iAssignees));
  r.expect(
    "el intruso no asigna un horario ajeno (400 INVALID_SCHEDULE)",
    await intruder.post("/schedules/assignments", { scheduleId: lateId, userIds: [intruder.id], from: today }),
    400,
    "INVALID_SCHEDULE"
  );
  const iSched = await intruder.post("/schedules", { name: `Intruso ${tag}`, mealBreakMin: 0, days: onTimeDef });
  r.expect("el intruso crea un horario propio", iSched, 201);
  const iAssignOurs = await intruder.post("/schedules/assignments", { scheduleId: iSched.body?.id, userIds: [valeria.id, tomas.id], from: today });
  r.check("el intruso no asigna su horario a gente de este cliente", iAssignOurs.status === 400 || iAssignOurs.body?.assigned === 0, short(iAssignOurs));
  const iRemove = await intruder.post("/schedules/assignments/remove", { scheduleId: lateId, userIds: [valeria.id] });
  r.check("el intruso no quita asignaciones ajenas", iRemove.status >= 400 || iRemove.body?.removed === 0, short(iRemove));
  const iQuery = await intruder.post("/schedules/assignments/query", { page: 1, limit: 100, filters: {} });
  r.check("las asignaciones del intruso no traen gente de este cliente", !JSON.stringify(iQuery.body ?? {}).includes(valeria.id), "");
  const iWeekly = await intruder.post("/schedules/weekly-attendance", { date: today, refresh: true });
  r.check("la pre-nómina del intruso no trae gente de este cliente", iWeekly.status === 200 && !JSON.stringify(iWeekly.body ?? {}).includes(valeria.id), `status ${iWeekly.status}`);
  const iState = await intruder.get(`/schedules/payroll/review-state?weekStart=${weekStart}`);
  r.check("el intruso ve su semana abierta, no el cierre de este cliente", iState.status === 200 && iState.body?.closed === false && (iState.body?.reviews ?? []).length === 0, short(iState));
  const iReopen = await intruder.post("/schedules/payroll/reopen", { weekStart });
  r.expect("el intruso no reabre la semana de este cliente (409, la suya no está cerrada)", iReopen, 409);
  const iReview = await intruder.put("/schedules/payroll/reviews", { weekStart: prevWeek, departmentId: almacen, reviewed: true });
  if (!r.check("el intruso no registra revisiones con un departamento ajeno", iReview.status >= 400 && iReview.status < 500, short(iReview))) {
    r.finding(
      iReview.status === 200 ? "ALTA" : "MEDIA",
      "Revisión de pre-nómina acepta un departamento de otro cliente",
      `El admin intruso: PUT /schedules/payroll/reviews {weekStart:${prevWeek}, departmentId:<Almacén del cliente ${slug}>} → ${short(iReview)}. setReviewed escribe departmentId sin validar que el departamento sea del cliente; la FK cruza clientes y la respuesta devuelve el nombre del departamento ajeno (payroll-review.service.ts:134-150).`
    );
  }
  const iPos = await intruder.get("/payroll/positions");
  r.check("el intruso no ve los puestos de este cliente", iPos.status === 200 && !(iPos.body ?? []).some((p: any) => [almId, admId].includes(p.id)), short(iPos));
  r.expect("el intruso no edita un puesto ajeno (404)", await intruder.patch(`/payroll/positions/${almId}`, { dailySalary: 1 }), 404);
  r.expect("el intruso no asigna un puesto ajeno (404)", await intruder.put(`/payroll/positions/${almId}/assign`, { userIds: [] }), 404);
  const iOwnPos = await intruder.post("/payroll/positions", { name: `Puesto intruso ${tag}`, dailySalary: 999 });
  r.expect("el intruso crea un puesto propio", iOwnPos, 201);
  const iSteal = await intruder.put(`/payroll/positions/${iOwnPos.body?.id}/assign`, { userIds: [valeria.id] });
  r.check("asignar gente ajena a su puesto no la incluye", iSteal.status >= 400 || (iSteal.body?.employees ?? []).length === 0, short(iSteal));
  const ourPos = await hr.get("/payroll/positions");
  const almAfter = (ourPos.body ?? []).find((p: any) => p.id === almId);
  r.check(
    "Valeria sigue en el puesto Almacenista con su salario de este cliente",
    (almAfter?.employees ?? []).some((e: any) => e.id === valeria.id) && almAfter?.dailySalary === 330.5,
    JSON.stringify(almAfter)
  );

  // Limpieza: los demás flujos corren sobre el mismo cliente y asignan horarios
  // hacia atrás; con la semana cerrada eso se rechaza (409 PAYROLL_WEEK_CLOSED).
  for (const week of [weekStart, addDays(weekStart, -7)]) {
    const state = await hr.get(`/schedules/payroll/review-state?weekStart=${week}`);
    if (state.body?.closed) await hr.post("/schedules/payroll/reopen", { weekStart: week });
  }
}
