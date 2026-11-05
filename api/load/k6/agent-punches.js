/**
 * k6 — ingesta de checadas por lote, como la hace TimeManagerAgent (F4-05).
 *
 *   set -a; source load/.env.load; set +a
 *   k6 run load/k6/agent-punches.js
 *
 * `setup()` crea un agente de prueba por la consola (login de plataforma +
 * `POST /agent/agents`) y descarga su config para tomar el reloj. Cada VU manda
 * lotes de 25 checadas con consecutivos únicos (idempotencia por
 * `clockSerial+serialNo`, así que no chocan entre VUs ni iteraciones).
 *
 * Env: BASE_URL, TENANT_ID, PLATFORM_USER, PLATFORM_PASS, VUS, DURATION.
 * Umbral: p95 < 800 ms, error rate < 1 %.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL ?? "http://127.0.0.1:4020/api/v1";
const TENANT_ID = __ENV.TENANT_ID ?? "";
const PLATFORM_USER = __ENV.PLATFORM_USER ?? "load.admin";
const PLATFORM_PASS = __ENV.PLATFORM_PASS ?? "LoadPrueba123!";

export const options = {
  scenarios: {
    agent: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS ?? 10),
      duration: __ENV.DURATION ?? "20s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:agent}": ["p(95)<800"],
  },
};

export function setup() {
  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: PLATFORM_USER, password: PLATFORM_PASS }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(login, { "login plataforma 200": (res) => res.status === 200 });
  const platformToken = login.json("token");

  const created = http.post(
    `${BASE_URL}/agent/agents`,
    JSON.stringify({ name: `k6-${Date.now()}` }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${platformToken}`,
        ...(TENANT_ID ? { "X-Tenant-Id": TENANT_ID } : {}),
      },
    }
  );
  check(created, { "agente creado": (res) => res.status === 201 });
  const agentToken = created.json("token");

  const config = http.get(`${BASE_URL}/agent/config`, {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  check(config, { "config del agente 200": (res) => res.status === 200 });
  const clocks = config.json("clocks") || [];
  return {
    agentToken,
    clockSerial: clocks.length > 0 ? clocks[0].serialNumber : __ENV.CLOCK_SERIAL,
    baseSerial: (Date.now() % 1000000) * 1000,
  };
}

export default function (data) {
  const punches = Array.from({ length: 25 }, (_, index) => ({
    serialNo: data.baseSerial + __VU * 100000 + __ITER * 25 + index + 1,
    employeeNumber: `80${String(((__VU + __ITER + index) % 20) + 1).padStart(4, "0")}`,
    name: "Persona de carga",
    minor: 75,
    occurredAt: new Date().toISOString(),
  }));

  const response = http.post(
    `${BASE_URL}/agent/punches`,
    JSON.stringify({ clockSerial: data.clockSerial, punches }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.agentToken}`,
      },
      tags: { scenario: "agent" },
    }
  );
  check(response, {
    "lote aceptado (200)": (res) => res.status === 200,
    "lote sin duplicados": (res) => {
      try {
        return res.json("duplicates") === 0;
      } catch {
        return false;
      }
    },
  });
  sleep(0.2);
}
