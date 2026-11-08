import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Cast } from "../cast";
import { Bot, addDays, localDate, type Report, type Res } from "../lib";

const secret = () => `Qa-${randomBytes(6).toString("hex")}`;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const rows = (res: Res): any[] => (Array.isArray(res.body) ? res.body : Array.isArray(res.body?.data) ? res.body.data : []);
const codeOf = (res: Res) => res.body?.code ?? res.body?.error?.code;
const brief = (res: Res) => `${res.status} ${codeOf(res) ?? ""} ${res.text.slice(0, 300)}`;

const CHECKLIST_KEYS = [
  "space_adequate",
  "ergonomics",
  "electrical_safety",
  "connectivity",
  "ventilation_lighting",
  "emergency_plan",
  "equipment_inventory",
  "no_risk_conditions",
];
const allYes = () => Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, "YES"]));

const POLICY_V = (n: number) =>
  [
    `Política de teletrabajo QA versión ${n}.`,
    "1. Horario: de 9 a 18 h con pausa de comida.",
    "2. Desconexión: fuera de horario no se envían mensajes de trabajo.",
    "3. Riesgos: se identifican riesgos ergonómicos y psicosociales.",
    "4. Equipo: la empresa entrega laptop y silla.",
    "5. Lactancia: se respetan los periodos de lactancia.",
    "6. Reversibilidad: la persona puede volver a la modalidad presencial.",
  ].join("\n");

async function createPerson(by: Bot, r: Report, tenantSlug: string, label: string, input: Record<string, unknown>) {
  const username = `${tenantSlug}.${String(input.username)}`;
  const password = secret();
  const res = await by.post("/users", { ...input, username, password, role: "CLIENT_STAFF" });
  if (!r.expect(`alta de ${input.name} para el flujo`, res, 201)) throw new Error(res.text);
  const bot = await new Bot(label, username, password, tenantSlug, "CLIENT_STAFF").login();
  return bot;
}

/**
 * NOM / registro de jornada: acuerdo del método de registro, convenios de
 * distribución (art. 58), teletrabajo NOM-037, export STPS, retención (solo
 * simulación), bitácora, permisos por rol y aislamiento entre clientes.
 */
