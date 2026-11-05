-- Vacaciones y permisos configurables por cliente.
CREATE TYPE "LeaveKind" AS ENUM ('VACATION', 'PAID_LEAVE', 'UNPAID_LEAVE', 'SICK_LEAVE', 'OTHER');
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "leave_types" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "LeaveKind" NOT NULL DEFAULT 'OTHER',
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_types_tenantId_key_key" ON "leave_types"("tenantId", "key");
CREATE INDEX "leave_types_tenantId_active_idx" ON "leave_types"("tenantId", "active");

CREATE TABLE "leave_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "days" INTEGER NOT NULL,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leave_requests_tenantId_status_idx" ON "leave_requests"("tenantId", "status");
CREATE INDEX "leave_requests_userId_startDate_idx" ON "leave_requests"("userId", "startDate");
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['leave_types','leave_requests'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())', t);
  END LOOP;
END
$$;
