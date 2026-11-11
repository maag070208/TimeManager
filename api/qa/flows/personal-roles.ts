import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Cast } from "../cast";
import { Bot, call, type Report, type Res } from "../lib";

/**
 * Personal y roles: ciclo de vida de personas extra (alta por admin y por RH,
 * expediente, edición, cambio de departamento, búsqueda, baja/reactivación,
 * contraseña reseteada), matriz de permisos por rol, excepciones por usuario,
 * roles de plataforma con X-Tenant-Id, aislamiento entre clientes, límite de
 * personas del plan, sesión (refresh, tokens alterados) y conteos del inicio.
 *
 * Solo desactiva/edita personas que este flujo crea; el reparto queda intacto.
 */

const secret = () => `Qa-${randomBytes(6).toString("hex")}`;
const rowsOf = (body: any): any[] => (Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.rows) ? body.rows : []);
const idsOf = (body: any): string[] => rowsOf(body).map((r) => r?.id ?? r?.userId).filter(Boolean);
const short = (res: Res) => `${res.status} ${res.text.slice(0, 220)}`;
const codeOf = (res: Res) => res.body?.code ?? res.body?.error?.code;

interface Person {
  id: string;
  username: string;
  password: string;
  name: string;
  employeeNumber: string;
  bot?: Bot;
}

