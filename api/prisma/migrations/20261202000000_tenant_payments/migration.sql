CREATE TYPE "TenantPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "tenant_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "dueDate" DATE NOT NULL,
  "status" "TenantPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "method" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_payments_tenantId_period_concept_key" ON "tenant_payments"("tenantId", "period", "concept");
CREATE INDEX "tenant_payments_tenantId_dueDate_idx" ON "tenant_payments"("tenantId", "dueDate");
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
