CREATE TABLE "payroll_positions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "jobTitle" TEXT,
  "dailySalary" DECIMAL(12,2) NOT NULL,
  "sbcDaily" DECIMAL(12,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_positions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_positions_tenantId_name_key" ON "payroll_positions"("tenantId", "name");
CREATE INDEX "payroll_positions_tenantId_idx" ON "payroll_positions"("tenantId");
ALTER TABLE "users" ADD COLUMN "payrollPositionId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_payrollPositionId_fkey" FOREIGN KEY ("payrollPositionId") REFERENCES "payroll_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
