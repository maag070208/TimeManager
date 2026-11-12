-- Canales de checada por cliente (WEB/APP/CLOCK) y origen del marcaje remoto.
--
-- El reloj físico deja de ser implícito: cada cliente declara qué canales
-- contrató y la web/app se adaptan. Backfill: los clientes que ya tienen
-- relojes dados de alta conservan el canal CLOCK; el resto queda WEB+APP.

CREATE TYPE "PunchChannel" AS ENUM ('WEB', 'APP', 'CLOCK');
CREATE TYPE "RemotePunchSource" AS ENUM ('WEB', 'APP');

ALTER TABLE "tenants"
  ADD COLUMN "punchChannels" "PunchChannel"[] NOT NULL DEFAULT ARRAY['WEB', 'APP']::"PunchChannel"[];

UPDATE "tenants" t
SET "punchChannels" = array_append(t."punchChannels", 'CLOCK'::"PunchChannel")
WHERE EXISTS (SELECT 1 FROM "time_clocks" tc WHERE tc."tenantId" = t."id");

ALTER TABLE "remote_punches"
  ADD COLUMN "source" "RemotePunchSource" NOT NULL DEFAULT 'WEB';
