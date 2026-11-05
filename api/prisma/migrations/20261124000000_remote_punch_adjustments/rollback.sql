ALTER TABLE "punch_adjustments" DROP CONSTRAINT IF EXISTS "punch_adjustments_remotePunchId_fkey";
DROP INDEX IF EXISTS "punch_adjustments_tenantId_targetType_targetId_idx";
DELETE FROM "punch_adjustments" WHERE "targetType" <> 'CLOCK';
UPDATE "punch_adjustments" SET "targetId" = "punchId";
ALTER TABLE "punch_adjustments"
  ALTER COLUMN "punchId" SET NOT NULL,
  DROP COLUMN IF EXISTS "remotePunchId",
  DROP COLUMN IF EXISTS "targetId",
  DROP COLUMN IF EXISTS "targetType";
DROP TYPE IF EXISTS "PunchAdjustmentTarget";
