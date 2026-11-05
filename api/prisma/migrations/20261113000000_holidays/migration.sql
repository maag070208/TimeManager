-- F1 — Catálogo de días festivos por cliente (art. 74 LFT).
CREATE TYPE "HolidayKind" AS ENUM ('OBLIGATORIO', 'CONVENIO');

CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "HolidayKind" NOT NULL DEFAULT 'OBLIGATORIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "holidays_tenantId_date_key" ON "holidays"("tenantId", "date");
CREATE INDEX "holidays_tenantId_date_idx" ON "holidays"("tenantId", "date");

ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holidays" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "holidays"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());
