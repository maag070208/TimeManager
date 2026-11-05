import { PrismaClient } from "@prisma/client";
import { env } from "@core/config/env.config";
// Directo del archivo (no del barrel): iterate.ts importa este módulo y un
// import circular database ↔ barrel rompería la carga.
import { tenancyExtension } from "@core/tenancy/extension";

/**
 * `users.name` guarda solo el primer nombre; el nombre completo se arma con
 * `middleName` + `paternalSurname` + `maternalSurname`. Se compone al leer para
 * que las pantallas, cartas y PDFs sigan mostrando el nombre completo.
 *
 * Las filas viejas (respaldo migrado) traen el nombre completo en `name`: si ya
 * termina con los apellidos, se devuelve tal cual para no duplicarlos.
 */
const clean = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const composeName = (user: {
  name: string;
  middleName: string | null;
  paternalSurname: string | null;
  maternalSurname: string | null;
}): string => {
  const parts = [user.name, user.middleName, user.paternalSurname, user.maternalSurname].filter(
    (part): part is string => typeof part === "string" && part.trim() !== ""
  );
  const full = parts.join(" ").replace(/\s+/g, " ").trim();
  const surnames = [user.paternalSurname, user.maternalSurname]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .map(clean)
    .join(" ");
  const first = user.name.trim().replace(/\s+/g, " ");
  // Fila vieja: el nombre completo ya estaba guardado en `name`.
  return surnames && clean(first).endsWith(surnames) ? first : full;
};

/**
 * Primer nombre. En las filas viejas `name` trae el nombre completo: se le
 * quitan del final el segundo nombre y los apellidos. En las nuevas `name` ya
 * es solo el primer nombre y no se toca.
 */
const firstNameOf = (user: {
  name: string;
  middleName: string | null;
  paternalSurname: string | null;
  maternalSurname: string | null;
}): string => {
  let value = user.name.trim().replace(/\s+/g, " ");
  for (const part of [user.maternalSurname, user.paternalSurname, user.middleName]) {
    const piece = (part ?? "").trim();
    if (!piece) continue;
    const escaped = piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = value.replace(new RegExp(`\\s+${escaped}$`, "i"), "").trim();
    if (next && next !== value) value = next;
  }
  return value || user.name;
};

/**
 * `connection_limit`/`pool_timeout` en la URL (F1B-07): Railway/PgBouncer
 * imponen un máximo de conexiones; N réplicas × pool no debe pasar del 70%.
 * Se respeta un valor ya presente en `DATABASE_URL`.
 */
const withPoolParams = (url: string): string => {
  if (!env.DATABASE_CONNECTION_LIMIT && !env.DATABASE_POOL_TIMEOUT && !env.DATABASE_PGBOUNCER) return url;
  const [base, query] = url.split("?");
  const params = new URLSearchParams(query ?? "");
  if (env.DATABASE_CONNECTION_LIMIT && !params.has("connection_limit")) {
    params.set("connection_limit", String(env.DATABASE_CONNECTION_LIMIT));
  }
  if (env.DATABASE_POOL_TIMEOUT && !params.has("pool_timeout")) {
    params.set("pool_timeout", String(env.DATABASE_POOL_TIMEOUT));
  }
  if (env.DATABASE_PGBOUNCER && !params.has("pgbouncer")) params.set("pgbouncer", "true");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

const base = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  ...(env.DATABASE_CONNECTION_LIMIT || env.DATABASE_POOL_TIMEOUT || env.DATABASE_PGBOUNCER
    ? { datasources: { db: { url: withPoolParams(env.DATABASE_URL) } } }
    : {}),
});

const extended = base.$extends({
  result: {
    user: {
      name: {
        needs: { name: true, middleName: true, paternalSurname: true, maternalSurname: true },
        compute: composeName,
      },
      /**
       * Primer nombre, para los formularios. En las filas viejas `name` trae el
       * nombre completo: se le quitan el segundo nombre y los apellidos del final.
       */
      firstName: {
        needs: { name: true, middleName: true, paternalSurname: true, maternalSurname: true },
        compute: firstNameOf,
      },
    },
  },
} as never);

export const prismaClient = (extended as unknown as PrismaClient).$extends(
  tenancyExtension({
    rls: {
      client: {
        $transaction: (ops) => (base as unknown as { $transaction: (o: unknown[]) => Promise<unknown[]> }).$transaction(ops),
        $executeRawUnsafe: (sql, ...values) =>
          (base as unknown as { $executeRawUnsafe: (s: string, ...v: unknown[]) => Promise<number> }).$executeRawUnsafe(sql, ...values),
      },
    },
  }) as never
) as unknown as PrismaClient;

/**
 * Cliente para procesos de workers/plataforma con rol BYPASSRLS
 * (`WORKER_DATABASE_URL`). Comparte la misma extensión de tenancy (filtra por
 * contexto) pero puede iterar clientes sin `app.tenant_id`.
 */
export const workerPrismaClient = env.WORKER_DATABASE_URL
  ? ((new PrismaClient({
      datasources: { db: { url: env.WORKER_DATABASE_URL } },
      log: ["error"],
    }) as unknown as { $extends: (ext: unknown) => PrismaClient }).$extends(tenancyExtension() as never) as unknown as PrismaClient)
  : prismaClient;
