/**
 * Reparto de los bots: la plataforma da de alta un cliente nuevo con su
 * administrador; el administrador crea los departamentos, a RH y a seis
 * empleados. También se crea un segundo cliente ("intruso") con un admin y un
 * empleado para probar que nadie ve datos ajenos.
 *
 * Cada corrida usa un cliente nuevo (`qa-<sello>`), así los flujos arrancan
 * en limpio sin borrar nada.
 */
import { randomBytes } from "node:crypto";
import { Bot, QA, Report, writeJson } from "./lib";

export interface CastMember {
  label: string;
  username: string;
  password: string;
  role: string;
  id: string;
  departmentId?: string;
  employeeNumber?: string;
}

export interface CastFile {
  stamp: string;
  timezone: string;
  tenant: { id: string; slug: string; name: string };
  departments: { almacen: string; oficina: string };
  admin: CastMember;
  hr: CastMember;
  employees: CastMember[];
  intruder: { tenant: { id: string; slug: string }; admin: CastMember; employee: CastMember };
}

export interface Cast {
  file: CastFile;
  platform: Bot;
  admin: Bot;
  hr: Bot;
  employees: Bot[];
  intruderAdmin: Bot;
  intruderEmployee: Bot;
}

const EMPLOYEES = [
  { name: "Lucía Herrera Campos", dept: "almacen" },
  { name: "Marco Ibarra Soto", dept: "almacen" },
  { name: "Daniela Ruiz Peña", dept: "almacen" },
  { name: "Óscar Navarro Lima", dept: "oficina" },
  { name: "Fernanda Castillo Vega", dept: "oficina" },
  { name: "Jorge Medina Ortiz", dept: "oficina" },
] as const;

const secret = () => `Qa-${randomBytes(6).toString("hex")}`;
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(" ").slice(0, 2).join(".");

export const TIMEZONE = "America/Mexico_City";

async function createTenant(platform: Bot, report: Report, slug: string, name: string, adminName: string) {
  const adminUser = `${slug}.admin`;
  const adminPass = secret();
  const res = await platform.post("/tenants", {
    name,
    slug,
    timezone: TIMEZONE,
    admin: { name: adminName, username: adminUser, password: adminPass },
  });
  if (!report.expect(`la plataforma da de alta el cliente ${slug}`, res, 201)) throw new Error(res.text);
  const tenant = res.body.tenant ?? res.body;
  return { tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name }, adminUser, adminPass };
}

async function createPerson(by: Bot, report: Report, input: Record<string, unknown>): Promise<string> {
  const res = await by.post("/users", input);
  if (!report.expect(`alta de ${input.name} (${input.role})`, res, 201)) throw new Error(res.text);
  return res.body.id ?? res.body.user?.id;
}

