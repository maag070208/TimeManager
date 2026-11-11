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
  const { Workbook } = await import("exceljs");
  const { UserImportService, USERS_IMPORT_COLUMNS } = await import("./user-import.service");

  const buffer = await new UserImportService().template();
  assert.ok(buffer.length > 0);

  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet(1);
  assert.ok(sheet, "tiene una hoja");

  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: unknown[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      values.push(row.getCell(column).value ?? "");
    }
    rows.push(values);
  });

  assert.equal(rows.length, 1, "solo el encabezado (nada que importar por accidente)");
  assert.deepEqual(rows[0].map(String), [...USERS_IMPORT_COLUMNS]);
  assert.deepEqual([...USERS_IMPORT_COLUMNS], [
    "Nombre del empleado",
    "Nombre de usuario",
    "Contraseña",
  ]);
});
