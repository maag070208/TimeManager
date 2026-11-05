-- F1B-01 — Bypass controlado de RLS para lookups PRE-contexto.
--
-- El login (usuario por username) y la autenticación de agentes (agente por
-- hash del token) ocurren ANTES de conocer el cliente, así que no tienen
-- `app.tenant_id`. La política ahora permite esas filas solo si la MISMA
-- transacción fijó `app.bypass_rls = 'on'`; la app lo hace únicamente en esos
-- lookups de sistema (`runWithRlsBypass`), nunca con datos de usuario.
CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(current_setting('app.bypass_rls', true), '') IN ('on', 'true', '1') $$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenantId'
      AND c.is_nullable = 'NO'
    ORDER BY c.table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (app_bypass_rls() OR "tenantId" = app_current_tenant_id()) WITH CHECK (app_bypass_rls() OR "tenantId" = app_current_tenant_id())',
      t
    );
  END LOOP;
END
$$;
