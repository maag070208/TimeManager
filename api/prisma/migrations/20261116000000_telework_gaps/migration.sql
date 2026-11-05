-- F4 — Brechas NOM-037: % teletrabajo, validación del checklist por la
-- Comisión, equipo entregado, capacitación, avisos y reversibilidad.
CREATE TYPE "TeleworkChecklistResult" AS ENUM ('APTO', 'NO_APTO');
CREATE TYPE "TeleworkTrainingKind" AS ENUM ('INITIAL', 'ANNUAL');
CREATE TYPE "TeleworkNoticeKind" AS ENUM ('ADDRESS_CHANGE', 'RISK_CONDITION', 'OTHER');
CREATE TYPE "TeleworkReversalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

ALTER TABLE "telework_registrations"
  ADD COLUMN "teleworkPercent" INTEGER,
  ADD COLUMN "activities" TEXT,
  ADD COLUMN "position" TEXT,
  ADD COLUMN "workPlaces" JSONB;

ALTER TABLE "telework_checklists"
  ADD COLUMN "validatedById" TEXT,
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "result" "TeleworkChecklistResult",
  ADD COLUMN "validationNotes" TEXT;

CREATE TABLE "telework_equipment_deliveries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "notes" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "acceptedHash" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telework_equipment_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telework_equipment_deliveries_tenantId_userId_idx" ON "telework_equipment_deliveries"("tenantId", "userId");
ALTER TABLE "telework_equipment_deliveries" ADD CONSTRAINT "telework_equipment_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telework_trainings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "kind" "TeleworkTrainingKind" NOT NULL DEFAULT 'ANNUAL',
  "completedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "evidence" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telework_trainings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telework_trainings_tenantId_userId_idx" ON "telework_trainings"("tenantId", "userId");
CREATE INDEX "telework_trainings_tenantId_expiresAt_idx" ON "telework_trainings"("tenantId", "expiresAt");
ALTER TABLE "telework_trainings" ADD CONSTRAINT "telework_trainings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telework_notices" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "kind" "TeleworkNoticeKind" NOT NULL DEFAULT 'OTHER',
  "occurredAt" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telework_notices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telework_notices_tenantId_userId_idx" ON "telework_notices"("tenantId", "userId");
ALTER TABLE "telework_notices" ADD CONSTRAINT "telework_notices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telework_reversal_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "TeleworkReversalStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telework_reversal_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telework_reversal_requests_tenantId_status_idx" ON "telework_reversal_requests"("tenantId", "status");
ALTER TABLE "telework_reversal_requests" ADD CONSTRAINT "telework_reversal_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'telework_equipment_deliveries','telework_trainings','telework_notices','telework_reversal_requests'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())', t);
  END LOOP;
END
$$;
