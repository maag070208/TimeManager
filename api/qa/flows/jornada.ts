import { randomBytes, randomUUID } from "node:crypto";
import type { Cast } from "../cast";
import { Bot, localDate, type Report, type Res } from "../lib";

/**
 * Jornada desde la app: configuración NOM del cliente, modo de checada y
 * acuerdo del método de registro; el día de los seis empleados con sus
 * variaciones; reglas de secuencia, offline e idempotencia; consulta propia de
 * marcajes; discrepancia → ajuste → aprobación por otra persona; asistencia del
 * día para RH/admin y aislamiento frente al cliente intruso.
 */

const list = (body: any): any[] => {
  if (Array.isArray(body)) return body;
  for (const key of ["data", "items", "rows", "logs", "results"]) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
};

const codeOf = (res: Res) => res.body?.code ?? res.body?.error?.code ?? "";
const brief = (res: Res) => `${res.status} ${codeOf(res)} ${res.text.slice(0, 300)}`;

type Step = { type: "ENTRY" | "LUNCH_START" | "LUNCH_END" | "EXIT"; extra?: Record<string, unknown> };

export default async function jornada(cast: Cast, r: Report): Promise<void> {
  const { admin, hr, employees, intruderAdmin, intruderEmployee, platform } = cast;
  const [lucia, marco, daniela, oscar, fernanda, jorge] = employees;
  const tz = cast.file.timezone;
  const today = localDate(new Date(), tz);
  const recorded = new Map<string, string[]>();
  const remember = (bot: Bot, res: Res) => {
    const id = res.body?.punch?.id;
    if (id && res.body?.created !== false) recorded.set(bot.id, [...(recorded.get(bot.id) ?? []), id]);
  };
  const punch = async (bot: Bot, step: Step, label: string, status = 201, code?: string) => {
    // `clientEventId` es obligatorio en el API; `step.extra` puede sobreescribirlo
    // (p. ej. el envío offline de Lucía reutiliza su id).
    const res = await bot.post("/nom/me/punch", {
      type: step.type,
      clientEventId: randomUUID(),
      ...(step.extra ?? {}),
    });
    r.expect(label, res, status, code);
    if (res.status === 201) remember(bot, res);
    return res;
  };

  // ── 0. La configuración que se crea por primera vez respeta lo que se pide ──
  // Se usa un cliente desechable propio para ejercer la PRIMERA escritura de la
  // configuración NOM (el cliente del reparto pudo haberla creado ya otro flujo).
  const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  const scratchSlug = `qa-${stamp}-j`;
  const scratchAdminUser = `${scratchSlug}.admin`;
  const scratchPass = `Qa-${randomBytes(6).toString("hex")}`;
  const scratchTenant = await platform.post("/tenants", {
    name: `Jornada QA ${stamp}`,
    slug: scratchSlug,
    timezone: tz,
    admin: { name: "Irene Prueba Luna", username: scratchAdminUser, password: scratchPass },
  });
  r.expect("la plataforma da de alta un cliente auxiliar para la configuración inicial", scratchTenant, 201);
  let scratchAdmin: Bot | null = null;
  let scratchEmployee: Bot | null = null;
  if (scratchTenant.status === 201) {
    scratchAdmin = await new Bot("Admin auxiliar", scratchAdminUser, scratchPass, scratchSlug, "CLIENT_ADMIN").login();
    const firstPut = await scratchAdmin.put("/nom/config", {
      remotePunchEnabled: true,
      blockRemoteWithoutAgreement: false,
      remoteCountsForWorkday: false,
    });
    r.expect("el admin guarda por primera vez la configuración NOM", firstPut, 200);
    const respected =
      firstPut.body?.blockRemoteWithoutAgreement === false && firstPut.body?.remoteCountsForWorkday === false;
    r.check(
      "la primera configuración guarda blockRemoteWithoutAgreement y remoteCountsForWorkday tal como se pidieron",
      respected,
      `respuesta: blockRemoteWithoutAgreement=${firstPut.body?.blockRemoteWithoutAgreement}, remoteCountsForWorkday=${firstPut.body?.remoteCountsForWorkday}`
    );
    if (!respected) {
      r.finding(
        "ALTA",
        "La primera escritura de la configuración NOM ignora blockRemoteWithoutAgreement/remoteCountsForWorkday",
        `PUT /nom/config {remotePunchEnabled:true, blockRemoteWithoutAgreement:false, remoteCountsForWorkday:false} en un cliente sin configuración responde 200 con blockRemoteWithoutAgreement=${firstPut.body?.blockRemoteWithoutAgreement}, remoteCountsForWorkday=${firstPut.body?.remoteCountsForWorkday}. El upsert de NomSettingsService.update solo pone en 'create' los límites, tolerancias y remotePunchEnabled; el cliente cree que apagó el candado del acuerdo y los empleados siguen recibiendo 403 REMOTE_AGREEMENT_REQUIRED (hay que guardar dos veces). Responsable: api/src/modules/nom/services/nom-settings.service.ts:263-274 (rama create del upsert).`
      );
      const secondPut = await scratchAdmin.put("/nom/config", { blockRemoteWithoutAgreement: false });
      r.expect("al guardar por segunda vez el candado del acuerdo sí se apaga", secondPut, 200);
    }
    const scratchUser = `${scratchSlug}.emp`;
    const scratchEmpPass = `Qa-${randomBytes(6).toString("hex")}`;
    const created = await scratchAdmin.post("/users", {
      username: scratchUser,
      password: scratchEmpPass,
      name: "Sergio Auxiliar Paz",
      role: "CLIENT_STAFF",
      employeeNumber: "701",
    });
    r.expect("el admin auxiliar da de alta a un empleado", created, 201);
    if (created.status === 201) {
      scratchEmployee = await new Bot("Sergio", scratchUser, scratchEmpPass, scratchSlug, "CLIENT_STAFF").login();
    }
  }

  // ── 1. Configuración NOM del cliente del reparto ──
  const initialConfig = await admin.get("/nom/config");
  r.expect("el admin consulta la configuración NOM", initialConfig, 200);
  const restore = {
    remotePunchEnabled: initialConfig.body?.remotePunchEnabled ?? true,
    blockRemoteWithoutAgreement: initialConfig.body?.blockRemoteWithoutAgreement ?? true,
  };
  const employeeCanReadConfig = await lucia.get("/nom/config");
  r.check("un empleado no lee la configuración NOM del cliente", employeeCanReadConfig.status === 403, brief(employeeCanReadConfig));
  const employeeWritesConfig = await lucia.put("/nom/config", { remotePunchEnabled: true });
  r.expect("un empleado no puede cambiar la configuración NOM", employeeWritesConfig, 403);
  const badConfig = await admin.put("/nom/config", { remotePunchEnabled: "si" });
  r.expect("configuración con tipo inválido rechazada", badConfig, 400, "VALIDATION_ERROR");

  const off = await admin.put("/nom/config", { remotePunchEnabled: false });
  r.expect("el admin apaga el marcaje remoto", off, 200);
  r.check("la configuración refleja marcaje remoto apagado", off.body?.remotePunchEnabled === false, JSON.stringify(off.body?.remotePunchEnabled));
  await punch(lucia, { type: "ENTRY" }, "con marcaje remoto apagado Lucía no puede checar desde la app", 403, "REMOTE_PUNCH_DISABLED");

  const on = await admin.put("/nom/config", { remotePunchEnabled: true, blockRemoteWithoutAgreement: true });
  r.expect("el admin enciende el marcaje remoto y exige acuerdo de método", on, 200);
  r.check(
    "la configuración refleja marcaje encendido y acuerdo exigido",
    on.body?.remotePunchEnabled === true && on.body?.blockRemoteWithoutAgreement === true,
    JSON.stringify({ remotePunchEnabled: on.body?.remotePunchEnabled, block: on.body?.blockRemoteWithoutAgreement })
  );

  // ── 2. Modo de checada por persona ──
  for (const bot of [lucia, marco, daniela]) {
    const res = await hr.patch(`/hr/${bot.id}/profile`, { checkinMode: "HYBRID" });
    r.expect(`RH deja a ${bot.label} en modo híbrido (reloj y app)`, res, 200);
  }
  for (const bot of [oscar, fernanda, jorge]) {
    const res = await hr.patch(`/hr/${bot.id}/profile`, { checkinMode: "WEB" });
    r.expect(`RH deja a ${bot.label} en modo app/web`, res, 200);
  }
  const badMode = await hr.patch(`/hr/${lucia.id}/profile`, { checkinMode: "TELEPATIA" });
  r.expect("modo de checada inexistente rechazado", badMode, 400);
  const selfMode = await lucia.patch(`/hr/${lucia.id}/profile`, { checkinMode: "WEB" });
  r.check("un empleado no cambia su propio modo de checada", selfMode.status === 403, brief(selfMode));

  // Persona extra del flujo: modo solo reloj (ya no bloquea el marcaje) y luego
  // app para probar el primer paso del día fuera de orden.
  const paolaUser = `${cast.file.tenant.slug}.paola.vargas`;
  const paolaPass = `Qa-${randomBytes(6).toString("hex")}`;
  const paolaCreated = await admin.post("/users", {
    username: paolaUser,
    password: paolaPass,
    name: "Paola Vargas Reyes",
    role: "CLIENT_STAFF",
    employeeNumber: "291",
    jobTitle: "Auxiliar de almacén",
    departmentId: cast.file.departments.almacen,
  });
  r.expect("el admin da de alta a Paola (persona extra del flujo jornada)", paolaCreated, 201);
  const paola = paolaCreated.status === 201
    ? await new Bot("Paola", paolaUser, paolaPass, cast.file.tenant.slug, "CLIENT_STAFF").login()
    : null;
  if (paola) {
    const clockOnly = await hr.patch(`/hr/${paola.id}/profile`, { checkinMode: "CLOCK" });
    r.expect("RH deja a Paola en modo solo reloj", clockOnly, 200);
    await punch(paola, { type: "ENTRY" }, "en modo solo reloj Paola sigue sujeto al acuerdo de método", 403, "REMOTE_AGREEMENT_REQUIRED");
  }

  // ── 3. Acuerdo del método de registro ──
  await punch(lucia, { type: "ENTRY" }, "sin acuerdo aceptado Lucía no puede checar desde la app", 403, "REMOTE_AGREEMENT_REQUIRED");
  const proposal = await lucia.get("/nom/me/record-agreement/proposal");
  r.expect("Lucía consulta la propuesta de acuerdo de método", proposal, 200);
  r.check("la propuesta incluye el método REMOTE", Array.isArray(proposal.body?.methods) && proposal.body.methods.includes("REMOTE"), JSON.stringify(proposal.body?.methods));
  const noAgreement = await lucia.get("/nom/me/record-agreement");
  r.check("antes de aceptar Lucía no tiene acuerdo", noAgreement.status === 200 && !noAgreement.body?.acceptedAt, brief(noAgreement));
  const badMethods = await lucia.post("/nom/me/record-agreement/accept", { methods: ["TELEPATIA"] });
  r.expect("acuerdo con método inexistente rechazado", badMethods, 400, "INVALID_RECORD_METHODS");
  const clockOnlyAgreement = await lucia.post("/nom/me/record-agreement/accept", {
    methods: ["CLOCK"],
    roundingPolicy: "Minutos exactos",
    correctionRules: "Ajuste aprobado",
  });
  r.expect("Lucía acepta primero un acuerdo solo de reloj", clockOnlyAgreement, 200);
  await punch(lucia, { type: "ENTRY" }, "con acuerdo sin REMOTE Lucía sigue sin poder checar desde la app", 403, "REMOTE_AGREEMENT_REQUIRED");
  for (const bot of [...employees, ...(paola ? [paola] : [])]) {
    const res = await bot.post("/nom/me/record-agreement/accept", {
      methods: ["CLOCK", "REMOTE"],
      roundingPolicy: "Minutos exactos",
      correctionRules: "Toda corrección pasa por ajuste documentado y aprobado",
    });
    r.expect(`${bot.label} acepta el acuerdo de método con REMOTE`, res, 200);
  }
  const luciaAgreement = await lucia.get("/nom/me/record-agreement");
  r.check(
    "el acuerdo de Lucía queda aceptado con CLOCK y REMOTE",
    Boolean(luciaAgreement.body?.acceptedAt) && JSON.stringify(luciaAgreement.body?.methods) === JSON.stringify(["CLOCK", "REMOTE"]),
    brief(luciaAgreement)
  );
  if (paola) {
    // El modo preferido del empleado ya no apaga los canales del cliente: quien
    // está en modo solo reloj puede marcar por web/app si el cliente los contrató.
    const paolaTelework = await paola.get("/nom/me/telework");
    r.check(
      "en modo solo reloj Paola puede checar por web/app: mandan los canales del cliente, no el modo",
      paolaTelework.body?.canPunchRemote === true && paolaTelework.body?.canPunchWeb === true,
      brief(paolaTelework)
    );
  }

  // ── 4. El día de cada empleado ──
  // Lucía: presencial con GPS, comida completa, envío offline con reintento.
  const luciaEvent = randomUUID();
  const reportedAt = new Date(Date.now() - 90_000).toISOString();
  const luciaGeo = { latitude: 19.4326, longitude: -99.1332, gpsAccuracyMeters: 12 };
  const firstTry = await punch(
    lucia,
    { type: "ENTRY", extra: { workMode: "PRESENCIAL", clientEventId: luciaEvent, clientReportedAt: reportedAt, ...luciaGeo } },
    "Lucía registra su entrada presencial con GPS (envío offline)"
  );
  const luciaEntryId: string | undefined = firstTry.body?.punch?.id;
  r.check("la hora de la checada es la del servidor, no la del teléfono", Boolean(firstTry.body?.punch?.occurredAt) && firstTry.body.punch.occurredAt !== reportedAt, JSON.stringify(firstTry.body?.punch));
  r.check("se guarda clientReportedAt del teléfono", firstTry.body?.punch?.clientReportedAt === reportedAt, `clientReportedAt=${firstTry.body?.punch?.clientReportedAt}`);
  r.check("se guarda la ubicación de Lucía", firstTry.body?.punch?.latitude === luciaGeo.latitude && firstTry.body?.punch?.longitude === luciaGeo.longitude, JSON.stringify(firstTry.body?.punch));
  r.check("el modo de trabajo queda PRESENCIAL", firstTry.body?.punch?.workMode === "PRESENCIAL", firstTry.body?.punch?.workMode);
  const retry = await lucia.post("/nom/me/punch", {
    type: "ENTRY",
    workMode: "PRESENCIAL",
    clientEventId: luciaEvent,
    clientReportedAt: reportedAt,
    ...luciaGeo,
  });
  r.expect("el reintento offline con el mismo clientEventId responde 200", retry, 200);
  r.check("el reintento no duplica (created:false, misma checada)", retry.body?.created === false && retry.body?.punch?.id === luciaEntryId, brief(retry));
  const outOfOrder = await punch(lucia, { type: "LUNCH_END" }, "Lucía marca regreso de comida sin haber salido: fuera de orden", 409, "INVALID_PUNCH_SEQUENCE");
  const seqMessage: string = outOfOrder.body?.message ?? "";
  const misleading = /abierto de tipo LUNCH_END/.test(seqMessage);
  r.check("el mensaje de secuencia describe lo que está abierto (la entrada), no lo que se intentó", !misleading, seqMessage);
  if (misleading) {
    r.finding(
      "BAJA",
      "El mensaje de INVALID_PUNCH_SEQUENCE dice que está abierto el tipo que se intentó marcar",
      `Con una ENTRY abierta, POST /nom/me/punch {type:"LUNCH_END"} → 409 INVALID_PUNCH_SEQUENCE con mensaje "${seqMessage}". Lo abierto es la entrada y lo esperado es ${JSON.stringify(outOfOrder.body?.details?.expected ?? outOfOrder.body?.expected ?? ["LUNCH_START", "EXIT"])}; el mensaje confunde al trabajador. Responsable: api/src/modules/nom/services/remote-punch.service.ts:127-128 (pasa type: input.type) y api/src/core/i18n/messages/es.ts:472 ("Ya tienes un registro abierto de tipo {{type}}").`
    );
  }
  await punch(lucia, { type: "ENTRY" }, "Lucía marca una segunda entrada: fuera de orden", 409, "INVALID_PUNCH_SEQUENCE");
  await punch(lucia, { type: "LUNCH_START", extra: { workMode: "PRESENCIAL", ...luciaGeo } }, "Lucía sale a comer");
  await punch(lucia, { type: "EXIT" }, "Lucía intenta salir estando en comida: fuera de orden", 409, "INVALID_PUNCH_SEQUENCE");
  await punch(lucia, { type: "ENTRY" }, "Lucía intenta entrar estando en comida: fuera de orden", 409, "INVALID_PUNCH_SEQUENCE");
  await punch(lucia, { type: "LUNCH_END", extra: { workMode: "PRESENCIAL", ...luciaGeo } }, "Lucía regresa de comer");
  await punch(lucia, { type: "EXIT", extra: { workMode: "PRESENCIAL", ...luciaGeo, note: "Cierre de inventario" } }, "Lucía registra su salida");
  await punch(lucia, { type: "ENTRY" }, "tras la salida Lucía no puede abrir otro ciclo", 409, "WORKDAY_ALREADY_CLOSED");
  await punch(lucia, { type: "LUNCH_START" }, "tras la salida Lucía no puede salir a comer", 409, "WORKDAY_ALREADY_CLOSED");
  const lateRetry = await lucia.post("/nom/me/punch", { type: "ENTRY", workMode: "PRESENCIAL", clientEventId: luciaEvent, clientReportedAt: reportedAt, ...luciaGeo });
  r.check("un reintento tardío de la entrada tras cerrar el día sigue siendo idempotente", lateRetry.status === 200 && lateRetry.body?.punch?.id === luciaEntryId, brief(lateRetry));

  // Marco: campo con GPS, sin comida.
  await punch(marco, { type: "ENTRY", extra: { workMode: "CAMPO", latitude: 20.6597 } }, "Marco manda solo latitud: coordenada incompleta", 400, "INVALID_GEO_POINT");
  await punch(marco, { type: "ENTRY", extra: { workMode: "CAMPO", longitude: -103.3496 } }, "Marco manda solo longitud: coordenada incompleta", 400, "INVALID_GEO_POINT");
  await punch(marco, { type: "ENTRY", extra: { workMode: "CAMPO", latitude: 95, longitude: -103.3 } }, "latitud fuera de rango rechazada", 400, "VALIDATION_ERROR");
  const marcoEntry = await punch(
    marco,
    { type: "ENTRY", extra: { workMode: "CAMPO", latitude: 20.6597, longitude: -103.3496, gpsAccuracyMeters: 30, note: "Ruta de entregas zona sur" } },
    "Marco registra su entrada en campo con GPS y nota"
  );
  r.check("la nota de Marco queda en su checada", marcoEntry.body?.punch?.note === "Ruta de entregas zona sur", JSON.stringify(marcoEntry.body?.punch?.note));
  r.check("el modo de trabajo de Marco queda CAMPO", marcoEntry.body?.punch?.workMode === "CAMPO", marcoEntry.body?.punch?.workMode);
  await punch(marco, { type: "LUNCH_END" }, "Marco marca regreso de comida sin comida: fuera de orden", 409, "INVALID_PUNCH_SEQUENCE");
  await punch(marco, { type: "EXIT", extra: { workMode: "CAMPO", latitude: 20.67, longitude: -103.35 } }, "Marco sale sin haber comido (entrada → salida)");
  await punch(marco, { type: "EXIT" }, "Marco intenta una segunda salida", 409, "WORKDAY_ALREADY_CLOSED");

  // Daniela: presencial sin GPS; se queda en comida.
  await punch(daniela, { type: "ENTRY", extra: { workMode: "PRESENCIAL" } }, "Daniela registra su entrada presencial sin ubicación");
  await punch(daniela, { type: "LUNCH_START", extra: { workMode: "PRESENCIAL" } }, "Daniela sale a comer (y sigue en comida)");

  // Óscar: remoto sin GPS, comida completa.
  const oscarEntry = await punch(oscar, { type: "ENTRY", extra: { workMode: "REMOTO" } }, "Óscar registra su entrada remota sin ubicación");
  const oscarEntryId: string | undefined = oscarEntry.body?.punch?.id;
  r.check("la checada de Óscar no trae ubicación", oscarEntry.body?.punch?.latitude === null && oscarEntry.body?.punch?.longitude === null, JSON.stringify(oscarEntry.body?.punch));
  await punch(oscar, { type: "LUNCH_START", extra: { workMode: "REMOTO" } }, "Óscar sale a comer");
  await punch(oscar, { type: "LUNCH_END", extra: { workMode: "REMOTO" } }, "Óscar regresa de comer");
  await punch(oscar, { type: "EXIT", extra: { workMode: "REMOTO" } }, "Óscar registra su salida");

  // Fernanda: remoto con GPS; se queda trabajando. DTO estricto.
  const unknownKey = await fernanda.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO", clientEventId: randomUUID(), deviceId: "pixel-7" });
  r.expect("cuerpo con clave desconocida rechazado (DTO estricto)", unknownKey, 400, "VALIDATION_ERROR");
  const badType = await fernanda.post("/nom/me/punch", { type: "BREAK", clientEventId: randomUUID() });
  r.expect("tipo de checada inexistente rechazado", badType, 400, "VALIDATION_ERROR");
  const badMode2 = await fernanda.post("/nom/me/punch", { type: "ENTRY", workMode: "LUNA", clientEventId: randomUUID() });
  r.expect("modo de trabajo inexistente rechazado", badMode2, 400, "VALIDATION_ERROR");
  const badEvent = await fernanda.post("/nom/me/punch", { type: "ENTRY", clientEventId: "no-es-uuid" });
  r.expect("clientEventId que no es UUID rechazado", badEvent, 400, "VALIDATION_ERROR");
  const missingEvent = await fernanda.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO" });
  r.expect("checada remota sin clientEventId rechazada (ahora es obligatorio)", missingEvent, 400, "VALIDATION_ERROR");
  const badReported = await fernanda.post("/nom/me/punch", { type: "ENTRY", clientEventId: randomUUID(), clientReportedAt: "ayer en la tarde" });
  r.expect("clientReportedAt que no es fecha rechazado", badReported, 400, "VALIDATION_ERROR");
  const fernandaEvent = randomUUID();
  await punch(
    fernanda,
    { type: "ENTRY", extra: { workMode: "REMOTO", latitude: 19.3910, longitude: -99.2837, clientEventId: fernandaEvent } },
    "Fernanda registra su entrada remota con GPS (sigue trabajando)"
  );

  // Jorge: sin modo (default), con nota; prueba reuso de clientEventId ajeno.
  const stolen = await jorge.post("/nom/me/punch", { type: "ENTRY", clientEventId: luciaEvent });
  const leaked = stolen.status === 200 && stolen.body?.punch?.id === luciaEntryId;
  r.check(
    "Jorge con un clientEventId que ya usó otra persona no recibe la checada de ella",
    !leaked,
    brief(stolen)
  );
  if (leaked) {
    r.finding(
      "ALTA",
      "La idempotencia por clientEventId no está acotada a la persona: devuelve la checada de otro empleado",
      `POST /nom/me/punch como Jorge con {type:"ENTRY", clientEventId:<el de la entrada de Lucía>} → 200 created:false con la checada de Lucía (id, hora, latitud/longitud de su ubicación). Jorge ve datos sensibles ajenos (geolocalización) y su entrada NO se registra aunque la app la da por buena. Responsable: api/src/modules/nom/services/remote-punch.service.ts:99-104 (findUnique por clientEventId sin filtrar userId) y :161-165 (mismo patrón en el catch P2002).`
    );
  } else if (stolen.status === 201) {
    remember(jorge, stolen);
  }
  const jorgeHasEntry = (recorded.get(jorge.id) ?? []).length > 0;
  const jorgeEntry = jorgeHasEntry
    ? stolen
    : await punch(jorge, { type: "ENTRY", extra: { note: "Entro tarde por cita en el SAT" } }, "Jorge registra su entrada sin modo de trabajo y con nota");
  r.check("sin modo de trabajo la checada queda como REMOTO", jorgeEntry.body?.punch?.workMode === "REMOTO", jorgeEntry.body?.punch?.workMode);
  await punch(jorge, { type: "EXIT", extra: { note: "Salgo a junta con proveedor" } }, "Jorge sale sin comer (entrada → salida)");

  // Persona del cliente auxiliar intenta reusar el clientEventId de Lucía.
  if (scratchEmployee) {
    await scratchEmployee.post("/nom/me/record-agreement/accept", { methods: ["CLOCK", "REMOTE"] });
    const cross = await scratchEmployee.post("/nom/me/punch", { type: "ENTRY", clientEventId: luciaEvent });
    const crossLeak = cross.body?.punch?.id === luciaEntryId;
    r.check("un empleado de otro cliente con el mismo clientEventId no ve la checada de Lucía", !crossLeak, brief(cross));
    r.check(
      "un clientEventId repetido en otro cliente no provoca un error 500",
      cross.status < 500,
      brief(cross)
    );
    if (crossLeak) {
      r.finding("BLOQUEANTE", "Fuga entre clientes por clientEventId", `POST /nom/me/punch en ${scratchSlug} con el clientEventId de Lucía devuelve su checada: ${brief(cross)}`);
    } else if (cross.status >= 500) {
      r.finding(
        "MEDIA",
        "Checada offline con clientEventId ya usado en otro cliente responde 500",
        `POST /nom/me/punch {type:"ENTRY", clientEventId:<uuid ya usado en otro cliente>} → ${brief(cross)}. El índice único de clientEventId es global pero la búsqueda previa está acotada al cliente (RLS): el create choca (P2002), el reintento no encuentra la fila y se relanza el error. La app reintentaría para siempre. Responsable: api/src/modules/nom/services/remote-punch.service.ts (catch P2002 en record) + índice único global de remote_punches.client_event_id en prisma/schema.prisma.`
      );
    }
  }

  // Primer paso del día fuera de orden (Paola en modo app).
  if (paola) {
    const toWeb = await hr.patch(`/hr/${paola.id}/profile`, { checkinMode: "WEB" });
    r.expect("RH pasa a Paola a modo app/web", toWeb, 200);
    const firstLunch = await paola.post("/nom/me/punch", { type: "LUNCH_START", clientEventId: randomUUID() });
    r.check("el primer paso del día no puede ser salida a comer", firstLunch.status === 409 && codeOf(firstLunch) === "INVALID_PUNCH_SEQUENCE", brief(firstLunch));
    const firstExit = firstLunch.status === 201 ? null : await paola.post("/nom/me/punch", { type: "EXIT", clientEventId: randomUUID() });
    if (firstExit) r.check("el primer paso del día no puede ser salida", firstExit.status === 409 && codeOf(firstExit) === "INVALID_PUNCH_SEQUENCE", brief(firstExit));
    if (firstLunch.status === 201 || firstExit?.status === 201) {
      r.finding(
        "ALTA",
        "El primer marcaje del día no exige ENTRY: se acepta salida o comida sin entrada",
        `Sin checadas previas hoy, POST /nom/me/punch {type:"${firstLunch.status === 201 ? "LUNCH_START" : "EXIT"}"} → 201. La regla de secuencia solo se aplica si ya hay una checada hoy (lastIsToday); con el primer paso cualquier tipo pasa. Un EXIT como primer marcaje además cierra el día y la persona ya no puede registrar su entrada (409 WORKDAY_ALREADY_CLOSED). Responsable: api/src/modules/nom/services/remote-punch.service.ts:119 (la regla solo corre "if (lastIsToday)"; sin checadas hoy no se exige ENTRY).`
      );
      const after = await paola.post("/nom/me/punch", { type: "ENTRY", clientEventId: randomUUID() });
      r.check("tras ese primer paso erróneo Paola aún puede registrar su entrada", after.status === 201, `${brief(after)} — sin ENTRY su día queda sin entrada y solo se le permite ${firstLunch.status === 201 ? "LUNCH_END" : "nada (día cerrado)"}`);
    }
  }

  // ── 5. Cada quien consulta sus marcajes ──
  const allIds = new Map<string, string>();
  for (const [userId, ids] of recorded) for (const id of ids) allIds.set(id, userId);
  for (const bot of employees) {
    const mine = await bot.get(`/nom/me/punches?from=${today}&to=${today}`);
    r.expect(`${bot.label} consulta sus marcajes de hoy`, mine, 200);
    const rows = list(mine.body);
    const ids = new Set(rows.map((p: any) => p.id));
    const expected = recorded.get(bot.id) ?? [];
    r.check(`${bot.label} ve sus ${expected.length} checadas`, expected.every((id) => ids.has(id)) && rows.filter((p: any) => p.source === "REMOTE").length === expected.length, `esperaba ${expected.length}, ve ${rows.length}: ${JSON.stringify(rows.map((p: any) => p.type))}`);
    const foreign = rows.filter((p: any) => allIds.has(p.id) && allIds.get(p.id) !== bot.id);
    r.check(`${bot.label} no ve checadas de otras personas`, foreign.length === 0, JSON.stringify(foreign));
  }
  const luciaRows = list((await lucia.get(`/nom/me/punches?from=${today}&to=${today}`)).body);
  const luciaEntryRow = luciaRows.find((p: any) => p.id === luciaEntryId);
  r.check("en sus marcajes Lucía ve su ubicación y el modo PRESENCIAL", luciaEntryRow?.latitude === luciaGeo.latitude && luciaEntryRow?.method === "PRESENCIAL", JSON.stringify(luciaEntryRow));
  const badRange = await lucia.get("/nom/me/punches?from=08-11-2026");
  r.expect("rango de fechas mal formado rechazado", badRange, 400, "VALIDATION_ERROR");
  const foreignQuery = await lucia.get(`/nom/me/punches?from=${today}&to=${today}&userId=${oscar.id}`);
  const foreignRows = list(foreignQuery.body).filter((p: any) => allIds.get(p.id) === oscar.id);
  r.check("Lucía no puede ver los marcajes de Óscar pasando su userId", foreignRows.length === 0, `${foreignRows.length} checadas de Óscar`);
  const intruderMine = await intruderEmployee.get(`/nom/me/punches?from=${today}&to=${today}`);
  r.check("el empleado intruso no ve checadas de este cliente", list(intruderMine.body).every((p: any) => !allIds.has(p.id)), brief(intruderMine));

  // ── 6. Discrepancia → ajuste → aprobación por otra persona ──
  if (oscarEntryId) {
    const expectedAt = new Date(Date.now() - 25 * 60_000).toISOString();
    const foreignReport = await marco.post("/nom/me/discrepancies", {
      punchId: oscarEntryId,
      reason: "Esa entrada es mía, la registré tarde",
    });
    r.expect("Marco no puede reportar discrepancia sobre la checada de Óscar", foreignReport, 403, "NOT_YOUR_PUNCH");
    const intruderReport = await intruderEmployee.post("/nom/me/discrepancies", {
      punchId: oscarEntryId,
      reason: "Quiero corregir esta checada",
    });
    r.check("el empleado intruso no puede reportar sobre la checada de Óscar", intruderReport.status === 404 || intruderReport.status === 403, brief(intruderReport));
    const shortReason = await oscar.post("/nom/me/discrepancies", { punchId: oscarEntryId, reason: "mal" });
    r.expect("discrepancia con motivo demasiado corto rechazada", shortReason, 400, "VALIDATION_ERROR");
    const extraKey = await oscar.post("/nom/me/discrepancies", { punchId: oscarEntryId, reason: "Se cayó el internet al entrar", status: "APPROVED" });
    r.expect("discrepancia con claves desconocidas rechazada", extraKey, 400, "VALIDATION_ERROR");

    const reported = await oscar.post("/nom/me/discrepancies", {
      punchId: oscarEntryId,
      reason: "Se cayó el internet al entrar; empecé 25 minutos antes",
      expectedOccurredAt: expectedAt,
    });
    r.expect("Óscar reporta una discrepancia sobre su entrada", reported, 201);
    const discrepancyId: string | undefined = reported.body?.id;
    r.check("la discrepancia queda pendiente", reported.body?.status === "PENDING", reported.body?.status);

    const oscarList = await oscar.get("/nom/me/discrepancies");
    r.check("Óscar ve su discrepancia pendiente", list(oscarList.body).some((d: any) => d.id === discrepancyId && d.status === "PENDING"), brief(oscarList));
    const marcoList = await marco.get("/nom/me/discrepancies");
    r.check("Marco no ve la discrepancia de Óscar", list(marcoList.body).every((d: any) => d.id !== discrepancyId), brief(marcoList));

    const oscarApproves = await oscar.post(`/nom/adjustments/${discrepancyId}/approve`, {});
    r.expect("Óscar no puede aprobar su propia discrepancia", oscarApproves, 403);
    const pending = await hr.get("/nom/adjustments?status=PENDING");
    r.expect("RH consulta los ajustes pendientes", pending, 200);
    r.check("RH ve la discrepancia de Óscar", list(pending.body).some((a: any) => a.id === discrepancyId), brief(pending));

    const proposed = await hr.post(`/nom/punches/${oscarEntryId}/adjustments`, {
      reason: "Validado con el registro del VPN de Óscar",
      occurredAt: expectedAt,
      workMode: "REMOTO",
    });
    r.expect("RH propone el ajuste de la entrada de Óscar", proposed, 201);
    const adjustmentId: string | undefined = proposed.body?.id;
    const noChanges = await hr.post(`/nom/punches/${oscarEntryId}/adjustments`, { reason: "Sin cambios reales" });
    r.expect("un ajuste sin cambios se rechaza", noChanges, 400, "PUNCH_ADJUSTMENT_NO_CHANGES");
    const employeeAdjusts = await oscar.post(`/nom/punches/${oscarEntryId}/adjustments`, { reason: "Me lo ajusto yo mismo", occurredAt: expectedAt });
    r.expect("un empleado no puede crear ajustes directos", employeeAdjusts, 403);

    const hrSelf = await hr.post(`/nom/adjustments/${adjustmentId}/approve`, {});
    r.expect("RH no puede aprobar el ajuste que propuso", hrSelf, 403, "SELF_APPROVAL_FORBIDDEN");
    const intruderApproves = await intruderAdmin.post(`/nom/adjustments/${adjustmentId}/approve`, {});
    r.expect("el admin intruso no puede aprobar el ajuste", intruderApproves, 404);
    const approved = await admin.post(`/nom/adjustments/${adjustmentId}/approve`, { note: "Visto con Óscar" });
    r.expect("el admin aprueba el ajuste de RH", approved, 200);
    r.check("el ajuste queda aprobado por el admin", approved.body?.status === "APPROVED" && approved.body?.decidedById === admin.id, brief(approved));
    const twice = await admin.post(`/nom/adjustments/${adjustmentId}/approve`, {});
    r.expect("el ajuste no se puede aprobar dos veces", twice, 409, "PUNCH_ADJUSTMENT_NOT_PENDING");
    const rejectedDup = await hr.post(`/nom/adjustments/${discrepancyId}/reject`, { note: "Atendida con el ajuste de RH" });
    r.expect("RH cierra la discrepancia del empleado como atendida", rejectedDup, 200);

    const history = await hr.get(`/nom/punches/${oscarEntryId}/history`);
    r.expect("RH consulta el historial de la checada de Óscar", history, 200);
    r.check("la checada original no cambia (append-only)", history.body?.punch?.occurredAt === oscarEntry.body?.punch?.occurredAt, `original=${oscarEntry.body?.punch?.occurredAt} ahora=${history.body?.punch?.occurredAt}`);
    r.check("el valor vigente aplica el ajuste aprobado", history.body?.effective?.occurredAt === expectedAt && JSON.stringify(history.body?.effective?.appliedAdjustmentIds) === JSON.stringify([adjustmentId]), JSON.stringify(history.body?.effective));
    const adjustmentsInHistory = list(history.body?.adjustments);
    r.check("el historial trae la discrepancia y el ajuste con su estado", adjustmentsInHistory.length === 2 && adjustmentsInHistory.some((a: any) => a.id === discrepancyId && a.status === "REJECTED") && adjustmentsInHistory.some((a: any) => a.id === adjustmentId && a.status === "APPROVED"), JSON.stringify(adjustmentsInHistory.map((a: any) => [a.status, a.requestedByName])));
    const historyAudit = list(history.body?.audit);
    const auditRes = await admin.get(`/audit?entityType=RemotePunch&entityId=${oscarEntryId}&limit=50`);
    const auditActions = list(auditRes.body).map((a: any) => a.action);
    r.check(
      "la bitácora de auditoría registra marcaje, discrepancia, ajuste y aprobación",
      ["REMOTE_PUNCH_RECORDED", "PUNCH_DISCREPANCY_REPORTED", "PUNCH_ADJUSTMENT_REQUESTED", "PUNCH_ADJUSTMENT_APPROVED"].every((a) => auditActions.includes(a)),
      `${auditRes.status} acciones=${JSON.stringify(auditActions)}`
    );
    r.check("el historial de la checada remota muestra su pista de auditoría", historyAudit.length > 0, `audit=${JSON.stringify(history.body?.audit)}`);
    if (historyAudit.length === 0 && auditActions.length > 0) {
      r.finding(
        "MEDIA",
        "El historial de una checada remota siempre trae la auditoría vacía",
        `GET /nom/punches/${"{id}"}/history de una checada de la app responde audit:[] aunque /audit?entityType=RemotePunch&entityId=… sí tiene ${auditActions.length} eventos (${auditActions.join(", ")}). Para checadas de reloj sí se arma la pista. RH no ve en la ficha de la checada quién marcó, reportó, ajustó y aprobó. Responsable: api/src/modules/nom/services/punch-adjustments.service.ts:188 (rama REMOTE de history devuelve "audit: []").`
      );
    }
    const intruderHistory = await intruderAdmin.get(`/nom/punches/${oscarEntryId}/history`);
    r.expect("el admin intruso no ve el historial de la checada de Óscar", intruderHistory, 404, "PUNCH_NOT_FOUND");
    const intruderAdjust = await intruderAdmin.post(`/nom/punches/${oscarEntryId}/adjustments`, { reason: "Ajuste malintencionado", occurredAt: expectedAt });
    r.expect("el admin intruso no puede ajustar la checada de Óscar", intruderAdjust, 404, "PUNCH_NOT_FOUND");
    const intruderAdjList = await intruderAdmin.get("/nom/adjustments");
    r.check("el admin intruso no ve los ajustes de este cliente", list(intruderAdjList.body).every((a: any) => a.id !== adjustmentId && a.id !== discrepancyId), brief(intruderAdjList));
    const intruderAudit = await intruderAdmin.get(`/audit?entityId=${oscarEntryId}`);
    r.check("el admin intruso no ve la auditoría de la checada de Óscar", list(intruderAudit.body).length === 0, brief(intruderAudit));

    const oscarAfter = await oscar.get("/nom/me/discrepancies");
    r.check("Óscar ve su discrepancia ya resuelta", list(oscarAfter.body).some((d: any) => d.id === discrepancyId && d.status !== "PENDING"), brief(oscarAfter));
    const oscarPunches = list((await oscar.get(`/nom/me/punches?from=${today}&to=${today}`)).body);
    const oscarEntryRow = oscarPunches.find((p: any) => p.id === oscarEntryId);
    r.check("en sus marcajes Óscar ve la hora corregida de su entrada", oscarEntryRow?.occurredAt === expectedAt, `ve ${oscarEntryRow?.occurredAt}, ajuste aprobado ${expectedAt}`);
    if (oscarEntryRow && oscarEntryRow.occurredAt !== expectedAt) {
      r.finding(
        "BAJA",
        "El trabajador sigue viendo la hora original tras aprobarse su corrección",
        `GET /nom/me/punches devuelve la entrada de Óscar con occurredAt=${oscarEntryRow.occurredAt}; el ajuste aprobado la deja en ${expectedAt} (history.effective). No hay campo de valor vigente ni marca de "corregida". Responsable: api/src/modules/nom/services/punch-adjustments.service.ts:379-384 (myPunches lee remotePunch.occurredAt sin aplicar ajustes aprobados).`
      );
    }

    // ── 7. Asistencia del día para RH/admin ──
    const board = await admin.get("/dashboard/attendance-today");
    r.expect("el admin consulta la asistencia de hoy", board, 200);
    const rowsOf = (res: Res) => list(res.body?.rows ?? res.body);
    const byId = new Map(rowsOf(board).map((row: any) => [row.userId ?? row.id, row]));
    const present = [lucia, marco, daniela, oscar, fernanda, jorge];
    for (const bot of present) {
      const row: any = byId.get(bot.id);
      r.check(`${bot.label} aparece como presente hoy`, row?.status === "PRESENT" || row?.status === "LATE", JSON.stringify(row ?? null));
    }
    const fernandaRow: any = byId.get(fernanda.id);
    r.check("Fernanda (entrada sin salida) aparece en sitio", fernandaRow?.onSite === true, JSON.stringify(fernandaRow ?? null));
    if (fernandaRow && fernandaRow.status !== "PRESENT" && fernandaRow.status !== "LATE") {
      r.finding(
        "ALTA",
        "Quien checó entrada desde la app y sigue trabajando no aparece presente ni en sitio",
        `Fernanda registró ENTRY (201) por /nom/me/punch y no ha salido. GET /dashboard/attendance-today la muestra con status=${fernandaRow.status}, onSite=${fernandaRow.onSite}, entryAt=${fernandaRow.entryAt}. La asistencia arma sesiones remotas solo cuando hay un cierre (LUNCH_START/EXIT); una entrada abierta no produce sesión, así que el tablero dice que no ha llegado. Responsable: api/src/modules/schedules/services/weekly-attendance.service.ts (bucle de remotePunches: la sesión abierta se descarta) → people-dashboard.service.ts attendanceToday.`
      );
    }
    for (const bot of [lucia, marco, oscar, jorge, daniela]) {
      const row: any = byId.get(bot.id);
      r.check(`${bot.label} no aparece en sitio (salió o está en comida)`, row?.onSite === false, JSON.stringify(row ?? null));
    }
    const counts = board.body?.counts ?? {};
    const presentCount = (counts.PRESENT ?? 0) + (counts.LATE ?? 0);
    r.check("el conteo de presentes incluye a los 6 empleados que checaron", presentCount >= 6, `counts=${JSON.stringify(counts)}`);
    r.check("el conteo en sitio es 1 (solo Fernanda)", counts.onSite === 1, `counts=${JSON.stringify(counts)}`);
    const oscarRow: any = byId.get(oscar.id);
    r.check("la asistencia de Óscar toma la entrada corregida y aprobada", oscarRow?.entryAt === expectedAt, `entryAt=${oscarRow?.entryAt}, ajuste=${expectedAt}, original=${oscarEntry.body?.punch?.occurredAt}`);
    if (oscarRow && oscarRow.entryAt && oscarRow.entryAt !== expectedAt) {
      r.finding(
        "ALTA",
        "Los ajustes aprobados de checadas remotas no se reflejan en asistencia ni pre-nómina",
        `Ajuste aprobado de la entrada de Óscar a ${expectedAt}; GET /dashboard/attendance-today sigue mostrando entryAt=${oscarRow.entryAt} (hora original). El reporte semanal (base de pre-nómina) lee remotePunch.occurredAt sin aplicar PunchAdjustment APROBADOS, así que la corrección documentada no tiene efecto en horas trabajadas. Responsable: api/src/modules/schedules/services/weekly-attendance.service.ts (consulta de remotePunches sin ajustes).`
      );
    }
    const luciaRow: any = byId.get(lucia.id);
    r.check("Lucía tiene registradas su entrada y su salida en el tablero", Boolean(luciaRow?.entryAt) && Boolean(luciaRow?.exitAt), JSON.stringify(luciaRow ?? null));

    const hrBoard = await hr.get("/dashboard/attendance-today");
    r.expect("RH consulta la asistencia de hoy", hrBoard, 200);
    r.check("RH y el admin ven los mismos números", JSON.stringify(hrBoard.body?.counts) === JSON.stringify(board.body?.counts), `rh=${JSON.stringify(hrBoard.body?.counts)} admin=${JSON.stringify(board.body?.counts)}`);
    const employeeBoard = await lucia.get("/dashboard/attendance-today");
    const employeeSeesOthers = employeeBoard.status === 200 && rowsOf(employeeBoard).some((row: any) => (row.userId ?? row.id) !== lucia.id);
    r.check("un empleado no ve la asistencia de sus compañeros", !employeeSeesOthers, brief(employeeBoard));

    const overview = await hr.get(`/hr/${lucia.id}/overview`);
    r.expect("RH abre el expediente de Lucía", overview, 200);
    const last30 = overview.body?.summary?.punchesLast30Days;
    r.check("el expediente cuenta las checadas de Lucía desde la app", typeof last30 === "number" && last30 >= 4, `punchesLast30Days=${last30}`);
    if (last30 === 0) {
      r.finding(
        "MEDIA",
        "El expediente de RH ignora las checadas de la app",
        `Lucía tiene 4 checadas hoy desde /nom/me/punch, pero GET /hr/${"{id}"}/overview responde summary.punchesLast30Days=0 y sin checadas recientes: solo cuenta timeClockPunch. RH ve a un empleado que checa por app como si nunca checara. Responsable: api/src/modules/hr/services/employee-overview.service.ts:99-110 (punches y punchesLast30Days solo sobre timeClockPunch).`
      );
    }

    // ── 8. Aislamiento ──
    const intruderBoard = await intruderAdmin.get("/dashboard/attendance-today");
    r.expect("el admin intruso consulta su asistencia", intruderBoard, 200);
    const ours = new Set([...employees.map((b) => b.id), hr.id, ...(paola ? [paola.id] : [])]);
    r.check("el admin intruso no ve a nadie de este cliente en su asistencia", rowsOf(intruderBoard).every((row: any) => !ours.has(row.userId ?? row.id)), `${rowsOf(intruderBoard).length} filas`);
    const intruderOverview = await intruderAdmin.get(`/hr/${lucia.id}/overview`);
    r.check("el admin intruso no abre el expediente de Lucía", intruderOverview.status === 404 || intruderOverview.status === 403, brief(intruderOverview));
    const intruderTenantHeader = await intruderAdmin.get("/dashboard/attendance-today", { tenantId: cast.file.tenant.id });
    r.check("el admin intruso no cambia de cliente con X-Tenant-Id", rowsOf(intruderTenantHeader).every((row: any) => !ours.has(row.userId ?? row.id)), brief(intruderTenantHeader));
    const intruderConfig = await intruderAdmin.get("/nom/config", { tenantId: cast.file.tenant.id });
    r.check("el admin intruso no lee la configuración de este cliente con X-Tenant-Id", intruderConfig.status >= 400 || intruderConfig.body?.blockRemoteWithoutAgreement !== undefined, brief(intruderConfig));
  }

  // ── 9. Dejar la configuración como estaba ──
  const restored = await admin.put("/nom/config", restore);
  r.expect("el admin deja la configuración NOM como estaba", restored, 200);
}
