-- Rollback de la migración `20261107000100_plans`.
--
-- Restaura la etiqueta de texto libre `tenants.plan` desde la FK del plan
-- (por clave) y elimina el catálogo. Los planes de seed desaparecen; los que
-- la consola haya creado también (esta migración los introduce todos).

ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_planId_fkey";

DROP INDEX IF EXISTS "tenants_planId_idx";

ALTER TABLE "tenants" ADD COLUMN "plan" TEXT;

UPDATE "tenants" t
SET "plan" = p."key"
FROM "plans" p
WHERE t."planId" = p."id";

ALTER TABLE "tenants" DROP COLUMN "planId";

DROP TABLE "plans";
