/**
 * Simula una semana de entradas y salidas para un cliente, como si cada persona
 * de la plantilla checara desde la web según su horario y su "carácter"
 * (ver `bots/README.md`): puntual, con retardos, con una falta, con tiempo
 * extra, remoto, o que sale temprano.
 *
 *   node --require ts-node/register/transpile-only --require tsconfig-paths/register \
 *        scripts/simulate-week.ts --tenant=<slug> [--weeks=1] [--dry-run]
 *
 * Inserta `remote_punches` (fuente WEB) con `occurredAt` en el pasado, una
 * persona y un día a la vez; un día que ya tiene marcajes remotos se respeta
 * (volver a correrlo no duplica). Solo escribe días ya transcurridos.
 */
import { randomUUID } from "node:crypto";
import { prismaClient } from "@core/config/database";
import { runWithTenant } from "@core/tenancy";
import { logger } from "@core/utils/logger";

type Character = "puntual" | "retardos" | "falta" | "extra" | "remoto" | "temprano";
const CHARACTERS: Character[] = ["puntual", "retardos", "falta", "extra", "remoto", "temprano"];

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const dryRun = process.argv.includes("--dry-run");
const slug = arg("tenant");
const weeks = Math.max(1, Number(arg("weeks") ?? 1));
if (!slug) throw new Error("Falta --tenant=<slug>");

/** Instante UTC de `YYYY-MM-DD HH:mm` en la zona del cliente. */
const zoned = (dateKey: string, time: string, timeZone: string): Date => {
  const [h, m] = time.split(":").map(Number);
  const guess = new Date(`${dateKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
};

const dateKeyIn = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const addDays = (dateKey: string, days: number): string => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 1 = lunes … 7 = domingo, como `schedule_days.weekday`. */
const weekdayOf = (dateKey: string): number => {
  const js = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
};

const shift = (time: string, minutes: number): string => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Variación determinista por persona y día para que cada corrida se vea natural pero repetible. */
const jitter = (seed: string, range: number): number => {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % (range * 2 + 1)) - range;
};

interface DayPlan {
  punches: Array<{ type: "ENTRY" | "LUNCH_START" | "LUNCH_END" | "EXIT"; time: string }>;
  workMode: "PRESENCIAL" | "REMOTO";
}

const planDay = (
  character: Character,
  seed: string,
  day: { startTime: string; endTime: string; mealStartTime: string | null; mealEndTime: string | null },
  weekday: number
): DayPlan | null => {
  const base = jitter(seed, 4);
  let entry = shift(day.startTime, base);
  let exit = shift(day.endTime, base);
  let workMode: DayPlan["workMode"] = "PRESENCIAL";
  switch (character) {
    case "retardos":
      if (weekday % 2 === 1) entry = shift(day.startTime, 14 + Math.abs(base) * 3);
      break;
    case "falta":
      if (weekday === 3) return null;
      break;
    case "extra":
      if (weekday <= 4) exit = shift(day.endTime, 75 + Math.abs(base) * 10);
      break;
    case "remoto":
      workMode = "REMOTO";
      entry = shift(day.startTime, -2 + base);
      break;
    case "temprano":
      if (weekday % 3 === 0) exit = shift(day.endTime, -40 - Math.abs(base) * 5);
      break;
    default:
      break;
  }
  const punches: DayPlan["punches"] = [{ type: "ENTRY", time: entry }];
  if (day.mealStartTime && day.mealEndTime) {
    punches.push({ type: "LUNCH_START", time: shift(day.mealStartTime, Math.abs(base)) });
    punches.push({ type: "LUNCH_END", time: shift(day.mealEndTime, Math.abs(base)) });
  }
  punches.push({ type: "EXIT", time: exit });
  return { punches, workMode };
};

const main = async () => {
  const tenant = await runWithTenant(null, () => prismaClient.tenant.findUnique({ where: { slug }, select: { id: true, name: true, timezone: true, weekStartDay: true } }), true);
  if (!tenant) throw new Error(`No existe el cliente ${slug}`);
  const timeZone = tenant.timezone ?? "America/Mexico_City";
  const now = new Date();
  const todayKey = dateKeyIn(now, timeZone);

  // Inicio de la semana del cliente (weekStartDay 0=domingo … 6=sábado).
  const jsToday = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const back = (jsToday - (tenant.weekStartDay ?? 1) + 7) % 7;
  const firstDay = addDays(todayKey, -back - 7 * (weeks - 1));

  await runWithTenant(tenant.id, async () => {
    const people = await prismaClient.user.findMany({
      where: { active: true, role: "CLIENT_STAFF", employeeNumber: { not: null } },
      orderBy: { employeeNumber: "asc" },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        scheduleAssignments: {
          where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gte: now } }] },
          orderBy: { validFrom: "desc" },
          take: 1,
          select: { schedule: { select: { name: true, days: true } } },
        },
      },
    });

    let created = 0;
    let skippedDays = 0;
    for (const [index, person] of people.entries()) {
      const schedule = person.scheduleAssignments[0]?.schedule;
      if (!schedule) {
        logger.info(`[simulate-week] ${person.name}: sin horario, se omite`);
        continue;
      }
      const character = CHARACTERS[index % CHARACTERS.length];
      const existing = await prismaClient.remotePunch.findMany({
        where: { userId: person.id, occurredAt: { gte: zoned(firstDay, "00:00", timeZone) } },
        select: { occurredAt: true },
      });
      const daysWithPunches = new Set(existing.map((row) => dateKeyIn(row.occurredAt, timeZone)));
      const summary: string[] = [];

      for (let offset = 0; offset < 7 * weeks; offset += 1) {
        const dateKey = addDays(firstDay, offset);
        if (dateKey >= todayKey) break;
        const weekday = weekdayOf(dateKey);
        const day = schedule.days.find((d) => d.weekday === weekday);
        if (!day || day.restDay || !day.startTime || !day.endTime) continue;
        if (daysWithPunches.has(dateKey)) {
          skippedDays += 1;
          continue;
        }
        const plan = planDay(character, `${person.id}:${dateKey}`, { startTime: day.startTime, endTime: day.endTime, mealStartTime: day.mealStartTime, mealEndTime: day.mealEndTime }, weekday);
        if (!plan) {
          summary.push(`${dateKey} falta`);
          continue;
        }
        summary.push(`${dateKey} ${plan.punches[0].time}-${plan.punches[plan.punches.length - 1].time}${plan.workMode === "REMOTO" ? " (remoto)" : ""}`);
        if (dryRun) {
          created += plan.punches.length;
          continue;
        }
        for (const punch of plan.punches) {
          await prismaClient.remotePunch.create({
            data: {
              userId: person.id,
              type: punch.type,
              source: "WEB",
              workMode: plan.workMode,
              occurredAt: zoned(dateKey, punch.time, timeZone),
              clientEventId: randomUUID(),
              note: "Simulación de bots",
            },
          });
          created += 1;
        }
      }
      logger.info(`[simulate-week] ${person.name} (#${person.employeeNumber}, ${character}, ${schedule.name}): ${summary.join(" · ") || "nada que simular"}`);
    }
    logger.info(`[simulate-week] ${tenant.name}: ${dryRun ? "se crearían" : "creados"} ${created} marcajes; ${skippedDays} días ya tenían checadas`);
  });
};

main()
  .catch((error) => {
    logger.error("[simulate-week] falló", error);
    process.exitCode = 1;
  })
  .finally(() => prismaClient.$disconnect());
