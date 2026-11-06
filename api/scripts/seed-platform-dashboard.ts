/**
 * Datos de demo para el dashboard de plataforma (solo BD local `tm_e2e`).
 * Crea clientes repartidos en meses, con plan, estado y un usuario admin para
 * que las gráficas y el uso tengan volumen. Idempotente por slug.
 *
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_e2e \
 *     npx ts-node -r tsconfig-paths/register scripts/seed-platform-dashboard.ts
 */
import { prismaClient } from "@core/config/database";
import { runWithTenant } from "@core/tenancy";
import { hashPassword } from "@core/utils/security";

const DEMO_PASSWORD = "DemoPrueba123!";
const moneyLabel = (value: number) => `$${value.toFixed(2)}`;

const SAMPLES = [
  { slug: "demo-norte", name: "Grupo Norte", planKey: "PLAN_500", createdAt: "2026-02-12T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-sol", name: "Soluciones del Sol", planKey: "PLAN_750", createdAt: "2026-03-18T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-azteca", name: "Azteca Logística", planKey: "PLAN_1000", createdAt: "2026-04-09T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-pacifico", name: "Pacífico Retail", planKey: "PLAN_500", createdAt: "2026-05-22T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-central", name: "Central Médica", planKey: "PLAN_750", createdAt: "2026-06-14T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-andes", name: "Andes Manufactura", planKey: "PLAN_1000", createdAt: "2026-07-08T10:00:00Z", status: "SUSPENDED" },
  { slug: "demo-sierra", name: "Sierra Alimentos", planKey: "PLAN_500", createdAt: "2026-08-19T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-golfo", name: "Golfo Servicios", planKey: "PLAN_750", createdAt: "2026-09-03T10:00:00Z", status: "ACTIVE" },
  { slug: "demo-bajio", name: "Bajío Construcciones", planKey: "PLAN_1000", createdAt: "2026-10-16T10:00:00Z", status: "SUSPENDED" },
  { slug: "demo-valle", name: "Valle Hotels", planKey: "PLAN_750", createdAt: "2026-11-02T10:00:00Z", status: "ACTIVE" },
] as const;

const main = async () => {
  if (!process.env.DATABASE_URL?.includes("tm_e2e")) {
    throw new Error("Este seed solo corre contra la BD local tm_e2e (demo).");
  }
  const plans = await prismaClient.plan.findMany({ select: { id: true, key: true, monthlyPrice: true } });
  const planByKey = new Map(plans.map((plan) => [plan.key, plan.id]));
  const priceByKey = new Map(plans.map((plan) => [plan.key, Number(plan.monthlyPrice ?? 0)]));
  if (planByKey.size === 0) throw new Error("No hay planes; corre el seed base primero.");
  const password = await hashPassword(DEMO_PASSWORD);

  for (const [index, sample] of SAMPLES.entries()) {
    const tenant = await prismaClient.tenant.upsert({
      where: { slug: sample.slug },
      create: {
        name: sample.name,
        slug: sample.slug,
        status: sample.status,
        planId: planByKey.get(sample.planKey) ?? null,
        timezone: "America/Mexico_City",
        createdAt: new Date(sample.createdAt),
        updatedAt: new Date(sample.createdAt),
      },
      update: {
        name: sample.name,
        status: sample.status,
        planId: planByKey.get(sample.planKey) ?? null,
        createdAt: new Date(sample.createdAt),
      },
    });
    const username = `demo${index + 1}.admin`;
    await runWithTenant(tenant.id, async () => {
      const existing = await prismaClient.user.findUnique({
        where: { tenantId_username: { tenantId: tenant.id, username } },
      });
      if (!existing) {
        await prismaClient.user.create({
          data: {
            tenantId: tenant.id,
            username,
            name: `Admin ${sample.name}`,
            password,
            role: "CLIENT_ADMIN",
            employeeNumber: `DEMO-${index + 1}`,
            active: true,
          },
        });
      }
    });
    const price = priceByKey.get(sample.planKey) ?? 0;
    for (let offset = 2; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - offset);
      const period = date.toISOString().slice(0, 7);
      const dueDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 5));
      const paid = offset > 0;
      await prismaClient.tenantPayment.upsert({
        where: { tenantId_period_concept: { tenantId: tenant.id, period, concept: "Suscripción mensual" } },
        create: {
          tenantId: tenant.id,
          concept: "Suscripción mensual",
          period,
          amount: price,
          dueDate,
          status: paid ? "PAID" : "PENDING",
          paidAt: paid ? dueDate : null,
          method: paid ? "Transferencia" : null,
        },
        update: {
          amount: price,
          status: paid ? "PAID" : "PENDING",
          paidAt: paid ? dueDate : null,
        },
      });
    }
    console.log(`[demo] ${sample.name} (${sample.slug}) · ${sample.status} · ${sample.planKey} · ${moneyLabel(price)}`);
  }
  // Clientes base del E2E (Acme/Beta): también con kardex para el demo.
  const baseTenants = await prismaClient.tenant.findMany({
    where: { slug: { in: ["acme", "beta"] } },
    include: { plan: true },
  });
  for (const tenant of baseTenants) {
    const price = Number(tenant.plan?.monthlyPrice ?? 0);
    for (let offset = 2; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - offset);
      const period = date.toISOString().slice(0, 7);
      const dueDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 5));
      const paid = offset > 0;
      await prismaClient.tenantPayment.upsert({
        where: { tenantId_period_concept: { tenantId: tenant.id, period, concept: "Suscripción mensual" } },
        create: {
          tenantId: tenant.id,
          concept: "Suscripción mensual",
          period,
          amount: price,
          dueDate,
          status: paid ? "PAID" : "PENDING",
          paidAt: paid ? dueDate : null,
          method: paid ? "Transferencia" : null,
        },
        update: { amount: price, status: paid ? "PAID" : "PENDING", paidAt: paid ? dueDate : null },
      });
    }
  }
  console.log(`[demo] ${SAMPLES.length} clientes demo + ${baseTenants.length} base · contraseña ${DEMO_PASSWORD}`);
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prismaClient.$disconnect());
