-- Geolocalización del marcaje remoto cifrada en reposo (AES-256-GCM, `sealText`).
-- Las columnas numéricas quedan solo para leer marcajes anteriores; el API ya
-- no las escribe. El backfill lo hace `scripts/nom-seal-locations.ts`.
ALTER TABLE "remote_punches" ADD COLUMN "location" TEXT;
ALTER TABLE "nom_archived_remote_punches" ADD COLUMN "location" TEXT;

-- El trigger append-only admite una sola excepción: mover las coordenadas en
-- claro a `location` con `app.nom_location_seal = 'on'`, sin tocar nada más.
CREATE OR REPLACE FUNCTION "nom_remote_punches_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.nom_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
     AND current_setting('app.nom_location_seal', true) = 'on'
     AND OLD."location" IS NULL
     AND NEW."location" IS NOT NULL
     AND NEW."latitude" IS NULL
     AND NEW."longitude" IS NULL
     AND NEW."gpsAccuracyMeters" IS NULL
     AND (to_jsonb(OLD) - 'latitude' - 'longitude' - 'gpsAccuracyMeters' - 'location')
       = (to_jsonb(NEW) - 'latitude' - 'longitude' - 'gpsAccuracyMeters' - 'location') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'remote_punches is append-only: % denied (report a discrepancy instead)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;
