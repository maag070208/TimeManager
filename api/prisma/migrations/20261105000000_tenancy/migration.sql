-- F1A-02 — Tenancy: tabla `tenants`, `tenantId` en las 25 tablas, unicidades
-- por cliente e índices únicos parciales para usuarios de plataforma.
--
-- Orden: enum + tabla tenants → insert del tenant `demo` → quitar unicos
-- globales → ADD COLUMN (nullable) → backfill → SET NOT NULL + DEFAULT →
-- PK compuesta de time_clock_employees → FKs → índices nuevos → unicos
-- parciales de plataforma → DROP COLUMN company → DROP TYPEs huérfanos.
--
-- El DEFAULT current_setting('app.tenant_id') hace que toda inserción sin
-- tenantId explícito tome el del contexto; si nadie lo puso, es NULL y la
-- columna NOT NULL falla ruidosamente (comportamiento buscado).

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable (tenant `demo`: todo lo que existe hoy pasa a ser suyo)
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "plan" TEXT,
    "employeeLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

INSERT INTO "tenants" ("id", "name", "slug", "status", "timezone", "createdAt", "updatedAt")
VALUES ('3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d', 'Demo', 'demo', 'ACTIVE', 'America/Mexico_City', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- DropIndex: unicos globales que pasan a ser por cliente
DROP INDEX "departments_name_key";
DROP INDEX "users_username_key";
DROP INDEX "users_email_key";
DROP INDEX "users_employeeNumber_key";
DROP INDEX "document_types_name_key";
DROP INDEX "sites_name_key";
DROP INDEX "sites_code_key";
DROP INDEX "schedules_name_key";
DROP INDEX "payroll_week_closures_weekStart_key";
DROP INDEX "time_clocks_url_key";
DROP INDEX "removal_categories_key_key";

-- AlterTable: ADD COLUMN nullable (el NOT NULL llega después del backfill)
ALTER TABLE "departments" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "subareas" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "document_types" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "employee_discounts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "employee_documents" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "disciplinary_reports" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "email_logs" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "sites" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "access_events" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "schedules" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "schedule_days" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "schedule_assignments" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "payroll_week_closures" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "payroll_department_reviews" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "time_clock_punches" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "time_clocks" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "time_clock_sync_events" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "time_clock_employees" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "removal_categories" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "time_clock_roster_entries" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "time_clock_roster_runs" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "overtime_approvals" ADD COLUMN "tenantId" TEXT;

-- Backfill: todo lo existente es del tenant demo. En `users`, los de
-- plataforma (ADMIN/SUPPORT) quedan con NULL: no pertenecen a ningún cliente.
UPDATE "departments" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "subareas" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "users" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL AND "role" NOT IN ('ADMIN', 'SUPPORT');
UPDATE "document_types" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "employee_discounts" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "employee_documents" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "notifications" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "audit_logs" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "disciplinary_reports" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "email_logs" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "sites" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "access_events" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "schedules" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "schedule_days" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "schedule_assignments" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "payroll_week_closures" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "payroll_department_reviews" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "time_clock_punches" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "time_clocks" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "time_clock_sync_events" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "time_clock_employees" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "removal_categories" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "time_clock_roster_entries" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "time_clock_roster_runs" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;
UPDATE "overtime_approvals" SET "tenantId" = '3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d' WHERE "tenantId" IS NULL;

-- AlterTable: NOT NULL + DEFAULT del contexto (time_clock_employees no lleva
-- default: su tenantId siempre lo pone código, forma parte de la PK)
ALTER TABLE "departments" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "subareas" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "document_types" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "employee_discounts" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "employee_documents" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "notifications" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "disciplinary_reports" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "sites" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "access_events" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "schedules" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "schedule_days" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "schedule_assignments" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "payroll_week_closures" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "payroll_department_reviews" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "time_clock_punches" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "time_clocks" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "time_clock_sync_events" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "removal_categories" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "time_clock_roster_entries" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "time_clock_roster_runs" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "overtime_approvals" ALTER COLUMN "tenantId" SET NOT NULL, ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "time_clock_employees" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: `users` suelta `company` (lo reemplaza el tenant; L-09)
ALTER TABLE "users" DROP COLUMN "company";

-- AlterTable: PK compuesta (tenantId, employeeNumber) en el vínculo reloj↔persona
ALTER TABLE "time_clock_employees" DROP CONSTRAINT "time_clock_employees_pkey",
ADD CONSTRAINT "time_clock_employees_pkey" PRIMARY KEY ("tenantId", "employeeNumber");

-- ForeignKeys: todo `tenantId` referencia a tenants; un cliente con datos no
-- se puede borrar (RESTRICT). Sin relación Prisma a propósito (FK solo en SQL).
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subareas" ADD CONSTRAINT "subareas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_discounts" ADD CONSTRAINT "employee_discounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_days" ADD CONSTRAINT "schedule_days_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_week_closures" ADD CONSTRAINT "payroll_week_closures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_department_reviews" ADD CONSTRAINT "payroll_department_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_clock_punches" ADD CONSTRAINT "time_clock_punches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_clocks" ADD CONSTRAINT "time_clocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_clock_sync_events" ADD CONSTRAINT "time_clock_sync_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_clock_employees" ADD CONSTRAINT "time_clock_employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "removal_categories" ADD CONSTRAINT "removal_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_clock_roster_entries" ADD CONSTRAINT "time_clock_roster_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_clock_roster_runs" ADD CONSTRAINT "time_clock_roster_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: índices por tenant + unicos compuestos por cliente
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");
CREATE UNIQUE INDEX "departments_tenantId_name_key" ON "departments"("tenantId", "name");
CREATE INDEX "subareas_tenantId_idx" ON "subareas"("tenantId");
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE UNIQUE INDEX "users_tenantId_username_key" ON "users"("tenantId", "username");
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");
CREATE UNIQUE INDEX "users_tenantId_employeeNumber_key" ON "users"("tenantId", "employeeNumber");
CREATE INDEX "document_types_tenantId_idx" ON "document_types"("tenantId");
CREATE UNIQUE INDEX "document_types_tenantId_name_key" ON "document_types"("tenantId", "name");
CREATE INDEX "employee_discounts_tenantId_idx" ON "employee_discounts"("tenantId");
CREATE INDEX "employee_documents_tenantId_idx" ON "employee_documents"("tenantId");
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");
CREATE INDEX "disciplinary_reports_tenantId_idx" ON "disciplinary_reports"("tenantId");
CREATE INDEX "email_logs_tenantId_idx" ON "email_logs"("tenantId");
CREATE INDEX "sites_tenantId_idx" ON "sites"("tenantId");
CREATE UNIQUE INDEX "sites_tenantId_name_key" ON "sites"("tenantId", "name");
CREATE UNIQUE INDEX "sites_tenantId_code_key" ON "sites"("tenantId", "code");
CREATE INDEX "access_events_tenantId_idx" ON "access_events"("tenantId");
CREATE INDEX "schedules_tenantId_idx" ON "schedules"("tenantId");
CREATE UNIQUE INDEX "schedules_tenantId_name_key" ON "schedules"("tenantId", "name");
CREATE INDEX "schedule_days_tenantId_idx" ON "schedule_days"("tenantId");
CREATE INDEX "schedule_assignments_tenantId_idx" ON "schedule_assignments"("tenantId");
CREATE INDEX "payroll_week_closures_tenantId_idx" ON "payroll_week_closures"("tenantId");
CREATE UNIQUE INDEX "payroll_week_closures_tenantId_weekStart_key" ON "payroll_week_closures"("tenantId", "weekStart");
CREATE INDEX "payroll_department_reviews_tenantId_idx" ON "payroll_department_reviews"("tenantId");
CREATE INDEX "time_clock_punches_tenantId_idx" ON "time_clock_punches"("tenantId");
CREATE INDEX "time_clocks_tenantId_idx" ON "time_clocks"("tenantId");
CREATE UNIQUE INDEX "time_clocks_tenantId_url_key" ON "time_clocks"("tenantId", "url");
CREATE INDEX "time_clock_sync_events_tenantId_idx" ON "time_clock_sync_events"("tenantId");
CREATE INDEX "removal_categories_tenantId_idx" ON "removal_categories"("tenantId");
CREATE UNIQUE INDEX "removal_categories_tenantId_key_key" ON "removal_categories"("tenantId", "key");
CREATE INDEX "time_clock_roster_entries_tenantId_idx" ON "time_clock_roster_entries"("tenantId");
CREATE INDEX "time_clock_roster_runs_tenantId_idx" ON "time_clock_roster_runs"("tenantId");
CREATE INDEX "overtime_approvals_tenantId_idx" ON "overtime_approvals"("tenantId");

-- CreateIndex: unicos parciales de plataforma (los compuestos con NULL no
-- aplican para usuarios sin tenant: NULL != NULL en Postgres)
CREATE UNIQUE INDEX "users_platform_username_key" ON "users"("username") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "users_platform_email_key" ON "users"("email") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "users_platform_employeeNumber_key" ON "users"("employeeNumber") WHERE "tenantId" IS NULL;

-- DropEnum: huérfanos del ERP (L-08)
DROP TYPE "MaterialOutputReason";
DROP TYPE "DeviceUnitStatus";
DROP TYPE "MovementType";
DROP TYPE "MovementStatus";
DROP TYPE "LoanStatus";
DROP TYPE "ItemCondition";
DROP TYPE "TicketStatus";
DROP TYPE "TicketPriority";
DROP TYPE "AssignmentStatus";
