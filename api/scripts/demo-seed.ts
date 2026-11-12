/**
 * Datos demo "reales": tres empresas ficticias con su personal, horarios,
 * relojes y varias semanas de operación (checadas con retardos, faltas,
 * comidas, olvidos y tiempo extra), más los flujos de RH y NOM encima.
 *
 *   pnpm --filter timemanager-api demo:seed        (usa DATABASE_URL de api/.env)
 *
 * Aditivo: no borra nada. Un cliente cuyo slug ya existe se salta completo
 * (las checadas y la bitácora son append-only, no se pueden resembrar).
 * Las horas extra, ledgers semanales y cierres salen del motor real a partir
 * de las checadas sembradas, igual que en producción.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prismaClient as db } from "@core/config/database";
import { seedPermissionsFromFixtures } from "@core/permissions";
import { seedPoliciesFromFixtures } from "@core/policies";
import { seedPlansFromFixtures } from "@core/plans";
import { runWithTenant } from "@core/tenancy/context";
import { seedTenantTemplateCatalogs } from "@core/tenancy/catalogs";
import { hashPassword } from "@core/utils/security";
import { localDateKey, startOfLocalDay } from "@core/utils/timezone";
import { createAuditModule } from "@modules/audit";
import { createSchedulesModule } from "@modules/schedules";
import {
  HolidayService,
  LeaveService,
  PunchAdjustmentsService,
  WeeklyOvertimeService,
  WorkRecordService,
} from "@modules/nom";
import type { ScheduleOvertimeDay } from "@modules/schedules/models/entity/schedule.entity";
import {
  ALLERGIES,
  COMPANIES,
  CONDITIONS,
  FEMALE_NAMES,
  MALE_NAMES,
  MIDDLE_FEMALE,
  MIDDLE_MALE,
  RELATIONSHIPS,
  STREETS,
  SURNAMES,
  type CheckinMode,
  type CompanySpec,
  type RoleKey,
  type ScheduleSpec,
} from "./demo/companies";

/** Contraseña de todas las cuentas demo. */
export const DEMO_PASSWORD = "Demo2026!";
const TZ = "America/Mexico_City";
const WEEKS_BACK = 5;

if (process.env.NODE_ENV === "production" && process.env.DEMO_SEED_FORCE !== "1") {
  throw new Error("NODE_ENV=production: el seed demo no corre aquí (DEMO_SEED_FORCE=1 para forzarlo).");
}

// ── Utilidades de fecha (claves `YYYY-MM-DD` en la zona del cliente) ────────
const addDaysKey = (key: string, days: number): string => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const jsWeekday = (key: string): number => new Date(`${key}T00:00:00.000Z`).getUTCDay();
const isoWeekday = (key: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 => (jsWeekday(key) || 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
const startOfWeekKey = (key: string, weekStartDay: number): string =>
  addDaysKey(key, -((jsWeekday(key) - weekStartDay + 7) % 7));
const toUtcDate = (key: string): Date => new Date(`${key}T00:00:00.000Z`);
const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const atLocal = (key: string, minutes: number): Date => new Date(startOfLocalDay(key, TZ).getTime() + minutes * 60_000);
const daysBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let key = from; key <= to; key = addDaysKey(key, 1)) out.push(key);
  return out;
};

// ── Aleatorio determinista por empresa ─────────────────────────────────────
const makeRng = (seed: string) => {
  let state = createHash("sha256").update(seed).digest().readUInt32LE(0);
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p: number) => next() < p,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
  };
};
type Rng = ReturnType<typeof makeRng>;

const plain = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/gi, "n").toLowerCase();
const consonantAfterFirst = (word: string): string =>
  plain(word).slice(1).replace(/[aeiou]/g, "").charAt(0).toUpperCase() || "X";
const firstVowelAfterFirst = (word: string): string =>
  plain(word).slice(1).match(/[aeiou]/)?.[0].toUpperCase() ?? "X";

// ── Tipos internos ─────────────────────────────────────────────────────────
interface Person {
  id: string;
  username: string;
  fullName: string;
  employeeNumber: string;
  role: RoleKey;
  department: string;
  schedule: ScheduleSpec;
  checkin: CheckinMode;
  clock?: string;
  telework?: "REMOTO" | "HIBRIDO";
  hireKey: string;
  /** Sesgos de conducta: puntualidad, ausentismo y disposición a quedarse. */
  lateProne: number;
  absenceProne: number;
  overtimeBias: number;
  /** Último día laborado (baja) o null. */
  leftKey: string | null;
  homeLat: number;
  homeLng: number;
}

interface PunchRow {
  clockSerial: string;
  employeeNumber: string;
  name: string;
  method: "FACE" | "FINGERPRINT" | "CARD";
  minor: number;
  occurredAt: Date;
}

const methodOf = (rng: Rng): Pick<PunchRow, "method" | "minor"> => {
  const roll = rng.next();
  if (roll < 0.78) return { method: "FACE", minor: 75 };
  if (roll < 0.96) return { method: "FINGERPRINT", minor: 38 };
  return { method: "CARD", minor: 1 };
};

const audit = createAuditModule().service;
const auditLog = (input: unknown, client?: unknown) =>
  audit.createLog(
    input as Parameters<typeof audit.createLog>[0],
    client as Parameters<typeof audit.createLog>[1]
  );

