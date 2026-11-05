import type { PrismaClient } from "@prisma/client";
import { localDateKey, startOfLocalDay } from "@core/utils/timezone";
import { minutesBetween, toMinutes, weekdayOf } from "@modules/schedules/services/workday-rules";

export interface DeferralScheduleDay {
  weekday: number;
  startTime: string | null;
  endTime: string | null;
  restDay: boolean;
}

/**
 * Siguiente momento en el que se puede entregar una notificación a un
 * teletrabajador: dentro de su jornada se entrega ya (`null`); fuera, se difiere
 * al inicio de su siguiente jornada (NOM-037 4.11/7.3 e).
 */
export const nextDeliveryFromSchedule = (
  days: DeferralScheduleDay[],
  now: Date,
  timezone: string
): Date | null => {
  for (let offset = 0; offset <= 8; offset += 1) {
    const dayKey = localDateKey(new Date(now.getTime() + offset * 24 * 60 * 60 * 1000), timezone);
    const day = days.find((candidate) => candidate.weekday === weekdayOf(dayKey));
    if (!day || day.restDay || !day.startTime || !day.endTime) continue;
    const startAt = new Date(
      startOfLocalDay(dayKey, timezone).getTime() + toMinutes(day.startTime) * 60 * 1000
    );
    const endAt = new Date(startAt.getTime() + minutesBetween(day.startTime, day.endTime) * 60 * 1000);
    if (now < startAt) return startAt;
    if (now <= endAt) return null;
  }
  return null;
};

/**
 * Resuelve si la notificación a `userId` debe diferirse por ser teletrabajador
 * activo y estar fuera de su jornada. Sin registro o sin horario → sin diferir.
 */
export const resolveTeleworkDeferral = async (
  db: PrismaClient,
  userId: string,
  now: Date = new Date()
): Promise<Date | null> => {
  const registration = await db.teleworkRegistration.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!registration) return null;

  const assignment = await db.scheduleAssignment.findFirst({
    where: {
      userId,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { validFrom: "desc" },
    include: { schedule: { include: { days: true } } },
  });
  if (!assignment) return null;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  if (!user?.tenantId) return null;
  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId },
    select: { timezone: true },
  });
  return nextDeliveryFromSchedule(
    assignment.schedule.days,
    now,
    tenant?.timezone ?? "America/Mexico_City"
  );
};
