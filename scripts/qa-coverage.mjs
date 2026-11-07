#!/usr/bin/env node
/**
 * Mide cobertura de la matriz QA: cada ID de docs/QA_MATRIX.md debe aparecer
 * en el nombre de al menos un test (E2E, unit o integración).
 *
 *   node scripts/qa-coverage.mjs
 *   node scripts/qa-coverage.mjs --json
 *
 * No ejecuta pruebas. Es el semáforo para saber qué falta antes de correrlas.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MATRIX = join(ROOT, "docs/QA_MATRIX.md");

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git" || name === "playwright-report" || name === "test-results") continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(spec|test)\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
};

const ROOTS = [join(ROOT, "web/tests/e2e"), join(ROOT, "web/src"), join(ROOT, "api/src"), join(ROOT, "api/tests")];
const testFiles = ROOTS.flatMap((dir) => {
  try {
    return walk(dir);
  } catch {
    return [];
  }
});

const matrix = readFileSync(MATRIX, "utf8");
const ids = [...matrix.matchAll(/^\| ((?:AUTH|PLAT|AUD|SET|NOM|EMP|HR|DEP|SCH|OT|PAY|CLK|AGT|ACT)-[A-Z0-9]+(?:-[A-Z0-9]+)*) \|/gm)].map((m) => m[1]);
const unique = [...new Set(ids)];
const isTab = (id) => /-(?:T\d+|S\d+)$/.test(id);
const isModal = (id) => /-M\d+$/.test(id);
const isAction = (id) => id.startsWith("ACT-");
const kind = (id) => (isAction(id) ? "acciones" : isModal(id) ? "modales" : isTab(id) ? "tabs" : "pantallas");

const contents = testFiles.map((file) => ({ file: relative(ROOT, file), text: readFileSync(file, "utf8") }));

/**
 * Los IDs sólo cuentan si están en el título de un test/describe.
 * Un test no debe etiquetar más de `MAX_IDS_PER_TEST` IDs: si necesita más,
 * está mezclando flujos y debe dividirse.
 */
const MAX_IDS_PER_TEST = 8;
const titles = [];
for (const { file, text } of contents) {
  for (const match of text.matchAll(/(?:^|\n)\s*(?:test|it|describe)(?:\.(?:only|skip|fixme))?\(\s*(["'`])([\s\S]*?)\1/g)) {
    titles.push({ file, title: match[2] });
  }
}
const overTagged = [];
const covered = new Map();
for (const { file, title } of titles) {
  const tags = [...new Set(title.match(/\b(?:AUTH|PLAT|AUD|SET|NOM|EMP|HR|DEP|SCH|OT|PAY|CLK|AGT|ACT)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) ?? [])];
  if (tags.length > MAX_IDS_PER_TEST) overTagged.push({ file, title, tags: tags.length });
  for (const id of tags) if (unique.includes(id) && !covered.has(id)) covered.set(id, file);
}

const groups = ["pantallas", "tabs", "modales", "acciones"];
const report = groups.map((group) => {
  const all = unique.filter((id) => kind(id) === group);
  const done = all.filter((id) => covered.has(id));
  return {
    group,
    total: all.length,
    covered: done.length,
    missing: all.filter((id) => !covered.has(id)),
  };
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ files: testFiles.length, tests: contents.length, report, overTagged }, null, 2));
  process.exit(0);
}

console.log(`QA coverage — ${testFiles.length} archivos de prueba\n`);
for (const row of report) {
  const pct = row.total === 0 ? 100 : Math.round((row.covered / row.total) * 100);
  console.log(`${row.group.padEnd(10)} ${String(row.covered).padStart(3)}/${String(row.total).padEnd(3)} ${String(pct).padStart(3)}%`);
  if (row.missing.length) console.log(`  faltan: ${row.missing.join(", ")}`);
}
if (overTagged.length) {
  console.log(`\n⚠ tests sobre-etiquetados (>${MAX_IDS_PER_TEST} IDs, divídelos):`);
  for (const row of overTagged.slice(0, 20)) console.log(`  ${row.tags} IDs — ${row.file}: ${row.title.slice(0, 140)}`);
}

const total = report.reduce((acc, row) => acc + row.total, 0);
const done = report.reduce((acc, row) => acc + row.covered, 0);
console.log(`\nTOTAL      ${done}/${total} ${Math.round((done / total) * 100)}%`);
process.exit(done === total ? 0 : 1);
