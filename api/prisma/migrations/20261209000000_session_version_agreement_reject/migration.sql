-- Revocación de sesiones: cada token lleva la versión de sesión de la persona.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- El trabajador puede rechazar el acuerdo del método de registro (con motivo).
ALTER TABLE "work_record_agreements" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "work_record_agreements" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
