DROP INDEX IF EXISTS "notifications_userId_deferredUntil_idx";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "deferredUntil";
