/**
 * Prueba de aislamiento entre clientes (F1A-08) contra una BD de PRUEBA.
 *
 *   TENANCY_CHECK_DATABASE_URL=postgresql://… pnpm tenancy-check
 *
 * Crea los clientes A y B con un departamento, horario, empleado y checada
 * cada uno; comprueba que desde A no se lista, lee, edita ni borra nada de B
 * (y al revés), y limpia al final. Nunca usa DATABASE_URL: así no corre por
 * accidente contra la BD de la nube.
 */
import assert from "node:assert/strict";

const url = process.env.TENANCY_CHECK_DATABASE_URL;
if (!url) {
  console.error("Falta TENANCY_CHECK_DATABASE_URL (BD de prueba; nunca la de producción).");
  process.exit(2);
}
process.env.DATABASE_URL = url;

interface Fixture {
  tenantId: string;
  departmentId: string;
  scheduleId: string;
  userId: string;
  punchId: string;
}

async function main(): Promise<void> {
  const { prismaClient: db } = await import("@core/config/database");
  const { runWithTenant } = await import("@core/tenancy/context");

  const run = Math.random().toString(36).slice(2, 8);
  const created: Fixture[] = [];
  let checks = 0;
  const check = async (label: string, fn: () => Promise<void>) => {
    await fn();
    checks += 1;
    console.log(`  ok  ${label}`);
  };

  const seed = async (slug: string, serial: number): Promise<Fixture> => {
    const tenant = await db.tenant.create({ data: { name: `Check ${slug}`, slug: `${slug}-${run}` } });
    return runWithTenant(tenant.id, async () => {
      const department = await db.department.create({ data: { name: "RH" } });
      const schedule = await db.schedule.create({ data: { name: "Matutino" } });
      const user = await db.user.create({
        data: { username: "empleado", name: "Empleado", password: "x", role: "CLIENT_STAFF", employeeNumber: "100", departmentId: department.id },
      });
      const punch = await db.timeClockPunch.create({
        data: {
          clockSerial: `CHECK-${run}`,
          serialNo: serial,
          employeeNumber: "100",
          name: "Empleado",
          method: "FACE",
          minor: 75,
          occurredAt: new Date(),
        },
      });
      const fixture = { tenantId: tenant.id, departmentId: department.id, scheduleId: schedule.id, userId: user.id, punchId: punch.id };
      created.push(fixture);
      return fixture;
    });
  };

  const isolation = async (me: Fixture, other: Fixture, name: string) => {
    await runWithTenant(me.tenantId, async () => {
      await check(`${name}: findMany solo ve lo propio`, async () => {
        assert.deepEqual((await db.department.findMany()).map((d) => d.id), [me.departmentId]);
        assert.deepEqual((await db.schedule.findMany()).map((s) => s.id), [me.scheduleId]);
        assert.deepEqual((await db.user.findMany({ select: { id: true } })).map((u) => u.id), [me.userId]);
        assert.deepEqual((await db.timeClockPunch.findMany()).map((p) => p.id), [me.punchId]);
      });
      await check(`${name}: count solo cuenta lo propio`, async () => {
        assert.equal(await db.schedule.count(), 1);
        assert.equal(await db.user.count(), 1);
      });
      await check(`${name}: no lee por id lo ajeno`, async () => {
        assert.equal(await db.department.findUnique({ where: { id: other.departmentId } }), null);
        assert.equal(await db.schedule.findFirst({ where: { id: other.scheduleId } }), null);
        assert.equal(await db.user.findUnique({ where: { id: other.userId }, select: { id: true } }), null);
        assert.equal(await db.timeClockPunch.findUnique({ where: { id: other.punchId } }), null);
      });
      await check(`${name}: un tenantId ajeno en where no salta el aislamiento`, async () => {
        const rows = await db.schedule.findMany({ where: { tenantId: other.tenantId } });
        assert.ok(rows.every((r) => r.tenantId === me.tenantId));
      });
      await check(`${name}: no edita lo ajeno`, async () => {
        await assert.rejects(db.schedule.update({ where: { id: other.scheduleId }, data: { name: "hackeado" } }));
        assert.equal((await db.department.updateMany({ where: { id: other.departmentId }, data: { name: "hackeado" } })).count, 0);
      });
      await check(`${name}: no borra lo ajeno`, async () => {
        await assert.rejects(db.schedule.delete({ where: { id: other.scheduleId } }));
        assert.equal((await db.timeClockPunch.deleteMany({ where: { id: other.punchId } })).count, 0);
      });
    });
  };

  try {
    console.log("tenancy-check: sembrando clientes A y B…");
    const a = await seed("a", 1);
    const b = await seed("b", 2);
    await isolation(a, b, "A→B");
    await isolation(b, a, "B→A");
    await check("lo ajeno sigue intacto", async () => {
      await runWithTenant(b.tenantId, async () => {
        const schedule = await db.schedule.findUnique({ where: { id: b.scheduleId } });
        assert.equal(schedule?.name, "Matutino");
        assert.equal((await db.department.findUnique({ where: { id: b.departmentId } }))?.name, "RH");
      });
    });
    console.log(`tenancy-check: ${checks} comprobaciones OK`);
  } finally {
    for (const f of created) {
      await runWithTenant(f.tenantId, async () => {
        await db.timeClockPunch.deleteMany();
        await db.user.deleteMany();
        await db.schedule.deleteMany();
        await db.department.deleteMany();
      });
    }
    await db.tenant.deleteMany({ where: { slug: { endsWith: `-${run}` } } });
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("tenancy-check FALLÓ:", err);
  process.exit(1);
});
