-- F6 — P2: exámenes médicos del teletrabajador (NOM-030) y dictámenes de
-- unidad de inspección (NOM-037 numeral 9).
CREATE TYPE "TeleworkMedicalExamKind" AS ENUM ('INITIAL', 'PERIODIC');

CREATE TABLE "telework_medical_exams" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "kind" "TeleworkMedicalExamKind" NOT NULL DEFAULT 'PERIODIC',
  "completedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "result" TEXT,
  "notes" TEXT,
  "evidence" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telework_medical_exams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telework_medical_exams_tenantId_userId_idx" ON "telework_medical_exams"("tenantId", "userId");
CREATE INDEX "telework_medical_exams_tenantId_expiresAt_idx" ON "telework_medical_exams"("tenantId", "expiresAt");
ALTER TABLE "telework_medical_exams" ADD CONSTRAINT "telework_medical_exams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inspection_certificates" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "issuer" TEXT NOT NULL,
  "certificateNumber" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "scope" TEXT,
  "evidence" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inspection_certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inspection_certificates_tenantId_certificateNumber_key" ON "inspection_certificates"("tenantId", "certificateNumber");
CREATE INDEX "inspection_certificates_tenantId_expiresAt_idx" ON "inspection_certificates"("tenantId", "expiresAt");

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['telework_medical_exams','inspection_certificates'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())', t);
  END LOOP;
END
$$;
