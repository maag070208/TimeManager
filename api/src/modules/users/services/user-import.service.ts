import { Workbook } from "exceljs";
import { t } from "@core/i18n";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { hashPassword } from "@core/utils/security";
import { DEFAULT_ROLE_KEY } from "@core/permissions";
import { currentTenantId } from "@core/tenancy";
import { assertCanAddPeople } from "@core/plans";

const MIN_PASSWORD_LENGTH = 12;

/**
 * Encabezados del formato de carga (`GET /users/import/template`). Son los
 * mismos que acepta `import()` (en español; también admite sus equivalentes en
 * inglés) y coinciden con lo que describe `users:import.description` en la web.
 */
export const USERS_IMPORT_COLUMNS = [
  "Nombre del empleado",
  "Nombre de usuario",
  "Contraseña",
] as const;

export interface UserImportRow {
  name: string;
  username: string;
  password: string;
}

export interface UserImportResult {
  created: number;
  skipped: { row: number; username: string; reason: string }[];
}

export class UserImportService {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  /**
   * Plantilla .xlsx del formato de carga (encabezados + una fila de ejemplo
   * comentada no se incluye: solo encabezados, para que nadie la importe tal
   * cual). Se genera en memoria con `exceljs`.
   */
  async template(): Promise<Buffer> {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Usuarios");
    sheet.addRow([...USERS_IMPORT_COLUMNS]);
    sheet.columns = [{ width: 34 }, { width: 26 }, { width: 22 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Carga masiva de empleados desde Excel: cada fila crea un usuario con rol
  // EMPLEADO, sin departamento (se asigna después manualmente). Si el username
  // ya existe, esa fila se omite y se reporta al final en vez de detener todo.
  async import(rows: UserImportRow[]): Promise<UserImportResult> {
    // La carga descuenta del plan de una vez: o cabe completa o no se escribe nada.
    await assertCanAddPeople(currentTenantId(), rows.length);
    const result: UserImportResult = { created: 0, skipped: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +1 por el encabezado, +1 porque Excel empieza en 1

      if (!row.name?.trim() || !row.username?.trim() || !row.password?.trim()) {
        result.skipped.push({
          row: rowNumber,
          username: row.username || t("labels.empty"),
          reason: t("userImport.missingData"),
        });
        continue;
      }

      const username = row.username.trim().toLowerCase();
      const exists = await this.db.user.findFirst({ where: { username } });
      if (exists) {
        result.skipped.push({ row: rowNumber, username, reason: t("userImport.usernameExists") });
        continue;
      }

      if (row.password.trim().length < MIN_PASSWORD_LENGTH) {
        result.skipped.push({
          row: rowNumber,
          username,
          reason: t("userImport.passwordTooShort", { min: MIN_PASSWORD_LENGTH }),
        });
        continue;
      }

      await this.db.user.create({
        data: {
          username,
          password: await hashPassword(row.password.trim()),
          name: row.name.trim(),
          role: DEFAULT_ROLE_KEY,
        },
      });
      result.created += 1;
    }

    return result;
  }
}