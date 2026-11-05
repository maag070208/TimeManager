-- Rollback de 20261106000000_clock_credentials: se pierden las credenciales
-- propias de los relojes (solo cifradas); después todos vuelven al par del `.env`.
ALTER TABLE "time_clocks"
  DROP COLUMN IF EXISTS "passwordEncrypted",
  DROP COLUMN IF EXISTS "username";
