-- RJ-04: ajustes sobre marcajes remotos (objetivo polimórfico).
CREATE TYPE "PunchAdjustmentTarget" AS ENUM ('CLOCK', 'REMOTE', 'ACCESS');

ALTER TABLE "punch_adjustments"
  ADD COLUMN "targetType" "PunchAdjustmentTarget" NOT NULL DEFAULT 'CLOCK',
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "remotePunchId" TEXT;

UPDATE "punch_adjustments" SET "targetId" = "punchId" WHERE "targetId" IS NULL;
ALTER TABLE "punch_adjustments" ALTER COLUMN "targetId" SET NOT NULL;
ALTER TABLE "punch_adjustments" ALTER COLUMN "punchId" DROP NOT NULL;

CREATE INDEX "punch_adjustments_tenantId_targetType_targetId_idx"
  ON "punch_adjustments"("tenantId", "targetType", "targetId");

ALTER TABLE "punch_adjustments"
  ADD CONSTRAINT "punch_adjustments_remotePunchId_fkey"
  FOREIGN KEY ("remotePunchId") REFERENCES "remote_punches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
