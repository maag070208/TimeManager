-- F2-07/F2-08 — Marcaje remoto (home office/campo) y NOM-037 teletrabajo.
--
-- 1) `remote_punches`: inicio/fin de jornada capturado por el trabajador sin
--    reloj. Append-only (trigger), idempotente por `clientEventId` y con
--    geolocalización OPCIONAL solo en el momento del marcaje. Se archiva por
--    retención igual que las checadas del reloj.
-- 2) `nom_settings`: política de teletrabajo, política de desconexión y aviso
--    de privacidad editables por cliente + versiones para el consentimiento,
--    y el interruptor `remotePunchEnabled`.
-- 3) `telework_registrations`: una persona teletrabajadora por cliente.
-- 4) `telework_checklists`: checklist inicial/periódico del lugar (JSON).
-- 5) `out_of_hours_contacts`: comunicación fuera de jornada (marca + aviso).

ALTER TABLE "nom_settings"
  ADD COLUMN "remotePunchEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "teleworkPolicy" TEXT,
  ADD COLUMN "disconnectPolicy" TEXT,
  ADD COLUMN "privacyNotice" TEXT,
  ADD COLUMN "policyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "privacyNoticeVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "policiesUpdatedAt" TIMESTAMP(3);

CREATE TYPE "RemotePunchType" AS ENUM ('ENTRY', 'EXIT');
CREATE TYPE "RemoteWorkMode" AS ENUM ('PRESENCIAL', 'HIBRIDO', 'REMOTO', 'CAMPO');
CREATE TYPE "TeleworkMode" AS ENUM ('REMOTO', 'HIBRIDO', 'CAMPO');
CREATE TYPE "TeleworkStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "TeleworkChecklistKind" AS ENUM ('INITIAL', 'PERIODIC');
CREATE TYPE "OutOfHoursContactChannel" AS ENUM ('CALL', 'MESSAGE', 'EMAIL', 'OTHER');

CREATE TABLE "remote_punches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "type" "RemotePunchType" NOT NULL,
    "workMode" "RemoteWorkMode" NOT NULL DEFAULT 'REMOTO',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientReportedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracyMeters" DOUBLE PRECISION,
    "note" TEXT,
    "clientEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "remote_punches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "remote_punches_clientEventId_key" ON "remote_punches"("clientEventId");
CREATE INDEX "remote_punches_tenantId_idx" ON "remote_punches"("tenantId");
CREATE INDEX "remote_punches_userId_occurredAt_idx" ON "remote_punches"("userId", "occurredAt");
CREATE INDEX "remote_punches_tenantId_occurredAt_idx" ON "remote_punches"("tenantId", "occurredAt");
ALTER TABLE "remote_punches" ADD CONSTRAINT "remote_punches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remote_punches" ADD CONSTRAINT "remote_punches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "telework_registrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "mode" "TeleworkMode" NOT NULL DEFAULT 'REMOTO',
    "status" "TeleworkStatus" NOT NULL DEFAULT 'ACTIVE',
    "homeAddress" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "consentAcceptedAt" TIMESTAMP(3),
    "consentPolicyVersion" INTEGER,
    "consentPrivacyVersion" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telework_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "telework_registrations_tenantId_userId_key" ON "telework_registrations"("tenantId", "userId");
CREATE INDEX "telework_registrations_tenantId_status_idx" ON "telework_registrations"("tenantId", "status");
CREATE INDEX "telework_registrations_userId_idx" ON "telework_registrations"("userId");
ALTER TABLE "telework_registrations" ADD CONSTRAINT "telework_registrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telework_registrations" ADD CONSTRAINT "telework_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telework_registrations" ADD CONSTRAINT "telework_registrations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "telework_checklists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "registrationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TeleworkChecklistKind" NOT NULL,
    "answers" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "telework_checklists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telework_checklists_tenantId_userId_idx" ON "telework_checklists"("tenantId", "userId");
CREATE INDEX "telework_checklists_registrationId_idx" ON "telework_checklists"("registrationId");
CREATE INDEX "telework_checklists_tenantId_completedAt_idx" ON "telework_checklists"("tenantId", "completedAt");
ALTER TABLE "telework_checklists" ADD CONSTRAINT "telework_checklists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telework_checklists" ADD CONSTRAINT "telework_checklists_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "telework_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telework_checklists" ADD CONSTRAINT "telework_checklists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "out_of_hours_contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL,
    "channel" "OutOfHoursContactChannel" NOT NULL,
    "reason" TEXT NOT NULL,
    "notifiedEmployee" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "out_of_hours_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "out_of_hours_contacts_tenantId_contactedAt_idx" ON "out_of_hours_contacts"("tenantId", "contactedAt");
CREATE INDEX "out_of_hours_contacts_userId_contactedAt_idx" ON "out_of_hours_contacts"("userId", "contactedAt");
ALTER TABLE "out_of_hours_contacts" ADD CONSTRAINT "out_of_hours_contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "out_of_hours_contacts" ADD CONSTRAINT "out_of_hours_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "out_of_hours_contacts" ADD CONSTRAINT "out_of_hours_contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Archivo por retención (mismas columnas + archivedAt).
CREATE TABLE "nom_archived_remote_punches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RemotePunchType" NOT NULL,
    "workMode" "RemoteWorkMode" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "clientReportedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracyMeters" DOUBLE PRECISION,
    "note" TEXT,
    "clientEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nom_archived_remote_punches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nom_archived_remote_punches_tenantId_occurredAt_idx" ON "nom_archived_remote_punches"("tenantId", "occurredAt");

-- Inmutabilidad del marcaje remoto (mismo contrato que las checadas del reloj).
CREATE OR REPLACE FUNCTION "nom_remote_punches_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.nom_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'remote_punches is append-only: % denied (report a discrepancy instead)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "remote_punches_append_only"
BEFORE UPDATE OR DELETE ON "remote_punches"
FOR EACH ROW EXECUTE FUNCTION "nom_remote_punches_append_only"();

-- RLS para las tablas nuevas (mismo patrón que 20261108000000_rls_tenant_isolation).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenantId'
      AND c.is_nullable = 'NO'
      AND c.table_name IN (
        'remote_punches', 'telework_registrations', 'telework_checklists', 'out_of_hours_contacts'
      )
    ORDER BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())',
      t
    );
  END LOOP;
END
$$;
