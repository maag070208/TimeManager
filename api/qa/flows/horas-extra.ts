import { randomBytes } from "node:crypto";
import type { Cast } from "../cast";
import { addDays, Bot, localDate, type Report, type Res } from "../lib";

/**
 * Horas extra de punta a punta: configuración NOM del cliente, solicitud y
 * consentimiento de extra, aprobación por día, ledger semanal (doble/triple/
 * excedente), constancia semanal del registro y alertas de jornada.
 *
 * Las checadas usan la hora del servidor, así que el tiempo extra se fabrica
 * como lo haría RH: cada empleado extra marca su ciclo de hoy y RH corrige los
 * marcajes (ajuste documentado, aprobado por otra persona) hacia días pasados
 * de la semana. El flujo deja la configuración NOM como la encontró.
 */

const OFFSET = "-06:00";
const at = (day: string, hhmm: string) => `${day}T${hhmm}:00${OFFSET}`;
const isoWeekday = (day: string) => {
  const js = new Date(`${day}T12:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
};
const jsWeekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const secret = () => `Qa-${randomBytes(6).toString("hex")}`;
const codeOf = (res: Res) => res.body?.code ?? res.body?.error?.code;
const rows = (res: Res): any[] => (Array.isArray(res.body) ? res.body : Array.isArray(res.body?.data) ? res.body.data : []);
const short = (res: Res) => `${res.status} ${codeOf(res) ?? ""} ${res.text.slice(0, 300)}`;

interface Extra {
  bot: Bot;
  id: string;
  name: string;
}

export default async function horasExtra(cast: Cast, r: Report): Promise<void> {
  const { admin, hr, intruderAdmin, intruderEmployee } = cast;
  const tz = cast.file.timezone;
  const slug = cast.file.tenant.slug;
  const today = localDate(new Date(), tz);
  const day = (n: number) => addDays(today, -n);
  const weekStart = day(6);
  const weekFilters = { period: "WEEK", date: today };

  const original = await admin.get("/nom/config");
  r.expect("el admin lee la configuración NOM", original, 200);
  const before = original.body ?? {};
  try {
    await configuracion(cast, r, today);
    const extras = await reparto(cast, r, today);
    if (!extras) return;
    await solicitudes(cast, r, extras, today);
    const fabricated = await fabricarJornadas(cast, r, extras, today);
    await aprobaciones(cast, r, extras, today, weekFilters, fabricated);
    const ledgers = await ledgerSemanal(cast, r, extras, today, fabricated);
    await constancias(cast, r, extras, weekStart, today, ledgers);
    await alertas(cast, r, extras, today);
    await aislamiento(cast, r, extras, today, ledgers);
  } finally {
    const restore = await admin.put("/nom/config", {
      weekStartDay: before.weekStartDay ?? 3,
      workdayLimitMinutes: before.source?.workdayLimit === "tenant" ? before.workdayLimitMinutes : null,
      weeklyLimitMinutes: before.source?.weeklyLimit === "tenant" ? before.weeklyLimitMinutes : null,
      blockRemoteWithoutAgreement: before.blockRemoteWithoutAgreement ?? true,
    });
    r.expect("se restaura la configuración NOM del cliente", restore, 200);
  }

  void slug;
  void intruderAdmin;
  void intruderEmployee;
  void hr;
}

// ── Configuración NOM ─────────────────────────────────────────────────────

async function configuracion(cast: Cast, r: Report, today: string): Promise<void> {
  const { admin, hr, employees, intruderAdmin } = cast;
  const cfg = (await admin.get("/nom/config")).body;
  const legalWeekly = cfg?.legal?.weeklyLimitMinutes;
  r.check(
    "la ley vigente (2026) fija 48 h semanales, 12 h diarias, 9 h al doble y 4 h al triple",
    legalWeekly === 2880 &&
      cfg?.legal?.workdayLimitMinutes === 720 &&
      cfg?.legal?.weeklyOvertimeLimitMinutes === 540 &&
      cfg?.legal?.weeklyTripleLimitMinutes === 240 &&
      cfg?.legal?.dailyOvertimeLimitMinutes === 240 &&
      cfg?.legal?.maxOvertimeDaysPerWeek === 4,
    JSON.stringify(cfg?.legal)
  );
  r.check("sin configurar, los límites salen del default legal", cfg?.source?.weeklyLimit === "legal_default", JSON.stringify(cfg?.source));

  r.expect("RH lee la configuración NOM", await hr.get("/nom/config"), 200);
  r.expect("un empleado no lee la configuración NOM", await employees[0].get("/nom/config"), 403);
  r.expect("un empleado no cambia la configuración NOM", await employees[0].put("/nom/config", { weeklyLimitMinutes: 2400 }), 403);

  r.expect(
    "no deja poner la semana por encima de las 48 h de ley",
    await admin.put("/nom/config", { weeklyLimitMinutes: (legalWeekly ?? 2880) + 1 }),
    400,
    "INVALID_WEEKLY_LIMIT"
  );
  r.expect("no deja poner la jornada diaria por encima de 12 h", await admin.put("/nom/config", { workdayLimitMinutes: 721 }), 400, "INVALID_WORKDAY_LIMIT");
  r.expect("rechaza una semana absurda (10081 min)", await admin.put("/nom/config", { weeklyLimitMinutes: 10081 }), 400);
  r.expect("rechaza una jornada diaria menor a 1 h", await admin.put("/nom/config", { workdayLimitMinutes: 59 }), 400);
  r.expect("rechaza campos desconocidos", await admin.put("/nom/config", { weeklyOvertimeLimitMinutes: 900 }), 400);

  const startBefore = cfg?.weekStartDay;
  const probeStart = (startBefore + 2) % 7;
  const mixed = await admin.put("/nom/config", { weekStartDay: probeStart, weeklyLimitMinutes: 9000 });
  r.expect("un cambio con un límite ilegal se rechaza completo", mixed, 400, "INVALID_WEEKLY_LIMIT");
  const afterMixed = (await admin.get("/nom/config")).body;
  if (
    !r.check(
      "el rechazo no deja cambios a medias (inicio de semana intacto)",
      afterMixed?.weekStartDay === startBefore,
      `weekStartDay ${startBefore} → ${afterMixed?.weekStartDay}`
    )
  ) {
    r.finding(
      "MEDIA",
      "PUT /nom/config guarda el inicio de semana aunque la petición se rechace",
      `PUT /nom/config {weekStartDay:${probeStart}, weeklyLimitMinutes:9000} responde 400 INVALID_WEEKLY_LIMIT, pero GET /nom/config ya muestra weekStartDay=${afterMixed?.weekStartDay} (antes ${startBefore}). ` +
        "NomSettingsService.update escribe tenant.weekStartDay antes de validar los límites (api/src/modules/nom/services/nom-settings.service.ts, NomSettingsService.update: el tenant.update va antes de las validaciones de límites). Cambia las semanas de nómina sin auditoría."
    );
  }

  const weekStartDay = (jsWeekday(today) + 1) % 7;
  const update = await admin.put("/nom/config", {
    weekStartDay,
    workdayLimitMinutes: 660,
    weeklyLimitMinutes: 2700,
    blockRemoteWithoutAgreement: false,
  });
  r.expect("el admin fija topes más estrictos que la ley (11 h / 45 h)", update, 200);
  r.check(
    "la configuración queda con los valores del cliente",
    update.body?.workdayLimitMinutes === 660 &&
      update.body?.weeklyLimitMinutes === 2700 &&
      update.body?.weekStartDay === weekStartDay &&
      update.body?.source?.weeklyLimit === "tenant" &&
      update.body?.source?.workdayLimit === "tenant",
    JSON.stringify({ w: update.body?.workdayLimitMinutes, s: update.body?.weeklyLimitMinutes, d: update.body?.weekStartDay, src: update.body?.source })
  );
  if (!r.check("el primer guardado respeta blockRemoteWithoutAgreement=false", update.body?.blockRemoteWithoutAgreement === false, `llegó ${update.body?.blockRemoteWithoutAgreement}`)) {
    r.finding(
      "MEDIA",
      "El primer guardado de la configuración NOM ignora los interruptores de checada remota",
      "PUT /nom/config {…, blockRemoteWithoutAgreement:false} en un cliente sin nom_settings responde 200 pero devuelve blockRemoteWithoutAgreement=true. " +
        "El `create` del upsert solo copia límites, tolerancias y remotePunchEnabled; omite remoteCountsForWorkday, blockRemoteWithoutAgreement y requireUnionForCollective (NomSettingsService.update, api/src/modules/nom/services/nom-settings.service.ts). La auditoría sí registra el valor pedido."
    );
  }

  const audit = await admin.get("/audit?action=NOM_SETTINGS_UPDATED&limit=20");
  r.expect("el admin consulta la auditoría de la configuración", audit, 200);
  const entry = rows(audit).find((row) => row?.newState?.weeklyLimitMinutes === 2700);
  r.check(
    "el cambio queda auditado con valor anterior y nuevo y quién lo hizo",
    Boolean(entry) && entry.previousState?.weeklyLimitMinutes === legalWeekly && entry.userId === admin.id,
    JSON.stringify(entry ?? rows(audit).slice(0, 2)).slice(0, 400)
  );

  const hrUpdate = await hr.put("/nom/config", { workdayLimitMinutes: 660 });
  r.expect("RH (time_clock.write) también puede guardar la configuración NOM", hrUpdate, 200);

  const theirs = await intruderAdmin.get("/nom/config");
  r.check(
    "el otro cliente no ve los topes de este cliente",
    theirs.status === 200 && theirs.body?.weeklyLimitMinutes !== 2700,
    short(theirs)
  );
  const spoof = await intruderAdmin.get("/nom/config", { tenantId: cast.file.tenant.id });
  r.check(
    "el admin del otro cliente no lee esta configuración con X-Tenant-Id",
    spoof.status >= 400 || spoof.body?.weeklyLimitMinutes !== 2700,
    short(spoof)
  );
}

// ── Empleados extra ───────────────────────────────────────────────────────

async function reparto(cast: Cast, r: Report, today: string): Promise<Record<string, Extra> | null> {
  const { admin } = cast;
  const people = [
    { key: "ana", name: "Ana Prieto Luna" },
    { key: "bruno", name: "Bruno Cárdenas Rey" },
    { key: "carla", name: "Carla Ortega Paz" },
    { key: "elena", name: "Elena Vidal Sanz" },
    { key: "diego", name: "Diego Rosas Mena" },
  ];
  const extras: Record<string, Extra> = {};
  for (const [i, p] of people.entries()) {
    const username = `${cast.file.tenant.slug}.he.${p.key}`;
    const password = secret();
    const res = await admin.post("/users", {
      username,
      password,
      name: p.name,
      role: "CLIENT_STAFF",
      employeeNumber: String(401 + i),
      jobTitle: "Operador de turno",
      departmentId: cast.file.departments.almacen,
    });
    if (!r.expect(`el admin da de alta a ${p.name}`, res, 201)) return null;
    const bot = await new Bot(p.name.split(" ")[0], username, password, cast.file.tenant.slug, "CLIENT_STAFF").login();
    extras[p.key] = { bot, id: res.body.id ?? res.body.user?.id, name: p.name };
  }

  const rest = isoWeekday(addDays(today, -1));
  const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === rest ? { weekday, restDay: true } : { weekday, startTime: "07:00", endTime: "15:00" }
  );
  const schedule = await admin.post("/schedules", {
    name: `Turno extra QA ${cast.file.stamp}`,
    entryToleranceMin: 10,
    exitToleranceMin: 0,
    mealBreakMin: 0,
    minOvertimeMin: 30,
    days,
  });
  if (!r.expect("el admin crea un turno de 6×8 h (48 h)", schedule, 201)) return null;
  const assign = await admin.post("/schedules/assignments", {
    scheduleId: schedule.body.id,
    userIds: [extras.ana.id, extras.bruno.id, extras.carla.id, extras.diego.id],
    from: addDays(today, -7),
  });
  r.expect("el admin asigna el turno a Ana, Bruno, Carla y Diego", assign, 201);

  const long = await admin.post("/schedules", {
    name: `Turno 10 h convenio QA ${cast.file.stamp}`,
    entryToleranceMin: 10,
    exitToleranceMin: 0,
    mealBreakMin: 0,
    minOvertimeMin: 30,
    days: [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
      weekday === isoWeekday(addDays(today, -2)) ? { weekday, startTime: "07:00", endTime: "17:00" } : { weekday, restDay: true }
    ),
  });
  r.expect("el admin crea un turno de 10 h para quien tiene convenio de distribución", long, 201);
  if (long.status === 201) {
    r.expect(
      "el admin asigna el turno de 10 h a Elena",
      await admin.post("/schedules/assignments", { scheduleId: long.body.id, userIds: [extras.elena.id], from: addDays(today, -7) }),
      201
    );
  }

  for (const key of ["ana", "bruno", "carla", "elena", "diego"]) {
    const res = await extras[key].bot.post("/nom/me/record-agreement/accept", {
      methods: ["REMOTE", "CLOCK"],
      roundingPolicy: "Minutos exactos",
      correctionRules: "Toda corrección pasa por ajuste documentado",
    });
    r.expect(`${extras[key].bot.label} acepta el método de registro (incluye remoto)`, res, 200);
  }
  return extras;
}

// ── Solicitudes de tiempo extra (autorización previa + consentimiento) ────

async function solicitudes(cast: Cast, r: Report, x: Record<string, Extra>, today: string): Promise<void> {
  const { admin, hr, employees, intruderAdmin, intruderEmployee } = cast;
  const tomorrow = addDays(today, 1);
  const base = { reason: "Cobertura de inventario de fin de mes", plannedMin: 120, days: [tomorrow] };

  r.expect("un empleado no puede pedir tiempo extra", await employees[0].post("/nom/overtime/requests", { ...base, userId: x.ana.id }), 403);
  const hrCreate = await hr.post("/nom/overtime/requests", { ...base, userId: x.ana.id });
  r.expect("RH sin overtime.approve no puede pedir tiempo extra (matriz de permisos)", hrCreate, 403);

  r.expect("sin minutos no hay solicitud", await admin.post("/nom/overtime/requests", { ...base, userId: x.ana.id, plannedMin: 0 }), 400, "INVALID_OVERTIME_REQUEST");
  r.expect("más de 4 h en un día se rechaza (art. 66)", await admin.post("/nom/overtime/requests", { ...base, userId: x.ana.id, plannedMin: 241 }), 400, "INVALID_OVERTIME_REQUEST");
  r.expect(
    "más de 4 h por día en varios días se rechaza",
    await admin.post("/nom/overtime/requests", { ...base, userId: x.ana.id, plannedMin: 481, days: [tomorrow, addDays(today, 2)] }),
    400,
    "INVALID_OVERTIME_REQUEST"
  );
  r.expect("sin motivo no hay solicitud", await admin.post("/nom/overtime/requests", { ...base, userId: x.ana.id, reason: "ok" }), 400, "INVALID_OVERTIME_REQUEST");
  r.expect(
    "no se puede pedir extra a un empleado de otro cliente",
    await admin.post("/nom/overtime/requests", { ...base, userId: cast.file.intruder.employee.id }),
    404,
    "USER_NOT_FOUND"
  );

  const minor = await admin.patch(`/hr/${x.diego.id}/profile`, { birthDate: `${Number(today.slice(0, 4)) - 16}-03-10` });
  if (r.expect("el admin registra la fecha de nacimiento de Diego (16 años)", minor, 200)) {
    r.expect(
      "a un menor de 18 no se le puede pedir tiempo extra",
      await admin.post("/nom/overtime/requests", { ...base, userId: x.diego.id }),
      400,
      "MINOR_OVERTIME_FORBIDDEN"
    );
  }

  const past = await admin.post("/nom/overtime/requests", { ...base, userId: x.carla.id, days: [addDays(today, -3)] });
  if (past.status === 201) {
    r.finding(
      "BAJA",
      "La «autorización previa» de tiempo extra acepta días ya pasados",
      `POST /nom/overtime/requests {days:["${addDays(today, -3)}"]} → 201. El servicio solo valida el formato del día (api/src/modules/nom/services/overtime-request.service.ts:43); una solicitud con fecha pasada no es autorización previa (arts. 66/68). Confirmar con producto si es regularización intencional.`
    );
    await admin.post(`/nom/overtime/requests/${past.body.id}/cancel`);
  }

  const forAna = await admin.post("/nom/overtime/requests", { ...base, userId: x.ana.id });
  r.expect("el admin pide 2 h de extra a Ana para mañana", forAna, 201);
  r.check("la solicitud nace pendiente", forAna.body?.status === "PENDING", forAna.body?.status);
  const forBruno = await admin.post("/nom/overtime/requests", { ...base, userId: x.bruno.id, plannedMin: 180 });
  r.expect("el admin pide 3 h de extra a Bruno", forBruno, 201);
  const forCarla = await admin.post("/nom/overtime/requests", { ...base, userId: x.carla.id, plannedMin: 60 });
  r.expect("el admin pide 1 h de extra a Carla", forCarla, 201);

  const anaMine = await x.ana.bot.get("/nom/me/overtime-requests");
  r.expect("Ana ve sus solicitudes en su portal", anaMine, 200);
  const anaIds = rows(anaMine).map((row) => row.id);
  r.check("Ana ve la suya y no la de Bruno", anaIds.includes(forAna.body?.id) && !anaIds.includes(forBruno.body?.id), JSON.stringify(anaIds));

  r.expect("Bruno no puede decidir la solicitud de Ana", await x.bruno.bot.post(`/nom/me/overtime-requests/${forAna.body?.id}/decision`, { accept: true }), 404, "OVERTIME_REQUEST_NOT_FOUND");
  r.expect("el admin no puede aceptar por Ana", await admin.post(`/nom/me/overtime-requests/${forAna.body?.id}/decision`, { accept: true }), 404, "OVERTIME_REQUEST_NOT_FOUND");
  r.expect("RH no puede aceptar por Ana", await hr.post(`/nom/me/overtime-requests/${forAna.body?.id}/decision`, { accept: true }), 404, "OVERTIME_REQUEST_NOT_FOUND");
  r.expect(
    "un empleado de otro cliente no decide la solicitud de Ana",
    await intruderEmployee.post(`/nom/me/overtime-requests/${forAna.body?.id}/decision`, { accept: true }),
    404
  );

  const accepted = await x.ana.bot.post(`/nom/me/overtime-requests/${forAna.body?.id}/decision`, { accept: true, note: "De acuerdo" });
  r.expect("Ana acepta su tiempo extra", accepted, 200);
  r.check("queda ACCEPTED con fecha de decisión", accepted.body?.status === "ACCEPTED" && Boolean(accepted.body?.workerDecidedAt), JSON.stringify(accepted.body).slice(0, 200));
  r.expect("Ana no puede cambiar de opinión después", await x.ana.bot.post(`/nom/me/overtime-requests/${forAna.body?.id}/decision`, { accept: false, note: "ya no" }), 409, "OVERTIME_REQUEST_ALREADY_DECIDED");

  const rejected = await x.bruno.bot.post(`/nom/me/overtime-requests/${forBruno.body?.id}/decision`, { accept: false, note: "Tengo clase ese día" });
  r.expect("Bruno rechaza su tiempo extra con nota", rejected, 200);
  r.check("queda REJECTED con la nota del trabajador", rejected.body?.status === "REJECTED" && rejected.body?.workerNote === "Tengo clase ese día", JSON.stringify(rejected.body).slice(0, 200));

  r.expect("el otro cliente no cancela solicitudes ajenas", await intruderAdmin.post(`/nom/overtime/requests/${forCarla.body?.id}/cancel`), 404);
  r.expect("RH sin overtime.approve no cancela solicitudes", await hr.post(`/nom/overtime/requests/${forCarla.body?.id}/cancel`), 403);
  const cancelled = await admin.post(`/nom/overtime/requests/${forCarla.body?.id}/cancel`);
  r.expect("el admin cancela la solicitud de Carla", cancelled, 200);
  r.expect("Carla ya no puede decidir una solicitud cancelada", await x.carla.bot.post(`/nom/me/overtime-requests/${forCarla.body?.id}/decision`, { accept: true }), 409);
  r.expect("no se cancela dos veces", await admin.post(`/nom/overtime/requests/${forCarla.body?.id}/cancel`), 409);

  const list = await hr.get("/nom/overtime/requests");
  r.expect("RH lista las solicitudes del cliente", list, 200);
  const byId = new Map(rows(list).map((row) => [row.id, row]));
  r.check(
    "RH ve el estado de cada solicitud",
    byId.get(forAna.body?.id)?.status === "ACCEPTED" && byId.get(forBruno.body?.id)?.status === "REJECTED" && byId.get(forCarla.body?.id)?.status === "CANCELLED",
    JSON.stringify([...byId.values()].map((row) => [row.user?.name, row.status]))
  );
  const onlyAccepted = await admin.get("/nom/overtime/requests?status=ACCEPTED");
  r.check("el filtro por estado solo trae aceptadas", rows(onlyAccepted).length > 0 && rows(onlyAccepted).every((row) => row.status === "ACCEPTED"), JSON.stringify(rows(onlyAccepted).map((row) => row.status)));
  r.expect("un empleado no lista las solicitudes del cliente", await employees[0].get("/nom/overtime/requests"), 403);
  const theirs = await intruderAdmin.get("/nom/overtime/requests");
  r.check("el otro cliente no ve estas solicitudes", theirs.status === 200 && !rows(theirs).some((row) => byId.has(row.id)), short(theirs));

  const audit = await admin.get(`/audit?entityId=${forBruno.body?.id}&limit=20`);
  const actions = rows(audit).map((row) => row.action);
  r.check("la solicitud y el rechazo quedan auditados", actions.includes("OVERTIME_REQUESTED") && actions.includes("OVERTIME_REJECTED"), JSON.stringify(actions));
}

// ── Jornadas con tiempo extra (marcaje remoto + ajustes aprobados) ─────────

interface Fabricated {
  ok: boolean;
  expectedExtra: Record<string, Record<string, number>>;
}

async function fabricarJornadas(cast: Cast, r: Report, x: Record<string, Extra>, today: string): Promise<Fabricated> {
  const { admin, hr } = cast;
  const d = (n: number) => addDays(today, -n);
  const plan: Record<string, Array<{ type: string; at: string }>> = {
    ana: [
      { type: "ENTRY", at: at(d(6), "07:00") },
      { type: "LUNCH_START", at: at(d(6), "18:00") },
      { type: "LUNCH_END", at: at(d(5), "07:00") },
      { type: "EXIT", at: at(d(5), "18:00") },
    ],
    bruno: [
      { type: "ENTRY", at: at(d(4), "05:00") },
      { type: "LUNCH_START", at: at(d(4), "23:00") },
      { type: "LUNCH_END", at: at(d(3), "07:00") },
      { type: "EXIT", at: at(d(3), "13:00") },
    ],
    carla: [
      { type: "ENTRY", at: at(d(1), "09:00") },
      { type: "EXIT", at: at(d(1), "14:00") },
    ],
    elena: [
      { type: "ENTRY", at: at(d(2), "07:00") },
      { type: "EXIT", at: at(d(2), "17:00") },
    ],
  };

  const dummy = await admin.post("/nom/distribution-agreements", {
    userId: x.elena.id,
    effectiveFrom: "2030-01-01",
    evidenceText: "Convenio de prueba para validar quién lo puede aceptar.",
  });
  if (r.expect("el admin registra un convenio de distribución (art. 58) para Elena", dummy, 201)) {
    const stolen = await x.ana.bot.post(`/nom/me/distribution-agreements/${dummy.body.id}/accept`);
    if (!r.check("Ana no puede aceptar el convenio de distribución de Elena", stolen.status === 403 || stolen.status === 404, short(stolen))) {
      r.finding(
        "ALTA",
        "Cualquier trabajador puede firmar el convenio de distribución de otro",
        `POST /nom/me/distribution-agreements/${dummy.body.id}/accept con la sesión de Ana sobre el convenio de Elena → ${stolen.status}, acceptedById=${stolen.body?.acceptedById}. ` +
          "DistributionAgreementService.accept no compara agreement.userId con el actor (DistributionAgreementService.accept, api/src/modules/nom/services/distribution-agreement.service.ts). El convenio queda «aceptado» y habilita jornadas >8 h sin extra para Elena."
      );
    }
  }
  const agreement = await admin.post("/nom/distribution-agreements", {
    userId: x.elena.id,
    effectiveFrom: addDays(today, -7),
    evidenceText: "Elena pacta 4 días de 10 h en lugar de 5 de 8 h (art. 58 LFT).",
  });
  r.expect("el admin registra el convenio vigente de Elena", agreement, 201);
  r.expect("Elena acepta su convenio de distribución", await x.elena.bot.post(`/nom/me/distribution-agreements/${agreement.body?.id}/accept`), 200);

  let ok = true;
  for (const [key, steps] of Object.entries(plan)) {
    const extra = x[key];
    for (const [i, step] of steps.entries()) {
      const type = i === steps.length - 1 ? "EXIT" : ["ENTRY", "LUNCH_START", "LUNCH_END"][i];
      const punch = await extra.bot.post("/nom/me/punch", { type, workMode: "REMOTO" });
      if (!r.expect(`${extra.bot.label} marca ${type} remoto`, punch, 201)) {
        ok = false;
        break;
      }
      const adj = await admin.post(`/nom/punches/${punch.body.punch.id}/adjustments`, {
        reason: "Marcaje capturado tarde; se corrige a la hora real trabajada",
        occurredAt: step.at,
        ...(type !== step.type ? { punchType: step.type } : {}),
      });
      if (!r.expect(`el admin corrige el ${type} de ${extra.bot.label} a ${step.at}`, adj, 201)) {
        ok = false;
        break;
      }
      if (key === "ana" && i === 0) {
        r.expect("quien pidió el ajuste no lo puede aprobar", await admin.post(`/nom/adjustments/${adj.body.id}/approve`, {}), 403, "SELF_APPROVAL_FORBIDDEN");
        r.expect("un empleado no aprueba ajustes", await extra.bot.post(`/nom/adjustments/${adj.body.id}/approve`, {}), 403);
      }
      const approved = await hr.post(`/nom/adjustments/${adj.body.id}/approve`, { note: "Validado con el jefe de turno" });
      if (!r.expect(`RH aprueba el ajuste de ${extra.bot.label}`, approved, 200)) ok = false;
    }
  }

  return {
    ok,
    expectedExtra: {
      ana: { [d(6)]: 180, [d(5)]: 180 },
      bruno: { [d(4)]: 480 },
      carla: { [d(1)]: 300 },
      elena: {},
    },
  };
}

// ── Aprobación de días con tiempo extra ───────────────────────────────────

async function aprobaciones(
  cast: Cast,
  r: Report,
  x: Record<string, Extra>,
  today: string,
  filters: Record<string, string>,
  fab: Fabricated
): Promise<void> {
  const { admin, hr, employees, intruderAdmin } = cast;
  const d = (n: number) => addDays(today, -n);
  const query = (bot: Bot, extra: Record<string, unknown> = {}) =>
    bot.post("/overtime/query", { page: 1, limit: 100, filters: { ...filters, ...extra } });

  const all = await query(admin, { status: "ALL" });
  r.expect("el admin consulta los días con tiempo extra de la semana", all, 200);
  const found = rows(all);
  const key = (row: any) => `${row.userId}|${row.date}`;
  const byKey = new Map(found.map((row) => [key(row), row]));
  if (fab.ok) {
    for (const [person, days] of Object.entries(fab.expectedExtra)) {
      for (const [date, minutes] of Object.entries(days)) {
        const row = byKey.get(`${x[person].id}|${date}`);
        r.check(
          `${x[person].bot.label} tiene ${minutes} min de extra el ${date}`,
          row?.extraMin === minutes,
          row ? `extraMin=${row.extraMin} worked=${row.workedMin} scheduled=${row.scheduledMin} rest=${row.restDay}` : "no aparece en la semana"
        );
      }
    }
    const elena = found.find((row) => row.userId === x.elena.id);
    r.check("Elena (10 h con convenio art. 58) no genera extra", !elena || elena.extraMin === 0, JSON.stringify(elena ?? null).slice(0, 200));
  }

  const dayView = await admin.post("/overtime/query", { page: 1, limit: 100, filters: { period: "DAY", date: d(4), status: "ALL" } });
  const brunoDay = rows(dayView).find((row) => row.userId === x.bruno.id);
  if (!r.check("la vista por día muestra el mismo extra que la vista semanal (Bruno)", brunoDay?.extraMin === byKey.get(`${x.bruno.id}|${d(4)}`)?.extraMin, `DAY ${d(4)} → ${JSON.stringify(brunoDay ?? null).slice(0, 160)}`)) {
    r.finding(
      "MEDIA",
      "Un marcaje remoto corregido a otro día desaparece de la vista diaria (y de la alerta diaria)",
      `Bruno marcó hoy (${today}) y RH movió los marcajes, con ajuste aprobado, al ${d(4)}. POST /overtime/query con period WEEK muestra ${byKey.get(`${x.bruno.id}|${d(4)}`)?.extraMin} min ese día, pero con period DAY date ${d(4)} no aparece. ` +
        "El reporte filtra los remotePunch por su occurredAt ORIGINAL dentro del rango y aplica los ajustes después (api/src/modules/time-clock/services/time-clock-report.service.ts:171-176). Afecta aprobaciones por día, export y el barrido DAY de alertas."
    );
  }

  r.expect("un empleado no consulta el tiempo extra", await query(employees[0]), 403);

  const target = { userId: x.ana.id, date: d(6) };
  r.expect("un empleado no aprueba tiempo extra", await employees[0].post("/overtime/approvals", { filters, items: [target], status: "APPROVED" }), 403);
  r.expect("RH sin overtime.approve no aprueba tiempo extra", await hr.post("/overtime/approvals", { filters, items: [target], status: "APPROVED" }), 403);
  r.expect("aprobar sin días es un error de validación", await admin.post("/overtime/approvals", { filters, items: [], status: "APPROVED" }), 400);
  r.expect("aprobar con un estado inventado es un error", await admin.post("/overtime/approvals", { filters, items: [target], status: "MAYBE" }), 400);

  const theirs = await intruderAdmin.post("/overtime/approvals", { filters, items: [target], status: "REJECTED", note: "intruso" });
  r.check("el admin de otro cliente no decide días de este cliente", theirs.status >= 400 || theirs.body?.updated === 0, short(theirs));

  const approve = await admin.post("/overtime/approvals", {
    filters,
    items: [target, { userId: x.carla.id, date: d(1) }, { userId: x.bruno.id, date: d(3) }],
    status: "APPROVED",
    note: "Inventario autorizado",
  });
  r.expect("el admin aprueba los días de Ana y Carla", approve, 200);
  r.check("se aprueban 2 y se omite el día de Bruno sin extra", approve.body?.updated === 2 && approve.body?.skipped === 1, JSON.stringify(approve.body));
  const reject = await admin.post("/overtime/approvals", { filters, items: [{ userId: x.ana.id, date: d(5) }], status: "REJECTED", note: "No autorizado" });
  r.expect("el admin rechaza el segundo día de Ana", reject, 200);

  const after = await query(admin, { status: "ALL" });
  const s = after.body?.summary ?? {};
  const visible = rows(after);
  const sum = (status: string, field: string) => visible.filter((row) => row.status === status).reduce((acc, row) => acc + (row[field] ?? 0), 0);
  if (fab.ok) {
    r.check(
      "el resumen cuenta 2 aprobados, 1 rechazado y 1 pendiente",
      s.approvedDays === 2 && s.rejectedDays === 1 && s.pendingDays === 1 && s.totalDays === 4,
      JSON.stringify({ a: s.approvedDays, r: s.rejectedDays, p: s.pendingDays, t: s.totalDays })
    );
    r.check(
      "los minutos del resumen cuadran con las filas (480 aprobados, 180 rechazados, 480 pendientes)",
      s.approvedMinutes === 480 && s.rejectedMinutes === 180 && s.pendingMinutes === 480 &&
        s.approvedMinutes === sum("APPROVED", "approvedExtraMin") && s.pendingMinutes === sum("PENDING", "extraMin") && s.rejectedMinutes === sum("REJECTED", "extraMin"),
      JSON.stringify({ a: s.approvedMinutes, r: s.rejectedMinutes, p: s.pendingMinutes })
    );
    const dept = (s.byDepartment ?? []).find((row: any) => row.departmentId === cast.file.departments.almacen);
    r.check("por departamento suma lo no rechazado (960 min en Almacén)", dept?.minutes === 960, JSON.stringify(s.byDepartment));
    r.check("la persona con pendientes es solo Bruno", s.peopleWithPending === 1, `peopleWithPending=${s.peopleWithPending}`);
    const decided = visible.find((row) => row.userId === x.ana.id && row.date === d(6));
    r.check("el día aprobado guarda quién decidió y la nota", decided?.decidedById === admin.id && decided?.note === "Inventario autorizado", JSON.stringify(decided ?? null).slice(0, 200));
  }

  for (const status of ["PENDING", "APPROVED", "REJECTED"]) {
    const res = await query(admin, { status });
    const list = rows(res);
    r.check(
      `el filtro ${status} solo trae días ${status} y no mueve el resumen`,
      res.status === 200 && list.every((row) => row.status === status) && res.body?.summary?.totalDays === s.totalDays,
      `${res.status} ${JSON.stringify(list.map((row) => row.status))} total=${res.body?.summary?.totalDays}`
    );
  }
  const byQ = await query(admin, { status: "ALL", q: "Bruno" });
  r.check("la búsqueda por nombre filtra a la persona", rows(byQ).length > 0 && rows(byQ).every((row) => row.userId === x.bruno.id), JSON.stringify(rows(byQ).map((row) => row.employeeName)));
  const byDept = await query(admin, { status: "ALL", departmentId: cast.file.departments.oficina });
  r.check("el filtro por departamento (Oficina) no trae a la gente de Almacén", rows(byDept).every((row) => row.departmentId === cast.file.departments.oficina), JSON.stringify(rows(byDept).map((row) => row.employeeName)));
  r.expect("un periodo inválido se rechaza", await admin.post("/overtime/query", { filters: { period: "YEAR", date: today } }), 400);

  const hrView = await query(hr, { status: "PENDING" });
  r.expect("RH consulta el tiempo extra", hrView, 200);
  r.check(
    "RH solo ve lo aprobado aunque pida pendientes",
    rows(hrView).length > 0 && rows(hrView).every((row) => row.status === "APPROVED" && row.extraMin === row.approvedExtraMin) &&
      hrView.body?.summary?.pendingDays === 0 && hrView.body?.summary?.rejectedDays === 0,
    JSON.stringify(rows(hrView).map((row) => [row.status, row.extraMin])) + JSON.stringify(hrView.body?.summary).slice(0, 160)
  );

  const revert = await admin.post("/overtime/approvals", { filters, items: [{ userId: x.ana.id, date: d(5) }], status: "PENDING" });
  r.expect("el admin regresa a pendiente el día rechazado", revert, 200);
  const reverted = rows(await query(admin, { status: "PENDING" })).find((row) => row.userId === x.ana.id && row.date === d(5));
  r.check("el día vuelve a pendiente sin decisión", reverted?.status === "PENDING" && reverted?.decidedById == null, JSON.stringify(reverted ?? null).slice(0, 200));
  r.expect("y se vuelve a rechazar", await admin.post("/overtime/approvals", { filters, items: [{ userId: x.ana.id, date: d(5) }], status: "REJECTED", note: "No autorizado" }), 200);

  const audit = await admin.get(`/audit?action=OVERTIME_APPROVAL_DECISION&entityId=${encodeURIComponent(`${x.ana.id}|${d(5)}`)}&limit=20`);
  const trail = rows(audit);
  r.check(
    "cada decisión del día queda auditada con estado anterior y nuevo",
    trail.length >= 3 && trail.some((row) => row.previousState?.status === "REJECTED" && row.newState == null),
    JSON.stringify(trail.map((row) => [row.previousState?.status, row.newState?.status]))
  );
}

// ── Ledger semanal (LFT 2026) ─────────────────────────────────────────────

async function ledgerSemanal(cast: Cast, r: Report, x: Record<string, Extra>, today: string, fab: Fabricated): Promise<any[]> {
  const { admin, hr, employees, intruderAdmin } = cast;
  const d = (n: number) => addDays(today, -n);
  r.expect("la semana sin fecha se rechaza", await admin.get("/nom/overtime/weekly"), 400, "INVALID_REPORT_DATE");
  r.expect("un empleado no ve el ledger semanal", await employees[0].get(`/nom/overtime/weekly?date=${today}`), 403);

  const res = await admin.get(`/nom/overtime/weekly?date=${today}`);
  r.expect("el admin calcula el ledger semanal", res, 200);
  const ledgers = rows(res);
  const of = (person: string) => ledgers.find((row) => row.userId === x[person].id);
  r.check(
    "todos los ledgers son de la semana que empieza hace 6 días",
    ledgers.length > 0 && ledgers.every((row) => String(row.weekStart).slice(0, 10) === d(6)),
    JSON.stringify(ledgers.map((row) => row.weekStart))
  );
  if (!fab.ok) return ledgers;

  const ana = of("ana");
  r.check(
    "Ana: 16 h ordinarias y 6 h al doble, sin triple ni excedente",
    ana?.ordinaryMin === 960 && ana?.otDoubleMin === 360 && ana?.otTripleMin === 0 && ana?.otIllegalMin === 0,
    JSON.stringify({ o: ana?.ordinaryMin, d: ana?.otDoubleMin, t: ana?.otTripleMin, i: ana?.otIllegalMin })
  );
  const daysSum = (ledger: any, field: string) => (Array.isArray(ledger?.days) ? ledger.days.reduce((acc: number, day: any) => acc + (day[field] ?? 0), 0) : NaN);
  r.check(
    "el detalle por día de Ana suma lo mismo que el total",
    daysSum(ana, "doubleMin") === ana?.otDoubleMin && daysSum(ana, "ordinaryMin") === ana?.ordinaryMin,
    JSON.stringify(ana?.days).slice(0, 300)
  );

  const bruno = of("bruno");
  r.check(
    "Bruno (18 h en un día) rompe el tope de 12 h: 4 h al doble y el resto excedente ilegal",
    bruno?.otDoubleMin === 240 && (bruno?.otIllegalMin ?? 0) > 0 && (bruno?.violations ?? []).includes("TOPE_DIARIO_12H"),
    JSON.stringify({ o: bruno?.ordinaryMin, d: bruno?.otDoubleMin, t: bruno?.otTripleMin, i: bruno?.otIllegalMin, v: bruno?.violations })
  );
  const brunoApproval = 480;
  const brunoLedgerExtra = (bruno?.otDoubleMin ?? 0) + (bruno?.otTripleMin ?? 0) + (bruno?.otIllegalMin ?? 0);
  if (!r.check("el extra del ledger de Bruno cuadra con el de la pantalla de aprobación (480 min)", brunoLedgerExtra === brunoApproval, `ledger=${brunoLedgerExtra} (doble ${bruno?.otDoubleMin}, ilegal ${bruno?.otIllegalMin}) vs aprobación=${brunoApproval}`)) {
    r.finding(
      "MEDIA",
      "El ledger semanal y la aprobación de tiempo extra no cuadran cuando el trabajador entra antes",
      `Bruno: turno 07:00–15:00, trabajó ${d(4)} 05:00–23:00. POST /overtime/query → extraMin=480 (solo cuenta después de la salida programada, workday-rules.ts:213-227). ` +
        `GET /nom/overtime/weekly → doble ${bruno?.otDoubleMin} + triple ${bruno?.otTripleMin} + ilegal ${bruno?.otIllegalMin} = ${brunoLedgerExtra} (el motor usa trabajado − programado, weekly-overtime-engine.ts:216-218). ` +
        "Lo que RH aprueba y lo que se exporta a la STPS/constancia (ledger) son cifras distintas para el mismo día."
    );
  }

  const carla = of("carla");
  r.check(
    "Carla: 5 h en su día de descanso van a la bolsa de descanso laborado, no al doble",
    carla?.restDayWorkedMin === 300 && carla?.otDoubleMin === 0,
    JSON.stringify({ rest: carla?.restDayWorkedMin, d: carla?.otDoubleMin, o: carla?.ordinaryMin })
  );

  const elena = of("elena");
  if (!r.check("Elena (10 h pactadas con convenio art. 58) no tiene extra en el ledger", (elena?.otDoubleMin ?? 0) === 0 && (elena?.ordinaryMin ?? 0) === 600, JSON.stringify({ o: elena?.ordinaryMin, d: elena?.otDoubleMin, days: elena?.days }).slice(0, 300))) {
    r.finding(
      "ALTA",
      "El ledger semanal ignora el convenio de distribución de jornada (art. 58)",
      `Elena tiene convenio aceptado y turno de 10 h; POST /overtime/query le da extraMin=0, pero GET /nom/overtime/weekly?date=${today} le pone ordinaria ${elena?.ordinaryMin} y ${elena?.otDoubleMin} min al doble. ` +
        "WeeklyOvertimeService manda `hasDistributionAgreement` dentro de cada día (api/src/modules/nom/services/weekly-overtime.service.ts:106) y el motor lo lee del input de la semana (weekly-overtime-engine.ts:181), así que siempre es false. Paga extra que no existe y lo registra en la constancia/export."
    );
  }

  const cfg = (await admin.get("/nom/config")).body;
  r.check("el ledger usa la jornada legal del año (48 h) como tope ordinario", ana?.year === Number(today.slice(0, 4)), JSON.stringify({ year: ana?.year, tenantWeekly: cfg?.weeklyLimitMinutes }));

  const hrRead = await hr.get(`/nom/overtime/weekly?date=${today}`);
  r.expect("RH consulta el ledger semanal", hrRead, 200);
  r.expect("un empleado no confirma ledgers", await employees[0].post(`/nom/overtime/weekly/${ana?.id}/confirm`), 403);
  r.expect("el otro cliente no confirma ledgers ajenos", await intruderAdmin.post(`/nom/overtime/weekly/${ana?.id}/confirm`), 404, "WEEKLY_LEDGER_NOT_FOUND");
  const hrConfirm = await hr.post(`/nom/overtime/weekly/${carla?.id}/confirm`);
  if (hrConfirm.status === 200) {
    r.finding(
      "BAJA",
      "RH congela el ledger semanal sin tener overtime.approve",
      `POST /nom/overtime/weekly/:id/confirm con RH → 200 (status ${hrConfirm.body?.status}). La ruta exige time_clock.write (api/src/modules/nom/routes/nom.routes.ts:125) mientras docs/modules/nom.md («Horas extra por semana») dice que confirmar requiere overtime.approve, que RH no tiene en role_permissions.json (tampoco puede aprobar días ni pedir extra).`
    );
  }
  const confirm = await admin.post(`/nom/overtime/weekly/${ana?.id}/confirm`);
  r.expect("el admin confirma (congela) la semana de Ana", confirm, 200);
  r.check("queda CONFIRMED con quién y cuándo", confirm.body?.status === "CONFIRMED" && confirm.body?.confirmedById === admin.id && Boolean(confirm.body?.confirmedAt), JSON.stringify(confirm.body).slice(0, 200));
  const again = await admin.post(`/nom/overtime/weekly/${ana?.id}/confirm`);
  r.check("confirmar otra vez no cambia nada", again.status === 200 && again.body?.confirmedAt === confirm.body?.confirmedAt, short(again));

  const recalc = await admin.post("/nom/overtime/weekly/recalculate", { date: today });
  r.expect("el admin recalcula la semana", recalc, 200);
  const frozen = rows(recalc).find((row) => row.userId === x.ana.id);
  r.check("el ledger confirmado no se recalcula", frozen?.status === "CONFIRMED" && frozen?.otDoubleMin === ana?.otDoubleMin && frozen?.updatedAt === confirm.body?.updatedAt, JSON.stringify({ s: frozen?.status, u: frozen?.updatedAt, c: confirm.body?.updatedAt }));
  r.expect("recalcular sin fecha se rechaza", await admin.post("/nom/overtime/weekly/recalculate", {}), 400, "INVALID_REPORT_DATE");

  const theirs = await intruderAdmin.get(`/nom/overtime/weekly?date=${today}`);
  r.check("el otro cliente no ve estos ledgers", theirs.status === 200 && !rows(theirs).some((row) => ledgers.some((mine) => mine.id === row.id)), short(theirs));
  return rows(recalc).length ? rows(recalc) : ledgers;
}

// ── Constancia semanal del registro ───────────────────────────────────────

async function constancias(cast: Cast, r: Report, x: Record<string, Extra>, weekStart: string, today: string, ledgers: any[]): Promise<void> {
  const { admin, hr, employees, intruderAdmin } = cast;
  const period = { periodStart: weekStart, periodEnd: today };
  const ack = (bot: Bot, body: Record<string, unknown>) => bot.post("/nom/me/record-acknowledgments", body);

  r.expect("un periodo al revés se rechaza", await ack(x.ana.bot, { periodStart: today, periodEnd: weekStart, accept: true }), 400, "INVALID_ACK_PERIOD");
  r.expect("un periodo mal escrito se rechaza", await ack(x.ana.bot, { periodStart: "ayer", periodEnd: today, accept: true }), 400, "INVALID_ACK_PERIOD");
  r.expect("objetar sin nota se rechaza", await ack(x.bruno.bot, { ...period, accept: false }), 400, "DISCREPANCY_NOTE_REQUIRED");

  const signed = await ack(x.ana.bot, { ...period, accept: true, userId: x.bruno.id });
  r.expect("Ana firma su semana", signed, 201);
  r.check("la firma es de Ana aunque mande otro userId", signed.body?.userId === x.ana.id && signed.body?.status === "ACCEPTED", JSON.stringify({ u: signed.body?.userId, s: signed.body?.status }));
  r.check("la firma guarda hash del resumen", /^[0-9a-f]{64}$/.test(String(signed.body?.summaryHash)), String(signed.body?.summaryHash));
  const anaLedger = ledgers.find((row) => row.userId === x.ana.id);
  const totals = signed.body?.summary?.totals;
  r.check(
    "el resumen firmado trae los mismos totales que el ledger de Ana",
    Boolean(anaLedger) && totals?.ordinaryMin === anaLedger.ordinaryMin && totals?.otDoubleMin === anaLedger.otDoubleMin && totals?.weeks === 1,
    JSON.stringify({ totals, ledger: anaLedger && { o: anaLedger.ordinaryMin, d: anaLedger.otDoubleMin } })
  );

  const objected = await ack(x.bruno.bot, { ...period, accept: false, note: "El miércoles salí a las 21:00, no a las 23:00" });
  r.expect("Bruno objeta su semana con nota", objected, 201);
  r.check("la objeción queda como DISCREPANCY con la nota", objected.body?.status === "DISCREPANCY" && objected.body?.discrepancyNote?.includes("21:00"), JSON.stringify({ s: objected.body?.status, n: objected.body?.discrepancyNote }));
  if (objected.body?.status === "DISCREPANCY" && objected.body?.acceptedAt) {
    r.finding(
      "BAJA",
      "Una objeción de la constancia semanal queda con acceptedAt (fecha de firma)",
      `POST /nom/me/record-acknowledgments {accept:false, note} → status DISCREPANCY pero acceptedAt=${objected.body.acceptedAt}. ` +
        "WorkRecordService.acknowledge pone acceptedAt=new Date() sin importar el estado (api/src/modules/nom/services/work-record.service.ts, acknowledge: create y update del upsert). Cualquier consumidor que cuente firmas por acceptedAt contará la objeción como firma."
    );
  }

  const loose = await ack(x.carla.bot, { periodStart: addDays(weekStart, -7), periodEnd: addDays(weekStart, -1), accept: "false", note: "No estoy de acuerdo" });
  if (loose.status === 201 && loose.body?.status === "ACCEPTED") {
    r.finding(
      "MEDIA",
      "La constancia cuenta como firma todo lo que no sea exactamente accept=false",
      `POST /nom/me/record-acknowledgments {accept:"false", note:"No estoy de acuerdo"} → 201 ACCEPTED (igual sin el campo accept). ` +
        "El controlador usa `accept: req.body?.accept !== false` (api/src/modules/nom/controllers/nom.controller.ts:466); una firma (prueba plena, art. 132 fr. XXXIV) debería exigir accept===true y rechazar lo demás con 400."
    );
  } else {
    r.check("accept no booleano no se toma como firma", loose.status === 400 || loose.body?.status !== "ACCEPTED", short(loose));
  }

  const mine = await x.bruno.bot.get("/nom/me/record-acknowledgments");
  r.expect("Bruno ve sus constancias", mine, 200);
  r.check("Bruno solo ve las suyas", rows(mine).length > 0 && rows(mine).every((row) => row.userId === x.bruno.id), JSON.stringify(rows(mine).map((row) => row.userId)));

  r.expect("un empleado no ve las constancias de todos", await employees[0].get("/nom/record-acknowledgments"), 403);
  const list = await hr.get("/nom/record-acknowledgments");
  r.expect("RH ve quién firmó y quién objetó", list, 200);
  const mineRows = rows(list).filter((row) => String(row.periodStart).slice(0, 10) === weekStart);
  const anaRow = mineRows.find((row) => row.userId === x.ana.id);
  const brunoRow = mineRows.find((row) => row.userId === x.bruno.id);
  r.check(
    "RH ve a Ana como firmada y a Bruno como objetada con su nota",
    anaRow?.status === "ACCEPTED" && brunoRow?.status === "DISCREPANCY" && Boolean(brunoRow?.discrepancyNote) && brunoRow?.user?.name === x.bruno.name,
    JSON.stringify(mineRows.map((row) => [row.user?.name, row.status, row.discrepancyNote]))
  );
  const signedCount = mineRows.filter((row) => row.status === "ACCEPTED").length;
  r.check("la objeción no cuenta como firma: 1 firmada de 2", signedCount === 1, `firmadas=${signedCount}`);

  const flip = await ack(x.bruno.bot, { ...period, accept: true });
  if (flip.status === 201 && flip.body?.id === objected.body?.id && flip.body?.status === "ACCEPTED" && flip.body?.discrepancyNote == null) {
    r.finding(
      "BAJA",
      "Firmar después de objetar borra la objeción de la constancia",
      `Bruno objetó la semana ${weekStart}..${today} y luego la firmó: el mismo registro (${objected.body?.id}) pasa a ACCEPTED y discrepancyNote=null (upsert de WorkRecordService.acknowledge, api/src/modules/nom/services/work-record.service.ts). La nota solo sobrevive en audit_logs; RH ya no ve que hubo objeción.`
    );
  }

  const theirs = await intruderAdmin.get("/nom/record-acknowledgments");
  r.check("el otro cliente no ve estas constancias", theirs.status === 200 && !rows(theirs).some((row) => row.userId === x.ana.id || row.userId === x.bruno.id), short(theirs));
  void admin;
}

// ── Alertas de jornada ────────────────────────────────────────────────────

async function alertas(cast: Cast, r: Report, x: Record<string, Extra>, today: string): Promise<void> {
  const { admin, hr, employees, intruderAdmin } = cast;
  const d = (n: number) => addDays(today, -n);
  r.expect("un empleado no barre alertas", await employees[0].post("/nom/alerts/scan", { date: today }), 403);
  r.expect("un empleado no ve alertas", await employees[0].get("/nom/alerts"), 403);
  r.expect("un alcance inventado se rechaza", await admin.post("/nom/alerts/scan", { date: today, scope: "MONTH" }), 400);

  const strict = await admin.put("/nom/config", { weeklyLimitMinutes: 600 });
  r.expect("el admin baja la jornada semanal del cliente a 10 h para probar la alerta", strict, 200);

  const week = await hr.post("/nom/alerts/scan", { date: today, scope: "WEEK" });
  r.expect("RH barre la semana", week, 200);
  const weekly = (week.body?.created ?? []).filter((row: any) => row.scope === "WEEK");
  const brunoWeek = weekly.find((row: any) => row.userId === x.bruno.id);
  r.check(
    "Bruno (24 h) rebasa el umbral semanal 10 h + 9 h doble + 4 h triple = 23 h",
    brunoWeek?.limitMinutes === 600 + 540 + 240 && brunoWeek?.workedMinutes === 1440,
    JSON.stringify(weekly).slice(0, 300)
  );
  r.check("Ana (22 h) no rebasa el umbral semanal", !weekly.some((row: any) => row.userId === x.ana.id), JSON.stringify(weekly.map((row: any) => row.userName)));
  const repeat = await hr.post("/nom/alerts/scan", { date: today, scope: "WEEK" });
  r.check("repetir el barrido no duplica la alerta", repeat.status === 200 && (repeat.body?.created ?? []).length === 0, short(repeat));

  const daily = await admin.post("/nom/alerts/scan", { date: d(4), scope: "DAY" });
  r.expect("el admin barre el día de Bruno", daily, 200);
  const brunoDay = (daily.body?.created ?? []).find((row: any) => row.userId === x.bruno.id);
  r.check(
    "Bruno (18 h) rebasa el tope diario del cliente (11 h)",
    brunoDay?.workedMinutes === 1080 && brunoDay?.limitMinutes === 660,
    JSON.stringify(daily.body).slice(0, 300)
  );

  const list = await hr.get("/nom/alerts");
  r.expect("RH lista las alertas", list, 200);
  r.check("la alerta semanal de Bruno está en la lista", rows(list).some((row) => row.userId === x.bruno.id && row.scope === "WEEK"), JSON.stringify(rows(list).map((row) => [row.userName, row.scope])));
  const weekOnly = await hr.get("/nom/alerts?scope=WEEK");
  r.check("el filtro por alcance solo trae semanales", rows(weekOnly).every((row) => row.scope === "WEEK"), JSON.stringify(rows(weekOnly).map((row) => row.scope)));
  const theirs = await intruderAdmin.get("/nom/alerts");
  r.check("el otro cliente no ve estas alertas", theirs.status === 200 && !rows(theirs).some((row) => row.userId === x.bruno.id), short(theirs));

  const audit = await admin.get("/audit?action=WORKDAY_LIMIT_ALERT&limit=20");
  r.check("la alerta queda auditada", rows(audit).some((row) => row.metadata?.employeeId === x.bruno.id), JSON.stringify(rows(audit).slice(0, 2)).slice(0, 300));
}

// ── Aislamiento ───────────────────────────────────────────────────────────

async function aislamiento(cast: Cast, r: Report, x: Record<string, Extra>, today: string, ledgers: any[]): Promise<void> {
  const { intruderAdmin, intruderEmployee } = cast;
  const spoofed = await intruderAdmin.post(
    "/overtime/query",
    { page: 1, limit: 100, filters: { period: "WEEK", date: today, status: "ALL" } },
    { tenantId: cast.file.tenant.id }
  );
  r.check(
    "con X-Tenant-Id ajeno el otro cliente no ve el tiempo extra de este",
    spoofed.status >= 400 || !rows(spoofed).some((row) => Object.values(x).some((e) => e.id === row.userId)),
    short(spoofed)
  );
  const spoofLedger = await intruderAdmin.get(`/nom/overtime/weekly?date=${today}`, { tenantId: cast.file.tenant.id });
  r.check(
    "con X-Tenant-Id ajeno el otro cliente no ve los ledgers",
    spoofLedger.status >= 400 || !rows(spoofLedger).some((row) => ledgers.some((mine) => mine.id === row.id)),
    short(spoofLedger)
  );
  const theirMine = await intruderEmployee.get("/nom/me/overtime-requests");
  r.check("el empleado del otro cliente no ve solicitudes de este", theirMine.status === 200 && rows(theirMine).length === 0, short(theirMine));
  const ack = await intruderEmployee.get("/nom/me/record-acknowledgments");
  r.check("el empleado del otro cliente no ve constancias de este", ack.status === 200 && rows(ack).length === 0, short(ack));
}
