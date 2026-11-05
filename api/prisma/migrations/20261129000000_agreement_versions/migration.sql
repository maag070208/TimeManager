ALTER TABLE "work_record_agreements"
  ADD COLUMN "employerAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "employerAcceptedIp" TEXT,
  ADD COLUMN "employerAcceptedHash" TEXT,
  ADD COLUMN "employerAcceptedById" TEXT;
ALTER TABLE "work_record_agreements"
  ADD CONSTRAINT "work_record_agreements_employerAcceptedById_fkey"
  FOREIGN KEY ("employerAcceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "work_record_agreement_versions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "agreementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "methods" JSONB NOT NULL,
  "roundingPolicy" TEXT,
  "correctionRules" TEXT,
  "textVersion" INTEGER NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedIp" TEXT,
  "acceptedHash" TEXT,
  "employerAcceptedAt" TIMESTAMP(3),
  "employerAcceptedIp" TEXT,
  "employerAcceptedHash" TEXT,
  "employerAcceptedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_record_agreement_versions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "work_record_agreement_versions_tenantId_agreementId_idx" ON "work_record_agreement_versions"("tenantId", "agreementId");
CREATE INDEX "work_record_agreement_versions_userId_idx" ON "work_record_agreement_versions"("userId");
ALTER TABLE "work_record_agreement_versions" ADD CONSTRAINT "work_record_agreement_versions_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "work_record_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_record_agreement_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_record_agreement_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "work_record_agreement_versions"
  USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id());
