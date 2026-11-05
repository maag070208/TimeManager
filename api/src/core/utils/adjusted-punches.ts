import type { PrismaClient } from "@prisma/client";

export interface ApprovedAdjustment {
  punchId: string;
  newState: unknown;
  decidedAt: Date | null;
  createdAt: Date;
}

/**
 * Correcciones aprobadas que aplican sobre una checada. La checada original
 * nunca se modifica (append-only): el valor vigente se materializa al vuelo.
 */
export const loadApprovedAdjustments = async (
  db: PrismaClient,
  punchIds: string[]
): Promise<ApprovedAdjustment[]> => {
  if (punchIds.length === 0) return [];
  return db.punchAdjustment.findMany({
    where: { punchId: { in: punchIds }, status: "APPROVED" },
    orderBy: [{ decidedAt: "asc" }, { createdAt: "asc" }],
    select: { punchId: true, newState: true, decidedAt: true, createdAt: true },
  });
};

/** Aplica en orden los ajustes aprobados y devuelve las checadas con su hora vigente. */
export const applyApprovedAdjustments = <T extends { id: string; occurredAt: Date }>(
  punches: T[],
  adjustments: ApprovedAdjustment[]
): T[] => {
  if (adjustments.length === 0) return punches;
  const byPunch = new Map<string, ApprovedAdjustment[]>();
  for (const adjustment of adjustments) {
    const list = byPunch.get(adjustment.punchId) ?? [];
    list.push(adjustment);
    byPunch.set(adjustment.punchId, list);
  }
  return punches.map((punch) => {
    const list = byPunch.get(punch.id);
    if (!list) return punch;
    let occurredAt = punch.occurredAt;
    for (const adjustment of list) {
      const state = adjustment.newState as Record<string, unknown> | null;
      if (typeof state?.occurredAt === "string") {
        const next = new Date(state.occurredAt);
        if (!Number.isNaN(next.getTime())) occurredAt = next;
      }
    }
    return occurredAt.getTime() === punch.occurredAt.getTime() ? punch : { ...punch, occurredAt };
  });
};
