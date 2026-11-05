import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { resolveSeedDataDir } from "../utils/seed-data-dir";

/**
 * Fixtures del catálogo de planes (`prisma/seed-data/plans.json`), el mismo que
 * inserta la migración `20261107000100_plans`. Se resuelven en runtime para no
 * tocar el disco al importar el módulo.
 */
const dataDir = (): string =>
  resolveSeedDataDir(path.join(__dirname, "..", "..", "..", "prisma"));

export interface PlanFixtureRow {
  id: string;
  key: string;
  name: string;
  employeeLimit: number;
  clockLimit: number;
  monthlyPrice: string | null;
  active: boolean;
  sortOrder: number;
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/** Planes de arranque normalizados desde `plans.json`. **Puro.** */
export const loadPlansFixture = (): PlanFixtureRow[] => {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir(), "plans.json"), "utf-8"));
  if (!Array.isArray(raw)) return [];
  const rows: PlanFixtureRow[] = [];
  for (const row of raw as Array<Record<string, unknown>>) {
    if (
      typeof row?.id !== "string" ||
      typeof row?.key !== "string" ||
      typeof row?.name !== "string" ||
      !isPositiveInt(row?.employeeLimit) ||
      !isPositiveInt(row?.clockLimit)
    ) {
      logger.warn(`plans.json: invalid row ${JSON.stringify(row)}`);
      continue;
    }
    rows.push({
      id: row.id,
      key: row.key,
      name: row.name,
      employeeLimit: row.employeeLimit,
      clockLimit: row.clockLimit,
      monthlyPrice: typeof row.monthlyPrice === "string" ? row.monthlyPrice : null,
      active: row.active !== false,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    });
  }
  return rows;
};

/** Siembra los planes de arranque (insert-missing: nunca pisa ediciones de la consola). */
export const seedPlansFromFixtures = async (db: PrismaClient): Promise<void> => {
  const rows = loadPlansFixture();
  if (rows.length === 0) return;
  await db.plan.createMany({ data: rows, skipDuplicates: true });
};
