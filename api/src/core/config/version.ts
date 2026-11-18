import fs from "node:fs";
import path from "node:path";

/**
 * Versión del API: la de `api/package.json` (una sola versión de producto,
 * `pnpm version:set`, ver docs/VERSIONES.md). Se busca hacia arriba porque en
 * desarrollo corre desde `src/` y en la imagen desde `dist/src/`.
 */
const readVersion = (): string => {
  let dir = __dirname;
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      const pkg = JSON.parse(fs.readFileSync(candidate, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "timemanager-api" && pkg.version) return pkg.version;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return "0.0.0";
    dir = parent;
  }
};

export const API_VERSION = readVersion();

/** Commit desplegado (Railway lo inyecta); `null` en local. */
export const API_COMMIT = (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? "").slice(0, 7) || null;

/** Versión de la web o la app que hizo la petición (`X-Client-Version`), para el log de soporte. */
export const clientVersionOf = (header: string | string[] | undefined): string | null => {
  const value = Array.isArray(header) ? header[0] : header;
  return value ? value.slice(0, 60) : null;
};
