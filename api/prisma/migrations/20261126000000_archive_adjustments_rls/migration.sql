-- RJ-05: archivo de ajustes, RLS de tablas de archivo y bloqueo de TRUNCATE.
CREATE TABLE "nom_archived_punch_adjustments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "targetType" "PunchAdjustmentTarget" NOT NULL,
  "targetId" TEXT NOT NULL,
  "punchId" TEXT,
  "remotePunchId" TEXT,
  "requestedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousState" JSONB NOT NULL,
  "newState" JSONB NOT NULL,
  "status" "PunchAdjustmentStatus" NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nom_archived_punch_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nom_archived_punch_adjustments_tenantId_idx" ON "nom_archived_punch_adjustments"("tenantId");

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'nom_archived_time_clock_punches',
      'nom_archived_access_events',
      'nom_archived_remote_punches',
      'nom_archived_punch_adjustments'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION "nom_archive_block_truncate"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'nom_archived_* es evidencia de retención: TRUNCATE no permitido';
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'nom_archived_time_clock_punches',
      'nom_archived_access_events',
      'nom_archived_remote_punches',
      'nom_archived_punch_adjustments'
    ])
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION nom_archive_block_truncate()', t || '_no_truncate', t);
  END LOOP;
END $$;
