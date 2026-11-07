/**
 * Captura todas las pantallas del sistema con los datos demo (`pnpm demo:seed`).
 * No es una prueba: inicia sesión por rol, recorre las rutas y guarda una
 * captura de página completa por pantalla.
 *
 *   node scripts/capture-screens.mjs <web-base> <ids.json> <carpeta-salida>
 *   (web-base sin subdominio, p. ej. http://localhost:5019)
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [base = "http://localhost:5019", idsFile, outDir = "capturas"] = process.argv.slice(2);
const ids = idsFile ? JSON.parse(fs.readFileSync(idsFile, "utf8")) : {};
const PASSWORD = "Demo2026!";
const withTenant = (slug) => (slug ? base.replace("://", `://${slug}.`) : base);

const SESSIONS = [
  {
    key: "altamira-admin",
    tenant: "altamira",
    username: "ricardo.salinas",
    routes: [
      "/", "/notifications",
      "/employees", `/employees/${ids.emp}`, `/employees/${ids.emp}/edit`, `/employees/${ids.emp}/account`, `/employees/${ids.emp}/history`,
      "/employees/new", "/employees/import", "/employees/records", "/employees/catalogs/documents",
      "/employees/disciplinary-reports", `/employees/disciplinary-reports/${ids.acta}`,
      "/departments", `/departments/${ids.dept}`, "/subareas",
      "/schedules", "/schedules/new", `/schedules/${ids.sched}/edit`, "/schedules/assign",
      "/schedules/overtime/approval", "/schedules/payroll", "/schedules/payroll/history",
      "/payroll/assign", "/payroll/settings",
      "/hr/time-clock", "/hr/time-clock/entries-exits", "/hr/time-clock/employees", "/hr/time-clock/employees/differences", "/hr/time-clock/roster",
      "/hr/leave", "/hr/jornada-acuerdos", "/teletrabajo",
      "/time-clocks", "/time-clocks/dashboard", "/time-clocks/people", "/time-clocks/inspect",
      "/users", "/users/new", "/roles", "/audit", "/settings/general", "/settings/catalogs",
    ],
  },
  { key: "altamira-rh", tenant: "altamira", username: "veronica.ibarra", routes: ["/", "/hr/leave", "/schedules/overtime/approval"] },
  { key: "altamira-personal", tenant: "altamira", username: "karla.nunez", routes: ["/", "/mi-jornada", "/notifications"] },
  { key: "santalucia-admin", tenant: "santalucia", username: "lucia.arellano", routes: ["/", "/teletrabajo", "/hr/time-clock/entries-exits"] },
  { key: "santalucia-teletrabajo", tenant: "santalucia", username: "andrea.preciado", routes: ["/mi-jornada"] },
  { key: "origen-admin", tenant: "origen", username: "mateo.lozano", routes: ["/", "/time-clocks"] },
  {
    key: "plataforma",
    tenant: null,
    username: "demo.admin",
    routes: ["/", "/tenants", `/tenants/${ids.tenant}`, "/plans", "/roles", "/users", "/audit", "/settings/general", "/settings/catalogs"],
  },
];

const slugOf = (route) => (route === "/" ? "inicio" : route.replace(/^\//, "").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "id").replace(/\//g, "_"));

const settle = async (page) => {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
};

const browser = await chromium.launch();
const manifest = [];
fs.mkdirSync(outDir, { recursive: true });

const shoot = async (page, file, meta) => {
  const target = path.join(outDir, file);
  await page.screenshot({ path: target, fullPage: true, type: "jpeg", quality: 78 });
  const errors = await page.locator("text=/Ocurrió un error|Something went wrong|No se pudo/i").count().catch(() => 0);
  manifest.push({ file, ...meta, url: page.url(), errors });
  console.log(`${errors ? "!" : "✓"} ${file}`);
};

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
  const page = await context.newPage();
  await page.goto(`${base}/#/landing`);
  await settle(page);
  await shoot(page, "00_publico_landing.jpg", { session: "publico", route: "/landing" });
  await page.goto(`${withTenant("altamira")}/#/login`);
  await settle(page);
  await shoot(page, "00_publico_login.jpg", { session: "publico", route: "/login" });
  await context.close();
}

for (const [index, session] of SESSIONS.entries()) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
  const page = await context.newPage();
  const root = withTenant(session.tenant);
  await page.goto(`${root}/#/login`);
  await page.locator('input[name="username"]').waitFor({ timeout: 20000 });
  await page.locator('input[name="username"]').fill(session.username);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click({ force: true });
  await page.waitForURL((url) => !url.hash.includes("login"), { timeout: 20000 }).catch(() => {});
  await settle(page);
  for (const route of session.routes) {
    await page.goto(`${root}/#${route}`);
    await settle(page);
    await shoot(page, `${String(index + 1).padStart(2, "0")}_${session.key}__${slugOf(route)}.jpg`, { session: session.key, route });
  }
  if (session.key === "altamira-personal") {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${root}/#/mi-jornada`);
    await settle(page);
    await shoot(page, `${String(index + 1).padStart(2, "0")}_${session.key}__mi-jornada_movil.jpg`, { session: session.key, route: "/mi-jornada (móvil)" });
  }
  await context.close();
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
