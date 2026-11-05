DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['nom_archived_time_clock_punches','nom_archived_access_events','nom_archived_remote_punches','nom_archived_punch_adjustments'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_truncate', t);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS "nom_archive_block_truncate"();
DROP TABLE IF EXISTS "nom_archived_punch_adjustments";
