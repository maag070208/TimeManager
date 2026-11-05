/**
 * Plantilla .xlsx de la carga masiva de empleados: encabezados exactos del
 * formato que consume `UserImportService.import()`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// `user-import.service` importa prisma/env; no se conecta en la unidad.
process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-users-secret";

test("la plantilla trae solo los encabezados del formato", async () => {
  const XLSX = await import("xlsx");
  const { UserImportService, USERS_IMPORT_COLUMNS } = await import("./user-import.service");

  const buffer = new UserImportService().template();
  assert.ok(buffer.length > 0);

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  assert.ok(sheetName, "tiene una hoja");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

  assert.equal(rows.length, 1, "solo el encabezado (nada que importar por accidente)");
  assert.deepEqual((rows[0] as unknown[]).map(String), [...USERS_IMPORT_COLUMNS]);
  assert.deepEqual([...USERS_IMPORT_COLUMNS], [
    "Nombre del empleado",
    "Nombre de usuario",
    "Contraseña",
  ]);
});
