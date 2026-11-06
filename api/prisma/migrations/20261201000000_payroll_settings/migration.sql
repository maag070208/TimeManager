CREATE TABLE "payroll_settings" (
  "tenantId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "defaultDailySalary" DECIMAL(12,2),
  "sbcDaily" DECIMAL(12,2),
  "umaDaily" DECIMAL(12,2),
  "overtimeHourlyDivisor" INTEGER NOT NULL DEFAULT 8,
  "overtimeDoubleHoursPerWeek" INTEGER NOT NULL DEFAULT 9,
  "overtimeDoubleMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 2,
  "overtimeTripleMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 3,
  "aguinaldoDays" INTEGER NOT NULL DEFAULT 15,
  "aguinaldoExemptUmas" DECIMAL(6,2) NOT NULL DEFAULT 30,
  "vacationPremiumPct" DECIMAL(5,2) NOT NULL DEFAULT 25,
  "primaVacacionalExemptUmas" DECIMAL(6,2) NOT NULL DEFAULT 15,
  "valesMonthly" DECIMAL(12,2),
  "valesExemptMonthly" DECIMAL(12,2),
  "fondoAhorroPct" DECIMAL(5,2),
  "fondoAhorroCapMonthly" DECIMAL(12,2),
  "fondoAhorroExemptMonthly" DECIMAL(12,2),
  "ptuRatePct" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "isrEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isrBrackets" JSONB,
  "isrSubsidyMonthly" DECIMAL(12,2),
  "imssEnabled" BOOLEAN NOT NULL DEFAULT false,
  "imssRates" JSONB,
  "primaAntiguedadDaysPerYear" INTEGER NOT NULL DEFAULT 12,
  "primaAntiguedadCapDaily" DECIMAL(12,2),
  "severanceMonths" DECIMAL(4,2) NOT NULL DEFAULT 3,
  "severanceDaysPerYear" INTEGER NOT NULL DEFAULT 20,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("tenantId")
);
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_settings" USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id());
