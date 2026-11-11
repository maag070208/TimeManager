import { randomBytes, randomUUID } from "node:crypto";
import type { Cast } from "../cast";
import { Bot, addDays, localDate, type Report, type Res } from "../lib";

/**
 * Vacaciones, permisos y avisos: catálogo de tipos y festivos, saldo LFT por
 * antigüedad, solicitudes (normales, con fin de semana/festivo, encimadas, sin
 * saldo, inválidas, pasadas), cancelación, decisión de RH/admin, avisos en la
 * campanita, reflejo en la asistencia semanal y aislamiento entre clientes.
 */

type LeaveType = { id: string; key: string; kind: string; paid: boolean; active: boolean };
type LeaveRequest = { id: string; status: string; days: number; userId: string; decisionNote?: string | null };
type Balance = { entitlementDays: number; usedDays: number; pendingDays: number; availableDays: number };

const secret = () => `Qa-${randomBytes(6).toString("hex")}`;
const weekday = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay();
const isWeekday = (dateKey: string) => weekday(dateKey) !== 0 && weekday(dateKey) !== 6;
const nextWeekday = (dateKey: string) => {
  let d = dateKey;
  while (!isWeekday(d)) d = addDays(d, 1);
  return d;
};
const shiftYears = (dateKey: string, years: number) => `${Number(dateKey.slice(0, 4)) + years}${dateKey.slice(4)}`;
const codeOf = (res: Res) => res.body?.code ?? res.body?.error?.code ?? "";
const brief = (res: Res) => `${res.status} ${codeOf(res)} ${res.text.slice(0, 200)}`;

