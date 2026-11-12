#!/usr/bin/env node
/**
 * Bot de alta masiva para un cliente: crea N empleados, N turnos (horarios) y
 * les asigna horario. Habla con el API real (no toca la BD directamente).
 *
 * Uso (desde la raíz del repo):
 *   BOT_USER=martin.garcia BOT_PASS='...' pnpm bot:alta
 *   BOT_USER=... BOT_PASS=... BOT_DRY_RUN=1 pnpm bot:alta   # solo simula
 *
 * Variables (todas opcionales salvo BOT_USER/BOT_PASS):
 *   BOT_API_URL           default http://127.0.0.1:4011/api/v1
 *   BOT_TENANT            slug del cliente, default "panaderia"
 *   BOT_COUNT             empleados a crear, default 5
 *   BOT_EMP_PASSWORD      contraseña provisional de las cuentas nuevas
 *   BOT_FROM              fecha de vigencia de la asignación (YYYY-MM-DD);
 *                         default el inicio de la semana del cliente
 *   BOT_SHIFTS            JSON con turnos: [{ "name", "startTime", "endTime",
 *                         "mealBreakMin", "assignedTo" }]
 *   BOT_DRY_RUN=1         planea sin escribir
 *   BOT_ALLOW_REMOTE=1    permite un API que no sea loopback
 *
 * Es idempotente por username y por nombre de turno: si ya existen, los reusa.
 */
import process from "node:process";

const CFG = {
  apiUrl: (process.env.BOT_API_URL ?? "http://127.0.0.1:4011/api/v1").replace(/\/+$/, ""),
  tenant: process.env.BOT_TENANT ?? "panaderia",
  user: process.env.BOT_USER,
  pass: process.env.BOT_PASS,
  count: Number.parseInt(process.env.BOT_COUNT ?? "5", 10),
  employeePassword: process.env.BOT_EMP_PASSWORD ?? "Panaderia2026!",
  from: process.env.BOT_FROM,
  dryRun: process.env.BOT_DRY_RUN === "1",
  allowRemote: process.env.BOT_ALLOW_REMOTE === "1",
};

/** Empleados por defecto: nombres y números de empleado pensados para panadería. */
const EMPLOYEES = [
  { username: "ana.ramirez", name: "Ana Lucía", paternalSurname: "Ramírez", maternalSurname: "Torres", employeeNumber: "9001", jobTitle: "Panadera" },
  { username: "carlos.mendoza", name: "Carlos", paternalSurname: "Mendoza", maternalSurname: "Ríos", employeeNumber: "9002", jobTitle: "Ayudante de panadería" },
  { username: "fernanda.castillo", name: "Fernanda", paternalSurname: "Castillo", maternalSurname: "Vega", employeeNumber: "9003", jobTitle: "Cajera" },
  { username: "jorge.salazar", name: "Jorge", paternalSurname: "Salazar", maternalSurname: "Domínguez", employeeNumber: "9004", jobTitle: "Repostero" },
  { username: "maria.ortiz", name: "María Fernanda", paternalSurname: "Ortiz", maternalSurname: "Luna", employeeNumber: "9005", jobTitle: "Vendedora" },
];

/** Turnos por defecto: L–V con comida de 60 min; sábado y domingo descanso. */
const DEFAULT_SHIFTS = [
  { name: "Turno Matutino", startTime: "08:00", endTime: "17:00", mealBreakMin: 60, assignedTo: 3 },
  { name: "Turno Vespertino", startTime: "13:00", endTime: "22:00", mealBreakMin: 60, assignedTo: 2 },
];

const shifts = CFG.shiftsJson ? JSON.parse(CFG.shiftsJson) : DEFAULT_SHIFTS;

let token = null;

const color = process.stdout.isTTY
  ? { ok: "\u001b[32m", warn: "\u001b[33m", err: "\u001b[31m", dim: "\u001b[2m", reset: "\u001b[0m" }
  : { ok: "", warn: "", err: "", dim: "", reset: "" };

const ok = (msg) => console.log(`${color.ok}✓${color.reset} ${msg}`);
const warn = (msg) => console.log(`${color.warn}⚠${color.reset} ${msg}`);
const fail = (msg) => {
  console.error(`${color.err}✗${color.reset} ${msg}`);
  process.exitCode = 1;
};
const title = (msg) => console.log(`\n${msg}`);
const dim = (msg) => console.log(`${color.dim}${msg}${color.reset}`);

