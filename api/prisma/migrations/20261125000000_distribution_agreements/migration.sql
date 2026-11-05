CREATE TYPE "DistributionAgreementKind" AS ENUM ('INDIVIDUAL', 'COLECTIVO');
CREATE TYPE "DistributionAgreementParty" AS ENUM ('WORKER', 'UNION');

CREATE TABLE "workday_distribution_agreements" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT,
  "scheduleId" TEXT,
  "kind" "DistributionAgreementKind" NOT NULL DEFAULT 'INDIVIDUAL',
  "party" "DistributionAgreementParty" NOT NULL DEFAULT 'WORKER',
  "scope" TEXT NOT NULL DEFAULT 'HORARIO',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "evidenceText" TEXT NOT NULL,
  "acceptedHash" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedIp" TEXT,
  "acceptedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workday_distribution_agreements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workday_distribution_agreements_tenantId_userId_idx" ON "workday_distribution_agreements"("tenantId", "userId");
CREATE INDEX "workday_distribution_agreements_tenantId_scheduleId_idx" ON "workday_distribution_agreements"("tenantId", "scheduleId");
ALTER TABLE "workday_distribution_agreements" ADD CONSTRAINT "workday_distribution_agreements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workday_distribution_agreements" ADD CONSTRAINT "workday_distribution_agreements_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workday_distribution_agreements" ADD CONSTRAINT "workday_distribution_agreements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workday_distribution_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workday_distribution_agreements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workday_distribution_agreements"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());
