import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Antes de los tests: siembra la base E2E (trunca y crea dos clientes).
 * Se ejecuta también antes de levantar la API, así que el arranque la ve lista.
 */
export default async function globalSetup(): Promise<void> {
  const apiDir = fileURLToPath(new URL("../../../api", import.meta.url));
  const databaseUrl =
    process.env.E2E_DATABASE_URL ?? "postgresql://postgres:test@127.0.0.1:55433/tm_e2e";

  execFileSync(
    "npx",
    ["ts-node", "-r", "tsconfig-paths/register", "scripts/e2e-seed.ts"],
    {
      cwd: apiDir,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "e2e" } as NodeJS.ProcessEnv,
    }
  );
}
