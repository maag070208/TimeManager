import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * Lock de líder de workers en Postgres (F1B-02): una sola fila por nombre en
 * `worker_locks`. No usa advisory locks de sesión porque Prisma regresa la
 * conexión al pool después de cada query; el heartbeat con TTL permite que otro
 * proceso tome el liderazgo si el actual muere.
 */
export const LEADER_LOCK_NAME = "workers";

/** Identidad única de esta instancia (host + pid + uuid), estable por proceso. */
export const workerHolderId = (): string =>
  `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

/**
 * Intenta tomar (o renovar si ya la tenemos) la fila del lock.
 * La toma si está libre, si es nuestra o si el heartbeat caducó.
 */
export const acquireLeaderLock = async (
  db: PrismaClient,
  name: string,
  holder: string,
  ttlMs: number
): Promise<boolean> => {
  const rows = await db.$queryRaw<Array<{ holder: string }>>`
    INSERT INTO "worker_locks" ("name", "holder", "heartbeatAt", "acquiredAt")
    VALUES (${name}, ${holder}, NOW(), NOW())
    ON CONFLICT ("name") DO UPDATE
      SET "holder" = EXCLUDED."holder", "heartbeatAt" = NOW(), "acquiredAt" = NOW()
      WHERE "worker_locks"."holder" = EXCLUDED."holder"
         OR "worker_locks"."heartbeatAt" < NOW() - (${ttlMs}::int * INTERVAL '1 millisecond')
    RETURNING "holder"
  `;
  return rows.length === 1 && rows[0].holder === holder;
};

/** Renueva el heartbeat; `false` si el liderazgo ya lo tomó otro proceso. */
export const heartbeatLeaderLock = async (
  db: PrismaClient,
  name: string,
  holder: string
): Promise<boolean> => {
  const updated = await db.$executeRaw`
    UPDATE "worker_locks" SET "heartbeatAt" = NOW()
    WHERE "name" = ${name} AND "holder" = ${holder}
  `;
  return updated > 0;
};

/** Suelta el liderazgo (apagado ordenado) para no esperar el TTL. */
export const releaseLeaderLock = async (
  db: PrismaClient,
  name: string,
  holder: string
): Promise<void> => {
  await db.$executeRaw`
    DELETE FROM "worker_locks" WHERE "name" = ${name} AND "holder" = ${holder}
  `;
};
