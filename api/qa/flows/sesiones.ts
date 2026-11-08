import type { Cast } from "../cast";
import type { Report } from "../lib";

/** Cada bot entra con su cuenta y ve su propio perfil y cliente. */
export default async function sesiones(cast: Cast, r: Report): Promise<void> {
  const everyone = [cast.admin, cast.hr, ...cast.employees];
  for (const bot of everyone) {
    const me = await bot.get("/auth/me");
    r.expect(`${bot.label} consulta su perfil`, me, 200);
    r.check(`${bot.label} pertenece al cliente ${cast.file.tenant.slug}`, me.body?.tenant?.slug === cast.file.tenant.slug, JSON.stringify(me.body?.tenant));
    r.check(`${bot.label} tiene el rol ${bot.role}`, me.body?.role === bot.role, `rol=${me.body?.role}`);
  }
  const wrongTenant = await cast.employees[0].post("/auth/login", {
    username: cast.employees[0].username,
    password: cast.employees[0].password,
    tenant: cast.file.intruder.tenant.slug,
  });
  r.check("un empleado no entra con el código de otra empresa", wrongTenant.status >= 400, `status ${wrongTenant.status}`);
}
