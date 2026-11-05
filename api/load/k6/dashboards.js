/**
 * k6 — dashboards concurrentes del cliente (F4-05).
 *
 *   set -a; source load/.env.load; set +a
 *   k6 run load/k6/dashboards.js
 *
 * Env: BASE_URL, TENANT_SLUG, CLIENT_USER, CLIENT_PASS, VUS, DURATION.
 * Umbral: p95 < 800 ms y error rate < 1 %.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL ?? "http://127.0.0.1:4020/api/v1";
const TENANT = __ENV.TENANT_SLUG ?? "load-client";
const USER = __ENV.CLIENT_USER ?? "load.client";
const PASS = __ENV.CLIENT_PASS ?? "LoadPrueba123!";

const ENDPOINTS = ["/dashboard/attendance-today", "/dashboard/people", "/dashboard/overtime-week"];

export const options = {
  scenarios: {
    dashboards: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS ?? 10),
      duration: __ENV.DURATION ?? "20s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:dashboards}": ["p(95)<800"],
  },
};

export function setup() {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: USER, password: PASS, tenant: TENANT }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(response, { "login 200": (res) => res.status === 200 });
  return { token: response.json("token") };
}

export default function (data) {
  const path = ENDPOINTS[(__VU + __ITER) % ENDPOINTS.length];
  const response = http.get(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { scenario: "dashboards" },
  });
  check(response, { "dashboard 200": (res) => res.status === 200 });
  sleep(0.3);
}