export default async function personalRoles(cast: Cast, r: Report): Promise<void> {
  const { admin, hr, platform, intruderAdmin, intruderEmployee } = cast;
  const staff = cast.employees[0];
  const slug = cast.file.tenant.slug;
  const tenantId = cast.file.tenant.id;
  const { almacen, oficina } = cast.file.departments;
  const tag = randomBytes(2).toString("hex");
  const active = new Set<string>();
  const ownIds = new Set<string>([cast.file.admin.id, cast.file.hr.id, ...cast.file.employees.map((e) => e.id)]);
  const foreignIds = new Set<string>([cast.file.intruder.admin.id, cast.file.intruder.employee.id]);

  const no500 = (step: string, res: Res) => {
    if (res.status >= 500) r.finding("ALTA", `500 en ${step}`, short(res));
  };

  const createPerson = async (by: Bot, label: string, num: string, input: Record<string, unknown> = {}): Promise<Person | null> => {
    const username = `${slug}.x${tag}.${num}`;
    const password = secret();
    const name = (input.name as string) ?? `Extra ${num}`;
    const res = await by.post("/users", { username, password, name, role: "CLIENT_STAFF", employeeNumber: num, ...input });
    no500(label, res);
    if (!r.expect(label, res, 201)) return null;
    const id = res.body?.id ?? res.body?.user?.id;
    ownIds.add(id);
    active.add(id);
    return { id, username, password, name, employeeNumber: num };
  };

  const loginRaw = (p: { username: string; password: string }) =>
    call(null, "POST", "/auth/login", { body: { username: p.username, password: p.password, tenant: slug } });

  const asBot = async (p: Person): Promise<Bot> => {
    const bot = await new Bot(p.name, p.username, p.password, slug, "CLIENT_STAFF").login();
    p.password = bot.password;
    p.bot = bot;
    return bot;
  };

  const withToken = (token: string) => {
    const b = new Bot("token", "", "", slug, "?");
    b.token = token;
    return b;
  };

  // Base de personas activas al empezar (8 del reparto, más las que hayan creado otros flujos).
  const baseActive = (await admin.get("/dashboard/people")).body?.active ?? 8;
  const intruderBase = (await cast.intruderAdmin.get("/dashboard/people")).body?.active ?? 2;
  const expectedActive = () => baseActive + active.size;

  // ── 1. Altas ───────────────────────────────────────────────────────────────
  const p1 = await createPerson(admin, "el admin da de alta a una persona extra (Almacén)", `3${tag}1`, {
    name: "Paula",
    paternalSurname: "Extra",
    maternalSurname: "Uno",
    jobTitle: "Montacarguista",
    departmentId: almacen,
  });
  const p2 = await createPerson(hr, "RH da de alta a una persona extra (Oficina)", `3${tag}2`, {
    name: "Ramiro",
    paternalSurname: "Extra",
    maternalSurname: "Dos",
    jobTitle: "Capturista",
    departmentId: oficina,
  });
  if (!p1 || !p2) throw new Error("no se pudieron crear las personas extra");

  const dupUser = await admin.post("/users", { username: p1.username, password: secret(), name: "Dup", role: "CLIENT_STAFF" });
  r.expect("el username repetido en el mismo cliente se rechaza", dupUser, 409, "USERNAME_TAKEN");
  const dupNum = await admin.post("/users", { username: `${slug}.x${tag}.dupnum`, password: secret(), name: "Dup", role: "CLIENT_STAFF", employeeNumber: p1.employeeNumber });
  r.expect("el número de empleado repetido se rechaza", dupNum, 409, "EMPLOYEE_NUMBER_TAKEN");
  const platformRole = await admin.post("/users", { username: `${slug}.x${tag}.root`, password: secret(), name: "Root", role: "ADMIN" });
  r.expect("el admin del cliente no puede crear un ADMIN de plataforma", platformRole, 403, "ROLE_NOT_FOR_CLIENT");
  const staffCreate = await staff.post("/users", { username: `${slug}.x${tag}.nope`, password: secret(), name: "Nope", role: "CLIENT_STAFF" });
  r.expect("un empleado no puede dar de alta personas", staffCreate, 403);

  const sameNameOther = await intruderAdmin.post("/users", { username: p1.username, password: secret(), name: "Homónimo", role: "CLIENT_STAFF" });
  r.check("otro cliente puede usar el mismo username (unicidad por cliente)", sameNameOther.status === 201, short(sameNameOther));
  if (sameNameOther.status === 201) foreignIds.add(sameNameOther.body?.id);

  // RH intentando crear o volverse administrador del cliente.
  const hrMakesAdmin = await hr.post("/users", { username: `${slug}.x${tag}.hradm`, password: secret(), name: "Admin por RH", role: "CLIENT_ADMIN" });
  no500("RH crea CLIENT_ADMIN", hrMakesAdmin);
  if (hrMakesAdmin.status === 201) {
    ownIds.add(hrMakesAdmin.body.id);
    active.add(hrMakesAdmin.body.id);
    r.finding(
      "MEDIA",
      "RH puede dar de alta administradores del cliente",
      "POST /users {role:CLIENT_ADMIN} con token de HUMAN_RESOURCES → 201. RH no tiene users.permissions, users.delete ni departments.manage, pero puede crear una cuenta que sí los tiene (escalada). user.service.ts create() solo valida isRoleAllowedFor (plataforma vs cliente), no que el rol otorgado esté dentro de los permisos de quien lo otorga."
    );
  }
  r.check("RH no puede crear un CLIENT_ADMIN (no tiene sus permisos)", hrMakesAdmin.status === 403, short(hrMakesAdmin));

  const p3 = await createPerson(admin, "el admin da de alta a un segundo RH extra", `3${tag}3`, { name: "Rocío", role: "HUMAN_RESOURCES", departmentId: oficina });
  if (p3) {
    const hrBot = new Bot("RH extra", p3.username, p3.password, slug, "HUMAN_RESOURCES");
    await hrBot.login();
    p3.password = hrBot.password;
    const selfPromote = await hrBot.put(`/users/${p3.id}`, { role: "CLIENT_ADMIN" });
    no500("RH se sube a CLIENT_ADMIN", selfPromote);
    const after = await admin.get(`/users/${p3.id}`);
    const promoted = after.body?.role === "CLIENT_ADMIN";
    r.check("RH no puede subirse a sí mismo a CLIENT_ADMIN", !promoted, `PUT /users/:self {role:CLIENT_ADMIN} → ${short(selfPromote)}; rol final ${after.body?.role}`);
    if (promoted) {
      r.finding(
        "ALTA",
        "RH se autoasciende a administrador del cliente",
        `PUT /users/${p3.id} {role:"CLIENT_ADMIN"} con el token del mismo RH → ${selfPromote.status}; GET /users/:id devuelve role=CLIENT_ADMIN. Con users.edit cualquier RH se da users.delete/users.permissions/departments.manage. user.service.ts update() no limita el rol que se asigna ni impide editar el propio rol.`
      );
      const deny = await hrBot.get(`/users/${cast.file.employees[0].id}/permissions`);
      r.check("tras autoascenderse, RH ya administra permisos (confirmación de la escalada)", deny.status === 200, short(deny));
    }
  }

  // ── 2. Expediente de RH ───────────────────────────────────────────────────
  const genders = await hr.get("/hr/catalogs/genders");
  const bloods = await hr.get("/hr/catalogs/blood-types");
  const docTypes = await hr.get("/hr/catalogs/document-types");
  r.expect("RH consulta el catálogo de géneros", genders, 200);
  r.expect("RH consulta el catálogo de tipos de sangre", bloods, 200);
  r.expect("RH consulta el catálogo de tipos de documento", docTypes, 200);
  const ensureCatalog = async (path: string, listed: Res, name: string): Promise<string | null> => {
    const found = rowsOf(listed.body).find((x) => x.active !== false)?.id;
    if (found) return found;
    // Géneros y tipos de sangre son globales; la base de QA puede venir sin sembrar.
    const created = await platform.post(path, { name }, { tenantId });
    if (created.status === 201) return created.body?.id ?? null;
    const again = await hr.get(path);
    return rowsOf(again.body).find((x) => x.active !== false)?.id ?? null;
  };
  const genderId = await ensureCatalog("/hr/catalogs/genders", genders, "Femenino");
  const bloodId = await ensureCatalog("/hr/catalogs/blood-types", bloods, "O+");
  const docTypeId = rowsOf(docTypes.body).find((d) => d.active !== false)?.id ?? null;
  r.check("hay catálogos de RH para el expediente (tipos de documento del cliente, géneros y sangre globales)", Boolean(genderId && bloodId && docTypeId), `g=${genderId} b=${bloodId} d=${docTypeId}`);

  const profile = {
    genderId,
    bloodTypeId: bloodId,
    birthDate: "1991-04-12",
    hireDate: "2024-02-01",
    rfc: "EXUP910412AB1",
    curp: "EXUP910412MDFXNL09",
    nss: "12345678901",
    streetAddress: "Av. Siempre Viva 742",
    neighborhood: "Centro",
    postalCode: "06000",
    city: "Ciudad de México",
    addressState: "CDMX",
    country: "México",
    personalPhone: "55 1234 5678",
    emergencyContactName: "Marta Extra",
    emergencyContactPhone: "5587654321",
    emergencyContactRelationship: "Madre",
    allergies: "Ninguna",
  };
  const patched = await hr.patch(`/hr/${p1.id}/profile`, profile);
  no500("PATCH /hr/:id/profile", patched);
  r.expect("RH captura datos personales del expediente", patched, 200);
  const record = await hr.get(`/hr/${p1.id}`);
  r.expect("RH lee el expediente", record, 200);
  const rb = record.body ?? {};
  r.check(
    "los datos personales persisten (RFC, CURP, NSS, CP, contacto, género, sangre)",
    rb.rfc === profile.rfc && rb.curp === profile.curp && rb.nss === profile.nss && rb.postalCode === profile.postalCode &&
      rb.emergencyContactName === profile.emergencyContactName && (rb.gender?.id ?? rb.genderId) === genderId && (rb.bloodType?.id ?? rb.bloodTypeId) === bloodId,
    JSON.stringify({ rfc: rb.rfc, curp: rb.curp, nss: rb.nss, cp: rb.postalCode, g: rb.gender?.id, b: rb.bloodType?.id })
  );
  r.check("la fecha de nacimiento persiste", String(rb.birthDate ?? "").startsWith("1991-04-12"), `birthDate=${rb.birthDate}`);
  const badRfc = await hr.patch(`/hr/${p1.id}/profile`, { rfc: "NO-ES-RFC" });
  r.expect("un RFC inválido se rechaza", badRfc, 400);
  const badCp = await hr.patch(`/hr/${p1.id}/profile`, { postalCode: "123" });
  r.expect("un código postal inválido se rechaza", badCp, 400);
  const staffRecord = await staff.get(`/hr/${p1.id}`);
  r.expect("un empleado no lee expedientes ajenos", staffRecord, 403);
  const staffPatch = await staff.patch(`/hr/${staff.id}/profile`, { city: "Hackeada" });
  r.expect("un empleado no edita expedientes (ni el suyo)", staffPatch, 403);

  const noFile = await hr.post(`/hr/${p1.id}/documents`, { documentTypeId: docTypeId });
  r.expect("subir documento sin archivo se rechaza", noFile, 400);
  if (docTypeId) {
    const form = new FormData();
    form.append("documentTypeId", docTypeId);
    form.append("file", new Blob([Buffer.from("%PDF-1.4\n%QA\n")], { type: "application/pdf" }), "identificacion.pdf");
    const upload = await hr.post(`/hr/${p1.id}/documents`, undefined, { form });
    r.check("subir un documento: 201 con S3 o 503 STORAGE_NOT_CONFIGURED sin S3", upload.status === 201 || (upload.status === 503 && codeOf(upload) === "STORAGE_NOT_CONFIGURED"), short(upload));
  }
  const docs = await hr.get(`/hr/${p1.id}/documents`);
  r.expect("RH lista los documentos del expediente", docs, 200);
  const missingDoc = await hr.get(`/hr/${p1.id}/documents/no-existe/download`);
  r.expect("descargar un documento inexistente → 404", missingDoc, 404);

  // ── 3. Edición y cambio de departamento ──────────────────────────────────
  const edit = await admin.put(`/users/${p1.id}`, { jobTitle: "Jefa de montacargas", middleName: "Andrea" });
  r.expect("el admin edita puesto y segundo nombre", edit, 200);
  const moveP1 = await admin.put(`/users/${p1.id}`, { departmentId: oficina });
  r.expect("el admin cambia a la persona de Almacén a Oficina", moveP1, 200);
  const p1Read = await admin.get(`/users/${p1.id}`);
  r.check("la edición y el departamento nuevo persisten", p1Read.body?.jobTitle === "Jefa de montacargas" && p1Read.body?.middleName === "Andrea" && p1Read.body?.department?.id === oficina, JSON.stringify({ job: p1Read.body?.jobTitle, dept: p1Read.body?.department }));
  const assign = await hr.post("/hr/assignment", { userIds: [p2.id], departmentId: almacen });
  no500("POST /hr/assignment", assign);
  r.check("RH reasigna a Ramiro a Almacén en lote", assign.status === 200 || assign.status === 201 || assign.status === 204, short(assign));
  const p2Read = await hr.get(`/hr/${p2.id}`);
  r.check("Ramiro queda en Almacén", p2Read.body?.department?.id === almacen, JSON.stringify(p2Read.body?.department));
  const hrEditsOther = await hr.put(`/users/${p2.id}`, { jobTitle: "Capturista sr." });
  r.expect("RH edita la cuenta (users.edit)", hrEditsOther, 200);
  const staffEdits = await staff.put(`/users/${p2.id}`, { jobTitle: "x" });
  r.expect("un empleado no edita cuentas", staffEdits, 403);

  // Departamento de otro cliente como FK.
  const intruderDept = await intruderAdmin.post("/departments", { name: `Ajeno ${tag}` });
  r.expect("el intruso crea un departamento en su cliente", intruderDept, 201);
  const foreignDeptId = intruderDept.body?.id;
  if (foreignDeptId) {
    const crossFk = await admin.put(`/users/${p2.id}`, { departmentId: foreignDeptId });
    no500("PUT /users con departamento ajeno", crossFk);
    const check = await admin.get(`/users/${p2.id}`);
    const linked = check.body?.departmentId === foreignDeptId || check.body?.department?.id === foreignDeptId;
    r.check("no se puede asignar un departamento de otro cliente", !linked && crossFk.status >= 400, `PUT → ${short(crossFk)}; dept final ${JSON.stringify(check.body?.department)}`);
    if (linked) {
      r.finding(
        "BLOQUEANTE",
        "departmentId no se valida contra el cliente (alta/edición de cuentas)",
        `PUT /users/${p2.id} {departmentId:<depto del cliente ${cast.file.intruder.tenant.slug}>} con el CLIENT_ADMIN de ${slug} → ${crossFk.status}; GET /users/:id devuelve department=${JSON.stringify(check.body?.department)} (nombre del otro cliente visible). user.service.ts:441-443 (update) escribe departmentId tal cual; la FK no lleva tenant y la extensión de tenancy solo filtra el usuario editado, no el departamento referido.`
      );
      await admin.put(`/users/${p2.id}`, { departmentId: almacen });
    }
    const crossCreate = await admin.post("/users", { username: `${slug}.x${tag}.fk`, password: secret(), name: "FK", role: "CLIENT_STAFF", departmentId: foreignDeptId });
    no500("POST /users con departamento ajeno", crossCreate);
    if (crossCreate.status === 201) {
      ownIds.add(crossCreate.body.id);
      active.add(crossCreate.body.id);
      r.finding("BLOQUEANTE", "Alta de persona con departamento de otro cliente", `POST /users {departmentId:<id de un depto de ${cast.file.intruder.tenant.slug}>} → 201 (${crossCreate.body?.id}); misma causa: user.service.ts create() (línea ~300) escribe data.departmentId sin validar el cliente.`);
      await admin.put(`/users/${crossCreate.body.id}`, { departmentId: null });
    }
    r.check("no se puede dar de alta con un departamento de otro cliente", crossCreate.status >= 400, short(crossCreate));
    const crossAssign = await hr.post("/hr/assignment", { userIds: [p2.id], departmentId: foreignDeptId });
    no500("POST /hr/assignment con departamento ajeno", crossAssign);
    const check2 = await hr.get(`/hr/${p2.id}`);
    r.check("RH no puede reasignar a un departamento de otro cliente", check2.body?.department?.id !== foreignDeptId && crossAssign.status >= 400, `→ ${short(crossAssign)}; dept ${JSON.stringify(check2.body?.department)}`);
    if (check2.body?.department?.id === foreignDeptId) {
      r.finding("BLOQUEANTE", "RH asigna personas a un departamento de otro cliente", `POST /hr/assignment {departmentId:<ajeno>} → ${crossAssign.status}`);
      await hr.post("/hr/assignment", { userIds: [p2.id], departmentId: almacen });
    }
    const crossProfile = await hr.patch(`/hr/${p2.id}/profile`, { departmentId: foreignDeptId });
    no500("PATCH /hr/:id/profile con departamento ajeno", crossProfile);
    const check3 = await hr.get(`/hr/${p2.id}`);
    r.check("el expediente no acepta un departamento de otro cliente", check3.body?.department?.id !== foreignDeptId, `→ ${short(crossProfile)}`);
    if (check3.body?.department?.id === foreignDeptId) {
      r.finding("BLOQUEANTE", "El expediente acepta un departamento de otro cliente", `PATCH /hr/${p2.id}/profile {departmentId:<ajeno>} → ${crossProfile.status}`);
      await hr.post("/hr/assignment", { userIds: [p2.id], departmentId: almacen });
    }
  }

  // ── 4. Búsqueda en /users/query ──────────────────────────────────────────
  const byDept = await admin.post("/users/query", { page: 1, limit: 100, filters: { departmentId: almacen } });
  r.expect("búsqueda por departamento", byDept, 200);
  const almacenIds = idsOf(byDept.body);
  const expectedAlmacen = [...cast.file.employees.slice(0, 3).map((e) => e.id), p2.id];
  r.check(
    "Almacén trae a Lucía, Marco, Daniela y Ramiro (y no a Paula, que se movió)",
    expectedAlmacen.every((id) => almacenIds.includes(id)) && !almacenIds.includes(p1.id),
    `ids=${almacenIds.length} total=${byDept.body?.total}`
  );
  const byNumber = await admin.post("/users/query", { page: 1, limit: 10, filters: { employeeNumber: p1.employeeNumber } });
  r.check("búsqueda por número de empleado", idsOf(byNumber.body).length === 1 && idsOf(byNumber.body)[0] === p1.id, short(byNumber));
  const byName = await admin.post("/users/query", { page: 1, limit: 10, filters: { name: "Andrea" } });
  r.check("búsqueda por nombre cubre segundo nombre", idsOf(byName.body).includes(p1.id), short(byName));
  const bySurname = await admin.post("/users/query", { page: 1, limit: 10, filters: { name: "extra" } });
  r.check("búsqueda por apellido sin distinguir mayúsculas", [p1.id, p2.id].every((id) => idsOf(bySurname.body).includes(id)), `ids=${idsOf(bySurname.body).length}`);
  const byRole = await admin.post("/users/query", { page: 1, limit: 100, filters: { role: "HUMAN_RESOURCES" } });
  r.check("búsqueda por rol trae a RH", idsOf(byRole.body).includes(cast.file.hr.id) && rowsOf(byRole.body).every((u) => u.role === "HUMAN_RESOURCES"), `n=${idsOf(byRole.body).length}`);
  const badFilter = await admin.post("/users/query", { page: 1, limit: 10, filters: { active: "quizá" } });
  r.check("un filtro con valor inválido no truena (<500)", badFilter.status < 500, short(badFilter));
  const allQuery = await admin.post("/users/query", { page: 1, limit: 200 });
  r.check("/users/query del admin solo trae filas de su cliente", idsOf(allQuery.body).every((id) => !foreignIds.has(id)), `n=${idsOf(allQuery.body).length}`);

  // ── 5. Baja y reactivación ───────────────────────────────────────────────
  const p1Bot = await asBot(p1);
  const p1Login = await loginRaw(p1);
  const p1Refresh = p1Login.body?.refreshToken as string | undefined;
  r.check("el login devuelve refresh token", Boolean(p1Refresh), short(p1Login));
  const p1MeBefore = await p1Bot.get("/auth/me");
  r.expect("Paula usa su sesión antes de la baja", p1MeBefore, 200);

  const selfDown = await admin.patch(`/users/${admin.id}/deactivate`, { reason: "Prueba de autobaja", notifyUser: false });
  r.expect("nadie se da de baja a sí mismo", selfDown, 400, "CANNOT_DEACTIVATE_SELF");
  const shortReason = await admin.patch(`/users/${p1.id}/deactivate`, { reason: "x", notifyUser: false });
  r.expect("la baja exige motivo", shortReason, 400);
  const staffDown = await staff.patch(`/users/${p1.id}/deactivate`, { reason: "Baja por empleado", notifyUser: false });
  r.expect("un empleado no da de baja a nadie", staffDown, 403);

  const down = await admin.patch(`/users/${p1.id}/deactivate`, { reason: "Baja temporal de prueba QA", notifyUser: false });
  r.expect("el admin da de baja a Paula", down, 200);
  if (down.status === 200) active.delete(p1.id);
  r.check("la baja registra fecha y queda inactiva", down.body?.active === false && Boolean(down.body?.deactivatedAt), JSON.stringify(down.body));
  const tokenAfter = await p1Bot.get("/auth/me");
  r.expect("el token de Paula deja de servir tras la baja", tokenAfter, 401);
  if (tokenAfter.status === 200) r.finding("BLOQUEANTE", "Token sigue sirviendo tras la baja", `GET /auth/me con token previo → 200`);
  const tokenAfterOther = await p1Bot.get("/nom/me/punches");
  r.expect("…tampoco para otros endpoints (/nom/me/punches)", tokenAfterOther, 401);
  const loginAfter = await loginRaw(p1);
  r.expect("Paula ya no puede entrar", loginAfter, 403, "ACCOUNT_DEACTIVATED");
  if (p1Refresh) {
    const refreshAfter = await call(null, "POST", "/auth/refresh", { body: { refreshToken: p1Refresh } });
    r.expect("el refresh token de Paula tampoco sirve tras la baja", refreshAfter, 401);
  }
  const downAgain = await admin.patch(`/users/${p1.id}/deactivate`, { reason: "Otra vez la baja", notifyUser: false });
  r.expect("dar de baja dos veces → 409", downAgain, 409, "USER_ALREADY_DEACTIVATED");
  const directory = await admin.get("/users/employees");
  r.check("una persona dada de baja sale del directorio", directory.status === 200 && !idsOf(directory.body).includes(p1.id), short(directory));
  const inactiveQuery = await admin.post("/users/query", { page: 1, limit: 50, filters: { active: false } });
  r.check("el filtro active:false trae a Paula", idsOf(inactiveQuery.body).includes(p1.id) && rowsOf(inactiveQuery.body).every((u) => u.active === false), short(inactiveQuery));

  const hrDown = await hr.patch(`/users/${p2.id}/deactivate`, { reason: "Baja por RH de prueba", notifyUser: false });
  r.expect("RH da de baja a Ramiro (hr.records)", hrDown, 200);
  if (hrDown.status === 200) active.delete(p2.id);
  const hrUp = await hr.patch(`/users/${p2.id}/reactivate`);
  r.expect("RH reactiva a Ramiro", hrUp, 200);
  if (hrUp.status === 200) active.add(p2.id);

  const up = await admin.patch(`/users/${p1.id}/reactivate`);
  r.expect("el admin reactiva a Paula", up, 200);
  if (up.status === 200) active.add(p1.id);
  r.check("la reactivación limpia la baja", up.body?.active === true && up.body?.deactivatedAt === null, JSON.stringify(up.body));
  const upAgain = await admin.patch(`/users/${p1.id}/reactivate`);
  r.expect("reactivar a alguien activo → 409", upAgain, 409, "USER_ALREADY_ACTIVE");
  const loginBack = await loginRaw(p1);
  r.expect("Paula vuelve a entrar", loginBack, 200);
  const oldTokenBack = await p1Bot.get("/auth/me");
  r.check("(info) el token previo a la baja revive al reactivar", true, `status ${oldTokenBack.status}`);
  if (oldTokenBack.status === 200) {
    r.finding("BAJA", "El token emitido antes de la baja vuelve a servir al reactivar", `GET /auth/me con el access token previo a PATCH /users/${p1.id}/deactivate → 200 tras /reactivate. La baja no revoca sesiones; solo las pausa mientras active=false (auth.middleware.ts revalida active, no un tokenVersion).`);
  }

  // ── 6. Contraseña reseteada por el admin ─────────────────────────────────
  const fresh = await asBot(p1);
  const preResetToken = fresh.token;
  const tempPass = secret();
  const shortPass = await admin.put(`/users/${p1.id}/password`, { password: "123" });
  r.expect("una contraseña corta se rechaza", shortPass, 400);
  const reset = await admin.put(`/users/${p1.id}/password`, { password: tempPass });
  r.check("el admin resetea la contraseña de Paula", reset.status === 204 || reset.status === 200, short(reset));
  const oldPassLogin = await loginRaw(p1);
  r.expect("la contraseña anterior ya no entra", oldPassLogin, 401, "INVALID_CREDENTIALS");
  const tempLogin = await loginRaw({ username: p1.username, password: tempPass });
  r.expect("la provisional entra", tempLogin, 200);
  r.check("la provisional marca mustChangePassword", tempLogin.body?.user?.mustChangePassword === true, JSON.stringify(tempLogin.body?.user ?? {}).slice(0, 200));
  const preReset = await withToken(preResetToken).get("/auth/me");
  if (preReset.status === 200) {
    r.finding("MEDIA", "El reseteo de contraseña no cierra las sesiones abiertas", `Tras PUT /users/${p1.id}/password, el access token anterior sigue respondiendo GET /auth/me → 200 (y el refresh también renovaría). Si el reseteo es por cuenta comprometida, el atacante conserva la sesión hasta que venza el token.`);
  }
  r.check("(info) sesión previa tras el reseteo", true, `status ${preReset.status}`);
  const tempBot = withToken(tempLogin.body?.token ?? "");
  const tempUse = await tempBot.get("/nom/me/punches");
  if (tempUse.status === 200) {
    r.finding("BAJA", "mustChangePassword solo lo exige la web", `Con la contraseña provisional (mustChangePassword=true) el API responde GET /nom/me/punches → 200; el cambio obligatorio no se aplica en el servidor, una app/cliente propio lo puede omitir.`);
  }
  r.check("(info) uso del API con contraseña provisional", true, `status ${tempUse.status}`);
  const wrongCurrent = await tempBot.post("/auth/change-password", { currentPassword: "equivocada-123", newPassword: secret() });
  r.expect("cambiar contraseña con la actual equivocada → 400", wrongCurrent, 400, "INVALID_PASSWORD");
  const samePass = await tempBot.post("/auth/change-password", { currentPassword: tempPass, newPassword: tempPass });
  r.expect("cambiar a la misma contraseña → 400", samePass, 400, "PASSWORD_UNCHANGED");
  const finalPass = secret();
  const changed = await tempBot.post("/auth/change-password", { currentPassword: tempPass, newPassword: finalPass });
  r.expect("Paula cambia la provisional", changed, 204);
  p1.password = finalPass;
  const finalLogin = await loginRaw(p1);
  r.check("con la nueva ya no pide cambio", finalLogin.status === 200 && finalLogin.body?.user?.mustChangePassword === false, short(finalLogin));
  const pAdm = await createPerson(admin, "el admin da de alta a un segundo CLIENT_ADMIN", `3${tag}7`, { name: "Sergio", role: "CLIENT_ADMIN" });
  const hrResetsAdmin = pAdm ? await hr.put(`/users/${pAdm.id}/password`, { password: secret() }) : ({ status: 0, body: null, text: "sin persona" } as Res);
  no500("RH resetea la contraseña de un CLIENT_ADMIN", hrResetsAdmin);
  if (hrResetsAdmin.status > 0 && hrResetsAdmin.status < 300) {
    r.finding("ALTA", "RH puede resetear la contraseña de un administrador del cliente", `PUT /users/${pAdm?.id}/password (rol CLIENT_ADMIN) con token de HUMAN_RESOURCES → ${hrResetsAdmin.status}: RH toma la cuenta del admin y entra con la provisional. La ruta solo exige users.edit (user.routes.ts:292); falta validar que el objetivo no tenga más permisos que quien resetea.`);
  }
  r.check("RH no puede resetear la contraseña del CLIENT_ADMIN", hrResetsAdmin.status === 403, short(hrResetsAdmin));

  // ── 7. Borrado ───────────────────────────────────────────────────────────
  const p4 = await createPerson(admin, "alta de una persona para borrar", `3${tag}4`, { name: "Temporal" });
  if (p4) {
    const hrDelete = await hr.delete(`/users/${p4.id}`);
    r.expect("RH no borra cuentas (sin users.delete)", hrDelete, 403);
    const del = await admin.delete(`/users/${p4.id}`);
    no500("DELETE /users/:id", del);
    r.expect("el admin borra a la persona sin historial", del, 200);
    if (del.status === 200) {
      const gone = await admin.get(`/users/${p4.id}`);
      if (del.body?.soft) {
        r.check("el borrado lógico la deja inactiva", gone.body?.active === false, short(gone));
      } else {
        r.check("el borrado físico la quita", gone.status === 404, short(gone));
      }
      active.delete(p4.id);
    }
    const missing = await admin.delete(`/users/no-existe-${tag}`);
    r.expect("borrar una cuenta inexistente → 404", missing, 404);
  }

  // ── 8. Matriz de permisos por rol ────────────────────────────────────────
  const empId = cast.file.employees[1].id;
  type Probe = { label: string; method: "GET" | "POST" | "PUT" | "DELETE"; path: string; body?: unknown; perms: string[] };
  const probes: Probe[] = [
    { label: "GET /users", method: "GET", path: "/users", perms: ["users.view"] },
    { label: "GET /users/:id", method: "GET", path: `/users/${empId}`, perms: ["users.view"] },
    { label: "GET /users/:id/history", method: "GET", path: `/users/${empId}/history`, perms: ["users.view"] },
    { label: "POST /users/query", method: "POST", path: "/users/query", body: { page: 1, limit: 5 }, perms: ["users.view"] },
    { label: "POST /users/availability", method: "POST", path: "/users/availability", body: { field: "username", value: "zz-qa" }, perms: ["users.view"] },
    { label: "POST /users (inválido)", method: "POST", path: "/users", body: {}, perms: ["users.create"] },
    { label: "DELETE /users/:inexistente", method: "DELETE", path: `/users/no-existe-${tag}`, perms: ["users.delete"] },
    { label: "GET /users/:id/permissions", method: "GET", path: `/users/${empId}/permissions`, perms: ["users.permissions"] },
    { label: "GET /users/employees", method: "GET", path: "/users/employees", perms: ["schedules.view", "time_clock.view", "hr.records"] },
    { label: "POST /departments (inválido)", method: "POST", path: "/departments", body: {}, perms: ["departments.manage"] },
    { label: "POST /subareas (inválido)", method: "POST", path: "/subareas", body: {}, perms: ["departments.manage"] },
    { label: "GET /hr/catalogs/genders", method: "GET", path: "/hr/catalogs/genders", perms: ["hr.records"] },
    { label: "POST /hr/catalogs/genders (inválido)", method: "POST", path: "/hr/catalogs/genders", body: {}, perms: ["catalogs.manage"] },
    { label: "POST /hr/query", method: "POST", path: "/hr/query", body: { page: 1, limit: 5 }, perms: ["hr.records"] },
    { label: "GET /hr/stats", method: "GET", path: "/hr/stats", perms: ["hr.records"] },
    { label: "GET /hr/:id", method: "GET", path: `/hr/${empId}`, perms: ["hr.records"] },
    { label: "POST /hr/disciplinary-reports/query", method: "POST", path: "/hr/disciplinary-reports/query", body: { page: 1, limit: 5 }, perms: ["hr.disciplinary_reports"] },
    { label: "GET /dashboard/people", method: "GET", path: "/dashboard/people", perms: ["hr.records"] },
    { label: "GET /dashboard/hr-records", method: "GET", path: "/dashboard/hr-records", perms: ["hr.records"] },
    { label: "GET /dashboard/attendance-today", method: "GET", path: "/dashboard/attendance-today", perms: ["attendance.view"] },
    { label: "GET /dashboard/overtime-week", method: "GET", path: "/dashboard/overtime-week", perms: ["overtime.view"] },
    { label: "GET /dashboard/setup-gaps", method: "GET", path: "/dashboard/setup-gaps", perms: ["time_clock.link"] },
    { label: "GET /audit", method: "GET", path: "/audit", perms: ["audit.view"] },
    { label: "GET /schedules", method: "GET", path: "/schedules", perms: ["schedules.view"] },
    { label: "POST /schedules (inválido)", method: "POST", path: "/schedules", body: {}, perms: ["schedules.manage"] },
    { label: "POST /overtime/query", method: "POST", path: "/overtime/query", body: { page: 1, limit: 5 }, perms: ["overtime.view"] },
    { label: "POST /overtime/approvals (inválido)", method: "POST", path: "/overtime/approvals", body: {}, perms: ["overtime.approve"] },
    { label: "GET /payroll/settings", method: "GET", path: "/payroll/settings", perms: ["payroll.view"] },
    { label: "GET /payroll/positions", method: "GET", path: "/payroll/positions", perms: ["payroll.view"] },
    { label: "POST /payroll/positions (inválido)", method: "POST", path: "/payroll/positions", body: {}, perms: ["payroll.close"] },
    { label: "POST /time-clock/query", method: "POST", path: "/time-clock/query", body: { page: 1, limit: 5 }, perms: ["time_clock.view"] },
    { label: "GET /time-clock/status", method: "GET", path: "/time-clock/status", perms: ["time_clock.view"] },
    { label: "GET /time-clock/removal-categories", method: "GET", path: "/time-clock/removal-categories", perms: ["time_clock.view"] },
    { label: "POST /time-clock/clocks (inválido)", method: "POST", path: "/time-clock/clocks", body: {}, perms: ["time_clocks.manage"] },
    { label: "GET /time-clock/summary", method: "GET", path: "/time-clock/summary", perms: ["time_clocks.manage", "time_clock.write"] },
    { label: "POST /time-clock/employees/link-suggested (inválido)", method: "POST", path: "/time-clock/employees/link-suggested", body: { items: "x" }, perms: ["time_clock.link"] },
    { label: "POST /access/query", method: "POST", path: "/access/query", body: { page: 1, limit: 5 }, perms: ["access.log"] },
    { label: "GET /access/me/today", method: "GET", path: "/access/me/today", perms: ["access.scan"] },
    { label: "POST /access/sites (inválido)", method: "POST", path: "/access/sites", body: {}, perms: ["access.sites"] },
    { label: "GET /nom/config", method: "GET", path: "/nom/config", perms: ["time_clock.view", "payroll.view"] },
    { label: "GET /nom/adjustments", method: "GET", path: "/nom/adjustments", perms: ["time_clock.view", "payroll.view"] },
    { label: "GET /nom/leave/requests", method: "GET", path: "/nom/leave/requests", perms: ["time_clock.view", "payroll.view"] },
    { label: "GET /nom/alerts", method: "GET", path: "/nom/alerts", perms: ["time_clock.view", "payroll.view"] },
    { label: "GET /nom/me/punches", method: "GET", path: "/nom/me/punches", perms: [] },
    { label: "GET /notifications", method: "GET", path: "/notifications", perms: [] },
    { label: "GET /departments", method: "GET", path: "/departments", perms: [] },
    { label: "GET /permissions/roles", method: "GET", path: "/permissions/roles", perms: [] },
    { label: "GET /tenants", method: "GET", path: "/tenants", perms: ["__platform"] },
    { label: "GET /plans", method: "GET", path: "/plans", perms: ["__platform"] },
    { label: "GET /permissions/admin", method: "GET", path: "/permissions/admin", perms: ["__platform"] },
    { label: "GET /sys-config", method: "GET", path: "/sys-config", perms: ["__platform"] },
    { label: "PUT /permissions/matrix", method: "PUT", path: "/permissions/matrix", body: { changes: [] }, perms: ["__platform"] },
  ];
  const matrixRaw = JSON.parse(readFileSync(path.resolve(__dirname, "../../prisma/seed-data/role_permissions.json"), "utf8")) as Array<{ role: string; permission: string; scope: string }>;
  const roleHas = (role: string, perm: string) => matrixRaw.some((m) => m.role === role && m.permission === perm && m.scope !== "NONE");
  const roleBots: Array<[string, Bot]> = [
    ["CLIENT_STAFF", staff],
    ["HUMAN_RESOURCES", hr],
    ["CLIENT_ADMIN", admin],
  ];
  for (const [role, bot] of roleBots) {
    let ok = 0;
    const wrong: string[] = [];
    for (const p of probes) {
      const allowed = p.perms.length === 0 || p.perms.some((perm) => roleHas(role, perm));
      const res = await (p.method === "GET" ? bot.get(p.path) : p.method === "DELETE" ? bot.delete(p.path) : p.method === "PUT" ? bot.put(p.path, p.body) : bot.post(p.path, p.body));
      no500(`${role} ${p.label}`, res);
      const pass = allowed ? res.status !== 401 && res.status !== 403 && res.status < 500 : res.status === 403;
      if (pass) ok++;
      else wrong.push(`${p.label}: esperaba ${allowed ? "permitido" : "403"}, llegó ${res.status} ${codeOf(res) ?? ""}`);
      if (!pass && !allowed && res.status < 300) {
        const leak = p.path === "/users/query" ? ` Devuelve ${idsOf(res.body).length} cuentas con username/email/número/puesto. user.routes.ts: router.post("/query") no tiene requiresPermission (el mismo archivo protege /employees por esa razón).` : "";
        r.finding(role === "CLIENT_STAFF" ? "ALTA" : "MEDIA", `${role} entra a ${p.label} sin el permiso`, `${p.method} ${p.path} → ${res.status}; la matriz no le da ${p.perms.join("/")}.${leak}`);
      }
      if (!pass && allowed && res.status === 403) {
        r.finding("MEDIA", `${role} recibe 403 en ${p.label} teniendo el permiso`, `${p.method} ${p.path} → 403 ${codeOf(res) ?? ""}; la matriz le da ${p.perms.join("/")}.`);
      }
    }
    r.check(`matriz ${role}: ${ok}/${probes.length} endpoints según role_permissions.json`, wrong.length === 0, wrong.join(" | "));
  }

  // ── 9. Permisos por usuario ──────────────────────────────────────────────
  const p2Bot = await asBot(p2);
  const before = await p2Bot.get("/schedules");
  r.expect("Ramiro (CLIENT_STAFF) no ve horarios", before, 403);
  const perms = await admin.get(`/users/${p2.id}/permissions`);
  r.expect("el admin consulta los permisos de Ramiro", perms, 200);
  r.check("la vista de permisos trae el alcance del rol", rowsOf(perms.body).some((v) => v.permission === "attendance.view" && v.roleScope === "OWN"), `n=${rowsOf(perms.body).length}`);
  const grant = await admin.put(`/users/${p2.id}/permissions/schedules.view`, { scope: "ALL", reason: "Apoyo a horarios QA", expiresAt: null });
  r.expect("el admin le otorga schedules.view", grant, 200);
  const afterGrant = await p2Bot.get("/schedules");
  r.expect("la excepción surte efecto: Ramiro ve horarios", afterGrant, 200);
  const dir = await p2Bot.get("/users/employees");
  r.expect("…y el directorio de personas (schedules.view)", dir, 200);
  const hrGrant = await hr.put(`/users/${p2.id}/permissions/schedules.view`, { scope: "ALL" });
  r.expect("RH no otorga permisos (sin users.permissions)", hrGrant, 403);
  const ownGrant = await admin.put(`/users/${admin.id}/permissions/catalogs.manage`, { scope: "ALL" });
  r.expect("nadie cambia sus propios permisos", ownGrant, 400, "CANNOT_CHANGE_OWN_PERMISSIONS");
  const badScope = await admin.put(`/users/${p2.id}/permissions/schedules.view`, { scope: "OWN" });
  r.expect("un alcance no válido para el permiso se rechaza", badScope, 400, "INVALID_SCOPE_FOR_PERMISSION");
  const unknown = await admin.put(`/users/${p2.id}/permissions/no.existe`, { scope: "ALL" });
  r.expect("un permiso inexistente se rechaza", unknown, 400, "PERMISSION_DOES_NOT_EXIST");
  const revoke = await admin.delete(`/users/${p2.id}/permissions/schedules.view`);
  r.expect("el admin retira la excepción", revoke, 200);
  const afterRevoke = await p2Bot.get("/schedules");
  r.expect("sin la excepción vuelve el 403", afterRevoke, 403);
  const deny = await admin.put(`/users/${p1.id}/permissions/attendance.view`, { scope: "NONE", reason: "Quitar autoservicio QA" });
  r.expect("el admin puede quitar un permiso del rol con alcance NONE", deny, 200);
  const p1b = await asBot(p1);
  const denied = await p1b.get("/dashboard/attendance-today");
  r.expect("con attendance.view=NONE Paula ya no ve su asistencia", denied, 403);
  await admin.delete(`/users/${p1.id}/permissions/attendance.view`);

  const tenantsGrant = await admin.put(`/users/${p2.id}/permissions/tenants.view`, { scope: "ALL" });
  no500("otorgar tenants.view", tenantsGrant);
  if (tenantsGrant.status === 200) {
    const tenantsList = await p2Bot.get("/tenants");
    r.expect("aun con tenants.view, un usuario de cliente no lista clientes (requiresPlatform)", tenantsList, 403);
    if (tenantsList.status === 200) r.finding("BLOQUEANTE", "Un usuario de cliente lista todos los clientes con una excepción de permiso", `GET /tenants → 200 tras PUT /users/${p2.id}/permissions/tenants.view`);
    await admin.delete(`/users/${p2.id}/permissions/tenants.view`);
  }
  r.check("(info) el admin del cliente puede otorgar tenants.view (permiso de plataforma)", true, `status ${tenantsGrant.status}`);
  if (tenantsGrant.status === 200) {
    r.finding("BAJA", "El admin del cliente puede otorgar permisos de plataforma no sensibles", `PUT /users/${p2.id}/permissions/tenants.view {scope:ALL} → 200 (también plans.view, catalogs.manage). requiresPlatform lo neutraliza en /tenants y /plans, pero la consola muestra permisos que el cliente no debería poder dar. user-permissions.service.ts set() solo valida 'sensitive'.`);
  }

  const catGrant = await admin.put(`/users/${p2.id}/permissions/catalogs.manage`, { scope: "ALL", reason: "QA catálogos" });
  no500("otorgar catalogs.manage", catGrant);
  if (catGrant.status === 200) {
    const genderName = `QA género ${tag}`;
    const created = await p2Bot.post("/hr/catalogs/genders", { name: genderName });
    no500("POST /hr/catalogs/genders por cliente", created);
    if (created.status === 201) {
      const seenByOther = await intruderAdmin.get("/hr/catalogs/genders");
      const leaked = rowsOf(seenByOther.body).some((g) => g.name === genderName);
      r.finding(
        leaked ? "BLOQUEANTE" : "ALTA",
        "Un empleado con excepción de catalogs.manage escribe catálogos de RH globales",
        `CLIENT_ADMIN otorga catalogs.manage (no lo tiene ni es sensible) a un CLIENT_STAFF → PUT /users/${p2.id}/permissions/catalogs.manage 200; el empleado hace POST /hr/catalogs/genders → 201. Gender/BloodType no tienen tenantId (schema.prisma model Gender), así que el alta ${leaked ? "aparece en GET /hr/catalogs/genders del otro cliente" : "es global"}. hr.routes.ts:368 solo exige requiresPermission("catalogs.manage"), sin requiresPlatform (docs/modules/hr.md dice "solo plataforma").`
      );
      const genderId2 = created.body?.id;
      if (genderId2) {
        await platform.delete(`/hr/catalogs/genders/${genderId2}`, undefined, { tenantId });
        await platform.delete(`/hr/catalogs/genders/${genderId2}`, undefined, { tenantId });
      }
    }
    r.check("aun con catalogs.manage, un usuario de cliente no escribe catálogos globales", created.status === 403, short(created));
    await admin.delete(`/users/${p2.id}/permissions/catalogs.manage`);
  }

  // ── 10. Plataforma y X-Tenant-Id ─────────────────────────────────────────
  const platUsers = await platform.get("/users", { tenantId });
  r.expect("ADMIN de plataforma lista las personas del cliente con X-Tenant-Id", platUsers, 200);
  const platIds = idsOf(platUsers.body);
  r.check("ve al reparto y a las personas extra del cliente", [...cast.file.employees.map((e) => e.id), cast.file.hr.id, p1.id, p2.id].every((id) => platIds.includes(id)), `n=${platIds.length}`);
  r.check("y nada del otro cliente", platIds.every((id) => !foreignIds.has(id)), `n=${platIds.length}`);
  const platDepts = await platform.get("/departments", { tenantId });
  r.check("ve los departamentos del cliente y no los del otro", idsOf(platDepts.body).includes(almacen) && !idsOf(platDepts.body).includes(foreignDeptId), short(platDepts));
  const platDash = await platform.get("/dashboard/people", { tenantId });
  r.expect("ADMIN de plataforma ve el inicio de personal del cliente", platDash, 200);
  const platRecord = await platform.get(`/hr/${p1.id}`, { tenantId });
  r.expect("ADMIN de plataforma lee un expediente del cliente", platRecord, 200);
  const platOther = await platform.get(`/users/${p1.id}`, { tenantId: cast.file.intruder.tenant.id });
  r.check("con X-Tenant-Id del otro cliente, la plataforma no ve a Paula", platOther.status === 404, short(platOther));
  const badHeader = await platform.get("/departments", { tenantId: `no-existe-${tag}` });
  r.expect("un X-Tenant-Id inexistente se rechaza", badHeader, 400, "INVALID_TENANT_HEADER");

  const adminHeader = await admin.get("/users", { tenantId: cast.file.intruder.tenant.id });
  r.check(
    "un CLIENT_ADMIN con X-Tenant-Id ajeno no cambia de cliente",
    adminHeader.status === 403 || (adminHeader.status === 200 && idsOf(adminHeader.body).every((id) => !foreignIds.has(id))),
    short(adminHeader)
  );
  if (adminHeader.status === 200 && idsOf(adminHeader.body).some((id) => foreignIds.has(id))) {
    r.finding("BLOQUEANTE", "X-Tenant-Id cambia de cliente a un CLIENT_ADMIN", `GET /users con X-Tenant-Id=${cast.file.intruder.tenant.id} → personas del otro cliente`);
  }
  const intruderHeader = await intruderAdmin.get(`/users/${p1.id}`, { tenantId });
  r.check("el intruso con X-Tenant-Id de este cliente no lee a Paula", intruderHeader.status === 403 || intruderHeader.status === 404, short(intruderHeader));
  const empHeader = await intruderEmployee.get("/nom/me/punches", { tenantId });
  r.check("un empleado con X-Tenant-Id ajeno tampoco cambia de cliente", empHeader.status === 403, short(empHeader));
  const impersonate = await admin.post(`/tenants/${cast.file.intruder.tenant.id}/impersonate`);
  r.expect("un CLIENT_ADMIN no puede impersonar otro cliente", impersonate, 403);

  // ── 11. Aislamiento con ids reales ───────────────────────────────────────
  const acta = await hr.post("/hr/disciplinary-reports", { userId: p2.id, reason: "MISCONDUCT", incidentDate: new Date().toISOString().slice(0, 10), description: "Acta de prueba QA por retardo reiterado." });
  r.expect("RH levanta un acta a Ramiro", acta, 201);
  const actaId = acta.body?.id;
  const sub = await admin.post("/subareas", { departmentId: almacen, name: `Andén ${tag}` });
  r.expect("el admin crea una subárea en Almacén", sub, 201);
  const subId = sub.body?.id;
  await p2Bot.post("/nom/me/record-agreement/accept", { methods: ["CLOCK", "REMOTE"], roundingPolicy: "Minutos exactos", correctionRules: "Ajuste aprobado" });
  const punch = await p2Bot.post("/nom/me/punch", { type: "ENTRY", workMode: "REMOTO", clientEventId: randomUUID() });
  no500("POST /nom/me/punch", punch);
  r.check("Ramiro registra una entrada (para tener una checada real)", punch.status === 201 || punch.status === 200, short(punch));
  const punchId = punch.body?.punch?.id ?? punch.body?.id;
  const notif = await p1b.get("/notifications");
  const notifId = rowsOf(notif.body)[0]?.id ?? rowsOf(notif.body?.items)[0]?.id;

  type Attack = { label: string; run: () => Promise<Res>; ok?: number[] };
  const attacks: Attack[] = [
    { label: "GET /users/:id", run: () => intruderAdmin.get(`/users/${p1.id}`) },
    { label: "GET /users/:id/history", run: () => intruderAdmin.get(`/users/${p1.id}/history`) },
    { label: "PUT /users/:id", run: () => intruderAdmin.put(`/users/${p1.id}`, { jobTitle: "Hackeada" }) },
    { label: "PUT /users/:id/password", run: () => intruderAdmin.put(`/users/${p1.id}/password`, { password: secret() }) },
    { label: "PATCH /users/:id/deactivate", run: () => intruderAdmin.patch(`/users/${p1.id}/deactivate`, { reason: "Baja desde otro cliente", notifyUser: false }) },
    { label: "PATCH /users/:id/reactivate", run: () => intruderAdmin.patch(`/users/${p1.id}/reactivate`) },
    { label: "DELETE /users/:id", run: () => intruderAdmin.delete(`/users/${p4?.id ?? p1.id}`) },
    { label: "GET /users/:id/permissions", run: () => intruderAdmin.get(`/users/${p2.id}/permissions`) },
    { label: "GET /hr/:id", run: () => intruderAdmin.get(`/hr/${p1.id}`) },
    { label: "GET /hr/:id/overview", run: () => intruderAdmin.get(`/hr/${p1.id}/overview`) },
    { label: "PATCH /hr/:id/profile", run: () => intruderAdmin.patch(`/hr/${p1.id}/profile`, { city: "Hackeada" }) },
    { label: "GET /hr/:id/documents", run: () => intruderAdmin.get(`/hr/${p1.id}/documents`) },
    { label: "PUT /hr/:id/discounts", run: () => intruderAdmin.put(`/hr/${p1.id}/discounts`, { discounts: [{ type: "IMSS" }] }) },
    { label: "POST /hr/assignment", run: () => intruderAdmin.post("/hr/assignment", { userIds: [p1.id], departmentId: foreignDeptId ?? null }) },
    { label: "POST /hr/:id/notify-registration", run: () => intruderAdmin.post(`/hr/${p1.id}/notify-registration`, {}) },
    { label: "GET /departments/:id", run: () => intruderAdmin.get(`/departments/${almacen}`) },
    { label: "PUT /departments/:id", run: () => intruderAdmin.put(`/departments/${almacen}`, { name: "Hackeado" }) },
    { label: "DELETE /departments/:id", run: () => intruderAdmin.delete(`/departments/${oficina}`) },
    { label: "POST /subareas en depto ajeno", run: () => intruderAdmin.post("/subareas", { departmentId: almacen, name: "Intrusa" }) },
    { label: "PUT /subareas/:id", run: () => intruderAdmin.put(`/subareas/${subId}`, { name: "Hackeada" }) },
    { label: "DELETE /subareas/:id", run: () => intruderAdmin.delete(`/subareas/${subId}`) },
    { label: "GET /hr/disciplinary-reports/:id", run: () => intruderAdmin.get(`/hr/disciplinary-reports/${actaId}`) },
    { label: "DELETE /hr/disciplinary-reports/:id", run: () => intruderAdmin.delete(`/hr/disciplinary-reports/${actaId}`) },
    { label: "POST /hr/disciplinary-reports a persona ajena", run: () => intruderAdmin.post("/hr/disciplinary-reports", { userId: p2.id, reason: "MISCONDUCT", incidentDate: "2026-11-02", description: "Acta desde otro cliente QA." }) },
    { label: "GET /time-clock/employees/:id/clock-status", run: () => intruderAdmin.get(`/time-clock/employees/${p2.id}/clock-status`) },
  ];
  if (punchId) {
    attacks.push({ label: "GET /nom/punches/:id/history", run: () => intruderAdmin.get(`/nom/punches/${punchId}/history`) });
    attacks.push({ label: "POST /nom/punches/:id/adjustments", run: () => intruderAdmin.post(`/nom/punches/${punchId}/adjustments`, { occurredAt: new Date().toISOString(), reason: "Ajuste desde otro cliente QA" }) });
  }
  if (notifId) {
    attacks.push({ label: "POST /notifications/:id/read", run: () => intruderAdmin.post(`/notifications/${notifId}/read`) });
    attacks.push({ label: "DELETE /notifications/:id", run: () => intruderAdmin.delete(`/notifications/${notifId}`) });
  }
  for (const a of attacks) {
    const res = await a.run();
    no500(`intruso ${a.label}`, res);
    const blocked = res.status === 404 || res.status === 403 || res.status === 400 || res.status === 409 || res.status === 422;
    const emptyOk = res.status === 200 && (a.label.includes("history") || a.label.includes("documents")) && rowsOf(res.body).length === 0;
    r.check(`aislamiento: el intruso no puede ${a.label}`, blocked || emptyOk, short(res));
    if (!blocked && !emptyOk) {
      r.finding("BLOQUEANTE", `Fuga entre clientes: ${a.label}`, `Con el CLIENT_ADMIN de ${cast.file.intruder.tenant.slug} sobre ids de ${slug} → ${short(res)}`);
    }
  }
  // Excepciones de permiso sobre personas de este cliente.
  const xGrant = await intruderAdmin.put(`/users/${p2.id}/permissions/schedules.view`, { scope: "ALL", reason: "Desde otro cliente" });
  no500("intruso PUT permiso", xGrant);
  await p2Bot.login();
  const xEffect = await p2Bot.get("/schedules");
  r.check("aislamiento: el intruso no puede otorgar permisos a Ramiro", xEffect.status === 403, `PUT → ${short(xGrant)}; Ramiro GET /schedules → ${xEffect.status}`);
  if (xEffect.status !== 403) {
    r.finding(
      "BLOQUEANTE",
      "Un admin de otro cliente otorga permisos a personas de este cliente",
      `PUT /users/${p2.id}/permissions/schedules.view {scope:ALL} con el CLIENT_ADMIN de ${cast.file.intruder.tenant.slug} responde ${xGrant.status} ${codeOf(xGrant) ?? ""}, pero la excepción SÍ se guarda: Ramiro (${slug}) pasa de 403 a ${xEffect.status} en GET /schedules, y el audit_log del otro cliente registra PERMISSION_EXCEPTION_SET. user_permissions no tiene tenantId (no la cubre la extensión de tenancy) y user-permissions.service.ts:158 hace upsert por userId sin validar que el usuario sea del cliente; el 404 sale después, en this.list() (línea 177).`
    );
    await admin.delete(`/users/${p2.id}/permissions/schedules.view`);
  }
  const ownGrant2 = await admin.put(`/users/${p2.id}/permissions/overtime.view`, { scope: "ALL", reason: "Para prueba de borrado ajeno" });
  r.expect("el admin otorga overtime.view a Ramiro", ownGrant2, 200);
  const xRevoke = await intruderAdmin.delete(`/users/${p2.id}/permissions/overtime.view`);
  no500("intruso DELETE permiso", xRevoke);
  // Las excepciones viajan en el token: se vuelve a entrar para ver las vigentes.
  await p2Bot.login();
  const stillGranted = await p2Bot.post("/overtime/query", { page: 1, limit: 5 });
  r.check("aislamiento: el intruso no puede retirar permisos de Ramiro", stillGranted.status !== 403, `DELETE → ${short(xRevoke)}; Ramiro POST /overtime/query → ${stillGranted.status}`);
  if (stillGranted.status === 403) {
    r.finding("BLOQUEANTE", "Un admin de otro cliente retira permisos a personas de este cliente", `DELETE /users/${p2.id}/permissions/overtime.view con el CLIENT_ADMIN de ${cast.file.intruder.tenant.slug} → ${xRevoke.status}; la excepción desaparece (Ramiro vuelve a 403). user-permissions.service.ts:181-188 busca y borra por userId sin filtrar cliente.`);
  }
  await admin.delete(`/users/${p2.id}/permissions/overtime.view`);

  // El intruso liga a SU empleado a un departamento de ESTE cliente.
  const xDept = await intruderAdmin.put(`/users/${cast.file.intruder.employee.id}`, { departmentId: almacen });
  no500("intruso PUT departamento ajeno", xDept);
  const xDeptRead = await intruderAdmin.get(`/users/${cast.file.intruder.employee.id}`);
  const xLinked = xDeptRead.body?.department?.id === almacen || xDeptRead.body?.departmentId === almacen;
  r.check("aislamiento: el intruso no puede ligar a su gente a un departamento de este cliente", !xLinked, `PUT → ${short(xDept)}; department=${JSON.stringify(xDeptRead.body?.department)}`);
  if (xLinked) {
    r.finding(
      "BLOQUEANTE",
      "Un cliente liga a su personal con un departamento de otro cliente (y lee su nombre)",
      `PUT /users/${cast.file.intruder.employee.id} {departmentId:"${almacen}"} (id de Almacén de ${slug}) con el CLIENT_ADMIN de ${cast.file.intruder.tenant.slug} → ${xDept.status}; GET /users/:id devuelve department=${JSON.stringify(xDeptRead.body?.department)}. Con eso se enumeran ids y nombres de departamentos ajenos y el depto ajeno aparece en /users, /users/query, /users/employees, /hr/query y /dashboard/attendance-today del intruso. user.service.ts:441-443 escribe departmentId sin validar que el departamento sea del cliente (lo mismo aplica a subareaId).`
    );
  }
  await intruderAdmin.put(`/users/${cast.file.intruder.employee.id}`, { departmentId: null });

  const p1After = await admin.get(`/users/${p1.id}`);
  r.check("Paula sigue intacta tras los intentos (activa, puesto y departamento)", p1After.body?.active === true && p1After.body?.jobTitle === "Jefa de montacargas" && p1After.body?.department?.id === oficina, JSON.stringify({ a: p1After.body?.active, j: p1After.body?.jobTitle, d: p1After.body?.department?.id }));
  const p1StillLogs = await loginRaw(p1);
  r.expect("Paula sigue entrando con su contraseña (el intruso no la cambió)", p1StillLogs, 200);
  const p1RecordAfter = await hr.get(`/hr/${p1.id}`);
  r.check("el expediente de Paula no cambió", p1RecordAfter.body?.city === profile.city && (p1RecordAfter.body?.discounts ?? []).length === 0, `city=${p1RecordAfter.body?.city}`);
  const deptsAfter = await admin.get("/departments");
  r.check("Almacén y Oficina siguen con su nombre", rowsOf(deptsAfter.body).some((d) => d.id === almacen && String(d.name).toLowerCase() === "almacén") && rowsOf(deptsAfter.body).some((d) => d.id === oficina), short(deptsAfter));
  if (actaId) {
    const actaAfter = await hr.get(`/hr/disciplinary-reports/${actaId}`);
    r.expect("el acta de Ramiro sigue ahí", actaAfter, 200);
  }

  const lists: Array<[string, () => Promise<Res>]> = [
    ["GET /users", () => intruderAdmin.get("/users")],
    ["POST /users/query", () => intruderAdmin.post("/users/query", { page: 1, limit: 200 })],
    ["GET /users/employees", () => intruderAdmin.get("/users/employees?includeInactive=true")],
    ["POST /hr/query", () => intruderAdmin.post("/hr/query", { page: 1, limit: 200 })],
    ["GET /departments", () => intruderAdmin.get("/departments")],
    ["POST /departments/query", () => intruderAdmin.post("/departments/query", { page: 1, limit: 200 })],
    ["GET /subareas", () => intruderAdmin.get("/subareas")],
    ["POST /hr/disciplinary-reports/query", () => intruderAdmin.post("/hr/disciplinary-reports/query", { page: 1, limit: 200 })],
    ["GET /hr/disciplinary-reports/employee/:id", () => intruderAdmin.get(`/hr/disciplinary-reports/employee/${p2.id}`)],
    ["POST /time-clock/employees/query", () => intruderAdmin.post("/time-clock/employees/query", { page: 1, limit: 200 })],
    ["GET /dashboard/attendance-today", () => intruderAdmin.get("/dashboard/attendance-today")],
    ["GET /notifications", () => intruderAdmin.get("/notifications")],
    ["GET /audit", () => intruderAdmin.get("/audit")],
  ];
  const ourAll = new Set<string>([...ownIds, almacen, oficina, ...(subId ? [subId] : []), ...(actaId ? [actaId] : []), ...(punchId ? [punchId] : [])]);
  for (const [label, run] of lists) {
    const res = await run();
    no500(`intruso lista ${label}`, res);
    const text = JSON.stringify(res.body ?? "");
    const candidates = label === "GET /audit" ? [almacen, oficina, subId, actaId, punchId].filter(Boolean) as string[] : [...ourAll];
    const hits = candidates.filter((id) => id && text.includes(id));
    const slugHit = false;
    r.check(`aislamiento: ${label} del intruso no trae filas de ${slug}`, hits.length === 0 && !slugHit, `status ${res.status}; ids ajenos: ${hits.slice(0, 3).join(",")}`);
    if (hits.length || slugHit) r.finding("BLOQUEANTE", `Fuga entre clientes en ${label}`, `${label} con el admin de ${cast.file.intruder.tenant.slug} trae ${hits.length} ids de ${slug} (${hits.slice(0, 3).join(",")})`);
  }
  const intruderPeople = await intruderAdmin.get("/dashboard/people");
  const intruderExpected = intruderBase + (sameNameOther.status === 201 ? 1 : 0);
  r.check(`el inicio del intruso cuenta solo a su gente (${intruderExpected})`, intruderPeople.body?.active === intruderExpected, `active=${intruderPeople.body?.active}`);
  const staffIntrude = await intruderEmployee.get(`/users/${p1.id}`);
  r.expect("el empleado intruso tampoco lee personas", staffIntrude, 403);
  const staffIntrudeAudit = await intruderEmployee.get(`/hr/${p1.id}`);
  r.expect("ni expedientes", staffIntrudeAudit, 403);
  const foreignLogin = await call(null, "POST", "/auth/login", { body: { username: p1.username, password: p1.password, tenant: cast.file.intruder.tenant.slug } });
  r.check("la contraseña de Paula no abre el homónimo del otro cliente", foreignLogin.status === 401, short(foreignLogin));
  if (actaId) {
    const cleanupActa = await hr.delete(`/hr/disciplinary-reports/${actaId}`);
    r.expect("RH elimina el acta de prueba", cleanupActa, 200);
  }

  // ── 12. Límite de personas del plan ──────────────────────────────────────
  const before12 = await platform.get(`/tenants/${tenantId}`);
  r.expect("la plataforma consulta el cliente", before12, 200);
  const usage = before12.body?.usage?.activeUsers ?? before12.body?.tenant?.usage?.activeUsers;
  r.check(`el uso del cliente cuadra con el reparto + extras (${expectedActive()})`, usage === expectedActive(), `usage=${usage}`);
  const originalLimit = before12.body?.employeeLimit ?? null;
  const limitSet = await platform.patch(`/tenants/${tenantId}`, { employeeLimit: expectedActive() });
  if (r.expect("la plataforma fija el límite de personas del cliente al uso actual", limitSet, 200)) {
    try {
      const overLimit = await admin.post("/users", { username: `${slug}.x${tag}.over`, password: secret(), name: "Excedente", role: "CLIENT_STAFF" });
      r.expect("alta por encima del límite → 409", overLimit, 409, "EMPLOYEE_LIMIT_REACHED");
      if (overLimit.status === 201) {
        ownIds.add(overLimit.body.id);
        active.add(overLimit.body.id);
        r.finding("ALTA", "El alta ignora el límite de personas del plan", `POST /users con employeeLimit=${expectedActive() - 1} → 201`);
      }
      const p5Down = await admin.patch(`/users/${p2.id}/deactivate`, { reason: "Liberar lugar QA", notifyUser: false });
      r.expect("dar de baja a Ramiro libera un lugar", p5Down, 200);
      if (p5Down.status === 200) active.delete(p2.id);
      const p6 = await createPerson(admin, "con el lugar libre, el alta vuelve a pasar", `3${tag}6`, { name: "Sustituta" });
      const reup = await admin.patch(`/users/${p2.id}/reactivate`);
      no500("reactivar sobre el límite", reup);
      if (reup.status === 200) {
        active.add(p2.id);
        r.finding("MEDIA", "Reactivar ignora el límite de personas del plan", `Con el cliente al tope (employeeLimit=${expectedActive() - 1}), PATCH /users/${p2.id}/reactivate → 200 y deja ${expectedActive()} activas. user.service.ts reactivate() no llama assertCanAddPeople (solo create() e import).`);
        const d = await admin.patch(`/users/${p2.id}/deactivate`, { reason: "Regresar al tope QA", notifyUser: false });
        if (d.status === 200) active.delete(p2.id);
      }
      r.check("reactivar por encima del límite → 409", reup.status === 409, short(reup));
      const viaPut = await admin.put(`/users/${p2.id}`, { active: true });
      no500("PUT active:true sobre el límite", viaPut);
      const viaPutRead = await admin.get(`/users/${p2.id}`);
      if (viaPutRead.body?.active === true) {
        active.add(p2.id);
        r.finding("MEDIA", "PUT /users/:id {active:true} reactiva sin límite ni bitácora de baja", `PUT /users/${p2.id} {active:true} → ${viaPut.status} con el cliente al tope; UserUpdateDto acepta 'active' y update() lo escribe directo (sin assertCanAddPeople, sin limpiar deactivatedAt/motivo).`);
      }
      r.check("PUT {active:true} no reactiva por encima del límite", viaPutRead.body?.active === false, `PUT → ${short(viaPut)}; active=${viaPutRead.body?.active}`);
      if (p6) {
        const d6 = await admin.patch(`/users/${p6.id}/deactivate`, { reason: "Fin de prueba de límite", notifyUser: false });
        if (d6.status === 200) active.delete(p6.id);
      }
    } finally {
      const restore = await platform.patch(`/tenants/${tenantId}`, { employeeLimit: originalLimit });
      r.expect("la plataforma restablece el límite original", restore, 200);
    }
    if (!active.has(p2.id)) {
      const back = await admin.patch(`/users/${p2.id}/reactivate`);
      r.expect("sin límite, Ramiro se reactiva", back, 200);
      if (back.status === 200) active.add(p2.id);
    }
  }

  // ── 13. Sesión ───────────────────────────────────────────────────────────
  const sess = await loginRaw(p1);
  await new Promise((res) => setTimeout(res, 1100));
  const refreshed = await call(null, "POST", "/auth/refresh", { body: { refreshToken: sess.body?.refreshToken } });
  r.expect("el refresh token entrega un access nuevo", refreshed, 200);
  r.check("el refresh rota (entrega otro refresh)", Boolean(refreshed.body?.refreshToken) && refreshed.body?.refreshToken !== sess.body?.refreshToken, "mismo refresh");
  const meNew = await withToken(refreshed.body?.token ?? "").get("/auth/me");
  r.check("el access renovado sirve y es de Paula en su cliente", meNew.status === 200 && meNew.body?.id === p1.id && meNew.body?.tenant?.slug === slug, short(meNew));
  const refreshAsAccess = await withToken(sess.body?.refreshToken ?? "").get("/auth/me");
  r.expect("un refresh token no sirve como access", refreshAsAccess, 401, "INVALID_TOKEN");
  const accessAsRefresh = await call(null, "POST", "/auth/refresh", { body: { refreshToken: sess.body?.token } });
  r.expect("un access token no sirve como refresh", accessAsRefresh, 401);
  const garbage = await call(null, "POST", "/auth/refresh", { body: { refreshToken: "basura" } });
  r.expect("un refresh basura → 401", garbage, 401, "INVALID_REFRESH_TOKEN");
  const token: string = sess.body?.token ?? "";
  const [h, pl, sig] = token.split(".");
  const payload = JSON.parse(Buffer.from(pl, "base64url").toString("utf8"));
  const forged = `${h}.${Buffer.from(JSON.stringify({ ...payload, role: "ADMIN", tenantId: null })).toString("base64url")}.${sig}`;
  const forgedRes = await withToken(forged).get("/auth/me");
  r.expect("un token con el payload alterado → 401", forgedRes, 401, "INVALID_TOKEN");
  const flipped = `${h}.${pl}.${sig.slice(0, -2)}${sig.slice(-2) === "AA" ? "BB" : "AA"}`;
  r.expect("un token con la firma alterada → 401", await withToken(flipped).get("/auth/me"), 401, "INVALID_TOKEN");
  const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${pl}.`;
  r.expect("un token alg=none → 401", await withToken(none).get("/auth/me"), 401, "INVALID_TOKEN");
  const expired = `${h}.${Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) - 3600 })).toString("base64url")}.${sig}`;
  r.expect("un token con exp vencido (re-firmado no) → 401", await withToken(expired).get("/auth/me"), 401, "INVALID_TOKEN");
  r.expect("sin token → 401", await call(null, "GET", "/auth/me"), 401, "TOKEN_MISSING");
  r.expect("cabecera Authorization mal formada → 401", await call(null, "GET", "/auth/me", { headers: { authorization: `Token ${token}` } }), 401, "INVALID_AUTHORIZATION_HEADER");
  r.check("(info) vida del access token", true, `exp-iat = ${payload.exp && payload.iat ? payload.exp - payload.iat : "?"} s`);
  const wrongPassLogin = await call(null, "POST", "/auth/login", { body: { username: p1.username, password: "no-es-la-clave", tenant: slug } });
  r.expect("login con contraseña equivocada → 401", wrongPassLogin, 401, "INVALID_CREDENTIALS");
  const noTenantLogin = await call(null, "POST", "/auth/login", { body: { username: p1.username, password: p1.password } });
  r.expect("login de personal de cliente sin código de empresa → 401", noTenantLogin, 401, "INVALID_CREDENTIALS");

  // ── 14. Inicio / dashboard por rol ───────────────────────────────────────
  const expected = expectedActive();
  const adminPeople = await admin.get("/dashboard/people");
  r.expect("el admin ve el inicio de personal", adminPeople, 200);
  r.check(`el inicio del admin cuenta ${expected} personas activas (${baseActive} al empezar + ${active.size} extra)`, adminPeople.body?.active === expected, `active=${adminPeople.body?.active}`);
  const monthDepartures = adminPeople.body?.departuresThisMonth;
  r.check("las bajas del mes cuentan las de este flujo", typeof monthDepartures === "number" && monthDepartures >= 1, `departures=${monthDepartures}`);
  const hrPeople = await hr.get("/dashboard/people");
  r.check(`el inicio de RH cuenta ${expected} activas`, hrPeople.status === 200 && hrPeople.body?.active === expected, `active=${hrPeople.body?.active}`);
  const staffPeople = await staff.get("/dashboard/people");
  r.expect("un empleado no ve el inicio de personal", staffPeople, 403);
  const stats = await hr.get("/hr/stats");
  r.check(`/hr/stats cuadra (activos=${expected})`, stats.status === 200 && stats.body?.active === expected && stats.body?.total - stats.body?.inactive === expected, JSON.stringify(stats.body));
  const roleSum = Object.values(stats.body?.roles ?? {}).reduce((a: number, b: any) => a + Number(b), 0);
  r.check("/hr/stats: el desglose por rol suma el total", roleSum === stats.body?.total && (stats.body?.roles?.CLIENT_STAFF ?? 0) >= 6, JSON.stringify(stats.body?.roles));
  const tenantNow = await platform.get(`/tenants/${tenantId}`);
  const usageNow = tenantNow.body?.usage?.activeUsers ?? tenantNow.body?.tenant?.usage?.activeUsers;
  r.check(`el uso del cliente en plataforma cuadra (${expected})`, usageNow === expected, `usage=${usageNow}`);
  for (const [role, bot] of roleBots) {
    const att = await bot.get("/dashboard/attendance-today");
    no500(`${role} attendance-today`, att);
    if (role === "CLIENT_STAFF") {
      const rows = rowsOf(att.body?.rows);
      r.check(`${role}: la asistencia de hoy solo trae su propia fila`, att.status === 200 && att.body?.scope === "OWN" && rows.every((x) => x.userId === bot.id), `status ${att.status} scope=${att.body?.scope} rows=${rows.length}`);
    } else {
      const rows = rowsOf(att.body?.rows);
      r.check(`${role}: la asistencia de hoy cubre al personal del cliente`, att.status === 200 && att.body?.scope === "ALL" && rows.every((x) => ownIds.has(x.userId)), `status ${att.status} scope=${att.body?.scope} rows=${rows.length}`);
      r.check(`${role}: counts.people cuadra con las filas`, att.body?.counts?.people === rows.length, JSON.stringify(att.body?.counts));
    }
    const me = await bot.get("/auth/me");
    r.check(`${role}: /auth/me trae permisos efectivos`, me.status === 200 && me.body?.role === role, `role=${me.body?.role}`);
  }
  const hrRecords = await hr.get("/dashboard/hr-records");
  r.expect("RH ve los expedientes incompletos", hrRecords, 200);
  const setupGaps = await admin.get("/dashboard/setup-gaps");
  r.expect("el admin ve los pendientes de configuración", setupGaps, 200);
}
