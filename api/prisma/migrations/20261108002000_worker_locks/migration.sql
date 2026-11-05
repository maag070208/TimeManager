-- F1B-02 — Lock de líder de workers (Postgres, sin Redis).
--
-- Una sola fila por lock. El líder la mantiene con heartbeat; si el proceso
-- muere, el heartbeat caduca y otro worker la toma. No usa advisory locks de
-- sesión porque Prisma devuelve la conexión al pool después de cada query.
CREATE TABLE IF NOT EXISTS "worker_locks" (
  "name" TEXT NOT NULL,
  "holder" TEXT NOT NULL,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_locks_pkey" PRIMARY KEY ("name")
);
