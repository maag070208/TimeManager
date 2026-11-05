-- F1B-13/17 — Agente local del cliente (TimeManagerAgent).
--
-- Un agente se registra con un token de dispositivo por cliente (en BD solo su
-- hash SHA-256), sube checadas en lote idempotente por
-- `@@unique(clockSerial, serialNo)` y consume trabajos de escritura contra el
-- reloj (padrón, tarjetas, huellas).
--
-- La cola de trabajos vive en `agent_jobs` mientras entre pg-boss (decisión A1);
-- `AgentJobQueue` es la interfaz que se sustituye sin tocar los endpoints.
--
-- Sin backfill: no hay agentes previos. `tenantId` no lleva FK a `tenants` para
-- seguir el patrón de las demás tablas de negocio (`time_clocks`,
-- `time_clock_punches`), que se filtran por la extensión de tenancy.

-- CreateEnum
CREATE TYPE "AgentJobType" AS ENUM ('SYNC', 'PERSON_ADD', 'PERSON_REMOVE', 'CARD_ADD', 'CARD_REMOVE', 'FINGERPRINT_APPLY');

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "version" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT,
    "clockSerial" TEXT,
    "type" "AgentJobType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "AgentJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_tokenHash_key" ON "agents"("tokenHash");

-- CreateIndex
CREATE INDEX "agents_tenantId_idx" ON "agents"("tenantId");

-- CreateIndex
CREATE INDEX "agent_jobs_tenantId_status_availableAt_idx" ON "agent_jobs"("tenantId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "agent_jobs_agentId_idx" ON "agent_jobs"("agentId");

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
