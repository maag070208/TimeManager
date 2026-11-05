DROP TABLE IF EXISTS "fingerprint_station_configs";
ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "brandColor",
  DROP COLUMN IF EXISTS "logoDataUrl",
  DROP COLUMN IF EXISTS "emailFrom";