export default async function permisos(cast: Cast, r: Report): Promise<void> {
  const { admin, hr } = cast;
  const [lucia, marco, daniela, oscar, fernanda, jorge] = cast.employees;
  const tz = cast.file.timezone;
  const today = localDate(new Date(), tz);
  const thisYear = Number(today.slice(0, 4));

  const request = (bot: Bot, typeId: string, startDate: string, endDate: string, reason?: string) =>
    bot.post<LeaveRequest>("/nom/me/leave/requests", { typeId, startDate, endDate, ...(reason ? { reason } : {}) });
  const balance = async (bot: Bot, year: number): Promise<Balance> =>
    (await bot.get<Balance>(`/nom/me/leave/balance?year=${year}`)).body;
  const decide = (bot: Bot, id: string, approve: boolean, note?: string) =>
    bot.post<LeaveRequest>(`/nom/leave/requests/${id}/decide`, { approve, ...(note ? { note } : {}) });
  const unread = async (bot: Bot): Promise<number> => (await bot.get("/notifications/unread-count")).body?.count ?? -1;
  const setHireDate = async (who: string, id: string, hireDate: string) => {
    const res = await hr.patch(`/hr/${id}/profile`, { hireDate });
    r.check(`RH fija la fecha de ingreso de ${who} (${hireDate})`, res.status === 200, brief(res));
  };

  // ── Catálogo de tipos ────────────────────────────────────────────────────
  const typesRes = await hr.get<LeaveType[]>("/nom/leave/types");
  r.expect("RH consulta el catálogo de tipos de permiso", typesRes, 200);
  const types = Array.isArray(typesRes.body) ? typesRes.body : [];
  const byKey = (key: string) => types.find((t) => t.key === key);
  for (const key of ["VACACIONES", "PERMISO_PAGADO", "PERMISO_SIN_GOCE", "INCAPACIDAD"]) {
    r.check(`el catálogo trae por defecto ${key}`, Boolean(byKey(key)), JSON.stringify(types.map((t) => t.key)));
  }
  r.check("el permiso sin goce viene marcado sin goce de sueldo", byKey("PERMISO_SIN_GOCE")?.paid === false);
  const vacationId = byKey("VACACIONES")?.id ?? "";
  const paidId = byKey("PERMISO_PAGADO")?.id ?? "";
  const unpaidId = byKey("PERMISO_SIN_GOCE")?.id ?? "";
  const sickId = byKey("INCAPACIDAD")?.id ?? "";
  if (!vacationId || !paidId || !unpaidId) {
    r.check("hay tipos base para seguir el flujo", false, typesRes.text);
    return;
  }

  const staffTypes = await lucia.get<LeaveType[]>("/nom/leave/types");
  r.expect("un empleado puede ver el catálogo de tipos (para pedir)", staffTypes, 200);

  const created = await hr.post<LeaveType>("/nom/leave/types", {
    key: "permiso paternidad",
    name: "Permiso de paternidad",
    kind: "PAID_LEAVE",
    paid: true,
  });
  r.expect("RH crea el tipo «Permiso de paternidad»", created, 201);
  r.check("la clave se normaliza a PERMISO_PATERNIDAD", created.body?.key === "PERMISO_PATERNIDAD", JSON.stringify(created.body));
  const paternityId = created.body?.id ?? "";
  r.expect(
    "una clave repetida se rechaza",
    await hr.post("/nom/leave/types", { key: "PERMISO_PATERNIDAD", name: "Duplicado" }),
    409,
    "LEAVE_TYPE_TAKEN"
  );
  r.expect("una clave demasiado corta se rechaza", await hr.post("/nom/leave/types", { key: "X", name: "Corto" }), 400, "INVALID_LEAVE_TYPE");
  r.expect(
    "un empleado no puede crear tipos de permiso",
    await lucia.post("/nom/leave/types", { key: "DIA_LIBRE", name: "Día libre" }),
    403
  );

  // ── Festivos ─────────────────────────────────────────────────────────────
  const holidays2027 = await hr.get<Array<{ id: string; date: string; name: string; kind: string }>>("/nom/holidays?year=2027");
  r.expect("RH consulta los festivos 2027", holidays2027, 200);
  const holidayDates = (holidays2027.body ?? []).map((h) => String(h.date).slice(0, 10));
  r.check("los festivos de ley incluyen el Día de la Revolución (2027-11-15)", holidayDates.includes("2027-11-15"), JSON.stringify(holidayDates));
  r.check("los festivos de ley incluyen el 1 de enero de 2027", holidayDates.includes("2027-01-01"));
  const companyHoliday = await hr.post<{ id: string }>("/nom/holidays", { date: "2027-03-19", name: "Aniversario de la empresa", kind: "CONVENIO" });
  r.expect("RH agrega un festivo de convenio (2027-03-19)", companyHoliday, 201);
  r.expect(
    "el mismo festivo no se da de alta dos veces",
    await hr.post("/nom/holidays", { date: "2027-03-19", name: "Otra vez" }),
    409,
    "HOLIDAY_ALREADY_EXISTS"
  );
  r.expect("un empleado no puede agregar festivos", await lucia.post("/nom/holidays", { date: "2027-04-01", name: "Mío" }), 403);

  // ── Saldos por antigüedad ────────────────────────────────────────────────
  const ids = cast.file.employees.map((e) => e.id);
  await setHireDate("Lucía", ids[0], "2023-01-15");
  await setHireDate("Marco", ids[1], "2015-06-01");
  const anniversary = addDays(today, 20);
  const oscarHire = shiftYears(anniversary, -1);
  await setHireDate("Óscar", ids[3], oscarHire);
  await setHireDate("Fernanda", ids[4], "2024-03-01");
  await setHireDate("Jorge", ids[5], "2020-01-10");
  await setHireDate("Roberto (RH)", cast.file.hr.id, "2020-02-01");

  const lucia27 = await balance(lucia, 2027);
  r.check("Lucía (4 años en 2027) tiene 18 días", lucia27?.entitlementDays === 18 && lucia27.availableDays === 18, JSON.stringify(lucia27));
  const marco27 = await balance(marco, 2027);
  r.check("Marco (12 años en 2027) tiene 22 días", marco27?.entitlementDays === 22, JSON.stringify(marco27));
  const daniela27 = await balance(daniela, 2027);
  r.check("Daniela sin fecha de ingreso tiene 0 días", daniela27?.entitlementDays === 0, JSON.stringify(daniela27));
  const fer27 = await balance(fernanda, 2027);
  r.check("Fernanda (3 años en 2027) tiene 16 días", fer27?.entitlementDays === 16, JSON.stringify(fer27));
  const jorge26 = await balance(jorge, 2026);
  r.check("Jorge (6 años en 2026) tiene 20 días", jorge26?.entitlementDays === 20, JSON.stringify(jorge26));
  const otherBalance = await lucia.get(`/nom/me/leave/balance?year=2027&userId=${ids[1]}`);
  r.check(
    "el saldo /me ignora un userId ajeno",
    otherBalance.status === 200 && otherBalance.body?.entitlementDays === 18,
    brief(otherBalance)
  );

  // ── Avisos: línea base ──────────────────────────────────────────────────
  const hrUnread0 = await unread(hr);
  const adminUnread0 = await unread(admin);
  const luciaUnread0 = await unread(lucia);

  // ── Solicitudes de Lucía ─────────────────────────────────────────────────
  const normal = await request(lucia, vacationId, "2027-02-08", "2027-02-10", "Viaje familiar");
  r.expect("Lucía pide vacaciones lun–mié (2027-02-08 a 02-10)", normal, 201);
  r.check("se cuentan 3 días y queda pendiente", normal.body?.days === 3 && normal.body?.status === "PENDING", JSON.stringify(normal.body));
  const normalId = normal.body?.id ?? "";

  const afterRequest = await balance(lucia, 2027);
  r.check(
    "la solicitud pendiente aparece en pendientes y no descuenta el saldo",
    afterRequest?.pendingDays === 3 && afterRequest.usedDays === 0 && afterRequest.availableDays === 18,
    JSON.stringify(afterRequest)
  );

  const hrUnread1 = await unread(hr);
  const adminUnread1 = await unread(admin);
  const notifiedOnRequest = hrUnread1 > hrUnread0 || adminUnread1 > adminUnread0;
  r.check("RH o el admin reciben aviso cuando Lucía pide vacaciones", notifiedOnRequest, `RH ${hrUnread0}→${hrUnread1}, admin ${adminUnread0}→${adminUnread1}`);
  if (!notifiedOnRequest) {
    r.finding(
      "MEDIA",
      "Pedir vacaciones/permiso no avisa a RH ni al admin",
      `POST /nom/me/leave/requests → 201, pero /notifications/unread-count de RH (${hrUnread0}→${hrUnread1}) y del admin (${adminUnread0}→${adminUnread1}) no cambia. LeaveService.createRequest (api/src/modules/nom/services/leave.service.ts) no recibe NotificationPort ni crea avisos; RH solo se entera entrando a la lista.`
    );
  }

  const weekendHoliday = await request(lucia, vacationId, "2027-11-12", "2027-11-16", "Puente de noviembre");
  r.expect("Lucía pide vie–mar cruzando fin de semana y el festivo del 15-nov", weekendHoliday, 201);
  r.check(
    "el fin de semana y el festivo de ley no cuentan (2 días: vie 12 y mar 16)",
    weekendHoliday.body?.days === 2,
    `days=${weekendHoliday.body?.days}`
  );
  const companyCross = await request(lucia, vacationId, "2027-03-18", "2027-03-22", "Puente de la empresa");
  r.expect("Lucía pide jue–lun cruzando el festivo de convenio del 19-mar", companyCross, 201);
  r.check("el festivo de convenio no cuenta (2 días: jue 18 y lun 22)", companyCross.body?.days === 2, `days=${companyCross.body?.days}`);
  const holidayEvidence: string[] = [];
  if (weekendHoliday.body?.days !== 2) holidayEvidence.push(`2027-11-12→2027-11-16 (festivo de ley 2027-11-15) days=${weekendHoliday.body?.days}, esperado 2`);
  if (companyCross.body?.days !== 2) holidayEvidence.push(`2027-03-18→2027-03-22 (festivo de convenio 2027-03-19) days=${companyCross.body?.days}, esperado 2`);

  r.expect(
    "una solicitud encimada con otra suya se rechaza",
    await request(lucia, vacationId, "2027-02-09", "2027-02-12"),
    409,
    "LEAVE_OVERLAP"
  );
  r.expect(
    "también se rechaza si el traslape es con otro tipo (permiso con goce)",
    await request(lucia, paidId, "2027-02-10", "2027-02-10"),
    409,
    "LEAVE_OVERLAP"
  );
  const tooMany = await request(lucia, vacationId, "2027-06-01", "2027-07-30");
  r.expect("pedir más días que el saldo se rechaza", tooMany, 400, "INSUFFICIENT_VACATION_DAYS");
  r.check("el rechazo explica los días disponibles", tooMany.body?.details?.available !== undefined || /disponibles|available/i.test(tooMany.text), tooMany.text);
  r.expect("fechas invertidas se rechazan", await request(lucia, vacationId, "2027-05-10", "2027-05-03"), 400, "INVALID_LEAVE_RANGE");
  r.expect("un rango solo de fin de semana se rechaza", await request(lucia, vacationId, "2027-05-08", "2027-05-09"), 400, "INVALID_LEAVE_RANGE");
  r.expect("una fecha con formato inválido se rechaza", await request(lucia, vacationId, "10/05/2027", "12/05/2027"), 400, "INVALID_LEAVE_RANGE");
  r.expect(
    "un tipo inexistente se rechaza",
    await request(lucia, "00000000-0000-0000-0000-000000000000", "2027-05-10", "2027-05-11"),
    404,
    "LEAVE_TYPE_NOT_FOUND"
  );

  const pastStart = nextWeekday(addDays(today, -30));
  const past = await request(lucia, vacationId, pastStart, pastStart, "Se me olvidó pedirlo");
  r.check(
    `pedir vacaciones con fecha pasada (${pastStart}) se rechaza`,
    past.status === 400,
    brief(past)
  );
  if (past.status === 201) {
    r.finding(
      "BAJA",
      "El empleado puede pedir vacaciones con fechas pasadas",
      `POST /nom/me/leave/requests {startDate:${pastStart}, endDate:${pastStart}} (hoy ${today}) → 201 PENDING. createRequest no valida que el rango sea futuro; una regularización debería hacerla RH, no el autoservicio. api/src/modules/nom/services/leave.service.ts:212`
    );
    await lucia.post(`/nom/me/leave/requests/${past.body.id}/cancel`);
  }

  // ── Cancelación ──────────────────────────────────────────────────────────
  const cancelled = await lucia.post<LeaveRequest>(`/nom/me/leave/requests/${companyCross.body?.id}/cancel`);
  r.expect("Lucía cancela su solicitud pendiente de marzo", cancelled, 200);
  r.check("queda CANCELLED", cancelled.body?.status === "CANCELLED", JSON.stringify(cancelled.body));
  r.expect(
    "cancelar dos veces la misma solicitud se rechaza",
    await lucia.post(`/nom/me/leave/requests/${companyCross.body?.id}/cancel`),
    409,
    "LEAVE_ALREADY_DECIDED"
  );
  r.expect("Marco no puede cancelar una solicitud de Lucía", await marco.post(`/nom/me/leave/requests/${normalId}/cancel`), 404, "LEAVE_NOT_FOUND");
  const reuse = await request(lucia, vacationId, "2027-03-18", "2027-03-18");
  r.expect("tras cancelar, las fechas quedan libres para otra solicitud", reuse, 201);
  if (reuse.body?.id) await lucia.post(`/nom/me/leave/requests/${reuse.body.id}/cancel`);

  // ── Permisos de decisión ─────────────────────────────────────────────────
  r.expect("Lucía no puede aprobar su propia solicitud", await decide(lucia, normalId, true), 403);
  r.expect("Marco no puede aprobar la solicitud de Lucía", await decide(marco, normalId, true), 403);
  r.expect("un empleado no puede listar las solicitudes de todos", await marco.get("/nom/leave/requests"), 403);

  const mine = await lucia.get<LeaveRequest[]>("/nom/me/leave/requests");
  r.expect("Lucía ve sus solicitudes", mine, 200);
  r.check("en «mis solicitudes» están las suyas", (mine.body ?? []).some((x) => x.id === normalId));
  const marcoMine = await marco.get<LeaveRequest[]>("/nom/me/leave/requests");
  r.check("Marco no ve las solicitudes de Lucía", !(marcoMine.body ?? []).some((x) => x.id === normalId), JSON.stringify(marcoMine.body));

  const pendingList = await hr.get<LeaveRequest[]>("/nom/leave/requests?status=PENDING");
  r.expect("RH lista las solicitudes pendientes", pendingList, 200);
  const pendingIds = (pendingList.body ?? []).map((x) => x.id);
  r.check("la lista de pendientes trae las de Lucía", pendingIds.includes(normalId) && pendingIds.includes(weekendHoliday.body?.id ?? "-"));
  r.check("la lista de pendientes no trae canceladas", !pendingIds.includes(companyCross.body?.id ?? "-"));

  const approved = await decide(hr, normalId, true, "Autorizado, buen viaje");
  r.expect("RH aprueba las vacaciones de febrero con nota", approved, 200);
  r.check("queda APPROVED con la nota", approved.body?.status === "APPROVED" && approved.body?.decisionNote === "Autorizado, buen viaje", JSON.stringify(approved.body));
  const rejected = await decide(hr, weekendHoliday.body?.id ?? "", false, "Temporada alta en almacén");
  r.expect("RH rechaza el puente de noviembre con nota", rejected, 200);
  r.check("queda REJECTED con la nota", rejected.body?.status === "REJECTED" && rejected.body?.decisionNote === "Temporada alta en almacén", JSON.stringify(rejected.body));
  r.expect("decidir otra vez una solicitud ya decidida se rechaza", await decide(hr, normalId, false), 409, "LEAVE_ALREADY_DECIDED");
  r.expect("decidir una solicitud inexistente da 404", await decide(hr, "no-existe", true), 404, "LEAVE_NOT_FOUND");
  r.expect("Lucía no puede cancelar una solicitud ya aprobada", await lucia.post(`/nom/me/leave/requests/${normalId}/cancel`), 409, "LEAVE_ALREADY_DECIDED");

  const afterDecision = await balance(lucia, 2027);
  r.check(
    "el saldo baja solo por lo aprobado (3 usados, 15 disponibles, 0 pendientes)",
    afterDecision?.usedDays === 3 && afterDecision.availableDays === 15 && afterDecision.pendingDays === 0,
    JSON.stringify(afterDecision)
  );

  const luciaUnread1 = await unread(lucia);
  const notifiedOnDecision = luciaUnread1 > luciaUnread0;
  r.check("Lucía recibe aviso cuando RH decide sus solicitudes", notifiedOnDecision, `no leídas ${luciaUnread0}→${luciaUnread1}`);
  if (!notifiedOnDecision) {
    r.finding(
      "MEDIA",
      "Aprobar o rechazar una solicitud no avisa al empleado",
      `POST /nom/leave/requests/:id/decide → 200 (APPROVED y REJECTED con nota), pero /notifications/unread-count de Lucía sigue en ${luciaUnread1}. LeaveService.decide (api/src/modules/nom/services/leave.service.ts:256) solo audita; el empleado no se entera del rechazo ni de la nota.`
    );
  }

  // ── Admin decide; tipo creado por RH ─────────────────────────────────────
  const marcoReq = await request(marco, vacationId, "2027-09-06", "2027-09-10", "Boda de mi hermana");
  r.expect("Marco pide una semana de vacaciones", marcoReq, 201);
  const byAdmin = await decide(admin, marcoReq.body?.id ?? "", true, "Aprobado por dirección");
  r.expect("el admin del cliente también puede aprobar (la matriz le da time_clock.write)", byAdmin, 200);
  const marcoAfter = await balance(marco, 2027);
  r.check("a Marco le quedan 17 de 22", marcoAfter?.usedDays === 5 && marcoAfter.availableDays === 17, JSON.stringify(marcoAfter));

  const paternity = await request(marco, paternityId, "2027-10-04", "2027-10-08", "Nacimiento de mi hija");
  r.expect("Marco pide el permiso de paternidad (tipo creado por RH)", paternity, 201);
  r.check("el permiso trae su tipo con goce", paternity.body && (paternity.body as any).type?.paid === true, JSON.stringify(paternity.body));
  r.expect("RH aprueba el permiso de paternidad", await decide(hr, paternity.body?.id ?? "", true), 200);
  const marcoAfterPaternity = await balance(marco, 2027);
  r.check("el permiso de paternidad no toca el saldo de vacaciones", marcoAfterPaternity?.usedDays === 5, JSON.stringify(marcoAfterPaternity));

  r.expect("RH da de baja el tipo de paternidad", await hr.delete(`/nom/leave/types/${paternityId}`), 200);
  const activeTypes = await hr.get<LeaveType[]>("/nom/leave/types");
  r.check("el tipo dado de baja ya no aparece en el catálogo", !(activeTypes.body ?? []).some((t) => t.id === paternityId));
  const allTypes = await hr.get<LeaveType[]>("/nom/leave/types?includeInactive=true");
  r.check("con includeInactive sí aparece (inactivo)", (allTypes.body ?? []).some((t) => t.id === paternityId && !t.active));
  r.expect("no se puede pedir un tipo dado de baja", await request(marco, paternityId, "2027-10-11", "2027-10-12"), 404, "LEAVE_TYPE_NOT_FOUND");
  const history = await marco.get<LeaveRequest[]>("/nom/me/leave/requests");
  r.check("la solicitud histórica con ese tipo sigue visible", (history.body ?? []).some((x) => x.id === paternity.body?.id));

  // ── Sin saldo y permiso sin goce ─────────────────────────────────────────
  r.expect(
    "Daniela (sin fecha de ingreso) no puede pedir vacaciones",
    await request(daniela, vacationId, "2027-04-05", "2027-04-06"),
    400,
    "VACATION_NOT_YET_EARNED"
  );
  const unpaid = await request(daniela, unpaidId, "2027-04-05", "2027-04-06", "Trámite personal");
  r.expect("Daniela sí puede pedir un permiso sin goce (no usa saldo)", unpaid, 201);
  r.expect("RH rechaza el permiso sin goce", await decide(hr, unpaid.body?.id ?? "", false, "Sin cobertura ese día"), 200);

  // ── Antigüedad: aún no cumple el año ─────────────────────────────────────
  const oscarBalance = await balance(oscar, thisYear);
  const beforeAnniversary = nextWeekday(addDays(today, 7));
  const oscarReq = await request(oscar, vacationId, beforeAnniversary, beforeAnniversary, "Antes del aniversario");
  r.check(
    `Óscar (ingresó ${oscarHire}, cumple el año el ${anniversary}) no puede gozar vacaciones el ${beforeAnniversary}`,
    oscarReq.status === 400,
    `saldo ${JSON.stringify(oscarBalance)}; ${brief(oscarReq)}`
  );
  if (oscarReq.status === 201 && beforeAnniversary < anniversary) {
    r.finding(
      "MEDIA",
      "El saldo da vacaciones antes de cumplir el año de antigüedad",
      `Óscar ingresó ${oscarHire}; GET /nom/me/leave/balance?year=${thisYear} da entitlementDays=${oscarBalance?.entitlementDays} y POST /nom/me/leave/requests para ${beforeAnniversary} (antes del aniversario ${anniversary}) → 201. balance() calcula la antigüedad al 31-dic del año (api/src/modules/nom/services/leave.service.ts:149), no a la fecha del goce; el art. 76 LFT da el derecho al cumplir el año.`
    );
  }
  if (oscarReq.body?.id) await oscar.post(`/nom/me/leave/requests/${oscarReq.body.id}/cancel`);

  // ── Pendientes que suman más que el saldo ────────────────────────────────
  const ferA = await request(fernanda, vacationId, "2027-03-01", "2027-03-12", "Primera parte");
  r.expect("Fernanda pide 10 días (de 16)", ferA, 201);
  const ferB = await request(fernanda, vacationId, "2027-04-05", "2027-04-14", "Segunda parte");
  r.check(
    "una segunda solicitud de 8 días con 10 ya pendientes (18 > 16) se rechaza",
    ferB.status === 400,
    brief(ferB)
  );
  if (ferB.status === 201) {
    const a = await decide(hr, ferA.body?.id ?? "", true);
    const b = await decide(hr, ferB.body?.id ?? "", true);
    const ferAfter = await balance(fernanda, 2027);
    r.check(
      "RH no puede aprobar más días que el saldo",
      b.status !== 200,
      `aprobar A ${a.status}, aprobar B ${b.status}; saldo ${JSON.stringify(ferAfter)}`
    );
    r.finding(
      "ALTA",
      "Se aprueban vacaciones por encima del saldo (los pendientes no apartan días)",
      `Fernanda tiene 16 días en 2027: pide 10 (2027-03-01→03-12) y luego 8 (2027-04-05→04-14) → ambas 201. RH aprueba las dos (${a.status}/${b.status}) y el saldo queda ${JSON.stringify(ferAfter)} (18 usados de 16, availableDays se trunca a 0). createRequest compara contra availableDays sin restar pendingDays (api/src/modules/nom/services/leave.service.ts:234) y decide() no revalida el saldo al aprobar (leave.service.ts:256).`
    );
  } else if (ferA.body?.id) {
    await fernanda.post(`/nom/me/leave/requests/${ferA.body.id}/cancel`);
  }

  // ── Rango que cruza el año ───────────────────────────────────────────────
  const cross = await request(jorge, vacationId, "2026-12-28", "2027-01-08", "Fin de año");
  r.expect("Jorge pide vacaciones del 28-dic-2026 al 8-ene-2027", cross, 201);
  r.check("el 1 de enero (festivo) no cuenta: 9 días", cross.body?.days === 9, `days=${cross.body?.days}`);
  if (cross.body?.days !== 9) holidayEvidence.push(`2026-12-28→2027-01-08 (Año Nuevo) days=${cross.body?.days}, esperado 9`);
  if (holidayEvidence.length) {
    r.finding(
      "ALTA",
      "Los días festivos se descuentan como días de vacaciones",
      `POST /nom/me/leave/requests → 201 con: ${holidayEvidence.join("; ")}. GET /nom/holidays sí lista esos festivos. businessDays() (api/src/modules/nom/services/leave.service.ts:29) solo excluye sábado y domingo y no consulta el catálogo de festivos (art. 74/76 LFT): el saldo del trabajador baja de más.`
    );
  }
  r.expect("RH aprueba las vacaciones de fin de año", await decide(hr, cross.body?.id ?? "", true), 200);
  const j26 = await balance(jorge, 2026);
  const j27 = await balance(jorge, 2027);
  const totalUsed = (j26?.usedDays ?? 0) + (j27?.usedDays ?? 0);
  r.check(
    "entre 2026 y 2027 se descuentan exactamente los días de la solicitud",
    totalUsed === cross.body?.days,
    `2026 usados=${j26?.usedDays}, 2027 usados=${j27?.usedDays}, solicitud=${cross.body?.days}`
  );
  if (cross.body?.days && totalUsed > cross.body.days) {
    r.finding(
      "MEDIA",
      "Una solicitud que cruza el año se descuenta completa en ambos años",
      `Jorge: 2026-12-28→2027-01-08 aprobada con days=${cross.body.days}; GET /nom/me/leave/balance?year=2026 usedDays=${j26?.usedDays} y ?year=2027 usedDays=${j27?.usedDays} (total ${totalUsed}). balance() suma row.days de toda solicitud que toque el año sin prorratear (api/src/modules/nom/services/leave.service.ts:160-170).`
    );
  }

  // ── RH no decide la suya ─────────────────────────────────────────────────
  const hrOwn = await request(hr, vacationId, "2027-02-15", "2027-02-16", "Vacaciones de RH");
  r.expect("Roberto (RH) pide sus propias vacaciones", hrOwn, 201);
  const hrSelf = await decide(hr, hrOwn.body?.id ?? "", true, "Me lo autorizo");
  r.check("RH no puede aprobar su propia solicitud", hrSelf.status === 403 || hrSelf.status === 409, brief(hrSelf));
  if (hrSelf.status === 200) {
    r.finding(
      "MEDIA",
      "RH puede aprobar sus propias vacaciones",
      `Roberto (HUMAN_RESOURCES) pide 2027-02-15→02-16 y POST /nom/leave/requests/${hrOwn.body?.id}/decide {approve:true} con su propio token → 200 APPROVED. decide() no compara actor.id con request.userId (api/src/modules/nom/services/leave.service.ts:256); falta segregación de funciones.`
    );
  }

  // ── Avisos (campanita) ───────────────────────────────────────────────────
  const stamp = cast.file.stamp;
  const sofiaUser = `${cast.file.tenant.slug}.sofia`;
  const sofiaPass = secret();
  const sofiaRes = await admin.post("/users", {
    username: sofiaUser,
    password: sofiaPass,
    name: "Sofía Lara Mendoza",
    email: `sofia.${stamp}@qa.invalid`,
    role: "HUMAN_RESOURCES",
    employeeNumber: "110",
    departmentId: cast.file.departments.oficina,
  });
  r.expect("el admin da de alta a Sofía (RH con correo)", sofiaRes, 201);
  const sofia = await new Bot("Sofía", sofiaUser, sofiaPass, cast.file.tenant.slug, "HUMAN_RESOURCES").login();

  const intruderHrUser = `${cast.file.intruder.tenant.slug}.rh2`;
  const intruderHrPass = secret();
  const intruderHrRes = await cast.intruderAdmin.post("/users", {
    username: intruderHrUser,
    password: intruderHrPass,
    name: "Rita Ajena Paz",
    email: `rita.${stamp}@qa.invalid`,
    role: "HUMAN_RESOURCES",
    employeeNumber: "910",
  });
  r.expect("el cliente intruso da de alta a su RH con correo", intruderHrRes, 201);
  const intruderHr = await new Bot("RH intruso", intruderHrUser, intruderHrPass, cast.file.intruder.tenant.slug, "HUMAN_RESOURCES").login();

  const sofiaUnread0 = await unread(sofia);
  const robertoUnread0 = await unread(hr);
  const intruderHrUnread0 = await unread(intruderHr);

  const paolaUser = `${cast.file.tenant.slug}.paola`;
  const paolaPass = secret();
  const paolaRes = await admin.post("/users", {
    username: paolaUser,
    password: paolaPass,
    name: "Paola Ríos Trejo",
    email: `paola.${stamp}@qa.invalid`,
    role: "CLIENT_STAFF",
    employeeNumber: "250",
    jobTitle: "Auxiliar administrativo",
    departmentId: cast.file.departments.oficina,
  });
  r.expect("el admin da de alta a Paola (empleada extra para checar)", paolaRes, 201);
  const paolaId = paolaRes.body?.id ?? paolaRes.body?.user?.id;
  const paola = await new Bot("Paola", paolaUser, paolaPass, cast.file.tenant.slug, "CLIENT_STAFF").login();

  const sofiaList = await sofia.get<{ data: Array<{ id: string; type: string; title: string; read: boolean }> }>("/notifications");
  const sofiaCreated = (sofiaList.body?.data ?? []).filter((n) => n.type === "USER_CREATED" && n.title.includes("Paola"));
  r.check("Sofía (RH) recibe el aviso de alta de Paola", sofiaCreated.length === 1 && (await unread(sofia)) > sofiaUnread0, JSON.stringify(sofiaList.body?.data?.slice(0, 3)));

  const robertoUnread1 = await unread(hr);
  r.check("Roberto (RH sin correo) también recibe el aviso en la campanita", robertoUnread1 > robertoUnread0, `${robertoUnread0}→${robertoUnread1}`);
  if (robertoUnread1 === robertoUnread0 && sofiaCreated.length === 1) {
    r.finding(
      "BAJA",
      "Los avisos en la app solo llegan a RH/admin que tienen correo",
      `Al dar de alta a Paola, Sofía (RH con correo) recibe USER_CREATED pero Roberto (RH sin correo) no (unread ${robertoUnread0}→${robertoUnread1}). resolveAdminHrRecipients filtra email: { not: null } también para la campanita (api/src/modules/notifications/services/notification.service.ts:113).`
    );
  }
  const intruderHrUnread1 = await unread(intruderHr);
  const intruderHrList = await intruderHr.get<{ data: Array<{ title: string }> }>("/notifications");
  r.check(
    "el RH del otro cliente no recibe el aviso de alta de Paola",
    intruderHrUnread1 === intruderHrUnread0 && !(intruderHrList.body?.data ?? []).some((n) => n.title.includes("Paola")),
    `${intruderHrUnread0}→${intruderHrUnread1}`
  );
  if ((intruderHrList.body?.data ?? []).some((n) => n.title.includes("Paola"))) {
    r.finding("BLOQUEANTE", "Aviso de alta de usuario llega a RH de otro cliente", `RH intruso ve un aviso con «Paola»: ${JSON.stringify(intruderHrList.body?.data?.slice(0, 3))}`);
  }

  const missing = await hr.post(`/hr/${paolaId}/notify-missing-records`);
  r.expect("RH le avisa a Paola lo que falta de su expediente", missing, 200);
  const paolaList = await paola.get<{ data: Array<{ id: string; type: string; read: boolean }> }>("/notifications");
  const paolaNotes = paolaList.body?.data ?? [];
  r.check("Paola tiene un aviso sin leer", paolaNotes.length >= 1 && (await unread(paola)) >= 1, JSON.stringify(paolaNotes));
  const paolaNoteId = paolaNotes[0]?.id ?? "";

  const luciaListBefore = await lucia.get<{ data: Array<{ id: string }> }>("/notifications");
  r.check("Lucía no ve los avisos de Paola", !(luciaListBefore.body?.data ?? []).some((n) => n.id === paolaNoteId));
  const foreignRead = await lucia.post(`/notifications/${paolaNoteId}/read`);
  const foreignDelete = await lucia.delete(`/notifications/${paolaNoteId}`);
  const intruderRead = await cast.intruderEmployee.post(`/notifications/${paolaNoteId}/read`);
  const paolaStill = await paola.get<{ data: Array<{ id: string; read: boolean }> }>("/notifications");
  const stillThere = (paolaStill.body?.data ?? []).find((n) => n.id === paolaNoteId);
  r.check(
    "Lucía y el empleado intruso no pueden marcar ni borrar el aviso de Paola",
    Boolean(stillThere) && stillThere?.read === false,
    `read ${foreignRead.status}, delete ${foreignDelete.status}, intruso ${intruderRead.status}; aviso=${JSON.stringify(stillThere)}`
  );

  r.expect("Paola marca su aviso como leído", await paola.post(`/notifications/${paolaNoteId}/read`), 204);
  r.check("su contador baja a 0", (await unread(paola)) === 0);
  const unreadOnly = await paola.get<{ data: unknown[] }>("/notifications?unread=true");
  r.check("el filtro «sin leer» queda vacío", (unreadOnly.body?.data ?? []).length === 0, JSON.stringify(unreadOnly.body));

  await hr.post(`/hr/${paolaId}/notify-missing-records`);
  await hr.post(`/hr/${paolaId}/notify-missing-records`);
  r.check("dos avisos más dejan 2 sin leer", (await unread(paola)) === 2);
  r.expect("Paola marca todos como leídos", await paola.post("/notifications/read-all"), 204);
  r.check("el contador queda en 0", (await unread(paola)) === 0);
  r.expect("Paola borra un aviso", await paola.delete(`/notifications/${paolaNoteId}`), 204);
  const paolaAfterDelete = await paola.get<{ data: Array<{ id: string }> }>("/notifications");
  r.check("el aviso borrado ya no aparece", !(paolaAfterDelete.body?.data ?? []).some((n) => n.id === paolaNoteId));

  if (sofiaCreated[0]) {
    r.expect("Sofía marca todos sus avisos como leídos", await sofia.post("/notifications/read-all"), 204);
    r.check("el contador de Sofía queda en 0", (await unread(sofia)) === 0);
    r.check("marcar todos de Sofía no tocó los de Roberto", (await unread(hr)) === robertoUnread1);
  }

  // ── Reflejo en asistencia semanal ────────────────────────────────────────
  await setHireDate("Paola", paolaId, "2020-01-01");
  const schedule = await admin.post<{ id: string }>("/schedules", {
    name: `Permisos QA L-V ${stamp}`,
    mealBreakMin: 60,
    days: [
      ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "17:00" })),
      { weekday: 6, restDay: true },
      { weekday: 7, restDay: true },
    ],
  });
  r.expect("el admin crea un horario L-V para Paola", schedule, 201);
  const assign = await admin.post("/schedules/assignments", { scheduleId: schedule.body?.id, userIds: [paolaId], from: addDays(today, -21) });
  r.check("el admin le asigna el horario a Paola", assign.status === 200 || assign.status === 201, brief(assign));
  const agreement = await paola.post("/nom/me/record-agreement/accept", {
    methods: ["CLOCK", "REMOTE"],
    roundingPolicy: "Minutos exactos",
    correctionRules: "Ajuste aprobado por RH",
  });
  r.check("Paola acepta el acuerdo de método de registro con checada remota", agreement.status < 300, brief(agreement));
  const entry = await paola.post("/nom/me/punch", { type: "ENTRY", workMode: "PRESENCIAL", clientEventId: randomUUID() });
  r.check("Paola registra su entrada de hoy (queda vinculada)", entry.status === 201 || entry.status === 200, brief(entry));

  const report0 = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
  r.expect("RH consulta la asistencia semanal", report0, 200);
  const rangeDays: string[] = report0.body?.range?.days ?? [];
  const leaveDay = [...rangeDays].reverse().find((d) => d < today && isWeekday(d));
  if (!leaveDay) {
    r.check("hay un día hábil pasado en la semana para probar el reflejo del permiso", false, `semana ${JSON.stringify(rangeDays)}, hoy ${today}`);
  } else {
    r.expect(
      `Paola no puede pedir vacaciones con fecha pasada (${leaveDay})`,
      await request(paola, vacationId, leaveDay, leaveDay, "Regularización"),
      400,
      "LEAVE_IN_PAST"
    );
    // Solo la incapacidad se registra hacia atrás: con ella se revisa el reflejo en asistencia.
    const paolaLeave = await request(paola, sickId, leaveDay, leaveDay, "Incapacidad del IMSS");
    let leaveOk = paolaLeave.status === 201;
    if (!leaveOk) leaveOk = r.check(`Paola registra su incapacidad del ${leaveDay}`, false, brief(paolaLeave));
    if (leaveOk) {
      r.expect(`RH aprueba las vacaciones de Paola del ${leaveDay}`, await decide(hr, paolaLeave.body.id, true), 200);
      const report = await hr.post("/schedules/weekly-attendance", { date: today, refresh: true });
      const row = (report.body?.rows ?? []).find((x: any) => x.userId === paolaId);
      const day = row?.days?.find((d: any) => d.date === leaveDay);
      r.check(
        `el ${leaveDay} aprobado como vacaciones no sale como falta en la asistencia semanal`,
        Boolean(day) && row?.linked === true && day.status === "LEAVE",
        `linked=${row?.linked}, status=${day?.status}, faltas=${row?.totals?.absences}`
      );
      if (day?.status === "ABSENCE") {
        r.finding(
          "ALTA",
          "Las vacaciones aprobadas salen como falta en la asistencia semanal",
          `Paola con horario L-V y vacaciones APPROVED el ${leaveDay}: POST /schedules/weekly-attendance {date:${today}} devuelve days[${leaveDay}].status=ABSENCE y totals.absences=${row?.totals?.absences}. El enum de estados (api/src/modules/schedules/models/dto/schedule.dto.ts:196) no tiene VACATION/LEAVE y weekly-attendance.service.ts:230-238 no consulta leaveRequest; ningún módulo fuera de leave.service lee LeaveRequest, así que la pre-nómina descuenta el día.`
        );
      }
    }
  }

  // ── Aislamiento entre clientes ───────────────────────────────────────────
  const intruderList = await cast.intruderAdmin.get<LeaveRequest[]>("/nom/leave/requests");
  r.expect("el admin intruso lista las solicitudes de su cliente", intruderList, 200);
  r.check("no ve ninguna solicitud de este cliente", !(intruderList.body ?? []).some((x) => x.id === normalId || x.id === marcoReq.body?.id));
  const spoofed = await cast.intruderAdmin.get<LeaveRequest[]>("/nom/leave/requests", { tenantId: cast.file.tenant.id });
  r.check(
    "con X-Tenant-Id de este cliente tampoco las ve",
    spoofed.status >= 400 || !(Array.isArray(spoofed.body) && spoofed.body.some((x) => x.id === normalId)),
    brief(spoofed)
  );
  r.expect("el admin intruso no puede decidir una solicitud de este cliente", await decide(cast.intruderAdmin, hrOwn.body?.id ?? normalId, false), 404, "LEAVE_NOT_FOUND");
  r.expect(
    "el empleado intruso no puede cancelar una solicitud de este cliente",
    await cast.intruderEmployee.post(`/nom/me/leave/requests/${ferA.body?.id ?? normalId}/cancel`),
    404,
    "LEAVE_NOT_FOUND"
  );
  r.expect(
    "el empleado intruso no puede usar un tipo de este cliente",
    await request(cast.intruderEmployee, vacationId, "2027-05-10", "2027-05-11"),
    404,
    "LEAVE_TYPE_NOT_FOUND"
  );
  r.expect("el admin intruso no puede editar un tipo de este cliente", await cast.intruderAdmin.patch(`/nom/leave/types/${paidId}`, { name: "Hackeado" }), 404);
  const intruderTypes = await cast.intruderAdmin.get<LeaveType[]>("/nom/leave/types?includeInactive=true");
  r.check("el catálogo del intruso no trae el tipo de paternidad de este cliente", !(intruderTypes.body ?? []).some((t) => t.id === paternityId));
  const intruderHolidays = await cast.intruderAdmin.get<Array<{ id: string }>>("/nom/holidays?year=2027");
  r.check("los festivos del intruso no traen el de convenio de este cliente", !(intruderHolidays.body ?? []).some((h) => h.id === companyHoliday.body?.id));
  r.expect("el admin intruso no puede borrar un festivo de este cliente", await cast.intruderAdmin.delete(`/nom/holidays/${companyHoliday.body?.id}`), 404, "HOLIDAY_NOT_FOUND");
  const intruderMine = await cast.intruderEmployee.get<LeaveRequest[]>("/nom/me/leave/requests");
  r.check("«mis solicitudes» del empleado intruso no trae nada de este cliente", !(intruderMine.body ?? []).some((x) => x.id === normalId));
  const intruderNotes = await cast.intruderEmployee.get<{ data: Array<{ id: string }> }>("/notifications");
  r.check("los avisos del empleado intruso no traen avisos de este cliente", !(intruderNotes.body?.data ?? []).some((n) => n.id === paolaNoteId));
}
