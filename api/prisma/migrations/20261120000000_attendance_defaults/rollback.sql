ALTER TABLE "nom_settings"
  DROP COLUMN IF EXISTS "defaultEntryToleranceMin",
  DROP COLUMN IF EXISTS "defaultExitToleranceMin",
  DROP COLUMN IF EXISTS "defaultMealBreakMin",
  DROP COLUMN IF EXISTS "defaultMinOvertimeMin";
