# Bots de QA

Personas simuladas que recorren los flujos completos del producto contra un API
corriendo, con su propia cuenta y token, como lo harían la app y la web.

**Solo local.** `qa/lib.ts` aborta si el API no está en loopback o la base no es
`tm_qa*`. Nunca contra Railway ni contra `tm_demo`.

## Preparar (una vez)

```bash
docker exec tm-test-pg psql -U postgres -c "CREATE DATABASE tm_qa"
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_qa npx prisma migrate deploy
```

`qa/.env.qa` (no se commitea) trae `QA_API_URL`, `QA_DATABASE_URL`,
`QA_PLATFORM_USER` y `QA_PLATFORM_PASS`. La cuenta de plataforma se siembra con
`prisma/seed.ts` (`INITIAL_ADMIN_USERNAME`/`INITIAL_ADMIN_PASSWORD`).

El API de QA es la configuración `api-qa` de `.claude/launch.json` (puerto 4031,
sin correos, Ably ni estación de huellas, sin rate limit).

## Correr

```bash
pnpm --filter timemanager-api qa:bots:local             # prepara tm_qa, levanta/cierra el API y corre todo
pnpm --filter timemanager-api qa:bots:local jornada     # corrida autocontenida, sólo ese flujo
pnpm --filter timemanager-api qa:bots                   # contra un API QA ya abierto: reparto nuevo + todos
pnpm --filter timemanager-api qa:bots jornada permisos # sólo esos flujos
QA_REUSE=1 pnpm --filter timemanager-api qa:bots jornada  # reusa el último reparto
```

`qa:bots:local` usa `qa/.env.qa`, exige una base local `tm_qa*`, guarda el log del proceso en `qa/out/api.log` y apaga el API temporal al terminar, incluso cuando hay fallos. No reutiliza ni detiene un API que ya ocupe el puerto 4031.

Salida en `qa/out/` (no se commitea): `cast.json` con las cuentas generadas y
`report.md` / `report.json` con cada paso (✓/✗) y los hallazgos.

## Reparto (`qa/cast.ts`)

Cada corrida crea un cliente nuevo `qa-<sello>` (zona `America/Mexico_City`):

| Bot | Rol | Detalle |
| --- | --- | --- |
| `cast.platform` | `ADMIN` | equipo TimeManager; da de alta los clientes |
| `cast.admin` | `CLIENT_ADMIN` | administra el cliente |
| `cast.hr` | `HUMAN_RESOURCES` | Roberto, núm. 100, Oficina |
| `cast.employees[0..2]` | `CLIENT_STAFF` | Lucía, Marco, Daniela — Almacén (201–203) |
| `cast.employees[3..5]` | `CLIENT_STAFF` | Óscar, Fernanda, Jorge — Oficina (204–206) |
| `cast.intruderAdmin` / `cast.intruderEmployee` | otro cliente | para probar aislamiento |

`cast.file` trae ids, departamentos (`departments.almacen/oficina`) y la zona.

## Escribir un flujo

Un archivo por flujo en `qa/flows/<nombre>.ts`, con export default:

```ts
import type { Cast } from "../cast";
import type { Report } from "../lib";

export default async function miFlujo(cast: Cast, r: Report): Promise<void> {
  // `clientEventId` es obligatorio (idempotencia): un uuid nuevo por acción.
  const res = await cast.employees[0].post("/nom/me/punch", {
    type: "ENTRY",
    clientEventId: crypto.randomUUID(),
  });
  r.expect("Lucía registra su entrada", res, 201);
  r.check("la hora es del servidor", Boolean(res.body?.punch?.occurredAt));
  // Un error del producto (no del bot) se anota como hallazgo:
  // r.finding("ALTA", "título corto", "ruta, cuerpo enviado, respuesta y qué se esperaba");
}
```

- `bot.get/post/put/patch/delete(ruta, cuerpo, { tenantId })` devuelve
  `{ status, body, text }`. Las rutas van sin `/api/v1`.
- `r.expect(paso, res, status, code?)` y `r.check(paso, ok, detalle)` registran
  pasos; `r.finding(severidad, título, detalle)` registra un bug del producto.
- Los flujos corren en orden alfabético sobre el mismo reparto: cada flujo crea
  lo que necesita (horarios, tipos de permiso…) y no rompe a los demás (si
  desactiva a alguien, que sea una persona que el mismo flujo creó).
- Las checadas usan la hora del servidor: un día completo pasa en segundos y
  solo hay un ciclo entrada → comida → regreso → salida por persona y día.
