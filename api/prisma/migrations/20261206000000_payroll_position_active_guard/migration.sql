-- Limpia asignaciones que ya no son válidas antes de activar la validación.
UPDATE "users" u
SET "payrollPositionId" = NULL
FROM "payroll_positions" p
WHERE u."payrollPositionId" = p.id
  AND (p.active = false OR p."tenantId" <> u."tenantId");

CREATE OR REPLACE FUNCTION validate_user_payroll_position() RETURNS trigger AS $$
BEGIN
  IF NEW."payrollPositionId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "payroll_positions" p
      WHERE p.id = NEW."payrollPositionId"
        AND p."tenantId" = NEW."tenantId"
        AND p.active = true
    ) THEN
      RAISE EXCEPTION 'El puesto de nómina asignado no existe, está inactivo o es de otro cliente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_payroll_position_guard ON "users";
CREATE TRIGGER users_payroll_position_guard
  BEFORE INSERT OR UPDATE OF "payrollPositionId" ON "users"
  FOR EACH ROW EXECUTE FUNCTION validate_user_payroll_position();