export default async function nomCumplimiento(cast: Cast, r: Report): Promise<void> {
  const { admin, hr, intruderAdmin } = cast;
  const lucia = cast.employees[0];
  const tz = cast.file.timezone;
  const today = localDate(new Date(), tz);
  const t0 = new Date(Date.now() - 2000).toISOString();
  const slug = cast.file.tenant.slug;

  const raul = await createPerson(admin, r, slug, "Raúl", {
    username: "raul.nom",
    name: "Raúl Benítez Lara",
    employeeNumber: "501",
    jobTitle: "Capturista",
    departmentId: cast.file.departments.oficina,
  });
  const teresa = await createPerson(admin, r, slug, "Teresa", {
    username: "teresa.nom",
    name: "Teresa Olvera Rangel",
    employeeNumber: "502",
    jobTitle: "Analista remota",
    departmentId: cast.file.departments.oficina,
  });
  const ajeno = await createPerson(intruderAdmin, r, cast.file.intruder.tenant.slug, "Ajeno remoto", {
    username: "ajeno.nom",
    name: "Hugo Ajeno Remoto",
    employeeNumber: "951",
  });

  // ── 1. Acuerdo del método de registro ──────────────────────────────────
  const noAgreement = await raul.get("/nom/me/record-agreement");
  r.expect("Raúl consulta su acuerdo de registro (aún no existe)", noAgreement, 200);
  r.check("sin aceptar, el acuerdo de Raúl está vacío", noAgreement.body == null || noAgreement.body === "", noAgreement.text);

  const proposal = await raul.get("/nom/me/record-agreement/proposal");
  r.expect("Raúl ve la propuesta del método de registro", proposal, 200);
  r.check(
    "la propuesta trae métodos CLOCK/REMOTE y el texto completo",
    Array.isArray(proposal.body?.methods) && proposal.body.methods.includes("REMOTE") && String(proposal.body?.text ?? "").length > 50,
    proposal.text
  );

  r.expect(
    "un método inventado se rechaza",
    await raul.post("/nom/me/record-agreement/accept", { methods: ["FAX"] }),
    400,
    "INVALID_RECORD_METHODS"
  );
  r.expect(
    "aceptar sin métodos se rechaza",
    await raul.post("/nom/me/record-agreement/accept", { methods: [] }),
    400,
    "INVALID_RECORD_METHODS"
  );

  const rejectRoute = await raul.post("/nom/me/record-agreement/reject", { reason: "No estoy de acuerdo con el método" });
  if (rejectRoute.status === 404 && codeOf(rejectRoute) === "ROUTE_NOT_FOUND") {
    r.check("el producto expone una vía para que el trabajador rechace el acuerdo", false, brief(rejectRoute));
    r.finding(
      "MEDIA",
      "El trabajador no puede rechazar el acuerdo del método de registro, ni RH proponerlo",
      "Solo existen GET /nom/me/record-agreement/proposal (texto fijo en nom.controller.ts recordAgreementProposal) y POST /nom/me/record-agreement/accept. " +
        "POST /nom/me/record-agreement/reject → 404 ROUTE_NOT_FOUND y no hay endpoint de RH/admin para proponer un acuerdo a una persona (nom.routes.ts:106-114). " +
        "La prueba de dos partes queda incompleta: no hay estado RECHAZADO/PENDIENTE visible para RH."
    );
  } else {
    r.check("el trabajador puede rechazar el acuerdo", rejectRoute.status < 300, brief(rejectRoute));
  }

  const methodsV1 = ["CLOCK", "REMOTE"];
  const accepted = await raul.post("/nom/me/record-agreement/accept", {
    methods: methodsV1,
    roundingPolicy: proposal.body?.roundingPolicy,
    correctionRules: proposal.body?.correctionRules,
  });
  r.expect("Raúl acepta el método de registro (CLOCK + REMOTE)", accepted, 200);
  const agreementId: string = accepted.body?.id;
  r.check("la aceptación queda firmada con hash SHA-256", /^[0-9a-f]{64}$/.test(String(accepted.body?.acceptedHash)), accepted.text);
  r.check("aún sin firma patronal", accepted.body?.employerAcceptedAt == null, accepted.text);

  const mine = await raul.get("/nom/me/record-agreement");
  r.check("Raúl ve su acuerdo aceptado", mine.status === 200 && mine.body?.id === agreementId && !!mine.body?.acceptedAt, brief(mine));

  r.expect(
    "Raúl no puede firmar como patrón su propio acuerdo",
    await raul.post(`/nom/record-agreements/${agreementId}/employer-sign`, {}),
    403
  );
  r.expect("un empleado no lista los acuerdos de todos", await lucia.get("/nom/record-agreements"), 403);

  const hrList = await hr.get("/nom/record-agreements");
  r.expect("RH lista los acuerdos de método", hrList, 200);
  const hrRow = rows(hrList).find((a) => a.id === agreementId);
  r.check("RH ve el acuerdo de Raúl pendiente de firma patronal", !!hrRow && hrRow.employerAcceptedAt == null, JSON.stringify(hrRow ?? null));

  r.expect(
    "el admin intruso no puede firmar el acuerdo de este cliente",
    await intruderAdmin.post(`/nom/record-agreements/${agreementId}/employer-sign`, {}),
    404
  );
  const intruderAgreements = await intruderAdmin.get("/nom/record-agreements");
  r.check(
    "el admin intruso no ve acuerdos de este cliente",
    intruderAgreements.status === 200 && !rows(intruderAgreements).some((a) => a.id === agreementId),
    brief(intruderAgreements)
  );
  const intruderVersions = await intruderAdmin.get(`/nom/record-agreements/${agreementId}/versions`);
  r.check(
    "el admin intruso no ve el historial del acuerdo",
    intruderVersions.status === 404 || (intruderVersions.status === 200 && rows(intruderVersions).length === 0),
    brief(intruderVersions)
  );

  const signed = await hr.post(`/nom/record-agreements/${agreementId}/employer-sign`, {});
  r.expect("RH firma como patrón el acuerdo de Raúl", signed, 200);
  r.check("la firma patronal deja fecha y hash", !!signed.body?.employerAcceptedAt && /^[0-9a-f]{64}$/.test(String(signed.body?.employerAcceptedHash)), signed.text);

  const resign = await admin.post(`/nom/record-agreements/${agreementId}/employer-sign`, {});
  if (resign.status === 200 && resign.body?.employerAcceptedHash !== signed.body?.employerAcceptedHash) {
    r.check("una segunda firma patronal no sobrescribe la primera", false, brief(resign));
    r.finding(
      "BAJA",
      "La firma patronal del acuerdo se puede volver a firmar y sobrescribe la anterior",
      `POST /nom/record-agreements/${agreementId}/employer-sign por segunda vez (otro firmante) → 200 y reemplaza employerAcceptedAt/ById/Hash de la firma de RH. ` +
        "Se esperaba 409 (ya firmado) para conservar la prueba original. work-record.service.ts employerSign (sin validar employerAcceptedAt previo)."
    );
  } else {
    r.check("una segunda firma patronal no sobrescribe la primera", resign.status === 409 || resign.body?.employerAcceptedHash === signed.body?.employerAcceptedHash, brief(resign));
  }

  const raulAfterSign = await raul.get("/nom/me/record-agreement");
  r.check("Raúl ve la firma patronal en su acuerdo", !!raulAfterSign.body?.employerAcceptedAt, brief(raulAfterSign));

  const changed = await raul.post("/nom/me/record-agreement/accept", { methods: ["CLOCK"] });
  r.expect("Raúl acepta una nueva versión del acuerdo (solo CLOCK)", changed, 200);
  r.check("el cambio de métodos sube la versión del texto", changed.body?.textVersion === (accepted.body?.textVersion ?? 1) + 1, changed.text);
  if (changed.body?.employerAcceptedAt) {
    r.check("la versión nueva queda sin firma patronal hasta que el patrón la firme", false, changed.text);
    r.finding(
      "ALTA",
      "Una versión nueva del acuerdo hereda la firma patronal de la versión anterior",
      `Tras la firma patronal de la v${accepted.body?.textVersion}, Raúl re-acepta con otros métodos (POST /nom/me/record-agreement/accept {methods:["CLOCK"]}) → 200 textVersion=${changed.body?.textVersion} ` +
        `pero employerAcceptedAt=${changed.body?.employerAcceptedAt} sigue puesto. El acuerdo vigente aparenta doble firma que el patrón nunca dio. ` +
        "work-record.service.ts acceptAgreement: el upsert (update) no limpia employerAccepted* cuando changed=true."
    );
  } else {
    r.check("la versión nueva queda sin firma patronal hasta que el patrón la firme", true);
  }

  const versions = await hr.get(`/nom/record-agreements/${agreementId}/versions`);
  r.expect("RH consulta el historial de versiones", versions, 200);
  const versionRows = rows(versions);
  r.check("el historial conserva las dos versiones firmadas", versionRows.length >= 2, `versiones=${versionRows.length}`);
  const v1 = versionRows.find((v) => v.textVersion === accepted.body?.textVersion);
  r.check("la v1 conserva la firma patronal en el historial", !!v1?.employerAcceptedAt, JSON.stringify(v1 ?? null));

  // ── 2. Convenios de distribución (art. 58) ─────────────────────────────
  const evidence = "Convenio individual de distribución de jornada: lunes a jueves 9.5 h, viernes 6 h.";
  const base = { userId: raul.id, kind: "INDIVIDUAL", party: "WORKER", effectiveFrom: today, effectiveTo: addDays(today, 90), evidenceText: evidence };

  r.expect("un empleado no puede crear convenios", await lucia.post("/nom/distribution-agreements", base), 403);
  r.expect("un empleado no lista convenios", await lucia.get("/nom/distribution-agreements"), 403);
  r.expect(
    "fechas invertidas se rechazan",
    await admin.post("/nom/distribution-agreements", { ...base, effectiveFrom: addDays(today, 10), effectiveTo: today }),
    400,
    "AGREEMENT_INVALID_RANGE"
  );
  r.expect("sin texto de evidencia se rechaza", await admin.post("/nom/distribution-agreements", { ...base, evidenceText: undefined }), 400, "VALIDATION_ERROR");
  r.expect("con texto demasiado corto se rechaza", await admin.post("/nom/distribution-agreements", { ...base, evidenceText: "corto" }), 400, "VALIDATION_ERROR");
  r.expect(
    "sin persona ni horario se rechaza",
    await admin.post("/nom/distribution-agreements", { ...base, userId: undefined }),
    400,
    "AGREEMENT_TARGET_REQUIRED"
  );
  r.expect(
    "un convenio colectivo sin sindicato se rechaza",
    await admin.post("/nom/distribution-agreements", { ...base, kind: "COLECTIVO", party: "WORKER" }),
    400,
    "AGREEMENT_UNION_REQUIRED"
  );
  r.expect(
    "una fecha con formato inválido se rechaza",
    await admin.post("/nom/distribution-agreements", { ...base, effectiveFrom: "08/11/2026" }),
    400,
    "VALIDATION_ERROR"
  );

  const decoy = await admin.post("/nom/distribution-agreements", base);
  r.expect("el admin crea un convenio individual para Raúl", decoy, 201);
  r.check("el convenio guarda fechas y texto", decoy.body?.evidenceText === evidence && String(decoy.body?.effectiveFrom).startsWith(today), decoy.text);
  const stolen = await teresa.post(`/nom/me/distribution-agreements/${decoy.body?.id}/accept`);
  if (stolen.status === 200) {
    r.check("otra persona no puede aceptar el convenio de Raúl", false, brief(stolen));
    r.finding(
      "ALTA",
      "Cualquier empleado del cliente puede aceptar el convenio de distribución de otra persona",
      `Convenio INDIVIDUAL de Raúl (${decoy.body?.id}); Teresa → POST /nom/me/distribution-agreements/:id/accept → 200 y queda acceptedById=Teresa. ` +
        "Se esperaba 403/404. Con eso el motor reconoce la jornada convenida de Raúl sin su firma. " +
        "distribution-agreement.service.ts accept(): no compara agreement.userId con el actor (ni restringe colectivos a la representación)."
    );
  } else {
    r.check("otra persona no puede aceptar el convenio de Raúl", stolen.status === 403 || stolen.status === 404, brief(stolen));
  }

  const individual = await hr.post("/nom/distribution-agreements", { ...base, evidenceText: `${evidence} Firmado ante RH.` });
  r.expect("RH crea un convenio individual para Raúl", individual, 201);
  const individualId: string = individual.body?.id;
  r.expect(
    "el admin intruso no puede aceptar el convenio de este cliente",
    await ajeno.post(`/nom/me/distribution-agreements/${individualId}/accept`),
    404
  );
  const accDist = await raul.post(`/nom/me/distribution-agreements/${individualId}/accept`);
  r.expect("Raúl acepta su convenio de distribución", accDist, 200);
  r.check("la aceptación guarda fecha y quién aceptó", !!accDist.body?.acceptedAt && accDist.body?.acceptedById === raul.id, accDist.text);
  r.expect("aceptar dos veces el mismo convenio se rechaza", await raul.post(`/nom/me/distribution-agreements/${individualId}/accept`), 409, "AGREEMENT_ALREADY_ACCEPTED");

  const schedule = await admin.post("/schedules", {
    name: `Turno convenio NOM ${cast.file.stamp}`,
    mealBreakMin: 60,
    days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "18:00", splitStartTime: null, splitEndTime: null, restDay: false })),
  });
  r.expect("el admin crea un horario para el convenio colectivo", schedule, 201);
  const collective = await admin.post("/nom/distribution-agreements", {
    scheduleId: schedule.body?.id,
    kind: "COLECTIVO",
    party: "UNION",
    effectiveFrom: today,
    evidenceText: "Convenio colectivo con el sindicato para el turno de oficina, distribución de 45 h semanales.",
  });
  r.expect("el admin crea un convenio colectivo por horario con el sindicato", collective, 201);
  r.check("el colectivo queda ligado al horario y a la parte UNION", collective.body?.scheduleId === schedule.body?.id && collective.body?.party === "UNION" && collective.body?.userId == null, collective.text);

  const foreign = await admin.post("/nom/distribution-agreements", { ...base, userId: ajeno.id });
  if (foreign.status === 201) {
    r.check("no se crea un convenio para una persona de otro cliente", false, brief(foreign));
    r.finding(
      "ALTA",
      "Se puede crear un convenio de distribución para una persona de otro cliente",
      `POST /nom/distribution-agreements {userId: <empleado del cliente intruso>} con el admin de ${slug} → 201 (id ${foreign.body?.id}). ` +
        "Se esperaba 404/400. distribution-agreement.service.ts create(): no valida que userId/scheduleId sean del cliente; la FK acepta cualquier usuario."
    );
  } else {
    r.check("no se crea un convenio para una persona de otro cliente", foreign.status >= 400 && foreign.status < 500, brief(foreign));
  }

  const distList = await admin.get(`/nom/distribution-agreements?userId=${raul.id}`);
  r.expect("el admin lista los convenios de Raúl", distList, 200);
  const raulDist = rows(distList);
  r.check(
    "la lista muestra el convenio aceptado con su aceptante",
    raulDist.some((a) => a.id === individualId && a.acceptedAt && a.acceptedBy?.name),
    JSON.stringify(raulDist.map((a) => ({ id: a.id, acceptedAt: a.acceptedAt })))
  );
  r.check("el filtro por persona solo trae convenios de Raúl", raulDist.every((a) => a.userId === raul.id), JSON.stringify(raulDist.map((a) => a.userId)));
  const hrDist = await hr.get(`/nom/distribution-agreements?scheduleId=${schedule.body?.id}`);
  r.check("RH ve el convenio colectivo filtrando por horario", hrDist.status === 200 && rows(hrDist).some((a) => a.id === collective.body?.id), brief(hrDist));
  const intruderDist = await intruderAdmin.get("/nom/distribution-agreements");
  r.check(
    "el admin intruso no ve convenios de este cliente",
    intruderDist.status === 200 && !rows(intruderDist).some((a) => [individualId, decoy.body?.id, collective.body?.id].includes(a.id)),
    brief(intruderDist)
  );

  // ── 3. Teletrabajo NOM-037 ──────────────────────────────────────────────
  const beforeReg = await teresa.get("/nom/me/telework");
  r.expect("Teresa consulta su teletrabajo (sin registro)", beforeReg, 200);
  r.check("sin registro no hay consentimiento pendiente", beforeReg.body?.registration == null && beforeReg.body?.pendingConsent === false, beforeReg.text);
  r.expect(
    "Teresa no puede aceptar una política sin estar registrada",
    await teresa.post("/nom/me/telework/accept", { policyVersion: 1, privacyNoticeVersion: 1 }),
    404,
    "TELEWORK_NOT_REGISTERED"
  );
  r.expect("un empleado no puede registrar teletrabajadores", await lucia.post("/nom/telework/registrations", { userId: teresa.id, mode: "REMOTO" }), 403);
  r.expect("un empleado no ve el padrón de teletrabajo", await lucia.get("/nom/telework/registrations"), 403);

  const reg = await hr.post("/nom/telework/registrations", { userId: teresa.id, mode: "REMOTO", homeAddress: "Calle Jacarandas 45, Puebla" });
  r.expect("RH registra a Teresa como teletrabajadora", reg, 201);
  const registrationId: string = reg.body?.id;
  r.check("el registro queda ACTIVO en modalidad REMOTO", reg.body?.status === "ACTIVE" && reg.body?.mode === "REMOTO", reg.text);
  r.expect("registrarla dos veces se rechaza", await hr.post("/nom/telework/registrations", { userId: teresa.id }), 409, "TELEWORK_ALREADY_REGISTERED");
  r.expect(
    "el admin intruso no puede registrar a Teresa",
    await intruderAdmin.post("/nom/telework/registrations", { userId: teresa.id, mode: "REMOTO" }),
    404,
    "USER_NOT_FOUND"
  );

  r.expect(
    "una política sin las secciones obligatorias se rechaza",
    await admin.put("/nom/telework/policy", { teleworkPolicy: "Solo trabajamos desde casa." }),
    400,
    "TELEWORK_POLICY_SECTIONS_MISSING"
  );
  r.expect("un empleado no puede cambiar la política", await lucia.put("/nom/telework/policy", { teleworkPolicy: POLICY_V(0) }), 403);
  const policyBefore = await hr.get("/nom/telework/policy");
  r.expect("RH consulta la política vigente", policyBefore, 200);
  const pv0 = Number(policyBefore.body?.policyVersion ?? 1);
  const policy1 = await admin.put("/nom/telework/policy", {
    teleworkPolicy: `${POLICY_V(pv0 + 1)}\nRun ${cast.file.stamp}-${Date.now()}`,
    privacyNotice: `Aviso de privacidad QA ${Date.now()}: datos de ubicación solo al marcar.`,
  });
  r.expect("el admin publica una política de teletrabajo completa", policy1, 200);
  const pv1 = Number(policy1.body?.policyVersion);
  const priv1 = Number(policy1.body?.privacyNoticeVersion);
  r.check("publicar una política nueva sube su versión", pv1 === pv0 + 1, `antes=${pv0} después=${pv1}`);

  const pending = await teresa.get("/nom/me/telework");
  r.check(
    "Teresa ve su registro con consentimiento pendiente",
    pending.body?.registration?.id === registrationId && pending.body?.pendingConsent === true && pending.body?.consentCurrent === false,
    pending.text
  );
  r.check("Teresa ve la versión vigente de la política", pending.body?.policy?.policyVersion === pv1, pending.text);
  r.expect(
    "Teresa no puede llenar el checklist sin aceptar la política",
    await teresa.post("/nom/me/telework/checklist", { answers: allYes() }),
    409,
    "TELEWORK_CONSENT_REQUIRED"
  );
  r.expect(
    "aceptar una versión vieja de la política se rechaza",
    await teresa.post("/nom/me/telework/accept", { policyVersion: pv0, privacyNoticeVersion: priv1 }),
    409,
    "TELEWORK_POLICY_VERSION_CHANGED"
  );
  const consent1 = await teresa.post("/nom/me/telework/accept", { policyVersion: pv1, privacyNoticeVersion: priv1 });
  r.expect("Teresa acepta la política y el aviso vigentes", consent1, 200);
  r.check("el consentimiento queda con la versión aceptada", consent1.body?.consentPolicyVersion === pv1 && !!consent1.body?.consentAcceptedAt, consent1.text);
  const current1 = await teresa.get("/nom/me/telework");
  r.check("tras aceptar, su consentimiento está al día", current1.body?.consentCurrent === true, current1.text);

  const policy2 = await admin.put("/nom/telework/policy", { teleworkPolicy: `${POLICY_V(pv1 + 1)}\nCambio ${Date.now()}` });
  r.expect("el admin actualiza la política otra vez", policy2, 200);
  const pv2 = Number(policy2.body?.policyVersion);
  r.check("la versión vuelve a subir", pv2 === pv1 + 1, `v=${pv2}`);
  const stale = await teresa.get("/nom/me/telework");
  r.check("con la versión nueva su consentimiento ya no está al día", stale.body?.consentCurrent === false && stale.body?.pendingConsent === true, stale.text);
  r.expect(
    "volver a aceptar la versión anterior se rechaza",
    await teresa.post("/nom/me/telework/accept", { policyVersion: pv1, privacyNoticeVersion: priv1 }),
    409,
    "TELEWORK_POLICY_VERSION_CHANGED"
  );
  r.expect("Teresa re-acepta la versión nueva", await teresa.post("/nom/me/telework/accept", { policyVersion: pv2, privacyNoticeVersion: priv1 }), 200);

  r.expect(
    "un checklist incompleto se rechaza",
    await teresa.post("/nom/me/telework/checklist", { answers: { space_adequate: "YES" } }),
    400,
    "TELEWORK_CHECKLIST_INCOMPLETE"
  );
  r.expect(
    "un checklist con preguntas inventadas se rechaza",
    await teresa.post("/nom/me/telework/checklist", { answers: { ...allYes(), tiene_gato: "YES" } }),
    400,
    "TELEWORK_CHECKLIST_INCOMPLETE"
  );
  const checklist1 = await teresa.post("/nom/me/telework/checklist", { answers: { ...allYes(), ventilation_lighting: "NO" } });
  r.expect("Teresa llena el checklist inicial de su lugar", checklist1, 201);
  r.check("el primer checklist es INITIAL", checklist1.body?.kind === "INITIAL", checklist1.text);
  const checklistId: string = checklist1.body?.id;

  const agreeRemote = await teresa.post("/nom/me/record-agreement/accept", { methods: ["CLOCK", "REMOTE"] });
  r.expect("Teresa acepta el método de registro con checada remota", agreeRemote, 200);

  r.expect(
    "Teresa no puede validar su propio checklist",
    await teresa.post(`/nom/telework/checklists/${checklistId}/validate`, { result: "APTO" }),
    403
  );
  r.expect(
    "el admin intruso no puede validar el checklist de Teresa",
    await intruderAdmin.post(`/nom/telework/checklists/${checklistId}/validate`, { result: "APTO" }),
    404,
    "TELEWORK_CHECKLIST_NOT_FOUND"
  );
  const noApto = await hr.post(`/nom/telework/checklists/${checklistId}/validate`, { result: "NO_APTO", notes: "Sin ventilación adecuada" });
  r.expect("RH (Comisión) valida el lugar como NO_APTO", noApto, 200);
  r.check("la validación guarda resultado, fecha y validador", noApto.body?.result === "NO_APTO" && !!noApto.body?.validatedAt && noApto.body?.validatedById === hr.id, noApto.text);

  r.expect(
    "con lugar NO_APTO Teresa no puede checar remoto",
    await teresa.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO" }),
    403,
    "TELEWORK_WORKPLACE_NOT_APPROVED"
  );

  const checklist2 = await teresa.post("/nom/me/telework/checklist", { answers: allYes() });
  r.expect("Teresa manda un checklist nuevo tras corregir", checklist2, 201);
  r.check("el segundo checklist es PERIODIC", checklist2.body?.kind === "PERIODIC", checklist2.text);
  r.expect(
    "mientras la Comisión no valide el nuevo, sigue bloqueada",
    await teresa.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO" }),
    403,
    "TELEWORK_WORKPLACE_NOT_APPROVED"
  );
  const bogus = await hr.post(`/nom/telework/checklists/${checklist2.body?.id}/validate`, { result: "QUIZAS" });
  if (bogus.status === 200 && bogus.body?.result === "APTO") {
    r.check("un resultado de validación inválido se rechaza", false, brief(bogus));
    r.finding(
      "MEDIA",
      "Un resultado de validación inválido del checklist se guarda como APTO",
      `POST /nom/telework/checklists/:id/validate {result:"QUIZAS"} → 200 result=APTO. Cualquier valor distinto de "NO_APTO" (o un body vacío) aprueba el lugar ` +
        "y desbloquea la checada remota. nom.controller.ts validateTeleworkChecklist: `req.body?.result === \"NO_APTO\" ? \"NO_APTO\" : \"APTO\"` sin validar el enum."
    );
  } else {
    r.check("un resultado de validación inválido se rechaza", bogus.status === 400, brief(bogus));
  }
  const apto = await hr.post(`/nom/telework/checklists/${checklist2.body?.id}/validate`, { result: "APTO", notes: "Ventilación corregida" });
  r.expect("RH valida el lugar corregido como APTO", apto, 200);
  const punch = await teresa.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO", clientEventId: randomUUID() });
  r.expect("con lugar APTO Teresa registra su entrada remota", punch, 201);
  r.check("la hora de la checada es del servidor", Math.abs(Date.parse(punch.body?.punch?.occurredAt) - Date.now()) < 120_000, punch.text);

  const regs = await hr.get("/nom/telework/registrations");
  r.expect("RH lista el padrón de teletrabajo", regs, 200);
  const teresaReg = rows(regs).find((x) => x.id === registrationId);
  r.check(
    "el padrón muestra a Teresa con consentimiento y último checklist",
    !!teresaReg && teresaReg.consentPolicyVersion === pv2 && !!teresaReg.lastChecklist,
    JSON.stringify(teresaReg ?? null)
  );
  const checklists = await hr.get("/nom/telework/checklists");
  r.check("RH ve los dos checklists de Teresa", checklists.status === 200 && rows(checklists).filter((c) => c.userId === teresa.id).length === 2, brief(checklists));
  const intruderRegs = await intruderAdmin.get("/nom/telework/registrations");
  r.check("el admin intruso no ve el padrón de teletrabajo de este cliente", intruderRegs.status === 200 && !rows(intruderRegs).some((x) => x.id === registrationId), brief(intruderRegs));
  const intruderChecklists = await intruderAdmin.get("/nom/telework/checklists");
  r.check("el admin intruso no ve los checklists de este cliente", intruderChecklists.status === 200 && !rows(intruderChecklists).some((c) => c.userId === teresa.id), brief(intruderChecklists));
  r.expect(
    "el admin intruso no puede terminar el teletrabajo de Teresa",
    await intruderAdmin.patch(`/nom/telework/registrations/${registrationId}`, { status: "ENDED" }),
    404,
    "TELEWORK_NOT_REGISTERED"
  );

  // Checada remota de una persona del cliente intruso: no debe aparecer en el export de este cliente.
  r.expect("la persona del cliente intruso acepta su método de registro", await ajeno.post("/nom/me/record-agreement/accept", { methods: ["REMOTE"] }), 200);
  r.expect("la persona del cliente intruso checa remoto", await ajeno.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO" }), 201);

  // ── 4. Export STPS ─────────────────────────────────────────────────────
  r.expect("un empleado no descarga el export STPS", await lucia.get(`/nom/export/stps?period=MONTH&date=${today}`), 403);
  r.expect("un periodo inválido se rechaza", await admin.get(`/nom/export/stps?period=SIGLO&date=${today}`), 400, "INVALID_REPORT_PERIOD");
  r.expect("sin fecha se rechaza", await admin.get("/nom/export/stps?period=MONTH"), 400, "INVALID_REPORT_DATE");
  r.expect("una fecha inválida se rechaza", await admin.get("/nom/export/stps?period=MONTH&date=2026-13-45"), 400, "INVALID_REPORT_DATE");

  const usersRes = await admin.get("/users?limit=500");
  const ourUsers = rows(usersRes);
  const ourNumbers = new Set(ourUsers.map((u) => u.employeeNumber).filter(Boolean));
  for (const n of ["100", "201", "206", "501", "502"]) ourNumbers.add(n);

  const exportJson = await admin.get(`/nom/export/stps?period=MONTH&date=${today}&format=json`);
  r.expect("el admin descarga el export STPS del mes (JSON)", exportJson, 200);
  const doc = exportJson.body ?? {};
  r.check("el export trae versión de esquema y periodo", String(doc.schemaVersion).startsWith("stps-registro-jornada") && doc.period === "MONTH" && !!doc.from && !!doc.to, JSON.stringify({ s: doc.schemaVersion, p: doc.period }));
  r.check("el export es de este cliente", doc.tenant?.id === cast.file.tenant.id && doc.tenant?.slug === slug, JSON.stringify(doc.tenant ?? null));
  if (doc && typeof doc === "object" && doc.sha256) {
    const { sha256: digest, ...unsigned } = doc;
    r.check("el hash SHA-256 del JSON se puede recalcular", sha256(JSON.stringify(unsigned, null, 2)) === digest, `sha=${digest}`);
  } else {
    r.check("el hash SHA-256 del JSON se puede recalcular", false, "sin sha256");
  }
  const allNames: string[] = [
    ...(doc.rows ?? []).map((x: any) => String(x.name ?? "")),
    ...(doc.punches ?? []).map((x: any) => String(x.name ?? "")),
    ...(doc.remotePunches ?? []).map((x: any) => String(x.name ?? "")),
  ];
  const foreignNames = allNames.filter((n) => /ajeno|intruso/i.test(n));
  r.check("el export no trae personas del cliente intruso", foreignNames.length === 0, `ajenos=${JSON.stringify([...new Set(foreignNames)])}`);
  if (foreignNames.length) {
    r.finding("BLOQUEANTE", "El export STPS trae personas de otro cliente", `GET /nom/export/stps?format=json de ${slug} incluye ${JSON.stringify([...new Set(foreignNames)])}.`);
  }
  const foreignNumbers = (doc.rows ?? []).map((x: any) => x.employeeNumber).filter((n: any) => n && !ourNumbers.has(n));
  r.check("todas las filas son números de empleado de este cliente", foreignNumbers.length === 0, `ajenos=${JSON.stringify(foreignNumbers)}`);
  const teresaRemote = (doc.remotePunches ?? []).filter((x: any) => x.employeeNumber === "502");
  r.check("la checada remota de Teresa viaja en el export", teresaRemote.length >= 1 && teresaRemote.some((x: any) => x.type === "ENTRY"), JSON.stringify(doc.remotePunches ?? []).slice(0, 300));
  r.check("el total de marcajes remotos cuadra con el detalle", doc.totals?.remotePunches === (doc.remotePunches ?? []).length, JSON.stringify(doc.totals ?? null));

  const exportCsv = await hr.get(`/nom/export/stps?period=MONTH&date=${today}`);
  r.expect("RH descarga el export STPS (CSV por defecto)", exportCsv, 200);
  const csv = typeof exportCsv.body === "string" ? exportCsv.body : "";
  const lines = csv.replace(/\n$/, "").split("\n");
  r.check("el CSV trae encabezado del registro y del cliente", lines[0]?.includes("Registro electrónico de jornada") && csv.includes(`(${cast.file.tenant.id})`), lines.slice(0, 3).join(" | "));
  r.check("el CSV trae la columna de minutos trabajados", csv.includes("fecha,numeroEmpleado,nombre,departamento"), "");
  const shaLine = lines.findIndex((l) => l.startsWith("# sha256: "));
  if (shaLine >= 0) {
    const declared = lines[shaLine].slice("# sha256: ".length);
    const rest = lines.filter((_, i) => i !== shaLine).join("\n");
    r.check("el hash SHA-256 del CSV se puede recalcular", sha256(rest) === declared, `declarado=${declared}`);
  } else {
    r.check("el hash SHA-256 del CSV se puede recalcular", false, "sin línea # sha256");
  }
  r.check("el CSV no trae personas del cliente intruso", !/ajeno|intruso/i.test(csv), "");

  const intruderExport = await intruderAdmin.get(`/nom/export/stps?period=MONTH&date=${today}&format=json`);
  r.expect("el admin intruso descarga su propio export", intruderExport, 200);
  const intrDoc = intruderExport.body ?? {};
  const ourNamesInIntruder = [...(intrDoc.rows ?? []), ...(intrDoc.remotePunches ?? []), ...(intrDoc.punches ?? [])].filter((x: any) =>
    /Teresa Olvera|Raúl Benítez|Lucía Herrera/i.test(String(x.name ?? ""))
  );
  r.check(
    "el export del intruso es de su cliente y no trae personas de este",
    intrDoc.tenant?.id === cast.file.intruder.tenant.id && ourNamesInIntruder.length === 0,
    JSON.stringify({ tenant: intrDoc.tenant?.id, nuestros: ourNamesInIntruder.length })
  );
  r.check("el export del intruso trae su propia checada remota", (intrDoc.remotePunches ?? []).some((x: any) => x.employeeNumber === "951"), JSON.stringify(intrDoc.remotePunches ?? []).slice(0, 200));
  const intruderForced = await intruderAdmin.get(`/nom/export/stps?period=MONTH&date=${today}&format=json`, { tenantId: cast.file.tenant.id });
  r.check(
    "el admin intruso no obtiene el export de este cliente con X-Tenant-Id",
    intruderForced.status >= 400 || intruderForced.body?.tenant?.id !== cast.file.tenant.id,
    brief(intruderForced)
  );

  // ── 5. Retención (solo simulación) ─────────────────────────────────────
  r.expect("un empleado no ve la retención", await lucia.get("/nom/retention"), 403);
  r.expect("un empleado no puede archivar", await lucia.post("/nom/retention/archive", { dryRun: true }), 403);
  const cfgBefore = await hr.get("/nom/config");
  r.expect("RH consulta la configuración NOM", cfgBefore, 200);
  const prevRetention = cfgBefore.body?.retentionMonths ?? null;
  r.expect("una retención fuera de rango se rechaza", await hr.put("/nom/config", { retentionMonths: 0 }), 400, "VALIDATION_ERROR");
  r.expect("RH fija la retención en 24 meses", await hr.put("/nom/config", { retentionMonths: 24 }), 200);
  const ret = await hr.get("/nom/retention");
  r.expect("RH consulta la retención vigente", ret, 200);
  const twelveMonthsAgo = Date.now() - 365 * 24 * 3600_000 + 7 * 24 * 3600_000;
  r.check("el corte nunca cae dentro del año legal (art. 804)", !!ret.body?.cutoff && Date.parse(ret.body.cutoff) <= twelveMonthsAgo, JSON.stringify(ret.body));
  const dry = await hr.post("/nom/retention/archive", { dryRun: true });
  r.expect("RH simula el archivado (dry-run)", dry, 200);
  r.check(
    "la simulación no archiva nada reciente",
    dry.body?.dryRun === true && dry.body?.punches === 0 && dry.body?.remotePunches === 0 && dry.body?.adjustments === 0,
    JSON.stringify(dry.body)
  );
  r.expect(
    "el admin intruso no puede archivar este cliente",
    await intruderAdmin.post("/nom/retention/archive", { dryRun: true, tenantId: cast.file.tenant.id }),
    403,
    "FORBIDDEN"
  );
  const restored = await hr.put("/nom/config", { retentionMonths: prevRetention });
  r.expect("RH regresa la retención a como estaba", restored, 200);
  const afterExport = await admin.get(`/nom/export/stps?period=MONTH&date=${today}&format=json`);
  r.check(
    "tras la simulación la checada de Teresa sigue en el registro",
    (afterExport.body?.remotePunches ?? []).some((x: any) => x.employeeNumber === "502"),
    brief(afterExport)
  );

  // ── 6. Bitácora ────────────────────────────────────────────────────────
  r.expect("un empleado no ve la bitácora", await lucia.get("/audit"), 403, "INSUFFICIENT_PERMISSIONS");
  r.expect("RH no ve la bitácora (sin audit.view)", await hr.get("/audit"), 403, "INSUFFICIENT_PERMISSIONS");

  const auditOf = async (query: string) => rows(await admin.get(`/audit?start=${encodeURIComponent(t0)}&limit=500&${query}`));
  const byAgreement = await auditOf(`entityType=WorkRecordAgreement&entityId=${agreementId}`);
  const accLogs = byAgreement.filter((l) => l.action === "WORK_RECORD_AGREEMENT_ACCEPTED");
  const signLogs = byAgreement.filter((l) => l.action === "WORK_RECORD_AGREEMENT_EMPLOYER_SIGNED");
  r.check("la bitácora registra las aceptaciones de Raúl con él como actor", accLogs.length >= 2 && accLogs.every((l) => l.userId === raul.id), JSON.stringify(accLogs.map((l) => l.userId)));
  r.check("la bitácora registra la firma patronal con RH como actor", signLogs.some((l) => l.userId === hr.id), JSON.stringify(signLogs.map((l) => l.userId)));
  r.check("los registros son de este cliente", byAgreement.every((l) => l.tenantId === cast.file.tenant.id), JSON.stringify(byAgreement.map((l) => l.tenantId)));

  const distLogs = await auditOf(`entityType=WorkdayDistributionAgreement&entityId=${individualId}`);
  r.check(
    "la bitácora registra alta (RH) y aceptación (Raúl) del convenio",
    distLogs.some((l) => l.action === "WORKDAY_DISTRIBUTION_AGREEMENT_CREATED" && l.userId === hr.id) &&
      distLogs.some((l) => l.action === "WORKDAY_DISTRIBUTION_AGREEMENT_ACCEPTED" && l.userId === raul.id),
    JSON.stringify(distLogs.map((l) => [l.action, l.userId]))
  );
  const regLogs = await auditOf(`entityType=TeleworkRegistration&entityId=${registrationId}`);
  r.check(
    "la bitácora registra el alta de teletrabajo y los consentimientos",
    regLogs.some((l) => l.action === "TELEWORK_REGISTERED" && l.userId === hr.id) &&
      regLogs.filter((l) => l.action === "TELEWORK_CONSENT_ACCEPTED" && l.userId === teresa.id).length >= 2,
    JSON.stringify(regLogs.map((l) => [l.action, l.userId]))
  );
  const validated = await auditOf("action=TELEWORK_CHECKLIST_VALIDATED");
  r.check("el filtro por acción solo trae esa acción", validated.length > 0 && validated.every((l) => l.action === "TELEWORK_CHECKLIST_VALIDATED"), JSON.stringify(validated.map((l) => l.action)));
  r.check(
    "la bitácora registra la validación NO_APTO del checklist con RH como actor",
    validated.some((l) => l.entityId === checklistId && l.userId === hr.id && l.newState?.result === "NO_APTO"),
    JSON.stringify(validated.map((l) => [l.entityId, l.newState]))
  );
  const policyLogs = await auditOf("action=NOM_TELEWORK_POLICY_UPDATED");
  r.check("la bitácora registra los cambios de política con su versión", policyLogs.filter((l) => l.userId === admin.id).length >= 2, `n=${policyLogs.length}`);
  const punchLogs = await auditOf(`action=REMOTE_PUNCH_RECORDED&userId=${teresa.id}`);
  r.check("la bitácora registra la checada remota de Teresa", punchLogs.length >= 1, `n=${punchLogs.length}`);
  const hrLogs = await auditOf(`userId=${hr.id}`);
  r.check("el filtro por persona solo trae acciones de RH", hrLogs.length > 0 && hrLogs.every((l) => l.userId === hr.id), `n=${hrLogs.length}`);
  r.check(
    "la bitácora registra el cambio de retención",
    hrLogs.some((l) => /NOM_SETTINGS|NOM_CONFIG/i.test(String(l.action))),
    JSON.stringify([...new Set(hrLogs.map((l) => l.action))])
  );
  const future = rows(await admin.get(`/audit?start=${encodeURIComponent(new Date(Date.now() + 86400_000).toISOString())}`));
  r.check("un rango de fechas futuro no trae registros", future.length === 0, `n=${future.length}`);

  const exportLogs = (await auditOf(`userId=${admin.id}`)).filter((l) => /EXPORT|STPS/i.test(`${l.action} ${l.entityType}`));
  if (exportLogs.length === 0) {
    r.check("la descarga del export STPS queda en la bitácora", false, "sin registro EXPORT/STPS del admin");
    r.finding(
      "MEDIA",
      "La descarga del export STPS no queda en la bitácora",
      `GET /nom/export/stps (admin y RH, JSON y CSV) → 200, pero GET /audit?userId=<admin> no trae ninguna acción de export. ` +
        "El export contiene marcajes y geolocalización (datos personales sensibles) y debería auditarse quién lo bajó. " +
        "nom.controller.ts exportStps / stps-export.service.ts export(): no llaman al AuditLogger (solo guardan generatedById en el archivo)."
    );
  } else {
    r.check("la descarga del export STPS queda en la bitácora", true);
  }

  const sample = accLogs[0];
  if (sample) {
    const detail = await admin.get(`/audit/${sample.id}`);
    r.expect("el admin abre el detalle de un registro de bitácora", detail, 200);
    const del = await admin.delete(`/audit/${sample.id}`);
    const put = await admin.put(`/audit/${sample.id}`, { action: "ALTERADO" });
    const patch = await admin.patch(`/audit/${sample.id}`, { action: "ALTERADO" });
    r.check("la bitácora no se puede borrar ni editar (append-only)", [del, put, patch].every((x) => x.status === 404 || x.status === 405), [del, put, patch].map(brief).join(" / "));
    const still = await admin.get(`/audit/${sample.id}`);
    r.check("el registro sigue intacto", still.status === 200 && still.body?.action === sample.action, brief(still));
    r.expect("el admin intruso no abre registros de bitácora de este cliente", await intruderAdmin.get(`/audit/${sample.id}`), 404);
    const forced = rows(await intruderAdmin.get(`/audit?tenantId=${cast.file.tenant.id}&entityId=${agreementId}`));
    r.check("el admin intruso no lista la bitácora de este cliente aunque la pida", forced.length === 0, `n=${forced.length}`);
  }

  // ── 7. Permisos de lectura por rol ─────────────────────────────────────
  const reads = [
    "/nom/record-agreements",
    "/nom/distribution-agreements",
    "/nom/telework/registrations",
    "/nom/telework/checklists",
    "/nom/telework/policy",
    "/nom/retention",
    "/nom/config",
  ];
  for (const route of reads) {
    const [a, h, e] = await Promise.all([admin.get(route), hr.get(route), lucia.get(route)]);
    r.check(`${route}: admin 200, RH 200, empleado 403`, a.status === 200 && h.status === 200 && e.status === 403, `admin ${a.status} · RH ${h.status} · empleado ${e.status}`);
  }
  r.expect("el admin ve la bitácora", await admin.get("/audit?limit=1"), 200);
  r.expect("un empleado no puede firmar acuerdos como patrón", await lucia.post(`/nom/record-agreements/${agreementId}/employer-sign`, {}), 403);
  r.expect("un empleado no puede cambiar la configuración NOM", await lucia.put("/nom/config", { retentionMonths: 24 }), 403);
}
