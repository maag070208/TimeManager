import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";

const pad = (value: number): string => String(value).padStart(2, "0");
const dateKey = (date: Date): string => date.toISOString().slice(0, 10);
const toUtcDate = (dayKey: string): Date => new Date(`${dayKey}T00:00:00.000Z`);

/** N-ésimo lunes del año (n=1..12) para los festivos de lunes. */
const nthMonday = (year: number, month: number, n: number): string => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (8 - first.getUTCDay()) % 7; // 1 = lunes
  return `${year}-${pad(month)}-${pad(1 + offset + (n - 1) * 7)}`;
};

/** Festivos obligatorios del art. 74 LFT para un año. */
export const legalHolidays = (year: number): Array<{ date: string; name: string }> => {
  const rows = [
    { date: `${year}-01-01`, name: "Año Nuevo" },
    { date: nthMonday(year, 2, 1), name: "Día de la Constitución" },
    { date: nthMonday(year, 3, 3), name: "Natalicio de Benito Juárez" },
    { date: `${year}-05-01`, name: "Día del Trabajo" },
    { date: `${year}-09-16`, name: "Día de la Independencia" },
    { date: nthMonday(year, 11, 3), name: "Día de la Revolución" },
    { date: `${year}-12-25`, name: "Navidad" },
  ];
  // Transmisión del Poder Ejecutivo Federal cada seis años.
  if ((year - 2024) % 6 === 0) {
    rows.push({ date: `${year}-10-01`, name: "Transmisión del Poder Ejecutivo Federal" });
  }
  return rows;
};

/**
 * Catálogo de festivos por cliente (art. 74 LFT). Siembra los obligatorios del
 * año la primera vez que se consulta y permite agregar los de convenio.
 */
export class HolidayService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  private async ensureDefaults(tenantId: string, years: number[]): Promise<void> {
    for (const year of [...new Set(years)]) {
      for (const holiday of legalHolidays(year)) {
        await this.db.holiday.upsert({
          where: { tenantId_date: { tenantId, date: toUtcDate(holiday.date) } },
          create: { tenantId, date: toUtcDate(holiday.date), name: holiday.name, kind: "OBLIGATORIO" },
          update: {},
        });
      }
    }
  }

  async list(tenantId: string, year: number): Promise<unknown[]> {
    await this.ensureDefaults(tenantId, [year]);
    return this.db.holiday.findMany({
      where: {
        tenantId,
        date: { gte: toUtcDate(`${year}-01-01`), lte: toUtcDate(`${year}-12-31`) },
      },
      orderBy: { date: "asc" },
    });
  }

  async create(
    tenantId: string,
    input: { date: string; name: string; kind?: "OBLIGATORIO" | "CONVENIO" },
    actor: { id: string; name?: string }
  ) {
    const exists = await this.db.holiday.findUnique({
      where: { tenantId_date: { tenantId, date: toUtcDate(input.date) } },
    });
    if (exists) throw new HttpError(409, "HOLIDAY_ALREADY_EXISTS", { date: input.date });
    const created = await this.db.holiday.create({
      data: {
        tenantId,
        date: toUtcDate(input.date),
        name: input.name.trim(),
        kind: input.kind ?? "CONVENIO",
      },
    });
    await this.audit?.({
      action: "HOLIDAY_CREATED",
      entityType: "Holiday",
      entityId: created.id,
      userId: actor.id,
      userName: actor.name,
      newState: { date: input.date, name: created.name, kind: created.kind },
    });
    return created;
  }

  async remove(tenantId: string, id: string, actor: { id: string; name?: string }) {
    const holiday = await this.db.holiday.findFirst({ where: { id, tenantId } });
    if (!holiday) throw new HttpError(404, "HOLIDAY_NOT_FOUND");
    await this.db.holiday.delete({ where: { id: holiday.id } });
    await this.audit?.({
      action: "HOLIDAY_DELETED",
      entityType: "Holiday",
      entityId: holiday.id,
      userId: actor.id,
      userName: actor.name,
      previousState: { date: dateKey(holiday.date), name: holiday.name },
    });
    return { ok: true };
  }

  /** Fechas festivas de un rango (para la clasificación semanal). */
  async between(tenantId: string, from: string, to: string): Promise<Set<string>> {
    const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];
    await this.ensureDefaults(tenantId, years);
    const rows = await this.db.holiday.findMany({
      where: { tenantId, date: { gte: toUtcDate(from), lte: toUtcDate(to) } },
      select: { date: true },
    });
    return new Set(rows.map((row) => dateKey(row.date)));
  }
}
