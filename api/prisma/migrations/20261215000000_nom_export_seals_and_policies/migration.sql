ALTER TABLE "nom_settings"
  ADD COLUMN "equipmentPolicy" TEXT,
  ADD COLUMN "returnToOfficePolicy" TEXT;

CREATE TABLE "nom_export_seals" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
  "sequence" INTEGER NOT NULL,
  "period" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "previousSeal" TEXT,
  "seal" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nom_export_seals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nom_export_seals_tenantId_sequence_key" ON "nom_export_seals"("tenantId", "sequence");
ALTER TABLE "nom_export_seals" ADD CONSTRAINT "nom_export_seals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nom_export_seals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nom_export_seals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "nom_export_seals" USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id());

CREATE OR REPLACE FUNCTION "nom_export_seals_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'nom_export_seals es de solo inserción: la cadena de sellos no se modifica';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "nom_export_seals_append_only"
BEFORE UPDATE ON "nom_export_seals"
FOR EACH ROW EXECUTE FUNCTION "nom_export_seals_append_only"();
