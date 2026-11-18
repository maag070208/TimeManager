#!/usr/bin/env node
/**
 * Una sola versión de CheckLab para API, web y app (semver MAYOR.MENOR.PARCHE).
 *
 *   pnpm version:show          muestra la versión de cada parte
 *   pnpm version:check         falla si alguna parte no coincide (CI)
 *   pnpm version:set 1.2.0     la escribe en todas las partes
 *
 * El número de build de Android (versionCode) e iOS (CURRENT_PROJECT_VERSION)
 * se deriva de la versión: MAYOR*10000 + MENOR*100 + PARCHE (1.2.3 → 10203),
 * así siempre crece cuando sube la versión. Ver docs/VERSIONES.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (rel) => path.join(root, rel);
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export const buildNumber = (version) => {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`Versión inválida: ${version} (usa MAYOR.MENOR.PARCHE)`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error("MENOR y PARCHE van de 0 a 99");
  return major * 10000 + minor * 100 + patch;
};

const json = (rel) => ({
  read: () => JSON.parse(fs.readFileSync(file(rel), "utf8")).version,
  write: (v) => {
    const text = fs.readFileSync(file(rel), "utf8");
    fs.writeFileSync(file(rel), text.replace(/("version":\s*)"[^"]*"/, `$1"${v}"`));
  },
});

const keyValue = (rel, key, separator) => {
  const re = new RegExp(`^(${key}${separator})(.*)$`, "m");
  return {
    read: () => re.exec(fs.readFileSync(file(rel), "utf8"))?.[2].trim(),
    write: (v) => {
      const text = fs.readFileSync(file(rel), "utf8");
      fs.writeFileSync(file(rel), re.test(text) ? text.replace(re, `$1${v}`) : `${text.trimEnd()}\n${key}${separator}${v}\n`);
    },
  };
};

const PARTS = [
  { name: "producto (package.json)", kind: "version", ...json("package.json") },
  { name: "API (api/package.json)", kind: "version", ...json("api/package.json") },
  { name: "web (web/package.json)", kind: "version", ...json("web/package.json") },
  { name: "app (checklab/gradle.properties)", kind: "version", ...keyValue("checklab/gradle.properties", "checklab.version", "=") },
  { name: "app build Android", kind: "build", ...keyValue("checklab/gradle.properties", "checklab.versionCode", "=") },
  { name: "app iOS (MARKETING_VERSION)", kind: "version", ...keyValue("checklab/iosApp/Configuration/Config.xcconfig", "MARKETING_VERSION", "=") },
  { name: "app build iOS", kind: "build", ...keyValue("checklab/iosApp/Configuration/Config.xcconfig", "CURRENT_PROJECT_VERSION", "=") },
];

const [command = "show", arg] = process.argv.slice(2);
const current = PARTS[0].read();

if (command === "set") {
  if (!arg) throw new Error("Uso: pnpm version:set MAYOR.MENOR.PARCHE");
  const build = String(buildNumber(arg));
  for (const part of PARTS) part.write(part.kind === "build" ? build : arg);
  console.log(`CheckLab ${current} → ${arg} (build ${build}). Revisa el diff y commitea.`);
} else {
  const expected = { version: current, build: String(buildNumber(current)) };
  let ok = true;
  for (const part of PARTS) {
    const value = part.read();
    const match = value === expected[part.kind];
    ok &&= match;
    console.log(`${match ? "✓" : "✗"} ${part.name.padEnd(34)} ${value ?? "(falta)"}`);
  }
  if (!ok) {
    console.error(`\nNo coinciden con ${current}. Corrige con: pnpm version:set ${current}`);
    process.exit(1);
  }
  if (command === "check") console.log(`\nTodo en ${current}.`);
}
