-- Rollback de `20261110000000_legacy_cleanup`: restaura las columnas nullable
-- (el contenido anterior no se puede recuperar: eran datos del ERP sin origen).

ALTER TABLE "audit_logs"
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "deviceCode" TEXT;

CREATE INDEX "audit_logs_deviceId_idx" ON "audit_logs"("deviceId");

ALTER TABLE "notifications" ADD COLUMN "ticketId" TEXT;
