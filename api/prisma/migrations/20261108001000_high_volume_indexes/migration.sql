-- F1B-08 — Índices compuestos por cliente en las tablas calientes.
--
-- Las consultas de asistencia/reportes filtran siempre por cliente y rango de
-- fechas; el orden tenant → empleado → fecha permite index scan sin ordenar.
CREATE INDEX IF NOT EXISTS "time_clock_punches_tenantId_employeeNumber_occurredAt_idx"
  ON "time_clock_punches" ("tenantId", "employeeNumber", "occurredAt");
CREATE INDEX IF NOT EXISTS "access_events_tenantId_employeeId_occurredAt_idx"
  ON "access_events" ("tenantId", "employeeId", "occurredAt");
-- Cola de correo por cliente (drenado del worker).
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_status_nextAttemptAt_idx"
  ON "email_logs" ("tenantId", "status", "nextAttemptAt");
