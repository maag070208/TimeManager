ALTER TABLE "audit_logs"
  ADD COLUMN "module" TEXT,
  ADD COLUMN "permissions" JSONB,
  ADD COLUMN "roles" JSONB,
  ADD COLUMN "ip_address" TEXT,
  ADD COLUMN "user_agent" TEXT;

CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es inmutable: no se permite UPDATE ni DELETE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON "audit_logs";
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
