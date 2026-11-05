-- El dueño de la BD (migraciones/arnés de pruebas) puede reiniciar tablas;
-- la aplicación no puede truncar la evidencia de retención.
CREATE OR REPLACE FUNCTION "nom_archive_block_truncate"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('postgres', 'tm_purge') THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'nom_archived_* es evidencia de retención: TRUNCATE no permitido';
END;
$$;
