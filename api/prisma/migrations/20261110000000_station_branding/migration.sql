-- F1B-12 — Estación de huellas configurable (central de plataforma o en sitio
--            por cliente) + F3-05 branding por cliente.
--
-- `fingerprint_station_configs` tiene una fila por alcance: `tenantId = null`
-- es el default de plataforma; una fila con tenantId es el override del
-- cliente (estación instalada en su sitio). La contraseña va cifrada con
-- AES-256-GCM (`core/utils/crypto`) y nunca se devuelve por API.
-- Fallback: si no hay fila, se usa `FINGERPRINT_STATION_*` del `.env`.
CREATE TABLE "fingerprint_station_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fingerprint_station_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fingerprint_station_configs_tenantId_key" ON "fingerprint_station_configs"("tenantId");

-- Branding por cliente (F3-05): color de acento, logo (data URL) y remitente
-- de correo propio (fallback: `RESEND_FROM_EMAIL`/marca TimeManager).
ALTER TABLE "tenants"
  ADD COLUMN "brandColor" TEXT,
  ADD COLUMN "logoDataUrl" TEXT,
  ADD COLUMN "emailFrom" TEXT;
