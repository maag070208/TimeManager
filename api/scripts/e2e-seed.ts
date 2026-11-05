/**
 * Siembra la base del entorno E2E (`tm_e2e`). SOLO local.
 *
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_e2e \
 *     npx ts-node -r tsconfig-paths/register scripts/e2e-seed.ts
 *
 * Deja dos clientes (acme y beta), el personal de cada uno con contraseña
 * conocida, departamentos, un horario, checadas de hoy, un reloj apuntando al
 * mock ISAPI (127.0.0.1:4801) y avisos para el admin de acme.
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

interface SeedUser {
  username: string;
  name: string;
  role: string;
  email: string;
  employeeNumber: string;
  jobTitle: string;
  department?: string;
}

const MAIN = async (): Promise<void> => {
  const { prismaClient: db } = await import("@core/config/database");
  const { seedPermissionsFromFixtures } = await import("@core/permissions");
  const { seedPoliciesFromFixtures } = await import("@core/policies");
  const { hashPassword } = await import("@core/utils/security");
  const { runWithTenant } = await import("@core/tenancy/context");

  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) throw new Error("La base E2E está vacía: corre `pnpm db:test:up`.");
  const list = tables.map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  await seedPermissionsFromFixtures(db);
  await seedPoliciesFromFixtures(db);

  const password = await hashPassword(E2E_PASSWORD);

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
    clockUrl: string | null
  ): Promise<void> => {
    const tenant = await db.tenant.create({
      data: { name: tenantName, slug, status: "ACTIVE" },
    });

    await runWithTenant(tenant.id, async () => {
      const departments = new Map<string, string>();
      for (const name of ["Recursos Humanos", "Operaciones", "Administración"]) {
        const department = await db.department.create({ data: { name } });
        departments.set(name, department.id);
      }
      // Horarios con semana completa (lunes a viernes 09:00–18:00): sin días,
      // el PATCH de edición desde la UI responde 400 (`days min(1)`).
      const morning = await db.schedule.create({ data: { name: "Matutino" } });
      const evening = await db.schedule.create({ data: { name: "Vespertino" } });
      await db.scheduleDay.createMany({
        data: [morning, evening].flatMap((schedule) =>
          [1, 2, 3, 4, 5].map((weekday) => ({
            scheduleId: schedule.id,
            weekday,
            startTime: "09:00",
            endTime: "18:00",
            restDay: false,
          }))
        ),
      });

      const created = new Map<string, { id: string }>();
      for (const user of users) {
        const row = await db.user.create({
          data: {
            username: user.username,
            name: user.name,
            email: user.email,
            password,
            role: user.role,
            employeeNumber: user.employeeNumber,
            jobTitle: user.jobTitle,
            departmentId: user.department ? departments.get(user.department) : departments.get("Recursos Humanos"),
            hireDate: new Date("2024-01-15"),
          },
        });
        created.set(user.username, row);
      }

      const staff = users.find((user) => user.role === "CLIENT_STAFF");
      const admin = users.find((user) => user.role === "CLIENT_ADMIN");
      const rh = users.find((user) => user.role === "HUMAN_RESOURCES");

      // Asignación vigente del horario Matutino para RH (cobertura de nómina y
      // tiempo extra). NO se asigna a la persona de CLIENT_STAFF: el E2E de
      // "asigna un horario" usa acme.staff y espera que siga disponible.
      if (rh) {
        const today = new Date();
        const validFrom = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
        );
        await db.scheduleAssignment.create({
          data: {
            userId: created.get(rh.username)!.id,
            scheduleId: morning.id,
            validFrom,
          },
        });
      }
      if (staff) {
        const base = new Date();
        base.setHours(8, 0, 0, 0);
        for (const [index, hour] of [8, 17].entries()) {
          const occurredAt = new Date(base);
          occurredAt.setHours(hour, index === 0 ? 2 : 5, 0, 0);
          await db.timeClockPunch.create({
            data: {
              clockSerial: clockSerial,
              serialNo: index + 1,
              employeeNumber: staff.employeeNumber,
              name: staff.name.toUpperCase(),
              method: "FACE",
              minor: 75,
              occurredAt,
            },
          });
        }
      }

      await db.timeClock.create({
        data: {
          serialNumber: clockSerial,
          name: "Entrada principal",
          url: clockUrl,
          // Cursor por delante de los eventos sintéticos del mock: la sync del
          // arranque no los inyecta y los reportes E2E quedan deterministas
          // (solo las checadas sembradas). Un reloj real arranca en 0.
          lastSerialNo: clockUrl ? 1_000_000 : 0,
          countsAttendance: true,
          writeEnabled: true,
        },
      });

      if (admin) {
        await db.notification.create({
          data: {
            userId: created.get(admin.username)!.id,
            type: "USER_CREATED",
            title: "Cuenta de prueba E2E",
            detail: "Datos sembrados para las pruebas de extremo a extremo.",
          },
        });
      }
    });
  };

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
    ],
    // El mock reporta MOCK-SERIAL-0001: la fila del reloj debe usar ese serial o
    // las pantallas lo marcan como "ahora responde otro reloj".
    "MOCK-SERIAL-0001",
    "http://127.0.0.1:4801"
  );

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
    null
  );

  const [tenants, users] = await Promise.all([db.tenant.count(), db.user.count()]);
  console.log(`E2E seed OK — ${tenants} clientes, ${users} usuarios, relojes en 127.0.0.1:4801.`);
  await db.$disconnect();
};

MAIN().catch((error) => {
  console.error(error);
  process.exit(1);
});
