-- Vuelve a la política sin bypass (falla cerrado también para pre-contexto).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenantId' AND c.is_nullable = 'NO'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())',
      t
    );
  END LOOP;
END
$$;
DROP FUNCTION IF EXISTS app_bypass_rls();
