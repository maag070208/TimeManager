-- Deja solo la asignación vigente más reciente por persona antes de imponer la regla.
WITH ranked AS (
  SELECT id, "userId",
         ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "validFrom" DESC, "createdAt" DESC, id DESC) AS rn
  FROM "schedule_assignments"
  WHERE "validTo" IS NULL
)
DELETE FROM "schedule_assignments" a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_assignments_one_open_per_user"
  ON "schedule_assignments" ("userId")
  WHERE "validTo" IS NULL;
