-- Rollback de 20261105000000_tenancy: devuelve el esquema al baseline
-- 20261104000000_baseline_rh. Pérdida asumida en DEV: el contenido de
-- `users.company` (columna eliminada por L-09) y los tenantId.

-- DropEnum inverso: recrear los enums huérfanos del ERP que existía en baseline
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'FAIR', 'POOR', 'BROKEN');
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PARTIAL', 'RETURNED', 'CANCELLED');
CREATE TYPE "MovementStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "MovementType" AS ENUM ('STOCK_IN', 'LOAN', 'RETURN', 'RETIREMENT', 'TRANSFER', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'MAINTENANCE_IN', 'MAINTENANCE_OUT', 'REVERSAL');
CREATE TYPE "DeviceUnitStatus" AS ENUM ('AVAILABLE', 'ON_LOAN', 'DAMAGED', 'IN_MAINTENANCE', 'RETIRED');
CREATE TYPE "MaterialOutputReason" AS ENUM ('DAMAGED', 'OBSOLETE', 'LOST', 'OTHER');

-- Re-add company (sin datos: la información original no se recupera)
ALTER TABLE "users" ADD COLUMN "company" TEXT;

-- DropIndex: unicos parciales de plataforma
DROP INDEX "users_platform_username_key";
DROP INDEX "users_platform_email_key";
DROP INDEX "users_platform_employeeNumber_key";

-- DropIndex: índices por tenant y unicos compuestos
DROP INDEX "overtime_approvals_tenantId_idx";
DROP INDEX "time_clock_roster_runs_tenantId_idx";
DROP INDEX "time_clock_roster_entries_tenantId_idx";
DROP INDEX "removal_categories_tenantId_key_key";
DROP INDEX "removal_categories_tenantId_idx";
DROP INDEX "time_clock_sync_events_tenantId_idx";
DROP INDEX "time_clocks_tenantId_url_key";
DROP INDEX "time_clocks_tenantId_idx";
DROP INDEX "time_clock_punches_tenantId_idx";
DROP INDEX "payroll_department_reviews_tenantId_idx";
DROP INDEX "payroll_week_closures_tenantId_weekStart_key";
DROP INDEX "payroll_week_closures_tenantId_idx";
DROP INDEX "schedule_assignments_tenantId_idx";
DROP INDEX "schedule_days_tenantId_idx";
DROP INDEX "schedules_tenantId_name_key";
DROP INDEX "schedules_tenantId_idx";
DROP INDEX "access_events_tenantId_idx";
DROP INDEX "sites_tenantId_code_key";
DROP INDEX "sites_tenantId_name_key";
DROP INDEX "sites_tenantId_idx";
DROP INDEX "email_logs_tenantId_idx";
DROP INDEX "disciplinary_reports_tenantId_idx";
DROP INDEX "audit_logs_tenantId_idx";
DROP INDEX "notifications_tenantId_idx";
DROP INDEX "employee_documents_tenantId_idx";
DROP INDEX "employee_discounts_tenantId_idx";
DROP INDEX "document_types_tenantId_name_key";
DROP INDEX "document_types_tenantId_idx";
DROP INDEX "users_tenantId_employeeNumber_key";
DROP INDEX "users_tenantId_email_key";
DROP INDEX "users_tenantId_username_key";
DROP INDEX "users_tenantId_idx";
DROP INDEX "subareas_tenantId_idx";
DROP INDEX "departments_tenantId_name_key";
DROP INDEX "departments_tenantId_idx";

