/**
 * Siembra la base del entorno E2E (`tm_e2e`). SOLO local.
 *
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_e2e \
 *     npx ts-node -r tsconfig-paths/register scripts/e2e-seed.ts
 *
 * Deja datos deterministas para que todas las pantallas tengan contenido:
 * dos clientes (acme y beta), personal con contraseña conocida, planes y
 * pagos, puestos de nómina y salarios, horarios con semana completa, checadas
 * de la semana en curso (retardo, comida, falta y tiempo extra), decisiones y
 * solicitudes de tiempo extra, vacaciones, expedientes, actas, teletrabajo,
 * convenios NOM, cierre histórico de pre-nómina, avisos y bitácora.
 *
 * Las fechas se calculan a partir del día de la corrida (zona del cliente), no
 * están hardcodeadas: `hoy`, el inicio de la semana (miércoles) y los días
 * laborables previos dentro de la semana.
 */
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) throw new Error("Falta DATABASE_URL (base local tm_e2e).");
const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) || !databaseName.startsWith("tm_e2e")) {
  throw new Error(
    `El seed E2E solo corre contra una base local tm_e2e (host=${parsed.hostname}, db=${databaseName}).`
  );
}
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "e2e";

/** Contraseña compartida por todas las cuentas de prueba. */
export const E2E_PASSWORD = "E2ePrueba123!";

const TZ = "America/Mexico_City";
/** El cliente opera miércoles → miércoles (`Tenant.weekStartDay` default). */
const WEEK_START_DAY = 3;

interface SeedUser {
  username: string;
  name: string;
  role: string;
  email: string;
  employeeNumber: string;
  jobTitle?: string;
  department?: string;
}

