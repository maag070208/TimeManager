/**
 * Corre los bots de QA.
 *
 *   pnpm --filter timemanager-api qa:bots                 # reparto nuevo + todos los flujos
 *   pnpm --filter timemanager-api qa:bots jornada permisos  # reparto nuevo + flujos elegidos
 *   QA_REUSE=1 pnpm --filter timemanager-api qa:bots jornada # reusa qa/out/cast.json
 *
 * Deja `qa/out/report.md` (y `.json`) con cada paso y los hallazgos.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildCast, loadCast, type Cast, type CastFile } from "./cast";
import { QA, Report, readJson, writeJson, type Check, type Finding } from "./lib";
import { writeFileSync } from "node:fs";

export type Flow = (cast: Cast, report: Report) => Promise<void>;

async function main(): Promise<void> {
  const flowsDir = path.join(__dirname, "flows");
  const available = readdirSync(flowsDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .sort();
  const wanted = process.argv.slice(2);
  const unknown = wanted.filter((w) => !available.includes(w));
  if (unknown.length) throw new Error(`Flujos desconocidos: ${unknown.join(", ")}. Hay: ${available.join(", ")}`);
  const names = wanted.length ? wanted : available;

  const reuse = process.env.QA_REUSE === "1" && existsSync(path.join(QA.outDir, "cast.json"));
  console.log(reuse ? "Reusando el reparto de qa/out/cast.json" : "Creando reparto nuevo…");
  const cast = reuse ? await loadCast(readJson<CastFile>("cast.json")) : await buildCast();
  console.log(`Cliente ${cast.file.tenant.slug}: admin, RH y ${cast.employees.length} empleados.\n`);

  const checks: Check[] = [];
  const findings: Finding[] = [];
  if (!reuse) {
    const setup = readJson<{ checks: Check[]; findings: Finding[] }>("report-reparto.json");
    checks.push(...setup.checks);
    findings.push(...setup.findings);
  }

  for (const name of names) {
    const report = new Report(name);
    console.log(`▶ ${name}`);
    try {
      const flow = (await import(path.join(flowsDir, name))).default as Flow;
      await flow(cast, report);
    } catch (error) {
      report.check("el flujo terminó sin excepción", false, error instanceof Error ? error.stack ?? error.message : String(error));
      report.finding("BLOQUEANTE", "El flujo se cortó", error instanceof Error ? error.message : String(error));
    }
    checks.push(...report.checks);
    findings.push(...report.findings);
    console.log("");
  }

  const failed = checks.filter((c) => !c.ok);
  writeJson("report.json", { tenant: cast.file.tenant, checks, findings });
  const lines = [
    `# Reporte de QA — cliente ${cast.file.tenant.slug}`,
    "",
    `${checks.length - failed.length}/${checks.length} pasos correctos · ${findings.length} hallazgos`,
    "",
    "## Hallazgos",
    "",
    ...(findings.length ? findings.map((f) => `- **${f.severity}** [${f.flow}] ${f.title}: ${f.detail}`) : ["Ninguno."]),
    "",
    "## Pasos fallidos",
    "",
    ...(failed.length ? failed.map((c) => `- [${c.flow}] ${c.step} — ${c.detail ?? ""}`) : ["Ninguno."]),
    "",
    "## Por flujo",
    "",
    ...[...new Set(checks.map((c) => c.flow))].map((flow) => {
      const own = checks.filter((c) => c.flow === flow);
      return `- ${flow}: ${own.filter((c) => c.ok).length}/${own.length}`;
    }),
    "",
  ];
  writeFileSync(path.join(QA.outDir, "report.md"), lines.join("\n"));
  console.log(`${checks.length - failed.length}/${checks.length} pasos · ${findings.length} hallazgos → qa/out/report.md`);
  process.exitCode = failed.length ? 1 : 0;
}

void main();
