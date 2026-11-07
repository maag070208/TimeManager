/**
 * Loader para los unit tests de la web con `node --test` (Node 22 ejecuta los
 * `.ts` con type-stripping nativo, sin Vitest/jest).
 *
 * Solo resuelve dos cosas que Node ESM no hace por sí solo:
 *  - los alias de FSD (`@shared/*`, `@entities/*`, …) → `src/...`;
 *  - imports relativos sin extensión (`./dates`) → `./dates.ts`.
 *
 * No transforma sintaxis: los tests importan módulos `.ts` sin JSX ni enums
 * (lógica pura). Para un módulo con JSX o `import` de JSON (p. ej. i18n) se
 * extrae la función pura a su archivo, que es justo lo que se busca testear.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const ALIASES = {
  "@shared/": "src/shared/",
  "@entities/": "src/entities/",
  "@features/": "src/features/",
  "@pages/": "src/pages/",
  "@widgets/": "src/widgets/",
  "@app/": "src/app/",
};

const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const resolveFile = (base) => {
  for (const suffix of CANDIDATES) {
    const file = base + suffix;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
};

export async function resolve(specifier, context, nextResolve) {
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (!specifier.startsWith(alias)) continue;
    const file = resolveFile(resolvePath(WEB_ROOT, target + specifier.slice(alias.length)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  const isRelative = specifier.startsWith(".") || specifier.startsWith("/");
  if (isRelative && context.parentURL?.startsWith("file:")) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const file = resolveFile(resolvePath(parentDir, specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
