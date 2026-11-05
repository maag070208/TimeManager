-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('INFONAVIT', 'IMSS', 'CHILD_SUPPORT');

-- CreateEnum
CREATE TYPE "DisciplinaryReason" AS ENUM ('ABSENCE', 'TARDINESS', 'INTOXICATION', 'MISCONDUCT', 'NONCOMPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialOutputReason" AS ENUM ('DAMAGED', 'OBSOLETE', 'LOST', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceUnitStatus" AS ENUM ('AVAILABLE', 'ON_LOAN', 'DAMAGED', 'IN_MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('STOCK_IN', 'LOAN', 'RETURN', 'RETIREMENT', 'TRANSFER', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'MAINTENANCE_IN', 'MAINTENANCE_OUT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "MovementStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PARTIAL', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'FAIR', 'POOR', 'BROKEN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AccessEventType" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "AccessLocationSource" AS ENUM ('GPS', 'SITE_ONLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "AccessMethod" AS ENUM ('QR_SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PunchMethod" AS ENUM ('FACE', 'FINGERPRINT', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TimeClockEmployeeStatus" AS ENUM ('ACTIVE', 'PENDING_REMOVAL');

-- CreateEnum
CREATE TYPE "OvertimeApprovalStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('NONE', 'OWN', 'AREA', 'ALL');

-- CreateEnum
CREATE TYPE "PolicyEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "KitchenItemKind" AS ENUM ('CONSUMABLE', 'DURABLE');

-- CreateEnum
CREATE TYPE "KitchenStorage" AS ENUM ('DRY', 'REFRIGERATED', 'FROZEN');

-- CreateEnum
CREATE TYPE "KitchenMovementType" AS ENUM ('STOCK_IN', 'CONSUMPTION', 'WASTE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "KitchenWasteReason" AS ENUM ('EXPIRED', 'SPOILED', 'BREAKAGE', 'LOSS', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HotelRoomStatus" AS ENUM ('CLEANING', 'INSPECTION', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "HotelZoneKind" AS ENUM ('BUILDING', 'FLOOR', 'AREA');

-- CreateEnum
CREATE TYPE "HotelReasonKind" AS ENUM ('ADJUSTMENT', 'WRITE_OFF', 'ROOM_STATUS', 'PO_CLOSE', 'INSPECTION');

-- CreateEnum
CREATE TYPE "HotelProductKind" AS ENUM ('CONSUMABLE', 'LINEN', 'CHEMICAL', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "HotelKitFrequency" AS ENUM ('EVERY_CLEANING', 'CHECKOUT_ONLY', 'EVERY_N_DAYS');

-- CreateEnum
CREATE TYPE "HotelWarehouseKind" AS ENUM ('ADMIN', 'CENTRAL', 'ZONE', 'CART', 'LAUNDRY');

-- CreateEnum
CREATE TYPE "HotelMovementStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HotelMovementType" AS ENUM ('INITIAL_LOAD', 'INBOUND', 'TRANSFER', 'ROOM_CONSUMPTION', 'LINEN_EXCHANGE', 'ADJUST_IN', 'ADJUST_OUT', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "HotelStocktakeStatus" AS ENUM ('DRAFT', 'COUNTING', 'PENDING_APPROVAL', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HotelTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HotelCleaningType" AS ENUM ('CHECKOUT', 'STAY', 'TURNDOWN');

-- CreateEnum
CREATE TYPE "HotelTaskLineSource" AS ENUM ('KIT', 'EXTRA');

-- CreateEnum
CREATE TYPE "HotelInspectionResult" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subareas" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "jobTitle" TEXT,
    "employeeNumber" TEXT,
    "company" TEXT,
    "departmentId" TEXT,
    "subareaId" TEXT,
    "middleName" TEXT,
    "paternalSurname" TEXT,
    "maternalSurname" TEXT,
    "photoKey" TEXT,
    "genderId" TEXT,
    "bloodTypeId" TEXT,
    "medicalConditions" TEXT,
    "allergies" TEXT,
    "birthDate" DATE,
    "hireDate" DATE,
    "rfc" TEXT,
    "curp" TEXT,
    "nss" TEXT,
    "streetAddress" TEXT,
    "neighborhood" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "addressState" TEXT,
    "country" TEXT DEFAULT 'México',
    "personalPhone" TEXT,
    "workPhone" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelationship" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "deactivationReason" TEXT,
    "deactivationCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_discounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "ticketId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "deviceId" TEXT,
    "deviceCode" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_reports" (
    "id" TEXT NOT NULL,
    "reason" "DisciplinaryReason" NOT NULL,
    "incidentDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "sanction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "disciplinary_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "sys_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "attachments" JSONB,
    "action" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusMeters" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_events" (
    "id" TEXT NOT NULL,
    "type" "AccessEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceTimestamp" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT,
    "employeeNumberSnapshot" TEXT,
    "guardId" TEXT,
    "siteId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracyMeters" DOUBLE PRECISION,
    "locationSource" "AccessLocationSource" NOT NULL,
    "method" "AccessMethod" NOT NULL,
    "credentialVersion" INTEGER,
    "scannedPayloadHash" TEXT,
    "clientEventId" TEXT,
    "deviceId" TEXT,
    "deviceCode" TEXT,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "entryToleranceMin" INTEGER NOT NULL DEFAULT 10,
    "exitToleranceMin" INTEGER NOT NULL DEFAULT 10,
    "mealBreakMin" INTEGER NOT NULL DEFAULT 0,
    "minOvertimeMin" INTEGER NOT NULL DEFAULT 60,
    "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_days" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "splitStartTime" TEXT,
    "splitEndTime" TEXT,
    "restDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_week_closures" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "snapshot" JSONB,

    CONSTRAINT "payroll_week_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_department_reviews" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "departmentId" TEXT,
    "bulk" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_department_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_punches" (
    "id" TEXT NOT NULL,
    "clockSerial" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "PunchMethod" NOT NULL,
    "minor" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clocks" (
    "serialNumber" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT,
    "countsAttendance" BOOLEAN NOT NULL DEFAULT true,
    "writeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "lastSerialNo" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_clocks_pkey" PRIMARY KEY ("serialNumber")
);

-- CreateTable
CREATE TABLE "time_clock_sync_events" (
    "id" TEXT NOT NULL,
    "clockSerial" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "lastSerialNo" INTEGER,
    "error" TEXT,

    CONSTRAINT "time_clock_sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_employees" (
    "employeeNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedById" TEXT,
    "status" "TimeClockEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "missingRuns" INTEGER NOT NULL DEFAULT 0,
    "missingSince" TIMESTAMP(3),
    "reappearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_clock_employees_pkey" PRIMARY KEY ("employeeNumber")
);

-- CreateTable
CREATE TABLE "removal_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "removal_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_roster_entries" (
    "id" TEXT NOT NULL,
    "clockSerial" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_clock_roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_roster_runs" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "added" INTEGER NOT NULL DEFAULT 0,
    "removalPending" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,
    "reappeared" INTEGER NOT NULL DEFAULT 0,
    "perClock" JSONB NOT NULL,

    CONSTRAINT "time_clock_roster_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_approvals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "OvertimeApprovalStatus" NOT NULL,
    "extraMin" INTEGER NOT NULL,
    "scheduleName" TEXT,
    "scheduledMin" INTEGER,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "staff" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scopes" "PermissionScope"[],
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "action" TEXT NOT NULL,
    "effect" "PolicyEffect" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_conditions" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "policy_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_roles" (
    "policyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "policy_roles_pkey" PRIMARY KEY ("policyId","role")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subareas_departmentId_name_key" ON "subareas"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeNumber_key" ON "users"("employeeNumber");

-- CreateIndex
CREATE INDEX "users_deactivatedAt_idx" ON "users"("deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "genders_name_key" ON "genders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blood_types_name_key" ON "blood_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_name_key" ON "document_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_discounts_userId_type_key" ON "employee_discounts"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_storageKey_key" ON "employee_documents"("storageKey");

-- CreateIndex
CREATE INDEX "employee_documents_userId_idx" ON "employee_documents"("userId");

-- CreateIndex
CREATE INDEX "employee_documents_documentTypeId_idx" ON "employee_documents"("documentTypeId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_deviceId_idx" ON "audit_logs"("deviceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "disciplinary_reports_userId_idx" ON "disciplinary_reports"("userId");

-- CreateIndex
CREATE INDEX "disciplinary_reports_createdAt_idx" ON "disciplinary_reports"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sys_config_key_key" ON "sys_config"("key");

-- CreateIndex
CREATE INDEX "sys_config_updatedAt_idx" ON "sys_config"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "email_logs_status_nextAttemptAt_idx" ON "email_logs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "access_events_clientEventId_key" ON "access_events"("clientEventId");

-- CreateIndex
CREATE INDEX "access_events_occurredAt_idx" ON "access_events"("occurredAt");

-- CreateIndex
CREATE INDEX "access_events_employeeId_occurredAt_idx" ON "access_events"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "access_events_siteId_idx" ON "access_events"("siteId");

-- CreateIndex
CREATE INDEX "access_events_guardId_idx" ON "access_events"("guardId");

-- CreateIndex
CREATE INDEX "access_events_type_idx" ON "access_events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_name_key" ON "schedules"("name");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_days_scheduleId_weekday_key" ON "schedule_days"("scheduleId", "weekday");

-- CreateIndex
CREATE INDEX "schedule_assignments_userId_validFrom_validTo_idx" ON "schedule_assignments"("userId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "schedule_assignments_scheduleId_idx" ON "schedule_assignments"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_week_closures_weekStart_key" ON "payroll_week_closures"("weekStart");

-- CreateIndex
CREATE INDEX "payroll_department_reviews_weekStart_idx" ON "payroll_department_reviews"("weekStart");

-- CreateIndex
CREATE INDEX "time_clock_punches_occurredAt_idx" ON "time_clock_punches"("occurredAt");

-- CreateIndex
CREATE INDEX "time_clock_punches_employeeNumber_occurredAt_idx" ON "time_clock_punches"("employeeNumber", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "time_clock_punches_clockSerial_serialNo_key" ON "time_clock_punches"("clockSerial", "serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "time_clocks_url_key" ON "time_clocks"("url");

-- CreateIndex
CREATE INDEX "time_clock_sync_events_clockSerial_startedAt_idx" ON "time_clock_sync_events"("clockSerial", "startedAt");

-- CreateIndex
CREATE INDEX "time_clock_employees_userId_idx" ON "time_clock_employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "removal_categories_key_key" ON "removal_categories"("key");

-- CreateIndex
CREATE INDEX "time_clock_roster_entries_employeeNumber_idx" ON "time_clock_roster_entries"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "time_clock_roster_entries_clockSerial_employeeNumber_key" ON "time_clock_roster_entries"("clockSerial", "employeeNumber");

-- CreateIndex
CREATE INDEX "time_clock_roster_runs_startedAt_idx" ON "time_clock_roster_runs"("startedAt");

-- CreateIndex
CREATE INDEX "overtime_approvals_date_idx" ON "overtime_approvals"("date");

-- CreateIndex
CREATE INDEX "overtime_approvals_status_idx" ON "overtime_approvals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_approvals_userId_date_key" ON "overtime_approvals"("userId", "date");

-- CreateIndex
CREATE INDEX "roles_module_sortOrder_idx" ON "roles"("module", "sortOrder");

-- CreateIndex
CREATE INDEX "permissions_module_sortOrder_idx" ON "permissions"("module", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "policies_key_key" ON "policies"("key");

-- CreateIndex
CREATE INDEX "policies_action_active_priority_idx" ON "policies"("action", "active", "priority");

-- CreateIndex
CREATE INDEX "policy_conditions_policyId_idx" ON "policy_conditions"("policyId");

-- AddForeignKey
ALTER TABLE "subareas" ADD CONSTRAINT "subareas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_fkey" FOREIGN KEY ("role") REFERENCES "roles"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_subareaId_fkey" FOREIGN KEY ("subareaId") REFERENCES "subareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_genderId_fkey" FOREIGN KEY ("genderId") REFERENCES "genders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_bloodTypeId_fkey" FOREIGN KEY ("bloodTypeId") REFERENCES "blood_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_deactivationCategoryId_fkey" FOREIGN KEY ("deactivationCategoryId") REFERENCES "removal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_discounts" ADD CONSTRAINT "employee_discounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_config" ADD CONSTRAINT "sys_config_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_days" ADD CONSTRAINT "schedule_days_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_week_closures" ADD CONSTRAINT "payroll_week_closures_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_week_closures" ADD CONSTRAINT "payroll_week_closures_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_department_reviews" ADD CONSTRAINT "payroll_department_reviews_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_department_reviews" ADD CONSTRAINT "payroll_department_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_sync_events" ADD CONSTRAINT "time_clock_sync_events_clockSerial_fkey" FOREIGN KEY ("clockSerial") REFERENCES "time_clocks"("serialNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_employees" ADD CONSTRAINT "time_clock_employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_employees" ADD CONSTRAINT "time_clock_employees_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_roster_entries" ADD CONSTRAINT "time_clock_roster_entries_clockSerial_fkey" FOREIGN KEY ("clockSerial") REFERENCES "time_clocks"("serialNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_approvals" ADD CONSTRAINT "overtime_approvals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_fkey" FOREIGN KEY ("role") REFERENCES "roles"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_fkey" FOREIGN KEY ("role") REFERENCES "roles"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_fkey" FOREIGN KEY ("permission") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_fkey" FOREIGN KEY ("permission") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_conditions" ADD CONSTRAINT "policy_conditions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_roles" ADD CONSTRAINT "policy_roles_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_roles" ADD CONSTRAINT "policy_roles_role_fkey" FOREIGN KEY ("role") REFERENCES "roles"("key") ON DELETE CASCADE ON UPDATE CASCADE;

