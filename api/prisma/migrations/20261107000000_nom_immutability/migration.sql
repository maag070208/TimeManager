-- F2-01..F2-04 — Registro electrónico de jornada (LFT art. 132 fr. XXXIV, 2027).
--
-- 1) Inmutabilidad: `time_clock_punches` es append-only (no UPDATE/DELETE) y
--    `access_events` solo admite el primer pase a anulado (nada más cambia).
--    La purga por retención se permite únicamente dentro de una transacción que
--    fije `SET LOCAL app.nom_purge = 'on'` (lo hace el servicio de archivado).
-- 2) Ajustes de checadas (`punch_adjustments`): quién/cuándo/por qué, valor
--    anterior/nuevo y aprobador. La checada original nunca se toca.
-- 3) Configuración NOM por cliente (`nom_settings`): límites de jornada y
--    meses de retención.
-- 4) Alertas de límite de jornada (`workday_limit_alerts`).
-- 5) Tablas de archivo (retención, F2-04): mismas columnas + `archivedAt`.
--    No llevan FKs para que sobrevivan al borrado de filas relacionadas.

-- ── Enums y tablas nuevas ──────────────────────────────────────────────────
CREATE TYPE "PunchAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "WorkdayAlertScope" AS ENUM ('DAY', 'WEEK');

CREATE TABLE "punch_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "punchId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousState" JSONB NOT NULL,
    "newState" JSONB NOT NULL,
    "status" "PunchAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "punch_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nom_settings" (
    "tenantId" TEXT NOT NULL,
    "workdayLimitMinutes" INTEGER,
    "weeklyLimitMinutes" INTEGER,
    "retentionMonths" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nom_settings_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "workday_limit_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "scope" "WorkdayAlertScope" NOT NULL,
    "date" DATE NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "limitMinutes" INTEGER NOT NULL,
    "notifyCount" INTEGER NOT NULL DEFAULT 0,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workday_limit_alerts_pkey" PRIMARY KEY ("id")
);

-- ── Tablas de archivo (retención) ──────────────────────────────────────────
CREATE TABLE "nom_archived_time_clock_punches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clockSerial" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "PunchMethod" NOT NULL,
    "minor" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nom_archived_time_clock_punches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nom_archived_access_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AccessEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "deviceTimestamp" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT,
    "employeeNumberSnapshot" TEXT,
    "guardId" TEXT,
    "siteId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracyMeters" DOUBLE PRECISION,
    "locationSource" "AccessLocationSource" NOT NULL,
    "method" "AccessMethod" NOT NULL,
    "credentialVersion" INTEGER,
    "scannedPayloadHash" TEXT,
    "clientEventId" TEXT,
    "deviceId" TEXT,
    "deviceCode" TEXT,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nom_archived_access_events_pkey" PRIMARY KEY ("id")
);

-- ── FKs / índices de las tablas nuevas ─────────────────────────────────────
CREATE INDEX "punch_adjustments_tenantId_idx" ON "punch_adjustments"("tenantId");
CREATE INDEX "punch_adjustments_punchId_idx" ON "punch_adjustments"("punchId");
CREATE INDEX "punch_adjustments_status_idx" ON "punch_adjustments"("status");
CREATE INDEX "punch_adjustments_requestedById_idx" ON "punch_adjustments"("requestedById");
CREATE INDEX "punch_adjustments_createdAt_idx" ON "punch_adjustments"("createdAt");
ALTER TABLE "punch_adjustments" ADD CONSTRAINT "punch_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "punch_adjustments" ADD CONSTRAINT "punch_adjustments_punchId_fkey" FOREIGN KEY ("punchId") REFERENCES "time_clock_punches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "punch_adjustments" ADD CONSTRAINT "punch_adjustments_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "punch_adjustments" ADD CONSTRAINT "punch_adjustments_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nom_settings" ADD CONSTRAINT "nom_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nom_settings" ADD CONSTRAINT "nom_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "workday_limit_alerts_tenantId_userId_scope_date_key" ON "workday_limit_alerts"("tenantId", "userId", "scope", "date");
CREATE INDEX "workday_limit_alerts_tenantId_createdAt_idx" ON "workday_limit_alerts"("tenantId", "createdAt");
ALTER TABLE "workday_limit_alerts" ADD CONSTRAINT "workday_limit_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workday_limit_alerts" ADD CONSTRAINT "workday_limit_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "nom_archived_time_clock_punches_tenantId_occurredAt_idx" ON "nom_archived_time_clock_punches"("tenantId", "occurredAt");
CREATE INDEX "nom_archived_access_events_tenantId_occurredAt_idx" ON "nom_archived_access_events"("tenantId", "occurredAt");

-- ── Inmutabilidad (triggers) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "nom_time_clock_punches_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.nom_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'time_clock_punches is append-only: % denied (use a punch adjustment)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "time_clock_punches_append_only"
BEFORE UPDATE OR DELETE ON "time_clock_punches"
FOR EACH ROW EXECUTE FUNCTION "nom_time_clock_punches_append_only"();

CREATE OR REPLACE FUNCTION "nom_access_events_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.nom_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'access_events is append-only: DELETE denied'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Único UPDATE permitido: el primer pase a anulado (void), sin tocar nada más.
  IF OLD."voidedAt" IS NOT NULL OR NEW."voidedAt" IS NULL THEN
    RAISE EXCEPTION 'access_events is append-only: only one void transition is allowed'
      USING ERRCODE = 'check_violation';
  END IF;
  IF (to_jsonb(OLD) - 'voidedAt' - 'voidedById' - 'voidReason')
     IS DISTINCT FROM (to_jsonb(NEW) - 'voidedAt' - 'voidedById' - 'voidReason') THEN
    RAISE EXCEPTION 'access_events is append-only: only void fields may change'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "access_events_append_only"
BEFORE UPDATE OR DELETE ON "access_events"
FOR EACH ROW EXECUTE FUNCTION "nom_access_events_append_only"();
