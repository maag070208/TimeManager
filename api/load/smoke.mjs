#!/usr/bin/env node
/**
 * Smoke de carga local (F4-05), sin dependencias: k6 no está instalado en este
 * equipo, así que este runner de Node mide latencias reales contra el API local
 * con los mismos escenarios que los scripts k6 de `load/k6/`.
 *
 *   node scripts/load-seed.ts            # siembra tm_test_load y escribe load/.env.load
 *   node load/smoke.mjs                  # con el API escuchando en BASE_URL
 *
 * Variables (salen de `load/.env.load` o del entorno): BASE_URL, TENANT_SLUG,
 * TENANT_ID, PLATFORM_USER/PASS, CLIENT_USER/PASS, LOAD_DURATION_MS,
 * LOAD_CONCURRENCY. Umbrales: p95 global < 800 ms y errores < 1 %.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = process.env.LOAD_ENV_FILE ?? path.join(here, ".env.load");

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

const config = {
  baseUrl: (process.env.BASE_URL ?? "http://127.0.0.1:4020/api/v1").replace(/\/+$/, ""),
  tenantSlug: process.env.TENANT_SLUG ?? "load-client",
  tenantId: process.env.TENANT_ID ?? "",
  platformUser: process.env.PLATFORM_USER ?? "load.admin",
  platformPass: process.env.PLATFORM_PASS ?? "LoadPrueba123!",
  clientUser: process.env.CLIENT_USER ?? "load.client",
  clientPass: process.env.CLIENT_PASS ?? "LoadPrueba123!",
  clockSerial: process.env.CLOCK_SERIAL ?? "LOAD-CLOCK-1",
  concurrency: Number(process.env.LOAD_CONCURRENCY ?? 5),
  batches: Number(process.env.LOAD_BATCHES ?? 20),
};

const results = [];
const failures = [];

const request = async (scenario, method, url, options = {}) => {
  const started = performance.now();
  let status = 0;
  let ok = false;
  try {
    const response = await fetch(`${config.baseUrl}${url}`, {
      method,
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    ok = response.ok;
    if (!response.ok) {
      failures.push({ scenario, status, body: (await response.text()).slice(0, 200) });
    }
    await response.arrayBuffer();
  } catch (error) {
    failures.push({ scenario, status: 0, body: error instanceof Error ? error.message : String(error) });
  } finally {
    results.push({ scenario, ms: performance.now() - started, ok });
  }
  return { status, ok };
};

const pool = async (scenario, count, worker, concurrency = config.concurrency) => {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, count) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= count) return;
      await worker(index);
    }
  });
  await Promise.all(runners);
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const statsOf = (scenario) => {
  const rows = results.filter((row) => row.scenario === scenario);
  const values = rows.map((row) => row.ms);
  const errors = rows.filter((row) => !row.ok).length;
  return {
    scenario,
    requests: rows.length,
    errors,
    rps: 0,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: values.length ? Math.max(...values) : 0,
  };
};

const login = (username, password, tenant) =>
  fetch(`${config.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, ...(tenant ? { tenant } : {}) }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`login ${username}: HTTP ${response.status}`);
    return response.json();
  });

const main = async () => {
  console.log(
    `[smoke] ${config.baseUrl} · cliente ${config.tenantSlug} · concurrencia ${config.concurrency}`
  );

  // 1) Login concurrente (auth + bcrypt).
  await pool("login", 30, () =>
    request("login", "POST", "/auth/login", {
      body: { username: config.clientUser, password: config.clientPass, tenant: config.tenantSlug },
    })
  );

  // 2) Dashboards concurrentes con sesión de cliente.
  const clientSession = await login(config.clientUser, config.clientPass, config.tenantSlug);
  const clientToken = clientSession.token;
  const endpoints = ["/dashboard/attendance-today", "/dashboard/people", "/dashboard/overtime-week"];
  await pool("dashboards", 60, (index) =>
    request("dashboards", "GET", endpoints[index % endpoints.length], { token: clientToken })
  );

  // 3) Ingesta de checadas por lote, como lo hace el agente.
  const platformSession = await login(config.platformUser, config.platformPass);
  const platformToken = platformSession.token;
  const created = await fetch(`${config.baseUrl}/agent/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${platformToken}`,
      ...(config.tenantId ? { "X-Tenant-Id": config.tenantId } : {}),
    },
    body: JSON.stringify({ name: `load-${Date.now()}` }),
  });
  if (!created.ok) throw new Error(`No se pudo crear el agente de carga: HTTP ${created.status}`);
  const agentToken = (await created.json()).token;
  const agentConfig = await fetch(`${config.baseUrl}/agent/config`, {
    method: "GET",
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  if (!agentConfig.ok) throw new Error(`No se pudo leer el config del agente: HTTP ${agentConfig.status}`);
  const agentConfigBody = await agentConfig.json();
  const clockSerial = agentConfigBody.clocks?.[0]?.serialNumber ?? config.clockSerial;
  const baseSerial = (Date.now() % 1_000_000) * 1000;

  await pool("agent-punches", config.batches, async (batch) => {
    const punches = Array.from({ length: 25 }, (_, index) => ({
      serialNo: baseSerial + batch * 25 + index + 1,
      employeeNumber: `80${String((batch * 25 + index) % 20 + 1).padStart(4, "0")}`,
      name: "Persona de carga",
      minor: 75,
      occurredAt: new Date().toISOString(),
    }));
    await request("agent-punches", "POST", "/agent/punches", {
      token: agentToken,
      body: { clockSerial, punches },
    });
  });

  const summary = ["login", "dashboards", "agent-punches"].map(statsOf);
  for (const row of summary) {
    row.rps = Number((row.requests / (Math.max(...results.map((r) => r.ms)) / 1000 || 1)).toFixed(2));
  }

  console.log("\nEscenario        reqs  errores   p50(ms)  p95(ms)  p99(ms)  max(ms)");
  for (const row of summary) {
    console.log(
      `${row.scenario.padEnd(16)} ${String(row.requests).padStart(4)}  ${String(row.errors).padStart(6)}  ` +
        `${row.p50.toFixed(1).padStart(8)} ${row.p95.toFixed(1).padStart(8)} ${row.p99.toFixed(1).padStart(8)} ${row.max.toFixed(1).padStart(8)}`
    );
  }

  const total = results.length;
  const errors = results.filter((row) => !row.ok).length;
  const all = results.map((row) => row.ms);
  const globalP95 = percentile(all, 95);
  const globalP99 = percentile(all, 99);
  const errorRate = total ? (errors / total) * 100 : 100;
  const elapsed = Math.max(...all) / 1000;

  console.log(
    `\nTotal ${total} reqs · ${errors} error(es) (${errorRate.toFixed(2)} %) · ` +
      `p50 ${percentile(all, 50).toFixed(1)} ms · p95 ${globalP95.toFixed(1)} ms · p99 ${globalP99.toFixed(1)} ms · ` +
      `~${(total / Math.max(elapsed, 0.001)).toFixed(1)} req/s`
  );
  for (const failure of failures.slice(0, 5)) {
    console.log(`  fallo ${failure.scenario} → HTTP ${failure.status}: ${failure.body}`);
  }

  const thresholds = {
    errorRate: errorRate < 1,
    p95: globalP95 < 800,
    login: (summary.find((row) => row.scenario === "login")?.p95 ?? 0) < 1000,
    dashboards: (summary.find((row) => row.scenario === "dashboards")?.p95 ?? 0) < 800,
    agent: (summary.find((row) => row.scenario === "agent-punches")?.p95 ?? 0) < 800,
  };
  const failed = Object.entries(thresholds).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) {
    console.error(`[smoke] FALLÓ: umbral(es) fuera: ${failed.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("[smoke] OK: p95 < 800 ms y errores < 1 %");
};

main().catch((error) => {
  console.error(`[smoke] falló: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