const MAIN = async (): Promise<void> => {
  const { prismaClient: db } = await import("@core/config/database");
  const { seedPermissionsFromFixtures } = await import("@core/permissions");
  const { seedPoliciesFromFixtures } = await import("@core/policies");
  const { hashPassword } = await import("@core/utils/security");
  const { runWithTenant } = await import("@core/tenancy/context");
  const { localDateKey, startOfLocalDay } = await import("@core/utils/timezone");

  // ── Fechas relativas a la corrida (zona del cliente) ─────────────────────
  const addDaysKey = (key: string, days: number): string => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const weekdayOfKey = (key: string): number => new Date(`${key}T00:00:00.000Z`).getUTCDay();
  const startOfWeekKey = (key: string): string => {
    const delta = (weekdayOfKey(key) - WEEK_START_DAY + 7) % 7;
    return addDaysKey(key, -delta);
  };
  const toUtcDate = (key: string): Date => new Date(`${key}T00:00:00.000Z`);
  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  /** Instante UTC de una hora de pared local del cliente. */
  const atLocal = (key: string, hhmm: string): Date =>
    new Date(startOfLocalDay(key, TZ).getTime() + toMinutes(hhmm) * 60_000);

  const todayKey = localDateKey(new Date(), TZ);
  const weekStartKey = startOfWeekKey(todayKey);
  const weekDayKeys = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStartKey, i));
  /** Días laborables (L-V) de la semana en curso que ya ocurrieron. */
  const pastWorkdayKeys = weekDayKeys.filter(
    (key) => key <= todayKey && weekdayOfKey(key) >= 1 && weekdayOfKey(key) <= 5
  );
  const recentDays = [...pastWorkdayKeys].reverse();
  const latestDay = recentDays[0] ?? todayKey;
  const previousDay = recentDays[1] ?? addDaysKey(latestDay, -1);
  const olderDay = recentDays[2] ?? addDaysKey(previousDay, -1);
  const previousWeekStartKey = addDaysKey(weekStartKey, -7);

  // ── Limpieza + catálogos base ────────────────────────────────────────────
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
      AND tablename NOT LIKE 'nom_archived_%'
  `;
  if (tables.length === 0) throw new Error("La base E2E está vacía: corre `pnpm db:test:up`.");
  const list = tables.map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`).join(", ");
  // Las tablas `nom_archived_*` son evidencia de retención y su trigger prohíbe
  // TRUNCATE: quedan fuera de la limpieza (en E2E siempre están vacías).
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  await seedPermissionsFromFixtures(db);
  await seedPoliciesFromFixtures(db);

  const password = await hashPassword(E2E_PASSWORD);
  const summary = {
    tenants: {} as Record<string, string>,
    plans: {} as Record<string, string>,
    payrollPositions: {} as Record<string, string>,
    schedules: {} as Record<string, string>,
    users: {} as Record<string, string>,
    departments: {} as Record<string, string>,
    leaveTypes: {} as Record<string, string>,
    documentTypes: {} as Record<string, string>,
    overtimeApprovals: [] as string[],
    weeklyOvertimeLedgers: [] as string[],
    payrollClosureId: null as string | null,
    paymentId: null as string | null,
  };

  // ── Planes de la plataforma (F3-09) ──────────────────────────────────────
  const planEsencial = await db.plan.create({
    data: { key: "ESENCIAL", name: "Esencial", employeeLimit: 500, clockLimit: 1, monthlyPrice: "500.00", sortOrder: 1 },
  });
  const planProfesional = await db.plan.create({
    data: { key: "PROFESIONAL", name: "Profesional", employeeLimit: 750, clockLimit: 2, monthlyPrice: "750.00", sortOrder: 2 },
  });
  const planEmpresa = await db.plan.create({
    data: { key: "EMPRESA", name: "Empresa", employeeLimit: 1000, clockLimit: 3, monthlyPrice: "1000.00", sortOrder: 3 },
  });
  summary.plans = { Esencial: planEsencial.id, Profesional: planProfesional.id, Empresa: planEmpresa.id };

  await db.user.create({
    data: {
      username: "e2e.admin",
      name: "Admin Plataforma",
      email: "e2e.admin@timemanager.test",
      password,
      role: "ADMIN",
    },
  });

  const seedTenant = async (
    slug: string,
    tenantName: string,
    users: SeedUser[],
    clockSerial: string,
    clockUrl: string | null,
    planId: string,
    rich: boolean
  ): Promise<void> => {
    const tenant = await db.tenant.create({
      data: { name: tenantName, slug, status: "ACTIVE", planId, timezone: TZ, weekStartDay: WEEK_START_DAY },
    });
    summary.tenants[slug] = tenant.id;

    await runWithTenant(tenant.id, async () => {
      const departments = new Map<string, string>();
      for (const name of ["Recursos Humanos", "Operaciones", "Administración"]) {
        const department = await db.department.create({ data: { name } });
        departments.set(name, department.id);
        summary.departments[`${slug}:${name}`] = department.id;
      }

      // Horarios: Matutino y Vespertino activos con la semana completa; el
      // Nocturno queda inactivo (catálogo con un horario apagado).
      const makeSchedule = async (name: string, active: boolean, shift: "DAY" | "NIGHT") => {
        const schedule = await db.schedule.create({
          data: {
            name,
            active,
            crossesMidnight: shift === "NIGHT",
            // La comida no cuenta como jornada: 09:00-18:00 con 60 min de
            // comida = 8 h ordinarias (si no, todo día tendría 1 h "extra").
            mealBreakMin: shift === "NIGHT" ? 0 : 60,
          },
        });
        const days = Array.from({ length: 7 }, (_, index) => {
          const weekday = index + 1;
          const restDay = weekday === 6 || weekday === 7;
          return {
            scheduleId: schedule.id,
            weekday,
            restDay,
            startTime: restDay ? null : shift === "NIGHT" ? "22:00" : "09:00",
            endTime: restDay ? null : shift === "NIGHT" ? "06:00" : "18:00",
          };
        });
        await db.scheduleDay.createMany({ data: days });
        return schedule;
      };
      const morning = await makeSchedule("Matutino", true, "DAY");
      const evening = await makeSchedule("Vespertino", true, "DAY");
      const night = await makeSchedule("Nocturno", false, "NIGHT");
      if (rich) {
        summary.schedules[`${slug}:Matutino`] = morning.id;
        summary.schedules[`${slug}:Vespertino`] = evening.id;
        summary.schedules[`${slug}:Nocturno`] = night.id;
      }

      // Personal (los usuarios base se conservan con el mismo username).
      const created = new Map<string, { id: string; employeeNumber: string; name: string }>();
      for (const user of users) {
        const row = await db.user.create({
          data: {
            username: user.username,
            name: user.name,
            email: user.email,
            password,
            role: user.role,
            employeeNumber: user.employeeNumber,
            jobTitle: user.jobTitle ?? null,
            departmentId: user.department ? departments.get(user.department) : departments.get("Recursos Humanos"),
            hireDate: new Date("2024-01-15"),
          },
          select: { id: true, name: true, employeeNumber: true },
        });
        created.set(user.username, { id: row.id, employeeNumber: row.employeeNumber ?? "", name: row.name });
        if (user.username === "acme.emilio") {
          await db.userRole.create({ data: { userId: row.id, role: "CLIENT_ADMIN" } });
        }
        summary.users[user.username] = row.id;
      }

      const admin = users.find((user) => user.username.endsWith(".admin"))!;
      const rh = users.find((user) => user.role === "HUMAN_RESOURCES");
      const staff = users.find((user) => user.role === "CLIENT_STAFF");
      const adminRow = created.get(admin.username)!;
      const rhRow = rh ? created.get(rh.username)! : null;
      const staffRow = staff ? created.get(staff.username)! : null;

      if (rich && staffRow) {
        // ── Puestos de nómina (≥2 activos con salario+SBC, 1 inactivo) ─────
        const operativo = await db.payrollPosition.create({
          data: { tenantId: tenant.id, name: "Operativo", jobTitle: "Analista", dailySalary: "315.04", sbcDaily: "350.00", active: true },
        });
        const administrativo = await db.payrollPosition.create({
          data: { tenantId: tenant.id, name: "Administrativo", jobTitle: "Gerente general", dailySalary: "520.00", sbcDaily: "560.00", active: true },
        });
        const especialista = await db.payrollPosition.create({
          data: { tenantId: tenant.id, name: "Especialista", jobTitle: null, dailySalary: "400.00", sbcDaily: "440.00", active: false },
        });
        summary.payrollPositions = {
          Operativo: operativo.id,
          Administrativo: administrativo.id,
          Especialista: especialista.id,
        };
        await db.user.update({ where: { id: staffRow.id }, data: { payrollPositionId: operativo.id } });
        await db.user.update({ where: { id: adminRow.id }, data: { payrollPositionId: administrativo.id } });

        // ── Asignaciones de horario (una vigente por persona) ─────────────
        // `validFrom` se guarda como UTC-medianoche del día local (así lo
        // compara `scheduleOn`): con la medianoche local la primera jornada de
        // la semana quedaba sin horario.
        const validFrom = toUtcDate(weekStartKey);
        for (const person of [staffRow, rhRow, adminRow]) {
          if (!person) continue;
          await db.scheduleAssignment.create({
            data: { userId: person.id, scheduleId: morning.id, validFrom, createdById: adminRow.id },
          });
        }

        // ── Checadas de la semana (reloj mock, números del personal) ──────
        let serial = 1;
        const punch = async (person: { id: string; employeeNumber: string; name: string }, key: string, hhmm: string) =>
          db.timeClockPunch.create({
            data: {
              clockSerial,
              serialNo: serial++,
              employeeNumber: person.employeeNumber,
              name: person.name.toUpperCase(),
              method: "FACE",
              minor: 75,
              occurredAt: atLocal(key, hhmm),
            },
          });

        // Vínculos reloj ↔ usuario: sin ellos la sesión del reloj no cuenta y
        // el tiempo extra no materializa pendientes.
        for (const person of [adminRow, rhRow, staffRow]) {
          if (!person) continue;
          await db.timeClockEmployee.create({
            data: { tenantId: tenant.id, employeeNumber: person.employeeNumber, userId: person.id, linkedById: adminRow.id },
          });
        }

        // Día más reciente: staff conserva 08:02/17:05 (E2E de checadas).
        await punch(staffRow, latestDay, "08:02");
        await punch(staffRow, latestDay, "17:05");
        await punch(adminRow, latestDay, "08:59");
        await punch(adminRow, latestDay, "19:30");
        if (rhRow) {
          await punch(rhRow, latestDay, "08:57");
          await punch(rhRow, latestDay, "19:15");
          // Día anterior: retardo de staff + jornada con extra aprobado.
          await punch(staffRow, previousDay, "09:23");
          await punch(staffRow, previousDay, "20:30");
          await punch(adminRow, previousDay, "08:00");
          await punch(adminRow, previousDay, "18:05");
          await punch(rhRow, previousDay, "08:58");
          await punch(rhRow, previousDay, "18:02");
          // Día ante-anterior: comida de staff (4 checadas) + RH falta.
          await punch(staffRow, olderDay, "08:00");
          await punch(staffRow, olderDay, "13:00");
          await punch(staffRow, olderDay, "13:45");
          await punch(staffRow, olderDay, "19:30");
          await punch(adminRow, olderDay, "09:00");
          await punch(adminRow, olderDay, "18:10");
        }

        // ── Tiempo extra: 1 APPROVED, 1 REJECTED y 2 pendientes ──────────
        // Los pendientes se materializan al vuelo: días con extra calculado y
        // SIN fila de aprobación (la UI los muestra en «Por aprobar»).
        const approved = await db.overtimeApproval.create({
          data: {
            userId: staffRow.id,
            date: toUtcDate(previousDay),
            status: "APPROVED",
            extraMin: 140,
            scheduleName: "Matutino",
            scheduledMin: 540,
            note: "Cierre de inventario",
            decidedById: adminRow.id,
            decidedAt: atLocal(latestDay, "10:00"),
          },
        });
        const rejected = await db.overtimeApproval.create({
          data: {
            userId: staffRow.id,
            date: toUtcDate(olderDay),
            status: "REJECTED",
            extraMin: 80,
            scheduleName: "Matutino",
            scheduledMin: 540,
            note: "No autorizada",
            decidedById: adminRow.id,
            decidedAt: atLocal(latestDay, "10:05"),
          },
        });
        summary.overtimeApprovals = [approved.id, rejected.id];
        await db.overtimeRequest.create({
          data: {
            userId: staffRow.id,
            requestedById: adminRow.id,
            reason: "Apoyo en cierre mensual",
            plannedMin: 120,
            days: [addDaysKey(weekStartKey, 8)],
            status: "PENDING",
          },
        });

        // Snapshots semanales: histórico CONFIRMED con dobles/triples, semana
        // en curso CONFIRMED de staff y DRAFT de admin (e2e-ops pide ≥1 DRAFT).
        const dayResult = (date: string, workedMin: number, extraMin: number) => ({
          date,
          workedMin,
          scheduledMin: 540,
          ordinaryMin: 480,
          extraMin,
          doubleMin: extraMin,
          tripleMin: 0,
          illegalMin: 0,
          restDayWorkedMin: 0,
          holidayWorkedMin: 0,
          sunday: false,
          violations: [],
        });
        const historical = await db.weeklyOvertimeLedger.create({
          data: {
            userId: staffRow.id,
            weekStart: toUtcDate(previousWeekStartKey),
            year: Number(previousWeekStartKey.slice(0, 4)),
            ordinaryMin: 2400,
            otDoubleMin: 540,
            otTripleMin: 120,
            otIllegalMin: 0,
            days: [
              dayResult(addDaysKey(previousWeekStartKey, 0), 660, 120),
              dayResult(addDaysKey(previousWeekStartKey, 1), 720, 180),
              dayResult(addDaysKey(previousWeekStartKey, 2), 600, 120),
              dayResult(addDaysKey(previousWeekStartKey, 3), 660, 120),
              dayResult(addDaysKey(previousWeekStartKey, 4), 660, 120),
            ],
            engineVersion: "weekly-ot-v1",
            status: "CONFIRMED",
            confirmedById: adminRow.id,
            confirmedAt: atLocal(latestDay, "11:00"),
          },
        });
        const current = await db.weeklyOvertimeLedger.create({
          data: {
            userId: staffRow.id,
            weekStart: toUtcDate(weekStartKey),
            year: Number(weekStartKey.slice(0, 4)),
            ordinaryMin: 1620,
            otDoubleMin: 220,
            otTripleMin: 0,
            otIllegalMin: 0,
            days: [
              dayResult(olderDay, 690, 80),
              dayResult(previousDay, 667, 140),
              dayResult(latestDay, 543, 0),
            ],
            engineVersion: "weekly-ot-v1",
            status: "CONFIRMED",
            confirmedById: adminRow.id,
            confirmedAt: atLocal(latestDay, "11:05"),
          },
        });
        const draft = await db.weeklyOvertimeLedger.create({
          data: {
            userId: adminRow.id,
            weekStart: toUtcDate(weekStartKey),
            year: Number(weekStartKey.slice(0, 4)),
            ordinaryMin: 1620,
            otDoubleMin: 160,
            otTripleMin: 0,
            otIllegalMin: 0,
            days: [dayResult(previousDay, 605, 0), dayResult(latestDay, 631, 80)],
            engineVersion: "weekly-ot-v1",
            status: "DRAFT",
          },
        });
        summary.weeklyOvertimeLedgers = [historical.id, current.id, draft.id];

        // ── Vacaciones / permisos: 2 tipos + 1 PENDING + 1 APPROVED ───────
        const vacationType = await db.leaveType.create({
          data: { key: "VACACIONES", name: "Vacaciones (con goce)", kind: "VACATION", paid: true },
        });
        const unpaidType = await db.leaveType.create({
          data: { key: "PERMISO_SIN_GOCE", name: "Permiso sin goce de sueldo", kind: "UNPAID_LEAVE", paid: false },
        });
        summary.leaveTypes = { "Vacaciones (con goce)": vacationType.id, "Permiso sin goce de sueldo": unpaidType.id };
        await db.leaveRequest.create({
          data: {
            userId: staffRow.id,
            typeId: vacationType.id,
            startDate: toUtcDate(addDaysKey(weekStartKey, 7)),
            endDate: toUtcDate(addDaysKey(weekStartKey, 9)),
            days: 3,
            status: "PENDING",
            reason: "Viaje familiar",
            createdById: staffRow.id,
          },
        });
        await db.leaveRequest.create({
          data: {
            userId: adminRow.id,
            typeId: vacationType.id,
            startDate: toUtcDate(addDaysKey(previousWeekStartKey, 4)),
            endDate: toUtcDate(addDaysKey(previousWeekStartKey, 5)),
            days: 2,
            status: "APPROVED",
            reason: "Asunto personal",
            createdById: adminRow.id,
            decidedById: rhRow?.id ?? adminRow.id,
            decidedAt: atLocal(previousWeekStartKey, "12:00"),
            decisionNote: "Aprobado",
          },
        });

        // ── Expediente: INE obligatorio cargado, Contrato faltante ────────
        const ineType = await db.documentType.create({ data: { name: "INE", required: false, sortOrder: 1 } });
        const contractType = await db.documentType.create({ data: { name: "Contrato", required: false, sortOrder: 2 } });
        summary.documentTypes = { INE: ineType.id, Contrato: contractType.id };
        await db.employeeDocument.create({
          data: {
            userId: staffRow.id,
            documentTypeId: ineType.id,
            storageKey: `e2e/${slug}/${staffRow.employeeNumber}/ine.txt`,
            originalName: "INE-Sergio-Staff.txt",
            mimeType: "text/plain",
            sizeBytes: 1024,
            uploadedById: adminRow.id,
          },
        });

        // ── Actas: falta (semana pasada) y retardo (día anterior) ─────────
        await db.disciplinaryReport.create({
          data: {
            userId: staffRow.id,
            createdById: adminRow.id,
            reason: "ABSENCE",
            incidentDate: toUtcDate(addDaysKey(previousWeekStartKey, 2)),
            description: "Falta sin aviso el día señalado.",
            sanction: "Amonestación verbal",
          },
        });
        await db.disciplinaryReport.create({
          data: {
            userId: staffRow.id,
            createdById: adminRow.id,
            reason: "TARDINESS",
            incidentDate: toUtcDate(previousDay),
            description: "Retardo de 23 minutos sin justificación.",
            sanction: "Llamada de atención",
          },
        });

        // ── Configuración NOM + teletrabajo (NOM-037) ────────────────────
        await db.nomSettings.create({
          data: {
            tenantId: tenant.id,
            workdayLimitMinutes: 720,
            weeklyLimitMinutes: 2880,
            retentionMonths: 60,
            defaultEntryToleranceMin: 10,
            defaultExitToleranceMin: 10,
            defaultMealBreakMin: 60,
            defaultMinOvertimeMin: 60,
            remotePunchEnabled: true,
            remoteCountsForWorkday: true,
            blockRemoteWithoutAgreement: false,
            teleworkPolicy: "Política de teletrabajo E2E: jornada, comunicación y desconexión digital.",
            disconnectPolicy: "Desconexión digital fuera de la jornada pactada (18:00 a 09:00).",
            privacyNotice: "Aviso de privacidad E2E para datos de teletrabajo.",
            policyVersion: 1,
            privacyNoticeVersion: 1,
            policiesUpdatedAt: atLocal(weekStartKey, "08:00"),
            updatedById: adminRow.id,
          },
        });
        const registration = await db.teleworkRegistration.create({
          data: {
            userId: staffRow.id,
            mode: "REMOTO",
            status: "ACTIVE",
            homeAddress: "Av. Reforma 123, Col. Centro, CDMX",
            teleworkPercent: 100,
            activities: "Análisis de datos y reportes de RH",
            position: "Analista",
            workPlaces: ["Domicilio particular"],
            startedAt: atLocal(previousWeekStartKey, "09:00"),
            consentAcceptedAt: atLocal(previousWeekStartKey, "09:05"),
            consentPolicyVersion: 1,
            consentPrivacyVersion: 1,
            createdById: adminRow.id,
          },
        });
        await db.teleworkChecklist.create({
          data: {
            registrationId: registration.id,
            userId: staffRow.id,
            kind: "INITIAL",
            answers: {
              space_adequate: "YES",
              ergonomics: "YES",
              electrical_safety: "YES",
              connectivity: "YES",
              ventilation_lighting: "YES",
              emergency_plan: "YES",
              equipment_inventory: "YES",
              no_risk_conditions: "YES",
            },
            completedAt: atLocal(previousWeekStartKey, "10:00"),
            createdById: staffRow.id,
            validatedById: adminRow.id,
            validatedAt: atLocal(previousWeekStartKey, "12:00"),
            result: "APTO",
            validationNotes: "Sin observaciones",
          },
        });
        await db.outOfHoursContact.create({
          data: {
            userId: staffRow.id,
            contactedAt: atLocal(previousDay, "20:30"),
            channel: "CALL",
            reason: "Aviso de guardia por incidencia",
            notifiedEmployee: true,
            createdById: adminRow.id,
          },
        });

        // ── Convenios NOM: distribución de jornada y método de registro ──
        await db.workdayDistributionAgreement.create({
          data: {
            userId: staffRow.id,
            scheduleId: morning.id,
            kind: "INDIVIDUAL",
            party: "WORKER",
            scope: "HORARIO",
            effectiveFrom: toUtcDate(weekStartKey),
            evidenceText: "Convenio de distribución de jornada 09:00-18:00 con descanso sábado y domingo.",
            acceptedHash: "e2e-sha256-distribucion-1003",
            acceptedAt: atLocal(weekStartKey, "09:00"),
            acceptedIp: "127.0.0.1",
            acceptedById: staffRow.id,
            createdById: adminRow.id,
          },
        });
        await db.workRecordAgreement.create({
          data: {
            userId: staffRow.id,
            methods: ["CLOCK", "REMOTE"],
            roundingPolicy: "Al minuto",
            correctionRules: "Solo por ajuste autorizado con motivo.",
            textVersion: 1,
            acceptedAt: atLocal(weekStartKey, "09:05"),
            acceptedIp: "127.0.0.1",
            acceptedHash: "e2e-sha256-registro-1003",
            employerAcceptedAt: atLocal(weekStartKey, "09:10"),
            employerAcceptedIp: "127.0.0.1",
            employerAcceptedHash: "e2e-sha256-registro-patron",
            employerAcceptedById: adminRow.id,
          },
        });

        // ── Nómina: configuración con salario diario > 0 ─────────────────
        await db.payrollSettings.create({
          data: {
            tenantId: tenant.id,
            currency: "MXN",
            defaultDailySalary: "315.04",
            sbcDaily: "350.00",
            umaDaily: "113.14",
            valesMonthly: "1500.00",
            updatedById: adminRow.id,
          },
        });

        // ── Pre-nómina: semana anterior cerrada, actual abierta ──────────
        const closure = await db.payrollWeekClosure.create({
          data: {
            weekStart: toUtcDate(previousWeekStartKey),
            closedById: adminRow.id,
            closedAt: atLocal(weekStartKey, "09:00"),
            snapshot: {
              weekStart: previousWeekStartKey,
              totalWorkedMinutes: 6900,
              totalExtraMinutes: 660,
              peopleTotal: 3,
              totals: { ordinaryMin: 6480, otDoubleMin: 540, otTripleMin: 120 },
              reviews: [...departments.keys()].map((name) => ({ departmentName: name, bulk: true })),
            },
          },
        });
        summary.payrollClosureId = closure.id;
        for (const departmentId of departments.values()) {
          await db.payrollDepartmentReview.create({
            data: {
              weekStart: toUtcDate(previousWeekStartKey),
              departmentId,
              bulk: true,
              reviewedById: adminRow.id,
              reviewedAt: atLocal(weekStartKey, "08:30"),
            },
          });
        }

        // ── Avisos: el admin conserva exactamente 1 sin leer ─────────────
        await db.notification.create({
          data: {
            userId: adminRow.id,
            type: "USER_CREATED",
            title: "Cuenta de prueba E2E",
            detail: "Datos sembrados para las pruebas de extremo a extremo.",
          },
        });
        await db.notification.create({
          data: {
            userId: adminRow.id,
            type: "PAYROLL_WEEK_CLOSED",
            title: "Pre-nómina cerrada",
            detail: "Se cerró la pre-nómina de la semana anterior.",
            read: true,
          },
        });
        await db.notification.create({
          data: {
            userId: staffRow.id,
            type: "OVERTIME_APPROVED",
            title: "Horas extra aprobadas",
            detail: "Se aprobaron tus horas extra del día anterior.",
          },
        });
        if (rhRow) {
          await db.notification.create({
            data: {
              userId: rhRow.id,
              type: "TELEWORK_CHECKLIST",
              title: "Checklist de teletrabajo recibido",
              detail: "Sergio Staff envió su checklist inicial del lugar de teletrabajo.",
              read: true,
            },
          });
        }

        // ── Bitácora de ejemplo (solo INSERT: la tabla es inmutable) ─────
        await db.auditLog.create({
          data: {
            action: "USER_CREATED",
            module: "users",
            entityType: "User",
            entityId: staffRow.id,
            userId: adminRow.id,
            userName: adminRow.name,
            newState: { username: staff?.username, role: staff?.role },
            metadata: { source: "e2e-seed" },
          },
        });
        await db.auditLog.create({
          data: {
            action: "PAYROLL_WEEK_CLOSED",
            module: "schedules",
            entityType: "PayrollWeekClosure",
            entityId: closure.id,
            userId: adminRow.id,
            userName: adminRow.name,
            newState: { weekStart: previousWeekStartKey },
            metadata: { source: "e2e-seed" },
          },
        });
        await db.auditLog.create({
          data: {
            action: "TIME_CLOCK_EMPLOYEE_LINKED",
            module: "time-clock",
            entityType: "TimeClockEmployee",
            entityId: `${slug}:1003`,
            userId: adminRow.id,
            userName: adminRow.name,
            metadata: { employeeNumber: "1003", source: "e2e-seed" },
          },
        });
      } else {
        // Beta: lo mínimo para aislamiento (checadas propias del mock, NOM y
        // nómina con salario default) sin horarios, puestos ni tiempo extra.
        if (staffRow) {
          await db.timeClockPunch.create({
            data: {
              clockSerial,
              serialNo: 1,
              employeeNumber: staffRow.employeeNumber,
              name: staffRow.name.toUpperCase(),
              method: "FACE",
              minor: 75,
              occurredAt: atLocal(todayKey, "08:05"),
            },
          });
          await db.timeClockPunch.create({
            data: {
              clockSerial,
              serialNo: 2,
              employeeNumber: staffRow.employeeNumber,
              name: staffRow.name.toUpperCase(),
              method: "FACE",
              minor: 75,
              occurredAt: atLocal(todayKey, "17:10"),
            },
          });
        }
        await db.nomSettings.create({ data: { tenantId: tenant.id, remotePunchEnabled: true } });
        await db.payrollSettings.create({
          data: { tenantId: tenant.id, defaultDailySalary: "315.04", sbcDaily: "350.00", updatedById: adminRow.id },
        });
      }

      // Reloj apuntando al mock ISAPI (para beta queda sin URL = dado de baja).
      await db.timeClock.create({
        data: {
          serialNumber: clockSerial,
          name: "Entrada principal",
          url: clockUrl,
          // Cursor por delante de los eventos sintéticos del mock: la sync del
          // arranque no los inyecta y los reportes E2E quedan deterministas.
          lastSerialNo: clockUrl ? 1_000_000 : 0,
          countsAttendance: true,
          writeEnabled: true,
        },
      });
    });

    // Pago del cliente (plataforma): cargo del mes en curso ya pagado.
    if (rich) {
      const period = todayKey.slice(0, 7);
      const payment = await db.tenantPayment.create({
        data: {
          tenantId: tenant.id,
          concept: "Mensualidad Profesional",
          period,
          amount: "750.00",
          dueDate: toUtcDate(`${period}-10`),
          status: "PAID",
          paidAt: atLocal(`${period}-05`, "12:00"),
          method: "TRANSFER",
          reference: "E2E-PAGO-0001",
        },
      });
      summary.paymentId = payment.id;
    }
  };

  // ── Cliente acme: datos completos ────────────────────────────────────────
  await seedTenant(
    "acme",
    "Cliente E2E Acme",
    [
      {
        username: "acme.admin",
        name: "Ana Administradora",
        role: "CLIENT_ADMIN",
        email: "acme.admin@timemanager.test",
        employeeNumber: "1001",
        jobTitle: "Gerente general",
        department: "Administración",
      },
      {
        username: "acme.rh",
        name: "Rita Recursos",
        role: "HUMAN_RESOURCES",
        email: "acme.rh@timemanager.test",
        employeeNumber: "1002",
        jobTitle: "Jefa de RH",
        department: "Recursos Humanos",
      },
      {
        username: "acme.staff",
        name: "Sergio Staff",
        role: "CLIENT_STAFF",
        email: "acme.staff@timemanager.test",
        employeeNumber: "1003",
        jobTitle: "Analista",
        department: "Operaciones",
      },
      {
        username: "acme.elena",
        name: "Elena Extra",
        role: "CLIENT_STAFF",
        email: "acme.elena@timemanager.test",
        employeeNumber: "1004",
        department: "Operaciones",
      },
      {
        username: "acme.emilio",
        name: "Emilio Extra",
        role: "CLIENT_STAFF",
        email: "acme.emilio@timemanager.test",
        employeeNumber: "1005",
        department: "Administración",
      },
    ],
    // El mock reporta MOCK-SERIAL-0001: la fila del reloj debe usar ese serial o
    // las pantallas lo marcan como "ahora responde otro reloj".
    "MOCK-SERIAL-0001",
    "http://127.0.0.1:4801",
    planProfesional.id,
    true
  );

  // ── Cliente beta: lo mínimo para probar aislamiento ─────────────────────
  await seedTenant(
    "beta",
    "Cliente E2E Beta",
    [
      {
        username: "beta.admin",
        name: "Beto Administrador",
        role: "CLIENT_ADMIN",
        email: "beta.admin@timemanager.test",
        employeeNumber: "2001",
        jobTitle: "Gerente",
        department: "Administración",
      },
      {
        username: "beta.staff",
        name: "Brenda Staff",
        role: "CLIENT_STAFF",
        email: "beta.staff@timemanager.test",
        employeeNumber: "2002",
        jobTitle: "Operadora",
        department: "Operaciones",
      },
    ],
    // Beta no tiene mock propio: el reloj queda sin URL (dado de baja).
    "E2E-BETA-CLOCK",
    null,
    planEsencial.id,
    false
  );

  await runWithTenant(null, async () => {
    const counts = {
      tenants: await db.tenant.count(),
      users: await db.user.count(),
      plans: await db.plan.count(),
      payments: await db.tenantPayment.count(),
      payrollPositions: await db.payrollPosition.count(),
      schedules: await db.schedule.count(),
      scheduleDays: await db.scheduleDay.count(),
      scheduleAssignments: await db.scheduleAssignment.count(),
      punches: await db.timeClockPunch.count(),
      clockLinks: await db.timeClockEmployee.count(),
      overtimeApprovals: await db.overtimeApproval.count(),
      overtimeRequests: await db.overtimeRequest.count(),
      overtimeLedgers: await db.weeklyOvertimeLedger.count(),
      leaveTypes: await db.leaveType.count(),
      leaveRequests: await db.leaveRequest.count(),
      documentTypes: await db.documentType.count(),
      documents: await db.employeeDocument.count(),
      disciplinaryReports: await db.disciplinaryReport.count(),
      teleworkRegistrations: await db.teleworkRegistration.count(),
      teleworkChecklists: await db.teleworkChecklist.count(),
      outOfHoursContacts: await db.outOfHoursContact.count(),
      distributionAgreements: await db.workdayDistributionAgreement.count(),
      recordAgreements: await db.workRecordAgreement.count(),
      payrollClosures: await db.payrollWeekClosure.count(),
      payrollReviews: await db.payrollDepartmentReview.count(),
      notifications: await db.notification.count(),
      auditLogs: await db.auditLog.count(),
    };
    console.log(`E2E seed OK — ${counts.tenants} clientes, ${counts.users} usuarios.`);
    console.log(`Conteos: ${JSON.stringify(counts)}`);
    console.log(`IDs: ${JSON.stringify(summary)}`);
  });

  await db.$disconnect();
};

MAIN().catch((error) => {
  console.error(error);
  process.exit(1);
});
