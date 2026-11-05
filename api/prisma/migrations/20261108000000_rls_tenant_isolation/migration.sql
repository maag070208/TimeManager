-- F1B-01 — Row Level Security por cliente (red de seguridad, fail-closed).
--
-- Todas las tablas con `tenantId` NOT NULL quedan protegidas: sin la variable
-- de sesión `app.tenant_id` no se ve NINGUNA fila y no se puede insertar una
-- fila de otro cliente (WITH CHECK). La app la fija por transacción con
-- `set_config('app.tenant_id', $1, true)` desde la extensión de Prisma.
--
-- Los roles se crean aparte (api/prisma/rls/roles.sql): `tm_app` sin
-- BYPASSRLS para el API y `tm_worker` con BYPASSRLS para workers/plataforma.
-- El rol dueño de las tablas queda también sujeto (FORCE) para que un rol con
-- privilegios no se salte las políticas sin querer.
--
-- Se recorre information_schema para cubrir también las tablas de cliente que
-- agreguen módulos posteriores (siempre que existan al aplicar esta migración;
-- una tabla nueva necesita su propia migración de RLS).
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id())',
      t
    );
  END LOOP;
END
$$;