-- DropForeignKey
ALTER TABLE "overtime_approvals" DROP CONSTRAINT "overtime_approvals_tenantId_fkey";
ALTER TABLE "time_clock_roster_runs" DROP CONSTRAINT "time_clock_roster_runs_tenantId_fkey";
ALTER TABLE "time_clock_roster_entries" DROP CONSTRAINT "time_clock_roster_entries_tenantId_fkey";
ALTER TABLE "removal_categories" DROP CONSTRAINT "removal_categories_tenantId_fkey";
ALTER TABLE "time_clock_employees" DROP CONSTRAINT "time_clock_employees_tenantId_fkey";
ALTER TABLE "time_clock_sync_events" DROP CONSTRAINT "time_clock_sync_events_tenantId_fkey";
ALTER TABLE "time_clocks" DROP CONSTRAINT "time_clocks_tenantId_fkey";
ALTER TABLE "time_clock_punches" DROP CONSTRAINT "time_clock_punches_tenantId_fkey";
ALTER TABLE "payroll_department_reviews" DROP CONSTRAINT "payroll_department_reviews_tenantId_fkey";
ALTER TABLE "payroll_week_closures" DROP CONSTRAINT "payroll_week_closures_tenantId_fkey";
ALTER TABLE "schedule_assignments" DROP CONSTRAINT "schedule_assignments_tenantId_fkey";
ALTER TABLE "schedule_days" DROP CONSTRAINT "schedule_days_tenantId_fkey";
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_tenantId_fkey";
ALTER TABLE "access_events" DROP CONSTRAINT "access_events_tenantId_fkey";
ALTER TABLE "sites" DROP CONSTRAINT "sites_tenantId_fkey";
ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_tenantId_fkey";
ALTER TABLE "disciplinary_reports" DROP CONSTRAINT "disciplinary_reports_tenantId_fkey";
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenantId_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenantId_fkey";
ALTER TABLE "employee_documents" DROP CONSTRAINT "employee_documents_tenantId_fkey";
ALTER TABLE "employee_discounts" DROP CONSTRAINT "employee_discounts_tenantId_fkey";
ALTER TABLE "document_types" DROP CONSTRAINT "document_types_tenantId_fkey";
ALTER TABLE "users" DROP CONSTRAINT "users_tenantId_fkey";
ALTER TABLE "subareas" DROP CONSTRAINT "subareas_tenantId_fkey";
ALTER TABLE "departments" DROP CONSTRAINT "departments_tenantId_fkey";

-- AlterTable: restaurar la PK de time_clock_employees (employeeNumber solo)
ALTER TABLE "time_clock_employees" DROP CONSTRAINT "time_clock_employees_pkey",
ADD CONSTRAINT "time_clock_employees_pkey" PRIMARY KEY ("employeeNumber");

-- AlterTable: quitar tenantId (default, NOT NULL y columna de una vez)
ALTER TABLE "departments" DROP COLUMN "tenantId";
ALTER TABLE "subareas" DROP COLUMN "tenantId";
ALTER TABLE "users" DROP COLUMN "tenantId";
ALTER TABLE "document_types" DROP COLUMN "tenantId";
ALTER TABLE "employee_discounts" DROP COLUMN "tenantId";
ALTER TABLE "employee_documents" DROP COLUMN "tenantId";
ALTER TABLE "notifications" DROP COLUMN "tenantId";
ALTER TABLE "audit_logs" DROP COLUMN "tenantId";
ALTER TABLE "disciplinary_reports" DROP COLUMN "tenantId";
ALTER TABLE "email_logs" DROP COLUMN "tenantId";
ALTER TABLE "sites" DROP COLUMN "tenantId";
ALTER TABLE "access_events" DROP COLUMN "tenantId";
ALTER TABLE "schedules" DROP COLUMN "tenantId";
ALTER TABLE "schedule_days" DROP COLUMN "tenantId";
ALTER TABLE "schedule_assignments" DROP COLUMN "tenantId";
ALTER TABLE "payroll_week_closures" DROP COLUMN "tenantId";
ALTER TABLE "payroll_department_reviews" DROP COLUMN "tenantId";
ALTER TABLE "time_clock_punches" DROP COLUMN "tenantId";
ALTER TABLE "time_clocks" DROP COLUMN "tenantId";
ALTER TABLE "time_clock_sync_events" DROP COLUMN "tenantId";
ALTER TABLE "time_clock_employees" DROP COLUMN "tenantId";
ALTER TABLE "removal_categories" DROP COLUMN "tenantId";
ALTER TABLE "time_clock_roster_entries" DROP COLUMN "tenantId";
ALTER TABLE "time_clock_roster_runs" DROP COLUMN "tenantId";
ALTER TABLE "overtime_approvals" DROP COLUMN "tenantId";

-- CreateIndex: unicos globales del baseline
CREATE UNIQUE INDEX "removal_categories_key_key" ON "removal_categories"("key");
CREATE UNIQUE INDEX "time_clocks_url_key" ON "time_clocks"("url");
CREATE UNIQUE INDEX "payroll_week_closures_weekStart_key" ON "payroll_week_closures"("weekStart");
CREATE UNIQUE INDEX "schedules_name_key" ON "schedules"("name");
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");
CREATE UNIQUE INDEX "document_types_name_key" ON "document_types"("name");
CREATE UNIQUE INDEX "users_employeeNumber_key" ON "users"("employeeNumber");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- DropTable tenants + enum (ya sin FKs ni datos referenciando)
DROP TABLE "tenants";
DROP TYPE "TenantStatus";