export async function buildCast(): Promise<Cast> {
  const report = new Report("reparto");
  const stamp = Date.now().toString(36);
  const platform = await new Bot("Plataforma", QA.platformUser, QA.platformPass, null, "ADMIN").login();

  const main = await createTenant(platform, report, `qa-${stamp}`, `Distribuidora QA ${stamp}`, "Alejandra Ríos Mora");
  const admin = await new Bot("Admin cliente", main.adminUser, main.adminPass, main.tenant.slug, "CLIENT_ADMIN").login();

  const almacen = await admin.post("/departments", { name: "Almacén" });
  const oficina = await admin.post("/departments", { name: "Oficina" });
  report.expect("el admin crea el departamento Almacén", almacen, 201);
  report.expect("el admin crea el departamento Oficina", oficina, 201);
  const departments = { almacen: almacen.body.id, oficina: oficina.body.id };

  const hrPass = secret();
  const hrUser = `${main.tenant.slug}.rh`;
  const hrId = await createPerson(admin, report, {
    username: hrUser,
    password: hrPass,
    name: "Roberto Salas Fuentes",
    role: "HUMAN_RESOURCES",
    employeeNumber: "100",
    jobTitle: "Jefe de Recursos Humanos",
    departmentId: departments.oficina,
  });
  const hr = await new Bot("RH", hrUser, hrPass, main.tenant.slug, "HUMAN_RESOURCES").login();

  const employeeMembers: CastMember[] = [];
  const employees: Bot[] = [];
  for (const [i, person] of EMPLOYEES.entries()) {
    const username = `${main.tenant.slug}.${slugify(person.name)}`;
    const password = secret();
    const employeeNumber = String(201 + i);
    const departmentId = departments[person.dept];
    const id = await createPerson(admin, report, {
      username,
      password,
      name: person.name,
      role: "CLIENT_STAFF",
      employeeNumber,
      jobTitle: person.dept === "almacen" ? "Auxiliar de almacén" : "Auxiliar administrativo",
      departmentId,
    });
    const bot = await new Bot(person.name.split(" ")[0], username, password, main.tenant.slug, "CLIENT_STAFF").login();
    employees.push(bot);
    employeeMembers.push({ label: bot.label, username, password: bot.password, role: "CLIENT_STAFF", id, departmentId, employeeNumber });
  }

  const other = await createTenant(platform, report, `qa-${stamp}-x`, `Intruso QA ${stamp}`, "Tomás Intruso Gil");
  const intruderAdmin = await new Bot("Admin intruso", other.adminUser, other.adminPass, other.tenant.slug, "CLIENT_ADMIN").login();
  const intruderEmpUser = `${other.tenant.slug}.empleado`;
  const intruderEmpPass = secret();
  const intruderEmpId = await createPerson(intruderAdmin, report, {
    username: intruderEmpUser,
    password: intruderEmpPass,
    name: "Iván Ajeno Cruz",
    role: "CLIENT_STAFF",
    employeeNumber: "900",
  });
  const intruderEmployee = await new Bot("Empleado intruso", intruderEmpUser, intruderEmpPass, other.tenant.slug, "CLIENT_STAFF").login();

  const file: CastFile = {
    stamp,
    timezone: TIMEZONE,
    tenant: main.tenant,
    departments,
    admin: { label: admin.label, username: admin.username, password: admin.password, role: admin.role, id: admin.id },
    hr: { label: hr.label, username: hrUser, password: hr.password, role: hr.role, id: hrId, departmentId: departments.oficina, employeeNumber: "100" },
    employees: employeeMembers,
    intruder: {
      tenant: other.tenant,
      admin: { label: intruderAdmin.label, username: intruderAdmin.username, password: intruderAdmin.password, role: "CLIENT_ADMIN", id: intruderAdmin.id },
      employee: { label: intruderEmployee.label, username: intruderEmpUser, password: intruderEmployee.password, role: "CLIENT_STAFF", id: intruderEmpId, employeeNumber: "900" },
    },
  };
  writeJson("cast.json", file);
  writeJson("report-reparto.json", { checks: report.checks, findings: report.findings });
  return { file, platform, admin, hr, employees, intruderAdmin, intruderEmployee };
}

/** Vuelve a abrir sesión con un reparto ya creado (para correr un flujo suelto). */
export async function loadCast(file: CastFile): Promise<Cast> {
  const slug = file.tenant.slug;
  const login = (m: CastMember, tenant: string | null) => new Bot(m.label, m.username, m.password, tenant, m.role).login();
  return {
    file,
    platform: await new Bot("Plataforma", QA.platformUser, QA.platformPass, null, "ADMIN").login(),
    admin: await login(file.admin, slug),
    hr: await login(file.hr, slug),
    employees: await Promise.all(file.employees.map((e) => login(e, slug))),
    intruderAdmin: await login(file.intruder.admin, file.intruder.tenant.slug),
    intruderEmployee: await login(file.intruder.employee, file.intruder.tenant.slug),
  };
}
