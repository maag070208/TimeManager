-- F3 — Prueba plena del registro (art. 132 fr. XXXIV):
-- acuerdo del método de registro y conformidad periódica del trabajador.
CREATE TYPE "WorkRecordAckStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISCREPANCY');

CREATE TABLE "work_record_agreements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "methods" JSONB NOT NULL,
    "roundingPolicy" TEXT,
    "correctionRules" TEXT,
    "textVersion" INTEGER NOT NULL DEFAULT 1,
    "acceptedAt" TIMESTAMP(3),
    "acceptedIp" TEXT,
    "acceptedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_record_agreements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "work_record_agreements_userId_key" ON "work_record_agreements"("userId");
CREATE INDEX "work_record_agreements_tenantId_idx" ON "work_record_agreements"("tenantId");
ALTER TABLE "work_record_agreements" ADD CONSTRAINT "work_record_agreements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "work_record_acknowledgments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "summary" JSONB NOT NULL,
    "summaryHash" TEXT NOT NULL,
    "status" "WorkRecordAckStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "workerIp" TEXT,
    "discrepancyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_record_acknowledgments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "work_record_acknowledgments_tenantId_userId_periodStart_periodEnd_key" ON "work_record_acknowledgments"("tenantId", "userId", "periodStart", "periodEnd");
CREATE INDEX "work_record_acknowledgments_tenantId_periodStart_idx" ON "work_record_acknowledgments"("tenantId", "periodStart");
CREATE INDEX "work_record_acknowledgments_userId_periodStart_idx" ON "work_record_acknowledgments"("userId", "periodStart");
ALTER TABLE "work_record_acknowledgments" ADD CONSTRAINT "work_record_acknowledgments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['work_record_agreements','work_record_acknowledgments'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())', t);
  END LOOP;
END
$$;
