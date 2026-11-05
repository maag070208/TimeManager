-- Rollback F2-01..F2-04: quita triggers, tablas y enums NOM.
DROP TRIGGER IF EXISTS "access_events_append_only" ON "access_events";
DROP FUNCTION IF EXISTS "nom_access_events_append_only"();
DROP TRIGGER IF EXISTS "time_clock_punches_append_only" ON "time_clock_punches";
DROP FUNCTION IF EXISTS "nom_time_clock_punches_append_only"();

DROP TABLE IF EXISTS "workday_limit_alerts";
DROP TABLE IF EXISTS "nom_settings";
DROP TABLE IF EXISTS "punch_adjustments";
DROP TABLE IF EXISTS "nom_archived_access_events";
DROP TABLE IF EXISTS "nom_archived_time_clock_punches";

DROP TYPE IF EXISTS "WorkdayAlertScope";
DROP TYPE IF EXISTS "PunchAdjustmentStatus";
