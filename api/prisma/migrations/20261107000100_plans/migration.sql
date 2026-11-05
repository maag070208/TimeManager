-- F3-09 — Catálogo de planes administrables (local-first, cobro pospuesto).
--
-- `tenants.plan` era una etiqueta de texto libre sin catálogo ni límites. Ahora
-- los planes son filas administrables (nombre, límite de personal, límite de
-- relojes y precio mensual) y el cliente apunta a una con `planId`.
--
-- Backfill: las etiquetas viejas (`PLAN_500`, `PLAN_750`, `PLAN_1000`, o el
-- nombre del plan) se convierten en la FK del plan correspondiente. Si una
-- etiqueta no casa no se inventa un plan: el cliente queda sin plan (sin
-- límites) y la consola permite asignarle uno. No se borra ningún dato.

CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeLimit" INTEGER NOT NULL,
    "clockLimit" INTEGER NOT NULL,
    "monthlyPrice" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- Planes de arranque (los mismos de `api/prisma/seed-data/plans.json`).
INSERT INTO "plans" ("id", "key", "name", "employeeLimit", "clockLimit", "monthlyPrice", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('a1000000-0000-4000-8000-000000000500', 'PLAN_500', 'Básico', 500, 1, 500.00, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000750', 'PLAN_750', 'Profesional', 750, 2, 750.00, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000001000', 'PLAN_1000', 'Empresarial', 1000, 3, 1000.00, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "tenants" ADD COLUMN "planId" TEXT;

UPDATE "tenants" t
SET "planId" = p."id"
FROM "plans" p
WHERE t."plan" = p."key"
   OR lower(t."plan") = lower(p."key")
   OR lower(t."plan") = lower(p."name");

ALTER TABLE "tenants" DROP COLUMN "plan";

CREATE INDEX "tenants_planId_idx" ON "tenants"("planId");

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "plans"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
