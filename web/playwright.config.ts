import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de la web contra un stack local:
 *   - API en 4010 con la base tm_e2e (Docker, puerto 55433)
 *   - mock ISAPI en 4801 (reloj simulado)
 *   - web Vite en 5106 (los clientes entran por subdominio: acme.localhost:5106)
 *
 * El seed corre en `globalSetup` (api/scripts/e2e-seed.ts): trunca y siembra
 * dos clientes y su personal. Nunca apunta a la nube.
 */
const API_PORT = 4010;
const WEB_PORT = 5106;
const MOCK_PORT = 4801;
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres:test@127.0.0.1:55433/tm_e2e";

/** Playwright puede reemplazar el entorno del comando: heredamos el del proceso. */
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "es-MX",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      // Reloj Hikvision simulado (solo 127.0.0.1).
      command: "npx ts-node -r tsconfig-paths/register scripts/isapi-mock/server.ts",
      cwd: "../api",
      url: `http://127.0.0.1:${MOCK_PORT}/__mock__/state`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ...inheritedEnv, MOCK_PORT: String(MOCK_PORT) },
    },
    {
      // API de pruebas: sin workers de reloj reales (mock), sin correo real.
      command: "npx ts-node -r tsconfig-paths/register src/index.ts",
      cwd: "../api",
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...inheritedEnv,
        DATABASE_URL,
        PORT: String(API_PORT),
        JWT_SECRET: "e2e-jwt-secret-no-usar-en-produccion",
        NODE_ENV: "e2e",
        WEB_ORIGIN: `http://localhost:${WEB_PORT},http://*.localhost:${WEB_PORT}`,
        TIME_CLOCK_USER: "mock",
        TIME_CLOCK_PASS: "mock-pass-123",
        TIME_CLOCK_SYNC_INTERVAL_MS: "3600000",
        TIME_CLOCK_WRITE_ENABLED: "true",
        EMAIL_DRY_RUN: "true",
        ABLY_API_KEY: "",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort --host 0.0.0.0`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...inheritedEnv,
        VITE_API_URL: API_URL,
        VITE_TENANT_BASE_DOMAIN: "localhost",
      },
    },
  ],
});
