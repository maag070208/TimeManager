-- Roles de base de datos para RLS (F1B-01). Se ejecuta UNA vez por entorno, con
-- el usuario administrador de Postgres, antes de desplegar la API:
--
--   psql "$ADMIN_DATABASE_URL" -f prisma/rls/roles.sql
--
-- - tm_app: rol del API (NOLOGIN: se conecta con un rol login que lo hereda, o
--   cámbialo a LOGIN y asígnale contraseña). NO tiene BYPASSRLS: queda sujeto a
--   las políticas y solo ve el cliente de `app.tenant_id`.
-- - tm_worker: rol de workers/plataforma (BYPASSRLS): sincronización de
--   relojes, padrón, cola de correo y consultas entre clientes. La aplicación
--   lo usa solo en el proceso `workers` (`WORKER_DATABASE_URL`).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tm_app') THEN
    CREATE ROLE tm_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tm_worker') THEN
    CREATE ROLE tm_worker NOLOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO tm_app, tm_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tm_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tm_app, tm_worker;
-- Tablas que creen migraciones futuras.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tm_app, tm_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tm_app, tm_worker;
