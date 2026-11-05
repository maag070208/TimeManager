/**
 * Siembra la base de carga (`tm_*` local) para la prueba de k6 / smoke (F4-05).
 * SOLO local: exige host loopback y nombre de BD que empiece con `tm_`.
 *
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_test_load \
 *     node --require ts-node/register/transpile-only \
 *          --require tsconfig-paths/register scripts/load-seed.ts
 *
 * Deja: catálogo de roles, un cliente `load-client`, admin de plataforma
 * (`load.admin`), admin del cliente (`load.client`), 20 personas y un reloj
 * apuntando al mock ISAPI. Escribe `load/.env.load` (ignorado por git) con las
 * variables que consumen los scripts k6 y `load/smoke.mjs`.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@core/utils/security";

const PASSWORD = "LoadPrueba123!";
const TENANT_SLUG = "load-client";
const CLOCK_SERIAL = "LOAD-CLOCK-1";
const BASE_URL = process.env.LOAD_BASE_URL ?? "http://127.0.0.1:4020/api/v1";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) throw new Error("Falta DATABASE_URL (BD local tm_*)");
const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) || !databaseName.startsWith("tm_")) {
  throw new Error(
    `La semilla de carga solo corre contra una BD local tm_* (host=${parsed.hostname}, db=${databaseName})`
  );
}

const main = async (): Promise<void> => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: ["error"] });
  try {
    const tables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tables.length === 0) throw new Error("La BD de carga está vacía: corre las migraciones.");
    const list = tables.map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

    const { seedPermissionsFromFixtures } = await import("@core/permissions");
    const { seedPoliciesFromFixtures } = await import("@core/policies");
    await seedPermissionsFromFixtures(db);
    await seedPoliciesFromFixtures(db);

    await db.role.createMany({
      data: [
        { key: "CLIENT_ADMIN", name: "Administrador del cliente" },
        { key: "HUMAN_RESOURCES", name: "Recursos Humanos" },
        { key: "CLIENT_STAFF", name: "Personal" },
        { key: "ADMIN", name: "Administrador de plataforma", staff: true },
        { key: "SUPPORT", name: "Soporte", staff: true },
      ],
      skipDuplicates: true,
    });

    const password = await hashPassword(PASSWORD);

    await db.user.create({
      data: {
        username: "load.admin",
        name: "Admin de carga (plataforma)",
        password,
        role: "ADMIN",
      },
    });

    const tenant = await db.tenant.create({
      data: { name: "Cliente de carga", slug: TENANT_SLUG, status: "ACTIVE", timezone: "America/Mexico_City" },
    });
    const tenantId = tenant.id;

    const department = await db.department.create({ data: { tenantId, name: "Operaciones" } });
    const clientAdmin = await db.user.create({
      data: {
        tenantId,
        username: "load.client",
        name: "Admin de carga (cliente)",
        password,
        role: "CLIENT_ADMIN",
        departmentId: department.id,
      },
    });

    const people = Array.from({ length: 20 }, (_, index) => ({
      tenantId,
      username: `load.staff.${String(index + 1).padStart(2, "0")}`,
      name: `Persona de carga ${index + 1}`,
      password,
      role: "CLIENT_STAFF",
      employeeNumber: `80${String(index + 1).padStart(4, "0")}`,
      departmentId: department.id,
      active: true,
    }));
    await db.user.createMany({ data: people });

    await db.timeClock.create({
      data: {
        serialNumber: CLOCK_SERIAL,
        tenantId,
        name: "Reloj de carga",
        url: "http://127.0.0.1:4801",
        username: "mock",
        passwordEncrypted: null,
        writeEnabled: true,
        countsAttendance: true,
      },
    });

    const today = new Date();
    const punches = Array.from({ length: 200 }, (_, index) => ({
      tenantId,
      clockSerial: CLOCK_SERIAL,
      serialNo: index + 1,
      employeeNumber: people[index % people.length].employeeNumber!,
      name: people[index % people.length].name,
      method: "FACE" as const,
      minor: 75,
      occurredAt: new Date(today.getTime() - index * 60_000),
    }));
    await db.timeClockPunch.createMany({ data: punches, skipDuplicates: true });
    await db.timeClock.update({
      where: { serialNumber: CLOCK_SERIAL },
      data: { lastSerialNo: 200, syncedAt: new Date() },
    });

    const envFile = [
      `BASE_URL=${BASE_URL}`,
      `TENANT_SLUG=${TENANT_SLUG}`,
      `TENANT_ID=${tenantId}`,
      `PLATFORM_USER=load.admin`,
      `PLATFORM_PASS=${PASSWORD}`,
      `CLIENT_USER=load.client`,
      `CLIENT_PASS=${PASSWORD}`,
      `CLOCK_SERIAL=${CLOCK_SERIAL}`,
      "",
    ].join("\n");
    const target = path.join(process.cwd(), "load", ".env.load");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, envFile, "utf8");

    console.log(
      JSON.stringify(
        { database: databaseName, tenantId, tenantSlug: TENANT_SLUG, clockSerial: CLOCK_SERIAL, envFile: target },
        null,
        2
      )
    );
    void clientAdmin;
  } finally {
    await db.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(`[load-seed] falló: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
