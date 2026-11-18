-- Postgres no quita valores de un enum: se recrea el tipo sin MISSING.
-- Se pierden las solicitudes de checada olvidada; los marcajes que ya se
-- insertaron al aprobarlas se quedan (la tabla de marcajes es append-only).
DELETE FROM "punch_adjustments" WHERE "targetType" = 'MISSING';
DELETE FROM "nom_archived_punch_adjustments" WHERE "targetType" = 'MISSING';
ALTER TYPE "PunchAdjustmentTarget" RENAME TO "PunchAdjustmentTarget_old";
CREATE TYPE "PunchAdjustmentTarget" AS ENUM ('CLOCK', 'REMOTE', 'ACCESS');
ALTER TABLE "punch_adjustments" ALTER COLUMN "targetType" DROP DEFAULT;
ALTER TABLE "punch_adjustments"
  ALTER COLUMN "targetType" TYPE "PunchAdjustmentTarget" USING "targetType"::text::"PunchAdjustmentTarget";
ALTER TABLE "punch_adjustments" ALTER COLUMN "targetType" SET DEFAULT 'CLOCK';
ALTER TABLE "nom_archived_punch_adjustments"
  ALTER COLUMN "targetType" TYPE "PunchAdjustmentTarget" USING "targetType"::text::"PunchAdjustmentTarget";
DROP TYPE "PunchAdjustmentTarget_old";