const api = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(`${CFG.apiUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  return { status: res.status, body: json, text };
};

const describe = (res) => {
  const code = res.body?.code ?? res.body?.error ?? "";
  const message = res.body?.message ?? "";
  return `${res.status} ${code}${message ? ` — ${message}` : ""}`.trim();
};

const requireOk = (label, res, expected = [200, 201]) => {
  if (!expected.includes(res.status)) {
    throw new Error(`${label}: ${describe(res)}`);
  }
  ok(label);
  return res.body;
};

/** Fecha de hoy en la zona del cliente y, si `weekStartDay` viene, el inicio de su semana. */
const todayAndWeekStart = (timeZone, weekStartDay) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  if (weekStartDay == null) return { today, weekStart: today };
  const [y, m, d] = today.split("-").map(Number);
  const weekdayJs = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo
  const offset = (weekdayJs - weekStartDay + 7) % 7;
  const start = new Date(Date.UTC(y, m - 1, d - offset));
  return { today, weekStart: start.toISOString().slice(0, 10) };
};

const checkLocalApi = () => {
  const host = new URL(CFG.apiUrl).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!local && !CFG.allowRemote) {
    throw new Error(
      `El API (${CFG.apiUrl}) no es local. Si de verdad quieres escribir ahí, corre con BOT_ALLOW_REMOTE=1.`
    );
  }
};

const login = async () => {
  if (!CFG.user || !CFG.pass) {
    throw new Error("Falta BOT_USER y/o BOT_PASS (credenciales de un admin del cliente).");
  }
  const res = await api("/auth/login", {
    method: "POST",
    body: { username: CFG.user, password: CFG.pass, tenant: CFG.tenant },
  });
  const data = requireOk(`Sesión de ${CFG.user} en ${CFG.tenant}`, res);
  token = data.token;
  return data.user;
};

const main = async () => {
  checkLocalApi();
  dim(`API ${CFG.apiUrl} · cliente "${CFG.tenant}"${CFG.dryRun ? " · SIMULACIÓN (sin escrituras)" : ""}`);
  const sessionUser = await login();

  const me = await api("/auth/me");
  const meBody = requireOk("Sesión verificada", me);
  for (const permission of ["users.create", "schedules.manage"]) {
    if (!meBody.permissions?.[permission]) {
      throw new Error(`La cuenta ${sessionUser.username} no tiene el permiso ${permission}.`);
    }
  }
  ok(`Permisos de alta y horarios presentes (${meBody.tenant?.name ?? CFG.tenant})`);

  const { today, weekStart } = todayAndWeekStart(meBody.tenant?.timezone ?? "America/Mexico_City", meBody.tenant?.weekStartDay);
  const from = CFG.from ?? weekStart;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error(`BOT_FROM inválida: ${from}`);
  dim(`Hoy ${today} · vigencia de la asignación: ${from}`);

  /* ---------------- Empleados ---------------- */
  title("1) Empleados");
  const employees = EMPLOYEES.slice(0, Math.max(1, CFG.count));
  if (employees.length < CFG.count) {
    warn(`El catálogo del bot trae ${EMPLOYEES.length} personas; se crearán ${employees.length}.`);
  }

  const existingUsers = await api("/users");
  const usersByName = new Map((requireOk("Usuarios actuales leídos", existingUsers) ?? []).map((u) => [u.username, u]));

  const created = [];
  for (const employee of employees) {
    const found = usersByName.get(employee.username);
    if (found) {
      ok(`${employee.username} ya existe, se reusa (${found.id})`);
      created.push({ ...employee, id: found.id, reused: true });
      continue;
    }
    if (CFG.dryRun) {
      ok(`${employee.username} se crearía como ${employee.name}`);
      created.push({ ...employee, id: null, reused: false });
      continue;
    }
    const res = await api("/users", {
      method: "POST",
      body: {
        username: employee.username,
        password: CFG.employeePassword,
        name: employee.name,
        middleName: employee.middleName,
        paternalSurname: employee.paternalSurname,
        maternalSurname: employee.maternalSurname,
        role: "CLIENT_STAFF",
        employeeNumber: employee.employeeNumber,
        jobTitle: employee.jobTitle,
        // Sin correo y sin documentos: ambos son opcionales en el alta.
      },
    });
    if (res.status === 409 && res.body?.code === "USERNAME_TAKEN") {
      const again = await api("/users");
      const match = (again.body ?? []).find((u) => u.username === employee.username);
      if (!match) throw new Error(`${employee.username} está tomado pero no se encontró al usuario.`);
      warn(`${employee.username} ya existía; se reusa (${match.id})`);
      created.push({ ...employee, id: match.id, reused: true });
      continue;
    }
    if (res.status === 409 && res.body?.code === "EMPLOYEE_NUMBER_TAKEN") {
      throw new Error(`El número de empleado ${employee.employeeNumber} ya está tomado; ajusta el catálogo o BOT_COUNT.`);
    }
    const user = requireOk(`Alta de ${employee.name} (@${employee.username})`, res);
    created.push({ ...employee, id: user.id, reused: false });
  }

  /* ---------------- Turnos ---------------- */
  title("2) Turnos (horarios)");
  const existingSchedules = await api("/schedules");
  const schedulesByName = new Map((requireOk("Horarios actuales leídos", existingSchedules) ?? []).map((s) => [s.name, s]));

  const allDays = (startTime, endTime) =>
    [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime, endTime })).concat(
      [6, 7].map((weekday) => ({ weekday, restDay: true }))
    );

  const schedules = [];
  for (const shift of shifts) {
    const found = schedulesByName.get(shift.name);
    if (found) {
      ok(`${shift.name} ya existe, se reusa (${found.id})`);
      schedules.push({ ...shift, id: found.id, reused: true });
      continue;
    }
    if (CFG.dryRun) {
      ok(`${shift.name} se crearía (L–V ${shift.startTime}–${shift.endTime})`);
      schedules.push({ ...shift, id: null, reused: false });
      continue;
    }
    const res = await api("/schedules", {
      method: "POST",
      body: {
        name: shift.name,
        mealBreakMin: shift.mealBreakMin ?? 60,
        days: allDays(shift.startTime, shift.endTime),
      },
    });
    const schedule = requireOk(`Alta de ${shift.name} (L–V ${shift.startTime}–${shift.endTime})`, res, [201]);
    schedules.push({ ...shift, id: schedule.id, reused: false });
  }

  /* ---------------- Asignaciones ---------------- */
  title("3) Asignación de horarios");
  const assignment = [];
  let cursor = 0;
  for (const schedule of schedules) {
    const people = created.slice(cursor, cursor + (schedule.assignedTo ?? Math.ceil(created.length / schedules.length)));
    cursor += people.length;
    if (people.length === 0) continue;
    const names = people.map((p) => p.name).join(", ");
    if (CFG.dryRun || people.some((p) => !p.id)) {
      ok(`${schedule.name} ← ${names} (desde ${from})`);
      assignment.push({ schedule, people, assigned: people.length });
      continue;
    }
    const res = await api("/schedules/assignments", {
      method: "POST",
      body: { scheduleId: schedule.id, userIds: people.map((p) => p.id), from },
    });
    if (res.status === 409 && res.body?.code === "PAYROLL_WEEK_CLOSED") {
      throw new Error(
        `La semana que empieza el ${from} está cerrada de nómina. Corre de nuevo con BOT_FROM=<otra fecha>.`
      );
    }
    const data = requireOk(`${schedule.name} ← ${names} (desde ${from})`, res, [201]);
    assignment.push({ schedule, people, assigned: data.assigned });
  }

  /* ---------------- Verificación ---------------- */
  title("4) Verificación");
  if (!CFG.dryRun) {
    for (const schedule of schedules) {
      const res = await api(`/schedules/${schedule.id}/assignees`);
      const rows = requireOk(`Asignados de ${schedule.name}`, res) ?? [];
      const expected = assignment.find((a) => a.schedule.id === schedule.id)?.people ?? [];
      const ids = new Set(rows.map((row) => row.user?.id ?? row.userId));
      const missing = expected.filter((person) => !ids.has(person.id));
      if (missing.length > 0) fail(`Faltan personas en ${schedule.name}: ${missing.map((p) => p.username).join(", ")}`);
      else ok(`${schedule.name}: ${rows.length} persona(s) con horario vigente`);
    }
  }

  /* ---------------- Resumen ---------------- */
  title("Resumen");
  const shiftByUsername = new Map();
  for (const a of assignment) for (const person of a.people) shiftByUsername.set(person.username, a.schedule.name);
  console.log(`${"Usuario".padEnd(20)} ${"Nombre".padEnd(34)} ${"Núm.".padEnd(6)} Turno`);
  for (const person of created) {
    const fullName = [person.name, person.paternalSurname, person.maternalSurname].filter(Boolean).join(" ");
    console.log(
      `${person.username.padEnd(20)} ${fullName.padEnd(34)} ${String(person.employeeNumber).padEnd(6)} ${shiftByUsername.get(person.username) ?? "—"}`
    );
  }
  if (!CFG.dryRun) {
    dim(`\nContraseña provisional de las cuentas nuevas: ${CFG.employeePassword}`);
    dim(`Web del cliente: http://${CFG.tenant}.localhost:5009/#/employees`);
    dim(`Horarios:       http://${CFG.tenant}.localhost:5009/#/schedules`);
  } else {
    dim("\nSimulación: no se escribió nada. Corre sin BOT_DRY_RUN para aplicar.");
  }
  if (CFG.count !== employees.length) warn(`Se pidieron ${CFG.count} empleados y el catálogo solo tiene ${employees.length}.`);
};

main().catch((error) => {
  fail(error.message);
  process.exitCode = 1;
});