async function seedCompany(
  company: CompanySpec,
  ctx: { plans: Array<{ id: string; name: string; monthlyPrice: unknown }>; password: string; genders: Map<string, string>; bloodTypes: string[] }
): Promise<{ slug: string; logins: Array<{ username: string; role: string; name: string }> } | null> {
  const rng = makeRng(`timemanager-demo:${company.slug}`);
  const existing = await runWithTenant(null, () => db.tenant.findUnique({ where: { slug: company.slug } }), true);
  if (existing) {
    console.log(`· ${company.name} (${company.slug}) ya existe: se salta.`);
    return null;
  }

  const todayKey = localDateKey(new Date(), TZ);
  const nowMs = Date.now();
  const weekStartKey = startOfWeekKey(todayKey, company.weekStartDay);
  const historyStartKey = addDaysKey(weekStartKey, -7 * WEEKS_BACK);
  const pastWeeks = Array.from({ length: WEEKS_BACK }, (_, i) => addDaysKey(weekStartKey, -7 * (WEEKS_BACK - i)));
  const lastWeekKey = pastWeeks[pastWeeks.length - 1];
  const historyDays = daysBetween(historyStartKey, todayKey);
  const plan = ctx.plans[company.planTier] ?? ctx.plans[ctx.plans.length - 1] ?? null;

  const tenant = await runWithTenant(
    null,
    () =>
      db.tenant.create({
        data: {
          name: company.name,
          slug: company.slug,
          status: "ACTIVE",
          timezone: TZ,
          weekStartDay: company.weekStartDay,
          planId: plan?.id ?? null,
          brandColor: company.brandColor,
          createdAt: new Date(company.createdAt),
          // Las empresas demo con relojes físicos conservan ese canal.
          punchChannels: company.clocks.length > 0 ? ["WEB", "APP", "CLOCK"] : ["WEB", "APP"],
        },
      }),
    true
  );
  await seedTenantTemplateCatalogs(tenant.id, db);
  const logins: Array<{ username: string; role: string; name: string }> = [];

  await runWithTenant(tenant.id, async () => {
    const tenantId = tenant.id;

    // ── Estructura: departamentos, subáreas, puestos, horarios ─────────────
    const departments = new Map<string, string>();
    const subareas = new Map<string, string>();
    for (const [name, subs] of Object.entries(company.departments)) {
      const department = await db.department.create({ data: { name } });
      departments.set(name, department.id);
      for (const sub of subs) {
        const subarea = await db.subarea.create({ data: { name: sub, departmentId: department.id, tenantId } });
        subareas.set(`${name}/${sub}`, subarea.id);
      }
    }

    const positions = new Map<string, string>();
    for (const position of company.positions) {
      const row = await db.payrollPosition.create({
        data: { tenantId, name: position.name, jobTitle: position.jobTitle, dailySalary: position.daily, sbcDaily: position.sbc },
      });
      positions.set(position.name, row.id);
    }

    const schedules = new Map<string, { id: string; spec: ScheduleSpec }>();
    for (const spec of company.schedules) {
      const schedule = await db.schedule.create({
        data: {
          name: spec.name,
          mealBreakMin: spec.mealBreakMin,
          crossesMidnight: spec.crossesMidnight ?? false,
          entryToleranceMin: 10,
          exitToleranceMin: 10,
          minOvertimeMin: 30,
        },
      });
      await db.scheduleDay.createMany({
        data: ([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => {
          const shift = spec.days[weekday];
          return {
            tenantId,
            scheduleId: schedule.id,
            weekday,
            restDay: shift === null,
            startTime: shift?.[0] ?? null,
            endTime: shift?.[1] ?? null,
          };
        }),
      });
      schedules.set(spec.name, { id: schedule.id, spec });
    }

    // ── Personal ───────────────────────────────────────────────────────────
    const usedUsernames = new Set<string>();
    const usedNames = new Set<string>();
    const people: Person[] = [];
    let employeeSeq = 101;

    const specs = [
      ...company.keyPeople.map((key) => ({ ...key, count: 1, key })),
      ...company.roster.flatMap((spec) => Array.from({ length: spec.count }, () => ({ ...spec, count: 1, key: undefined }))),
    ];

    for (const spec of specs) {
      const key = spec.key;
      const gender: "M" | "F" = key?.gender ?? (rng.chance(spec.department.startsWith("Enfermer") ? 0.8 : 0.48) ? "F" : "M");
      let first = key?.first ?? rng.pick(gender === "F" ? FEMALE_NAMES : MALE_NAMES);
      let paternal = key?.paternal ?? rng.pick(SURNAMES);
      let maternal = key?.maternal ?? rng.pick(SURNAMES);
      while (!key && usedNames.has(`${first} ${paternal} ${maternal}`)) {
        first = rng.pick(gender === "F" ? FEMALE_NAMES : MALE_NAMES);
        paternal = rng.pick(SURNAMES);
        maternal = rng.pick(SURNAMES);
      }
      usedNames.add(`${first} ${paternal} ${maternal}`);
      const middle = key ? key.middle ?? null : rng.chance(0.3) ? rng.pick(gender === "F" ? MIDDLE_FEMALE : MIDDLE_MALE) : null;

      let username = key?.username ?? `${plain(first)}.${plain(paternal)}`.replace(/\s+/g, "");
      for (let n = 2; usedUsernames.has(username); n++) username = `${plain(first)}.${plain(paternal)}${n}`;
      usedUsernames.add(username);

      const birthKey =
        key?.birthDate ??
        `${rng.int(1968, 2004)}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
      const hireKey =
        key?.hireDate ??
        (people.length === specs.length - 2
          ? addDaysKey(weekStartKey, -2)
          : people.length === specs.length - 1
            ? addDaysKey(lastWeekKey, 1)
            : `${rng.int(Math.max(2015, Number(birthKey.slice(0, 4)) + 18), 2026)}-${String(rng.int(1, 9)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`);
      const employeeNumber = String(employeeSeq++).padStart(4, "0");
      const yy = birthKey.slice(2, 4);
      const mmdd = birthKey.slice(5, 7) + birthKey.slice(8, 10);
      const initials = `${plain(paternal).charAt(0).toUpperCase()}${firstVowelAfterFirst(paternal)}${plain(maternal).charAt(0).toUpperCase()}${plain(first).charAt(0).toUpperCase()}`;
      const homo = randomBytes(2).toString("hex").toUpperCase().slice(0, 3);
      const neighborhood = rng.pick(company.neighborhoods);
      const emergencyFirst = rng.pick(rng.chance(0.5) ? FEMALE_NAMES : MALE_NAMES);
      const fullName = [first, middle, paternal, maternal].filter(Boolean).join(" ");
      const role: RoleKey = key?.role ?? "CLIENT_STAFF";
      const departmentId = departments.get(spec.department)!;

      const row = await db.user.create({
        data: {
          tenantId,
          username,
          email: `${username}@${company.emailDomain}`,
          password: ctx.password,
          name: first,
          middleName: middle,
          paternalSurname: paternal,
          maternalSurname: maternal,
          role,
          jobTitle: spec.jobTitle,
          employeeNumber,
          checkinMode: spec.checkin ?? "CLOCK",
          departmentId,
          subareaId: spec.subarea ? subareas.get(`${spec.department}/${spec.subarea}`) : null,
          payrollPositionId: positions.get(spec.position) ?? null,
          genderId: ctx.genders.get(gender === "F" ? "Femenino" : "Masculino"),
          bloodTypeId: rng.pick(ctx.bloodTypes),
          medicalConditions: rng.pick(CONDITIONS),
          allergies: rng.pick(ALLERGIES),
          birthDate: toUtcDate(birthKey),
          hireDate: toUtcDate(hireKey),
          rfc: `${initials}${yy}${mmdd}${homo}`,
          curp: `${initials}${yy}${mmdd}${gender === "F" ? "M" : "H"}${company.stateCode}${consonantAfterFirst(paternal)}${consonantAfterFirst(maternal)}${consonantAfterFirst(first)}0${rng.int(1, 9)}`,
          nss: `${rng.int(10, 99)}${yy}${rng.int(1000000, 9999999)}`.slice(0, 11),
          streetAddress: `${rng.pick(STREETS)} ${rng.int(12, 2890)}${rng.chance(0.3) ? `, int. ${rng.int(1, 40)}` : ""}`,
          neighborhood,
          postalCode: `${company.postalPrefix}${rng.int(10, 99)}`,
          city: company.city,
          addressState: company.state,
          country: "México",
          personalPhone: `${rng.pick(["55", "33", "81"])} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)}`,
          workPhone: rng.chance(0.25) ? `${rng.pick(["55", "33"])} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)}` : null,
          emergencyContactName: `${emergencyFirst} ${rng.chance(0.5) ? paternal : rng.pick(SURNAMES)} ${rng.pick(SURNAMES)}`,
          emergencyContactPhone: `${rng.pick(["55", "33", "81"])} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)}`,
          emergencyContactRelationship: rng.pick(RELATIONSHIPS),
          createdAt: atLocal(hireKey < company.createdAt.slice(0, 10) ? company.createdAt.slice(0, 10) : hireKey, 9 * 60 + rng.int(0, 120)),
        },
        select: { id: true },
      });
      if (key) logins.push({ username, role, name: fullName });

      const roll = rng.next();
      people.push({
        id: row.id,
        username,
        fullName,
        employeeNumber,
        role,
        department: spec.department,
        schedule: schedules.get(spec.schedule)!.spec,
        checkin: spec.checkin ?? "CLOCK",
        clock: spec.clock,
        telework: spec.telework,
        hireKey,
        lateProne: key ? 0.03 : roll < 0.7 ? 0.04 : roll < 0.9 ? 0.15 : 0.32,
        absenceProne: key ? 0.005 : roll < 0.8 ? 0.015 : 0.06,
        overtimeBias: rng.next(),
        leftKey: null,
        homeLat: 19.4 + rng.next() * 0.2,
        homeLng: -99.2 + rng.next() * 0.2,
      });
    }

    const admin = people.find((p) => p.role === "CLIENT_ADMIN")!;
    const rh = people.find((p) => p.role === "HUMAN_RESOURCES")!;
    const staff = people.filter((p) => p.role === "CLIENT_STAFF");
    const rankAndFile = staff.filter((p) => !company.keyPeople.some((k) => k.username === p.username));

    // Una baja voluntaria hace 9 días (la persona deja de checar).
    const leaver = rankAndFile[3];
    leaver.leftKey = addDaysKey(todayKey, -10);
    const resignation = await db.removalCategory.findFirst({ where: { key: "resignation" } });
    await db.user.update({
      where: { id: leaver.id },
      data: {
        active: false,
        deactivatedAt: atLocal(addDaysKey(todayKey, -9), 10 * 60 + 15),
        deactivatedById: rh.id,
        deactivationReason: "Renuncia voluntaria: cambio de residencia.",
        deactivationCategoryId: resignation?.id ?? null,
      },
    });

    // ── Asignación de horarios (con un cambio de turno hace dos semanas) ───
    const changed = rankAndFile.find((p) => p.schedule.name !== company.schedules[0].name && !p.schedule.crossesMidnight);
    for (const person of people) {
      const from = person.hireKey > historyStartKey ? person.hireKey : addDaysKey(historyStartKey, -60);
      if (person === changed) {
        const switchKey = addDaysKey(weekStartKey, -14);
        await db.scheduleAssignment.create({
          data: {
            userId: person.id,
            scheduleId: schedules.get(company.schedules[0].name)!.id,
            validFrom: toUtcDate(from),
            validTo: toUtcDate(addDaysKey(switchKey, -1)),
            createdById: rh.id,
          },
        });
        await db.scheduleAssignment.create({
          data: { userId: person.id, scheduleId: schedules.get(person.schedule.name)!.id, validFrom: toUtcDate(switchKey), createdById: rh.id },
        });
        continue;
      }
      await db.scheduleAssignment.create({
        data: { userId: person.id, scheduleId: schedules.get(person.schedule.name)!.id, validFrom: toUtcDate(from), createdById: rh.id },
      });
    }
    const scheduleOn = (person: Person, key: string): ScheduleSpec =>
      person === changed && key < addDaysKey(weekStartKey, -14) ? company.schedules[0] : person.schedule;

    // ── Festivos, permisos y vacaciones (antes de generar checadas) ────────
    const holidays = new HolidayService(db, auditLog);
    await holidays.list(tenantId, Number(todayKey.slice(0, 4)));
    for (const holiday of company.conventionHolidays ?? []) {
      await db.holiday.create({ data: { date: toUtcDate(holiday.date), name: holiday.name, kind: "CONVENIO" } });
    }
    const holidayKeys = new Set(
      (await db.holiday.findMany({ select: { date: true } })).map((h) => h.date.toISOString().slice(0, 10))
    );

    const leave = new LeaveService(db, auditLog);
    const leaveTypes = (await leave.listTypes(tenantId)) as Array<{ id: string; key: string }>;
    const typeId = (key: string) => leaveTypes.find((t) => t.key === key)!.id;
    const absentByLeave = new Set<string>();
    const workdaysFrom = (person: Person, start: string, count: number): string[] => {
      const out: string[] = [];
      for (let key = start; out.length < count; key = addDaysKey(key, 1)) {
        if (scheduleOn(person, key).days[isoWeekday(key)] !== null) out.push(key);
      }
      return out;
    };
    const leaves: Array<{ person: Person; type: string; start: string; days: number; status: "APPROVED" | "PENDING" | "REJECTED" | "CANCELLED"; reason: string; note?: string }> = [
      { person: rankAndFile[0], type: "VACACIONES", start: addDaysKey(pastWeeks[1], 1), days: 4, status: "APPROVED", reason: "Vacaciones con la familia en Mazatlán" },
      { person: rankAndFile[5], type: "INCAPACIDAD", start: addDaysKey(pastWeeks[3], 2), days: 3, status: "APPROVED", reason: "Incapacidad IMSS por infección respiratoria", note: "Folio de incapacidad entregado" },
      { person: rankAndFile[8], type: "PERMISO_PAGADO", start: addDaysKey(lastWeekKey, 3), days: 1, status: "APPROVED", reason: "Trámite de escrituras", note: "Autorizado" },
      { person: rankAndFile[2], type: "VACACIONES", start: addDaysKey(todayKey, 12), days: 5, status: "PENDING", reason: "Viaje de fin de año a Oaxaca" },
      { person: rankAndFile[10], type: "VACACIONES", start: addDaysKey(todayKey, 19), days: 3, status: "PENDING", reason: "Boda de mi hermana en Puebla" },
      { person: rankAndFile[6], type: "PERMISO_SIN_GOCE", start: addDaysKey(todayKey, 4), days: 2, status: "PENDING", reason: "Cambio de domicilio" },
      { person: rankAndFile[7], type: "VACACIONES", start: addDaysKey(todayKey, 6), days: 5, status: "REJECTED", reason: "Puente de noviembre", note: "Temporada alta: ya hay dos personas del área de vacaciones esa semana." },
      { person: rankAndFile[9], type: "PERMISO_PAGADO", start: addDaysKey(todayKey, 8), days: 1, status: "CANCELLED", reason: "Cita médica" },
    ];
    for (const item of leaves) {
      if (!item.person) continue;
      const keys = workdaysFrom(item.person, item.start, item.days);
      if (item.status === "APPROVED") for (const key of keys) absentByLeave.add(`${item.person.id}|${key}`);
      const requestedAt = atLocal(addDaysKey(keys[0], -rng.int(6, 15)), 11 * 60);
      await db.leaveRequest.create({
        data: {
          userId: item.person.id,
          typeId: typeId(item.type),
          startDate: toUtcDate(keys[0]),
          endDate: toUtcDate(keys[keys.length - 1]),
          days: keys.length,
          status: item.status,
          reason: item.reason,
          createdById: item.person.id,
          createdAt: requestedAt,
          ...(item.status === "APPROVED" || item.status === "REJECTED"
            ? { decidedById: rh.id, decidedAt: new Date(requestedAt.getTime() + 26 * 3600_000), decisionNote: item.note ?? null }
            : {}),
        },
      });
    }

    // ── Checadas: reloj (y marcaje web de quien teletrabaja) ───────────────
    const clockPunches: PunchRow[] = [];
    const remotePunches: Prisma.RemotePunchCreateManyInput[] = [];
    const misPunches: Array<{ person: Person; wrongAt: Date; rightAt: Date }> = [];
    const lateDays: Array<{ person: Person; key: string; minutes: number }> = [];
    const absences: Array<{ person: Person; key: string }> = [];
    const monthEndRush = (key: string) => Number(key.slice(8, 10)) >= 26 || Number(key.slice(8, 10)) <= 2;

    for (const person of people) {
      for (const key of historyDays) {
        if (key < person.hireKey) continue;
        if (person.leftKey && key > person.leftKey) continue;
        const spec = scheduleOn(person, key);
        const shift = spec.days[isoWeekday(key)];
        if (!shift) continue;
        if (holidayKeys.has(key) && !(spec.worksHolidays && rng.chance(0.6))) continue;
        if (absentByLeave.has(`${person.id}|${key}`)) continue;
        if (rng.chance(person.absenceProne)) {
          if (key < todayKey) absences.push({ person, key });
          continue;
        }

        const remoteToday =
          person.checkin === "WEB" || (person.telework === "HIBRIDO" && [1, 3, 5].includes(isoWeekday(key)));
        const start = toMinutes(shift[0]);
        let end = toMinutes(shift[1]);
        if (end <= start) end += 24 * 60;

        const late = rng.chance(person.lateProne) ? rng.int(11, 42) : 0;
        const entry = late ? start + late : start - rng.int(2, 18);
        if (late && key < todayKey) lateDays.push({ person, key, minutes: late });
        const wantsExtra = rng.chance(
          spec.overtimeChance * (0.4 + person.overtimeBias * 1.6) * (monthEndRush(key) ? 1.8 : 1)
        );
        const exit = wantsExtra ? end + rng.int(45, person.overtimeBias > 0.85 ? 300 : 170) : end + rng.int(0, 14);

        const stamps: number[] = [entry];
        if (spec.mealBreakMin >= 60 && !remoteToday && rng.chance(0.55)) {
          const out = start + Math.floor((end - start) / 2) - rng.int(0, 40);
          stamps.push(out, out + rng.int(spec.mealBreakMin - 8, spec.mealBreakMin + 12));
        }
        stamps.push(exit);
        const forgotExit = !remoteToday && rng.chance(0.012);
        if (forgotExit) stamps.pop();

        for (const [index, minute] of stamps.entries()) {
          const occurredAt = atLocal(key, minute + rng.int(0, 59) / 60);
          if (occurredAt.getTime() > nowMs) break;
          if (remoteToday) {
            const type = stamps.length === 4 ? (["ENTRY", "LUNCH_START", "LUNCH_END", "EXIT"] as const)[index] : index === 0 ? "ENTRY" : "EXIT";
            remotePunches.push({
              tenantId,
              userId: person.id,
              type,
              workMode: person.telework === "HIBRIDO" ? "HIBRIDO" : "REMOTO",
              occurredAt,
              clientReportedAt: new Date(occurredAt.getTime() - rng.int(0, 4000)),
              latitude: person.homeLat + (rng.next() - 0.5) * 0.0004,
              longitude: person.homeLng + (rng.next() - 0.5) * 0.0004,
              gpsAccuracyMeters: rng.int(8, 45),
              clientEventId: `demo-${company.slug}-${person.employeeNumber}-${key}-${index}`,
            });
            continue;
          }
          clockPunches.push({
            clockSerial: person.clock ?? company.clocks[0].serial,
            employeeNumber: person.employeeNumber,
            name: person.fullName.toUpperCase().slice(0, 32),
            ...methodOf(rng),
            occurredAt,
          });
        }
        // Salida registrada tarde por olvido (se corrige con un ajuste).
        if (!remoteToday && !forgotExit && stamps.length === 2 && key < todayKey && misPunches.length < 6 && rng.chance(0.03)) {
          const last = clockPunches[clockPunches.length - 1];
          const rightAt = last.occurredAt;
          last.occurredAt = new Date(rightAt.getTime() + rng.int(95, 260) * 60_000);
          misPunches.push({ person, wrongAt: last.occurredAt, rightAt });
        }
      }
    }

    // Consecutivo por reloj en orden cronológico (como lo entrega el equipo).
    const bySerial = new Map<string, PunchRow[]>();
    for (const punch of clockPunches) {
      const list = bySerial.get(punch.clockSerial) ?? [];
      list.push(punch);
      bySerial.set(punch.clockSerial, list);
    }
    const lastSerial = new Map<string, number>();
    for (const [serial, list] of bySerial) {
      list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      const rows = list.map((punch, index) => ({ ...punch, tenantId, serialNo: 48_211 + index * 2 + (index % 7 === 0 ? 1 : 0) }));
      for (let i = 0; i < rows.length; i += 1000) await db.timeClockPunch.createMany({ data: rows.slice(i, i + 1000) });
      lastSerial.set(serial, rows[rows.length - 1]?.serialNo ?? 0);
    }
    for (let i = 0; i < remotePunches.length; i += 1000) await db.remotePunch.createMany({ data: remotePunches.slice(i, i + 1000) });

    // ── Relojes, vínculos, padrón y bitácora de sincronización ─────────────
    for (const clock of company.clocks) {
      const syncedAt = new Date(nowMs - rng.int(1, 4) * 60_000);
      await db.timeClock.create({
        data: {
          serialNumber: clock.serial,
          name: clock.name,
          url: clock.url,
          model: clock.model,
          countsAttendance: true,
          lastSerialNo: lastSerial.get(clock.serial) ?? 0,
          syncedAt,
          createdAt: new Date(company.createdAt),
        },
      });
      const events: Prisma.TimeClockSyncEventCreateManyInput[] = [];
      for (let i = 0; i < 18; i++) {
        const startedAt = new Date(syncedAt.getTime() - i * 5 * 60_000);
        const failed = i === 11;
        events.push({
          tenantId,
          clockSerial: clock.serial,
          trigger: i === 15 ? "MANUAL" : "AUTO",
          ok: !failed,
          startedAt,
          finishedAt: new Date(startedAt.getTime() + rng.int(900, 4200)),
          readCount: failed ? 0 : rng.int(0, 9),
          newCount: failed ? 0 : rng.int(0, 6),
          lastSerialNo: failed ? null : lastSerial.get(clock.serial) ?? 0,
          error: failed ? `connect ETIMEDOUT ${clock.url.replace("http://", "")}:80` : null,
        });
      }
      await db.timeClockSyncEvent.createMany({ data: events });
    }
    const clockPeople = people.filter((p) => p.checkin !== "WEB");
    await db.timeClockEmployee.createMany({
      data: clockPeople.map((p) => ({
        tenantId,
        employeeNumber: p.employeeNumber,
        userId: p.id,
        linkedById: rh.id,
        ...(p === leaver
          ? { status: "PENDING_REMOVAL" as const, missingRuns: 3, missingSince: atLocal(addDaysKey(todayKey, -8), 9 * 60) }
          : {}),
      })),
    });
    await db.timeClockRosterEntry.createMany({
      data: clockPeople
        .filter((p) => p !== leaver && p.clock)
        .map((p) => ({ tenantId, clockSerial: p.clock!, employeeNumber: p.employeeNumber, name: p.fullName.toUpperCase().slice(0, 32), lastSeenAt: new Date(nowMs - 20 * 60_000) })),
    });
    await db.timeClockRosterRun.create({
      data: {
        trigger: "AUTO",
        startedAt: new Date(nowMs - 22 * 60_000),
        finishedAt: new Date(nowMs - 21 * 60_000),
        ok: true,
        removalPending: 1,
        perClock: company.clocks.map((c) => ({ serial: c.serial, ok: true, count: clockPeople.filter((p) => p.clock === c.serial).length - (leaver.clock === c.serial ? 1 : 0), error: null })),
      },
    });

    // ── Configuración NOM y nómina ─────────────────────────────────────────
    await db.nomSettings.create({
      data: {
        tenantId,
        workdayLimitMinutes: 720,
        retentionMonths: 60,
        defaultEntryToleranceMin: 10,
        defaultExitToleranceMin: 10,
        defaultMealBreakMin: 30,
        defaultMinOvertimeMin: 30,
        remotePunchEnabled: true,
        remoteCountsForWorkday: true,
        blockRemoteWithoutAgreement: true,
        teleworkPolicy: company.teleworkPolicy ?? null,
        disconnectPolicy: "Fuera de la jornada pactada nadie está obligado a responder mensajes, llamadas ni correos, salvo guardia formalmente asignada.",
        privacyNotice: `${company.legalName} trata los datos de registro de jornada, geolocalización puntual y biometría únicamente para el control de asistencia y la nómina.`,
        policiesUpdatedAt: new Date(company.createdAt),
        updatedById: admin.id,
      },
    });
    await db.payrollSettings.create({
      data: {
        tenantId,
        currency: "MXN",
        defaultDailySalary: "315.04",
        sbcDaily: "331.20",
        umaDaily: "113.14",
        valesMonthly: company.planTier > 0 ? "1200.00" : null,
        fondoAhorroPct: company.planTier === 2 ? "5.00" : null,
        updatedById: admin.id,
      },
    });

    // ── Acuerdos NOM: método de registro y distribución de jornada ─────────
    for (const person of people) {
      const signedKey = person.hireKey > company.createdAt.slice(0, 10) ? person.hireKey : company.createdAt.slice(0, 10);
      const methods = person.checkin === "WEB" ? ["REMOTE"] : person.checkin === "HYBRID" || person.telework ? ["CLOCK", "REMOTE"] : ["CLOCK"];
      const acceptedAt = atLocal(signedKey, 10 * 60 + rng.int(0, 200));
      const agreement = {
        methods,
        roundingPolicy: "Al minuto, sin redondeo",
        correctionRules: "Toda corrección se hace por ajuste con motivo, aprobado por una segunda persona; la checada original no se modifica.",
        textVersion: 1,
        acceptedAt,
        acceptedIp: `187.190.${rng.int(1, 254)}.${rng.int(1, 254)}`,
        acceptedHash: createHash("sha256").update(`${person.id}:${methods.join(",")}:1`).digest("hex"),
        employerAcceptedAt: new Date(acceptedAt.getTime() + 3600_000),
        employerAcceptedIp: "201.141.32.10",
        employerAcceptedHash: createHash("sha256").update(`${tenantId}:${person.id}:employer`).digest("hex"),
        employerAcceptedById: admin.id,
      };
      const row = await db.workRecordAgreement.create({ data: { userId: person.id, ...agreement } });
      await db.workRecordAgreementVersion.create({ data: { agreementId: row.id, userId: person.id, ...agreement, employerAcceptedById: admin.id } });
      if (person.schedule.crossesMidnight) {
        await db.workdayDistributionAgreement.create({
          data: {
            userId: person.id,
            scheduleId: schedules.get(person.schedule.name)!.id,
            kind: "INDIVIDUAL",
            party: "WORKER",
            scope: "HORARIO",
            effectiveFrom: toUtcDate(signedKey),
            evidenceText: `Convenio de distribución de jornada «${person.schedule.name}» (art. 59 LFT) firmado por ${person.fullName}.`,
            acceptedHash: createHash("sha256").update(`dist:${person.id}`).digest("hex"),
            acceptedAt,
            acceptedIp: agreement.acceptedIp,
            acceptedById: person.id,
            createdById: rh.id,
          },
        });
      }
    }

    // ── Ajustes de checada (olvidos), con aprobación de una segunda persona ─
    const adjustments = new PunchAdjustmentsService(db, auditLog);
    for (const [index, mis] of misPunches.entries()) {
      const punch = await db.timeClockPunch.findFirst({
        where: { employeeNumber: mis.person.employeeNumber, occurredAt: mis.wrongAt },
        select: { id: true },
      });
      if (!punch) continue;
      const created = await adjustments.create(
        punch.id,
        { occurredAt: mis.rightAt.toISOString(), reason: "Olvidó checar su salida; regresó por sus cosas y checó tarde. Lo confirma su supervisor.", note: "Salida real según bitácora del área" } as Parameters<PunchAdjustmentsService["create"]>[1],
        { id: rh.id, name: rh.fullName }
      );
      if (index < 2) continue;
      const reject = index === misPunches.length - 1;
      await adjustments.decide(
        created.id,
        reject ? "REJECT" : "APPROVE",
        reject ? "No coincide con el registro de la caseta." : "Validado con el supervisor.",
        { id: admin.id, name: admin.fullName }
      );
    }

    // ── Motor real: días calculados, decisiones de extra, ledgers, cierres ─
    const { service: scheduleService } = createSchedulesModule({ audit: auditLog });
    const weekly = new WeeklyOvertimeService(db, scheduleService, auditLog, holidays);
    const daysOf = async (weekKey: string): Promise<ScheduleOvertimeDay[]> =>
      (await scheduleService.computeOvertimeDays({ page: 1, limit: 100000, filters: { period: "WEEK", date: weekKey }, sort: undefined })).days;

    const approvalsByDay = new Map<string, number>();
    const overtimeNotes = ["Cierre de inventario mensual", "Carga extraordinaria de pedidos", "Cobertura de ausencia", "Recepción de embarque retrasado", "Apoyo en auditoría", "Pacientes en espera"];
    let closedCount = 0;
    for (const weekKey of [...pastWeeks, weekStartKey]) {
      const days = await daysOf(weekKey);
      const isLast = weekKey === lastWeekKey;
      const isCurrent = weekKey === weekStartKey;
      const decidedBase = atLocal(addDaysKey(weekKey, 8), 10 * 60);

      // Tope diario superado: queda la alerta (como la levantaría el barrido).
      for (const day of days.filter((d) => d.workedMin > 720)) {
        await db.workdayLimitAlert.create({
          data: { userId: day.userId, scope: "DAY", date: toUtcDate(day.date), workedMinutes: day.workedMin, limitMinutes: 720, notifyCount: 1, notifiedAt: atLocal(day.date, 23 * 60) },
        });
      }

      if (!isCurrent) {
        for (const day of days.filter((d) => d.extraMin > 0)) {
          if (isLast && rng.chance(0.35)) continue;
          const status = day.extraMin > 240 && rng.chance(0.5) ? "REJECTED" : rng.chance(0.08) ? "REJECTED" : "APPROVED";
          await db.overtimeApproval.create({
            data: {
              userId: day.userId,
              date: toUtcDate(day.date),
              status,
              extraMin: day.extraMin,
              scheduleName: day.scheduleName,
              scheduledMin: day.scheduledMin,
              note: status === "REJECTED" ? "Sin autorización previa del supervisor" : rng.pick(overtimeNotes),
              decidedById: rng.chance(0.6) ? rh.id : admin.id,
              decidedAt: new Date(decidedBase.getTime() + rng.int(0, 300) * 60_000),
            },
          });
          if (status === "APPROVED") approvalsByDay.set(`${day.userId}|${day.date}`, day.extraMin);
        }
      }

      await weekly.computeWeek(tenantId, weekKey);
      if (isCurrent) continue;

      const ledgerStatus = isLast ? "CONFIRMED" : "CLOSED";
      await db.weeklyOvertimeLedger.updateMany({
        where: { weekStart: toUtcDate(weekKey), ...(isLast ? { otIllegalMin: 0 } : {}) },
        data: { status: ledgerStatus, confirmedById: rh.id, confirmedAt: decidedBase },
      });

      // Revisión por departamento y cierre de pre-nómina.
      const deptRows = new Map<string, { departmentId: string | null; name: string; people: Set<string>; normalMin: number; extraMin: number; approvedExtraMin: number; absences: number }>();
      const personRows = new Map<string, { departmentId: string | null; name: string; clock: string; workedMin: number; extraMin: number; approvedExtraMin: number; absences: number }>();
      for (const day of days) {
        const dept = deptRows.get(day.departmentId ?? "") ?? { departmentId: day.departmentId, name: day.departmentName ?? "Sin departamento", people: new Set(), normalMin: 0, extraMin: 0, approvedExtraMin: 0, absences: 0 };
        const person = personRows.get(day.userId) ?? { departmentId: day.departmentId, name: day.employeeName, clock: day.employeeNumber ?? "", workedMin: 0, extraMin: 0, approvedExtraMin: 0, absences: 0 };
        const approved = approvalsByDay.get(`${day.userId}|${day.date}`) ?? 0;
        const absent = !day.restDay && !day.withoutSchedule && day.workedMin === 0 ? 1 : 0;
        dept.people.add(day.userId);
        dept.normalMin += day.workedMin - day.extraMin;
        dept.extraMin += day.extraMin;
        dept.approvedExtraMin += approved;
        dept.absences += absent;
        person.workedMin += day.workedMin;
        person.extraMin += day.extraMin;
        person.approvedExtraMin += approved;
        person.absences += absent;
        deptRows.set(day.departmentId ?? "", dept);
        personRows.set(day.userId, person);
      }
      const departmentsList = [...deptRows.values()].map((d) => ({ ...d, people: d.people.size }));
      const reviewedDepts = isLast ? departmentsList.slice(0, Math.max(1, Math.floor(departmentsList.length / 2))) : departmentsList;
      for (const dept of reviewedDepts) {
        await db.payrollDepartmentReview.create({
          data: {
            weekStart: toUtcDate(weekKey),
            departmentId: dept.departmentId,
            bulk: !isLast,
            reviewedById: rh.id,
            reviewedAt: atLocal(addDaysKey(weekKey, 8), 9 * 60 + rng.int(0, 120)),
          },
        });
      }
      if (isLast) continue;
      const snapshotPeople = [...personRows.values()];
      const total = (field: "workedMin" | "extraMin" | "approvedExtraMin" | "absences") =>
        snapshotPeople.reduce((sum, p) => sum + p[field], 0);
      const closure = await db.payrollWeekClosure.create({
        data: {
          weekStart: toUtcDate(weekKey),
          closedById: admin.id,
          closedAt: atLocal(addDaysKey(weekKey, 8), 13 * 60 + rng.int(0, 90)),
          snapshot: {
            summary: {
              people: snapshotPeople.length,
              workedMin: total("workedMin"),
              extraMin: total("extraMin"),
              approvedExtraMin: total("approvedExtraMin"),
              absences: total("absences"),
            },
            departments: departmentsList,
            people: snapshotPeople,
          },
        },
      });
      closedCount += 1;
      await auditLog({
        action: "PAYROLL_WEEK_CLOSED",
        module: "schedules",
        entityType: "PayrollWeekClosure",
        entityId: closure.id,
        userId: admin.id,
        userName: admin.fullName,
        newState: { weekStart: weekKey, people: snapshotPeople.length },
      });
    }

    // ── Constancias semanales del trabajador (prueba plena del registro) ──
    const record = new WorkRecordService(db, auditLog);
    const ackWeeks = pastWeeks.slice(-3, -1);
    for (const weekKey of ackWeeks) {
      for (const person of people.filter((p) => p.hireKey <= weekKey && !p.leftKey)) {
        if (rng.chance(0.18)) continue;
        const discrepancy = rng.chance(0.03);
        const row = await record.acknowledge(
          tenantId,
          person.id,
          {
            periodStart: weekKey,
            periodEnd: addDaysKey(weekKey, 6),
            accept: !discrepancy,
            note: discrepancy ? "El martes salí a las 17:40, el registro marca 15:05." : null,
          },
          { id: person.id, name: person.fullName, ip: `187.190.${rng.int(1, 254)}.${rng.int(1, 254)}` }
        );
        await db.workRecordAcknowledgment.update({
          where: { id: row.id },
          data: { acceptedAt: atLocal(addDaysKey(weekKey, rng.int(8, 10)), 8 * 60 + rng.int(0, 600)) },
        });
      }
    }

    // ── Solicitudes previas de horas extra (arts. 66 y 68 LFT) ────────────
    const otRequests = [
      { person: rankAndFile[1], status: "ACCEPTED" as const, days: [addDaysKey(lastWeekKey, 4)], reason: "Inventario físico de fin de mes", workerNote: "De acuerdo" },
      { person: rankAndFile[4], status: "PENDING" as const, days: [addDaysKey(todayKey, 2), addDaysKey(todayKey, 3)], reason: "Temporada alta: cobertura de turno", workerNote: null },
      { person: rankAndFile[11] ?? rankAndFile[3], status: "PENDING" as const, days: [addDaysKey(todayKey, 5)], reason: "Capacitación de personal nuevo", workerNote: null },
      { person: rankAndFile[12] ?? rankAndFile[6], status: "REJECTED" as const, days: [addDaysKey(lastWeekKey, 5)], reason: "Apoyo en evento externo", workerNote: "Tengo clases los sábados" },
    ];
    for (const item of otRequests) {
      await db.overtimeRequest.create({
        data: {
          userId: item.person.id,
          requestedById: rh.id,
          reason: item.reason,
          plannedMin: 120,
          days: item.days,
          status: item.status,
          workerNote: item.workerNote,
          workerDecidedAt: item.status === "PENDING" ? null : atLocal(addDaysKey(item.days[0], -2), 17 * 60),
          createdAt: atLocal(addDaysKey(item.days[0], -4), 12 * 60),
        },
      });
    }

    // ── Expediente: documentos, descuentos y actas ─────────────────────────
    const docTypes = await db.documentType.findMany({ orderBy: { sortOrder: "asc" } });
    for (const person of people) {
      const complete = rng.chance(0.82);
      for (const type of docTypes) {
        if (!type.required && rng.chance(0.4)) continue;
        if (!complete && type.required && rng.chance(0.5)) continue;
        const ext = type.name === "INE" ? "jpg" : "pdf";
        await db.employeeDocument.create({
          data: {
            userId: person.id,
            documentTypeId: type.id,
            storageKey: `tenant/${tenantId}/employees/${person.id}/demo-${type.id}.${ext}`,
            originalName: `${plain(type.name).replace(/\s+/g, "_")}_${plain(person.fullName).replace(/\s+/g, "_")}.${ext}`,
            mimeType: ext === "jpg" ? "image/jpeg" : "application/pdf",
            sizeBytes: rng.int(80_000, 1_400_000),
            uploadedById: rh.id,
            createdAt: atLocal(person.hireKey > company.createdAt.slice(0, 10) ? person.hireKey : company.createdAt.slice(0, 10), 12 * 60),
          },
        });
      }
    }
    for (const person of rankAndFile.slice(0, 6)) {
      await db.employeeDiscount.create({ data: { userId: person.id, type: rng.pick(["INFONAVIT", "IMSS", "CHILD_SUPPORT"] as const), note: "Descuento vigente según aviso de retención" } });
    }
    for (const absence of absences.slice(0, 3)) {
      await db.disciplinaryReport.create({
        data: { userId: absence.person.id, createdById: rh.id, reason: "ABSENCE", incidentDate: toUtcDate(absence.key), description: "Falta sin aviso ni justificante.", sanction: "Amonestación por escrito", createdAt: atLocal(addDaysKey(absence.key, 1), 12 * 60) },
      });
    }
    for (const late of lateDays.filter((l) => l.minutes > 30).slice(0, 3)) {
      await db.disciplinaryReport.create({
        data: { userId: late.person.id, createdById: rh.id, reason: "TARDINESS", incidentDate: toUtcDate(late.key), description: `Retardo de ${late.minutes} minutos sin justificación.`, sanction: "Llamada de atención", createdAt: atLocal(addDaysKey(late.key, 1), 11 * 60) },
      });
    }

    // ── Teletrabajo (NOM-037) ─────────────────────────────────────────────
    for (const person of people.filter((p) => p.telework)) {
      const started = atLocal(person.hireKey > company.createdAt.slice(0, 10) ? person.hireKey : company.createdAt.slice(0, 10), 9 * 60);
      const registration = await db.teleworkRegistration.create({
        data: {
          userId: person.id,
          mode: person.telework!,
          status: "ACTIVE",
          homeAddress: `${rng.pick(STREETS)} ${rng.int(20, 900)}, ${rng.pick(company.neighborhoods)}, ${company.city}`,
          teleworkPercent: person.telework === "REMOTO" ? 100 : 60,
          activities: "Conciliaciones, facturación, reportes y atención por correo",
          position: "Administrativo",
          workPlaces: ["Domicilio particular", ...(person.telework === "HIBRIDO" ? ["Oficinas de la empresa"] : [])],
          startedAt: started,
          consentAcceptedAt: new Date(started.getTime() + 15 * 60_000),
          consentPolicyVersion: 1,
          consentPrivacyVersion: 1,
          createdById: rh.id,
        },
      });
      const answers = { space_adequate: "YES", ergonomics: "YES", electrical_safety: "YES", connectivity: "YES", ventilation_lighting: "YES", emergency_plan: "YES", equipment_inventory: "YES", no_risk_conditions: "YES" };
      await db.teleworkChecklist.create({
        data: { registrationId: registration.id, userId: person.id, kind: "INITIAL", answers, completedAt: new Date(started.getTime() + 3600_000), createdById: person.id, validatedById: rh.id, validatedAt: new Date(started.getTime() + 26 * 3600_000), result: "APTO", validationNotes: "Espacio adecuado; se entregó silla ergonómica." },
      });
      await db.teleworkChecklist.create({
        data: { registrationId: registration.id, userId: person.id, kind: "PERIODIC", answers: { ...answers, ergonomics: rng.chance(0.5) ? "NO" : "YES" }, completedAt: atLocal(addDaysKey(todayKey, -3), 10 * 60), createdById: person.id },
      });
    }
    const teleworker = people.find((p) => p.telework);
    if (teleworker) {
      await db.outOfHoursContact.create({
        data: { userId: teleworker.id, contactedAt: atLocal(addDaysKey(lastWeekKey, 2), 20 * 60 + 40), channel: "CALL", reason: "Aclaración urgente de un pago de proveedor", notifiedEmployee: true, createdById: admin.id },
      });
    }

    // ── Avisos y bitácora de altas recientes ───────────────────────────────
    const newHires = people.filter((p) => p.hireKey >= lastWeekKey);
    for (const hire of newHires) {
      await auditLog({ action: "USER_CREATED", module: "users", entityType: "User", entityId: hire.id, userId: rh.id, userName: rh.fullName, newState: { username: hire.username, name: hire.fullName } });
    }
    const notify = (userId: string, type: string, title: string, detail: string, read: boolean, hoursAgo: number) =>
      db.notification.create({ data: { userId, type, title, detail, read, createdAt: new Date(nowMs - hoursAgo * 3600_000) } });
    for (const target of [admin, rh]) {
      await notify(target.id, "TIME_CLOCK_ROSTER", "Baja pendiente en el reloj", `${leaver.fullName} dejó de aparecer en los relojes. Confirma el motivo de la baja.`, false, 6);
      await notify(target.id, "WORKDAY_LIMIT", "Jornada por encima del tope", "Hay personas que rebasaron las 12 horas diarias esta semana. Revisa el tiempo extra.", false, 20);
      await notify(target.id, "PAYROLL_WEEK_CLOSED", "Pre-nómina cerrada", `Se cerraron ${closedCount} semanas de pre-nómina.`, true, 72);
    }
    for (const hire of newHires) await notify(rh.id, "USER_CREATED", "Alta de personal", `${hire.fullName} se dio de alta como ${hire.department}.`, hire.hireKey < weekStartKey, 30);
    if (teleworker) await notify(rh.id, "TELEWORK_CHECKLIST", "Checklist de teletrabajo recibido", `${teleworker.fullName} envió su checklist periódico.`, false, 70);
    if (teleworker) await notify(teleworker.id, "OUT_OF_HOURS_CONTACT", "Contacto fuera de horario registrado", "Se registró una llamada fuera de tu jornada; queda constancia.", true, 120);
    for (const person of rankAndFile.slice(0, 5)) {
      await notify(person.id, "OVERTIME_APPROVED", "Horas extra aprobadas", "Se aprobaron tus horas extra de la semana pasada.", rng.chance(0.5), 50);
    }

    console.log(
      `✓ ${company.name}: ${people.length} personas, ${clockPunches.length} checadas de reloj, ${remotePunches.length} marcajes web, ${misPunches.length} ajustes, ${closedCount} semanas cerradas.`
    );
  });

  // ── Cobranza de la plataforma (kardex mensual del cliente) ───────────────
  await runWithTenant(
    null,
    async () => {
      const price = Number(plan?.monthlyPrice ?? 750);
      const startMonth = company.createdAt.slice(0, 7);
      const currentMonth = localDateKey(new Date(), TZ).slice(0, 7);
      const months: string[] = [];
      for (let period = startMonth; period <= currentMonth; period = addDaysKey(`${period}-28`, 5).slice(0, 7)) {
        months.push(period);
      }
      for (const period of months) {
        const isCurrent = period === currentMonth;
        const isPrevious = period === months[months.length - 2];
        const late = company.planTier === 0 && isPrevious;
        await db.tenantPayment.create({
          data: {
            tenantId: tenant.id,
            concept: `Mensualidad ${plan?.name ?? "plan"}`,
            period,
            amount: price.toFixed(2),
            dueDate: toUtcDate(`${period}-10`),
            status: isCurrent ? "PENDING" : late ? "OVERDUE" : "PAID",
            paidAt: isCurrent || late ? null : atLocal(`${period}-0${rng.int(3, 9)}`, 12 * 60),
            method: isCurrent || late ? null : rng.pick(["TRANSFER", "TRANSFER", "CARD"]),
            reference: isCurrent || late ? null : `SPEI-${company.slug.toUpperCase()}-${period.replace("-", "")}`,
          },
        });
      }
      await db.tenantPayment.create({
        data: {
          tenantId: tenant.id,
          concept: "Instalación y configuración de relojes",
          period: startMonth,
          amount: (1450 * company.clocks.length).toFixed(2),
          dueDate: toUtcDate(`${startMonth}-20`),
          status: "PAID",
          paidAt: new Date(new Date(company.createdAt).getTime() + 5 * 86_400_000),
          method: "TRANSFER",
          reference: `SPEI-${company.slug.toUpperCase()}-SETUP`,
        },
      });
    },
    true
  );

  return { slug: company.slug, logins };
}

async function main(): Promise<void> {
  await seedPermissionsFromFixtures(db);
  await seedPoliciesFromFixtures(db);
  await seedPlansFromFixtures(db);

  const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
  /** Distribución aproximada en México (O+ es mayoría). */
  const BLOOD_MIX = ["O+", "O+", "O+", "O+", "A+", "A+", "B+", "O-", "AB+"];
  const { plans, genders, bloodTypes } = await runWithTenant(
    null,
    async () => {
      for (const name of ["Femenino", "Masculino"]) await db.gender.upsert({ where: { name }, create: { name }, update: {} });
      for (const name of BLOOD_TYPES) await db.bloodType.upsert({ where: { name }, create: { name }, update: {} });
      const bloodIds = new Map((await db.bloodType.findMany()).map((b) => [b.name, b.id]));
      return {
        plans: await db.plan.findMany({ orderBy: { monthlyPrice: "asc" }, select: { id: true, name: true, monthlyPrice: true } }),
        genders: new Map((await db.gender.findMany()).map((g) => [g.name, g.id])),
        bloodTypes: BLOOD_MIX.map((name) => bloodIds.get(name)!),
      };
    },
    true
  );
  const password = await hashPassword(DEMO_PASSWORD);

  const results = [];
  for (const company of COMPANIES) {
    results.push(
      await seedCompany(company, { plans, password, genders, bloodTypes })
    );
  }

  console.log(`\nContraseña de todas las cuentas demo: ${DEMO_PASSWORD}`);
  for (const result of results.filter(Boolean)) {
    console.log(`\n  ${result!.slug}  →  http://${result!.slug}.localhost:5006`);
    for (const login of result!.logins) console.log(`    ${login.username.padEnd(22)} ${login.role.padEnd(16)} ${login.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
