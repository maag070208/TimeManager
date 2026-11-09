#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(QA_DIR, "..");
const OUT_DIR = path.join(QA_DIR, "out");
const DB_URL = process.env.QA_DATABASE_URL ?? "postgresql://postgres:test@127.0.0.1:55433/tm_qa";
const API_PORT = 4031;
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const CONTAINER = process.env.TM_TEST_DB_CONTAINER ?? "tm-test-pg";
const LOCAL = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function readQaEnv() {
  const file = path.join(QA_DIR, ".env.qa");
  const values = {};
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const qaEnv = readQaEnv();
const db = new URL(DB_URL);
const dbName = decodeURIComponent(db.pathname.replace(/^\//, ""));
if (!LOCAL.has(db.hostname) || !dbName.startsWith("tm_qa")) {
  throw new Error(`Base no permitida: usa una base local tm_qa* (recibida: ${db.hostname}/${dbName}).`);
}
if (!qaEnv.QA_PLATFORM_USER || !qaEnv.QA_PLATFORM_PASS) {
  throw new Error("Faltan QA_PLATFORM_USER/QA_PLATFORM_PASS en api/qa/.env.qa.");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: API_DIR,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} terminó con ${code ?? signal}.`));
    });
  });
}

async function waitForApi(child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("El API QA se detuvo antes de responder; revisa qa/out/api.log.");
    try {
      const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("El API QA no respondió en 90 s; revisa qa/out/api.log.");
}

async function stopApi(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

mkdirSync(OUT_DIR, { recursive: true });
try {
  await fetch(API_URL + "/health", { signal: AbortSignal.timeout(1000) });
  throw new Error(`El puerto ${API_PORT} ya tiene un API. Deténlo antes de una corrida autocontenida.`);
} catch (error) {
  if (error instanceof Error && error.message.startsWith("El puerto")) throw error;
}

const env = {
  ...process.env,
  DATABASE_URL: DB_URL,
  QA_DATABASE_URL: DB_URL,
  QA_API_URL: API_URL,
  QA_PLATFORM_USER: qaEnv.QA_PLATFORM_USER,
  QA_PLATFORM_PASS: qaEnv.QA_PLATFORM_PASS,
  INITIAL_ADMIN_USERNAME: qaEnv.QA_PLATFORM_USER,
  INITIAL_ADMIN_PASSWORD: qaEnv.QA_PLATFORM_PASS,
  PORT: String(API_PORT),
  NODE_ENV: "development",
  JWT_SECRET: process.env.QA_JWT_SECRET ?? "qa-jwt-secret-local-no-usar-en-produccion",
  WEB_ORIGIN: "http://localhost:5009,http://*.localhost:5009",
  TIME_CLOCK_USER: "mock",
  TIME_CLOCK_PASS: "mock-pass-123",
  TIME_CLOCK_SYNC_INTERVAL_MS: "3600000",
  RATE_LIMIT_DISABLED: "true",
  EMAIL_DRY_RUN: "true",
  RESEND_API_KEY: "",
  ABLY_API_KEY: "",
  NOTIFICATION_EMAILS: "",
  FINGERPRINT_STATION_URL: "",
  RUN_WORKERS_IN_API: "false",
  QUEUE_ENABLED: "false",
};

let api;
try {
  await run("docker", ["inspect", CONTAINER], { stdio: "ignore" });
  const existing = await new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${dbName.replaceAll("'", "''")}'`], { stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output.trim() === "1") : reject(new Error("No se pudo consultar la base QA.")));
  });
  if (!existing) await run("docker", ["exec", CONTAINER, "createdb", "-U", "postgres", dbName]);
  await run(path.join(API_DIR, "node_modules/.bin/prisma"), ["migrate", "deploy"], { env });
  await run(process.execPath, ["--require", "ts-node/register/transpile-only", "--require", "tsconfig-paths/register", "prisma/seed.ts"], { env });

  const log = createWriteStream(path.join(OUT_DIR, "api.log"), { flags: "w" });
  api = spawn(process.execPath, ["--require", "ts-node/register/transpile-only", "--require", "tsconfig-paths/register", "src/index.ts"], {
    cwd: API_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stdout.pipe(log);
  api.stderr.pipe(log);
  await waitForApi(api);
  console.log(`API QA lista en ${API_URL}; base ${dbName}.`);
  const args = process.argv.slice(2);
  if (args.includes("--serve")) {
    console.log("API QA disponible para WEB/APP; detén el proceso del arnés al terminar.");
    await new Promise((resolve, reject) => {
      const stop = () => resolve();
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
      api.once("error", reject);
      api.once("exit", (code, signal) => reject(new Error(`El API QA terminó con ${code ?? signal}.`)));
    });
  } else {
    await run(process.execPath, ["--require", "ts-node/register/transpile-only", "--require", "tsconfig-paths/register", "qa/run.ts", ...args], { env });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (api) await stopApi(api);
}
