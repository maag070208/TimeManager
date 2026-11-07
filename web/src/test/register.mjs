/**
 * Registra el loader de unit tests antes de que Node cargue los `.test.ts`:
 *
 *   cd web
 *   node --import ./src/test/register.mjs --test $(find src -name '*.test.ts')
 *
 * Sin este registro, `node --test` solo puede importar tests cuyos módulos usen
 * rutas relativas con extensión; con él funcionan los alias de FSD.
 */
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
