-- Rollback de 20261108000000_rls_tenant_isolation: quita las políticas y deja
-- las tablas sin RLS (vuelve a depender solo de la extensión de Prisma).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenantId' AND c.is_nullable = 'NO'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;
DROP FUNCTION IF EXISTS app_current_tenant_id();
