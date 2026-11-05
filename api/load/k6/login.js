/**
 * k6 — login concurrente (F4-05).
 *
 *   set -a; source load/.env.load; set +a
 *   k6 run load/k6/login.js
 *
 * Env: BASE_URL, TENANT_SLUG, CLIENT_USER, CLIENT_PASS, VUS, DURATION.
 * Umbral: error rate < 1 % y p95 < 1000 ms (bcrypt + JWT en cada login).
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL ?? "http://127.0.0.1:4020/api/v1";
const TENANT = __ENV.TENANT_SLUG ?? "load-client";
const USER = __ENV.CLIENT_USER ?? "load.client";
const PASS = __ENV.CLIENT_PASS ?? "LoadPrueba123!";

export const options = {
  scenarios: {
    login: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS ?? 10),
      duration: __ENV.DURATION ?? "20s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:login}": ["p(95)<1000"],
  },
};

export default function () {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: USER, password: PASS, tenant: TENANT }),
    { headers: { "Content-Type": "application/json" }, tags: { scenario: "login" } }
  );
  check(response, {
    "login 200": (res) => res.status === 200,
    "login trae token": (res) => Boolean(res.json("token")),
  });
  sleep(0.2);
}
