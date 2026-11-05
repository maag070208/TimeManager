DROP INDEX IF EXISTS "time_clocks_apiKeyHash_key";
ALTER TABLE "time_clocks"
  DROP COLUMN IF EXISTS "apiKeyCreatedAt",
  DROP COLUMN IF EXISTS "apiKeyPrefix",
  DROP COLUMN IF EXISTS "apiKeyHash";
