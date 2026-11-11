-- F1B-08 — Reportes de checadas por cliente y rango de fechas.
--
-- Complementa a (tenantId, employeeNumber, occurredAt): cuando la consulta no
-- filtra por empleado (reporte de asistencia/ingesta de todo el cliente) el
-- índice existente solo sirve por su prefijo `tenantId`; este permite escanear
-- por `tenantId` + rango de `occurredAt` sin ordenar.
CREATE INDEX IF NOT EXISTS "time_clock_punches_tenantId_occurredAt_idx"
  ON "time_clock_punches" ("tenantId", "occurredAt");
