DROP TABLE IF EXISTS "work_record_agreement_versions";
ALTER TABLE "work_record_agreements" DROP CONSTRAINT IF EXISTS "work_record_agreements_employerAcceptedById_fkey";
ALTER TABLE "work_record_agreements"
  DROP COLUMN IF EXISTS "employerAcceptedById",
  DROP COLUMN IF EXISTS "employerAcceptedHash",
  DROP COLUMN IF EXISTS "employerAcceptedIp",
  DROP COLUMN IF EXISTS "employerAcceptedAt";
