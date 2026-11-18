-- Consentimiento del aviso de privacidad del cliente para todo el personal que
-- checa (no solo teletrabajo). Una fila por persona y versión del aviso.
CREATE TABLE "privacy_consents" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "textHash" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedIp" TEXT,
  CONSTRAINT "privacy_consents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "privacy_consents_userId_version_key" ON "privacy_consents"("userId", "version");
CREATE INDEX "privacy_consents_tenantId_idx" ON "privacy_consents"("tenantId");
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quien ya aceptó el aviso dentro del consentimiento de teletrabajo conserva esa aceptación.
INSERT INTO "privacy_consents" ("id", "tenantId", "userId", "version", "textHash", "acceptedAt")
SELECT gen_random_uuid()::text, r."tenantId", r."userId", r."consentPrivacyVersion", 'telework-consent', r."consentAcceptedAt"
FROM "telework_registrations" r
WHERE r."consentAcceptedAt" IS NOT NULL AND r."consentPrivacyVersion" IS NOT NULL
ON CONFLICT ("userId", "version") DO NOTHING;

-- RLS al final: el backfill corre antes de que la política exija contexto de cliente.
ALTER TABLE "privacy_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "privacy_consents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "privacy_consents"
  USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id());
