/**
 * Corre Playwright en serie (un solo stack/BD a la vez) con lock de archivo.
 *
 *   node scripts/e2e-run.mjs tests/e2e/personal.spec.ts --project=chromium
 *
 * Tres suites en paralelo se pelearían por los puertos 4010/5106/4801 y por la
 * base tm_e2e (el seed la trunca). Este runner espera su turno.
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const LOCK = "/tmp/tm-e2e-run.lock";
const STALE_MS = 90 * 60 * 1000;

const release = () => rmSync(LOCK, { recursive: true, force: true });

for (;;) {
  try {
    mkdirSync(LOCK);
    break;
  } catch {
    try {
      const age = Date.now() - statSync(LOCK).mtimeMs;
      if (age > STALE_MS) {
        release();
        continue;
      }
    } catch {
      continue;
    }
    await sleep(3000);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    release();
    process.exit(130);
  });
}

// Limpia servidores huérfanos de corridas anteriores (solo nuestros puertos).
for (const port of [4801, 4010, 5106]) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    if (pids) execSync(`kill -9 ${pids.split("\n").join(" ")}`);
  } catch {
    // Sin procesos en el puerto: nada que limpiar.
  }
}

const args = process.argv.slice(2);
const child = spawn("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  release();
  process.exit(code ?? 1);
});
