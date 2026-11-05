-- Política de asistencia por cliente: defaults para horarios nuevos.
ALTER TABLE "nom_settings"
  ADD COLUMN "defaultEntryToleranceMin" INTEGER,
  ADD COLUMN "defaultExitToleranceMin" INTEGER,
  ADD COLUMN "defaultMealBreakMin" INTEGER,
  ADD COLUMN "defaultMinOvertimeMin" INTEGER;
