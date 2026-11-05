DROP TRIGGER IF EXISTS "remote_punches_append_only" ON "remote_punches";
DROP FUNCTION IF EXISTS "nom_remote_punches_append_only"();
DROP TABLE IF EXISTS "nom_archived_remote_punches";
DROP TABLE IF EXISTS "out_of_hours_contacts";
DROP TABLE IF EXISTS "telework_checklists";
DROP TABLE IF EXISTS "telework_registrations";
DROP TABLE IF EXISTS "remote_punches";
DROP TYPE IF EXISTS "OutOfHoursContactChannel";
DROP TYPE IF EXISTS "TeleworkChecklistKind";
DROP TYPE IF EXISTS "TeleworkStatus";
DROP TYPE IF EXISTS "TeleworkMode";
DROP TYPE IF EXISTS "RemoteWorkMode";
DROP TYPE IF EXISTS "RemotePunchType";
ALTER TABLE "nom_settings"
  DROP COLUMN IF EXISTS "remotePunchEnabled",
  DROP COLUMN IF EXISTS "teleworkPolicy",
  DROP COLUMN IF EXISTS "disconnectPolicy",
  DROP COLUMN IF EXISTS "privacyNotice",
  DROP COLUMN IF EXISTS "policyVersion",
  DROP COLUMN IF EXISTS "privacyNoticeVersion",
  DROP COLUMN IF EXISTS "policiesUpdatedAt";
