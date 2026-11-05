-- Limpieza heredada del ERP (L-10/L-11): columnas muertas de notificaciones y
-- auditoría.
--
-- 1) `notifications.ticketId`: las notificaciones podían apuntar a un ticket del
--    ERP. El producto ya no tiene tickets y la columna quedó siempre en NULL.
-- 2) `audit_logs.deviceId` / `deviceCode`: la bitácora venía del kardex/custodia
--    de dispositivos del ERP; ningún writer del producto las llena. La auditoría
--    de accesos guarda su dispositivo en `access_events`, que no se toca.
--
-- Sin backfill: solo se eliminan datos que ya no tienen origen ni consumidor.

ALTER TABLE "notifications" DROP COLUMN "ticketId";

DROP INDEX "audit_logs_deviceId_idx";

ALTER TABLE "audit_logs"
  DROP COLUMN "deviceId",
  DROP COLUMN "deviceCode";
