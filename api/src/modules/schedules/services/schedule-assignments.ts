import type { Prisma, PrismaClient } from "@prisma/client";
import { toUtcDate } from "./workday-rules";

const withSchedule = { schedule: { include: { days: true } } } as const;

export type LoadedAssignment = Prisma.ScheduleAssignmentGetPayload<{ include: typeof withSchedule }>;

/**
 * Asignaciones de horario (con sus días) que tocan `[start, end)` para las
 * personas dadas, en orden de vigencia. Una sola consulta para el periodo; el
 * horario de cada día lo resuelve `scheduleOn`.
 */
export const loadScheduleAssignments = async (
  db: PrismaClient,
  userIds: string[],
  range: { start: Date; end: Date }
): Promise<LoadedAssignment[]> =>
  userIds.length === 0
    ? []
    : db.scheduleAssignment.findMany({
        where: {
          userId: { in: userIds },
          validFrom: { lt: range.end },
          OR: [{ validTo: null }, { validTo: { gte: range.start } }],
        },
        include: withSchedule,
        orderBy: { validFrom: "asc" },
      });

/**
 * Horario vigente de la persona en el día local `dayKey` (`validFrom`/`validTo`
 * se guardan como UTC-medianoche del día). `null` = sin horario ese día.
 *
 * Si hay vigencias encimadas —una corrección/reasignación hacia atrás que no
 * cerró a la anterior— gana la que **entró en vigor al final** del día: es la
 * expectativa vigente. Antes ganaba la más antigua y eso producía el retardo
 * inventado de DEMO-911 (se comparaba la checada contra el turno viejo: 14:58
 * contra un Matutino 09:00 → "Retardo 5:59 h", en vez de 0 con el Vespertino
 * 15:00 que sí tenía asignado). Empate: la capturada después y, al final, el
 * id, para que el resultado no dependa del orden de la consulta.
 */
export const scheduleOn = (assignments: LoadedAssignment[], userId: string, dayKey: string) => {
  const dayMs = toUtcDate(dayKey).getTime();
  let current: LoadedAssignment | undefined;
  for (const assignment of assignments) {
    if (assignment.userId !== userId) continue;
    if (assignment.validFrom.getTime() > dayMs) continue;
    if (assignment.validTo && assignment.validTo.getTime() < dayMs) continue;
    if (!current || winsOver(assignment, current)) current = assignment;
  }
  return current?.schedule ?? null;
};

/** La asignación `candidate` manda sobre `current` en el empate de vigencia. */
const winsOver = (candidate: LoadedAssignment, current: LoadedAssignment): boolean => {
  const byValidFrom = candidate.validFrom.getTime() - current.validFrom.getTime();
  if (byValidFrom !== 0) return byValidFrom > 0;
  const byCreatedAt = candidate.createdAt.getTime() - current.createdAt.getTime();
  if (byCreatedAt !== 0) return byCreatedAt > 0;
  return candidate.id > current.id;
};
