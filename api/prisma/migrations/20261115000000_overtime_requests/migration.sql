-- F3 — Autorización previa y consentimiento del trabajador para horas extra
-- (arts. 66 y 68 LFT). El rechazo no borra el tiempo trabajado del registro.
CREATE TYPE "OvertimeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "overtime_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "plannedMin" INTEGER NOT NULL,
    "days" JSONB NOT NULL DEFAULT '[]',
    "status" "OvertimeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "workerNote" TEXT,
    "workerDecidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "overtime_requests_tenantId_status_idx" ON "overtime_requests"("tenantId", "status");
CREATE INDEX "overtime_requests_userId_createdAt_idx" ON "overtime_requests"("userId", "createdAt");
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "overtime_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "overtime_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "overtime_requests"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());
