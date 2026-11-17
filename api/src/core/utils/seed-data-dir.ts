import fs from "node:fs";
import path from "node:path";

/**
 * Resuelve el directorio de fixtures `prisma/seed-data` que contiene `fixture`
 * (p. ej. `roles.json`), a partir del `__dirname` del llamador.
 *
 * Con ts-node los fixtures están junto al script; compilado, el seed corre
 * desde `dist/prisma/` y `tsc` no copia los .json, así que se leen del `prisma/`
 * original que la imagen sí conserva.
 */
export function resolveSeedDataDir(baseDir: string, fixture: string): string {
  const candidates = [
    path.join(baseDir, "seed-data"),
    path.join(baseDir, "..", "..", "prisma", "seed-data"),
    // Imagen de producción: el proceso corre en /repo/api y `prisma/` se copia ahí.
    path.join(process.cwd(), "prisma", "seed-data"),
  ];
  const dir = candidates.find((c) => fs.existsSync(path.join(c, fixture)));
  if (!dir) {
    throw new Error(
      `prisma/seed-data/${fixture} not found (real backup fixtures). Searched in: ${candidates.join(", ")}`
    );
  }
  return dir;
}
