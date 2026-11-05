-- F1 — Motor semanal de horas extra (plan de cumplimiento LFT 2026).
--
-- Snapshot por persona/semana con la clasificación en DOBLE, TRIPLE y
-- EXCEDENTE ILEGAL, detalle día por día y versión del motor. Se recalcula en
-- DRAFT y se congela al confirmarse. La tabla es por cliente (RLS).

CREATE TYPE "WeeklyOvertimeStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CLOSED');

CREATE TABLE "weekly_overtime_ledgers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "ordinaryMin" INTEGER NOT NULL DEFAULT 0,
    "otDoubleMin" INTEGER NOT NULL DEFAULT 0,
    "otTripleMin" INTEGER NOT NULL DEFAULT 0,
    "otIllegalMin" INTEGER NOT NULL DEFAULT 0,
    "restDayWorkedMin" INTEGER NOT NULL DEFAULT 0,
    "holidayWorkedMin" INTEGER NOT NULL DEFAULT 0,
    "sundayWorked" BOOLEAN NOT NULL DEFAULT false,
    "minor" BOOLEAN NOT NULL DEFAULT false,
    "violations" JSONB NOT NULL DEFAULT '[]',
    "days" JSONB NOT NULL DEFAULT '[]',
    "engineVersion" TEXT NOT NULL,
    "status" "WeeklyOvertimeStatus" NOT NULL DEFAULT 'DRAFT',
    "workerAckAt" TIMESTAMP(3),
    "workerAckHash" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "weekly_overtime_ledgers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weekly_overtime_ledgers_tenantId_userId_weekStart_key" ON "weekly_overtime_ledgers"("tenantId", "userId", "weekStart");
CREATE INDEX "weekly_overtime_ledgers_tenantId_weekStart_idx" ON "weekly_overtime_ledgers"("tenantId", "weekStart");
CREATE INDEX "weekly_overtime_ledgers_userId_weekStart_idx" ON "weekly_overtime_ledgers"("userId", "weekStart");
CREATE INDEX "weekly_overtime_ledgers_status_idx" ON "weekly_overtime_ledgers"("status");
ALTER TABLE "weekly_overtime_ledgers" ADD CONSTRAINT "weekly_overtime_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS por cliente (mismo patrón que 20261108000000_rls_tenant_isolation).
ALTER TABLE "weekly_overtime_ledgers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weekly_overtime_ledgers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "weekly_overtime_ledgers"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());
