/** Configuración de nómina y cálculo con los datos del cliente (315.04/8h/48h). */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { api, clientSession, createTenant, expectStatus, setupSuite, stopSuite } from "./harness";

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("nómina configurable", () => {
  test("guarda configuración y calcula sueldo + horas extra", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const defaults = await api("GET", "/payroll/settings", { token: admin.token });
    expectStatus(defaults, 200, "configuración inicial");
    assert.equal(defaults.body?.overtimeDoubleHoursPerWeek, 9);

    const saved = await api("PUT", "/payroll/settings", {
      token: admin.token,
      body: {
        defaultDailySalary: 315.04,
        umaDaily: 113.14,
        overtimeDoubleHoursPerWeek: 9,
        overtimeDoubleMultiplier: 2,
        overtimeTripleMultiplier: 3,
        aguinaldoDays: 15,
        vacationPremiumPct: 25,
      },
    });
    expectStatus(saved, 200, "configuración guardada");
    assert.equal(saved.body?.defaultDailySalary, 315.04);

    const calculated = await api("POST", "/payroll/calculate", {
      token: admin.token,
      body: {
        periodStart: "2026-11-01",
        periodEnd: "2026-11-06",
        daysWorked: 6,
        overtimeDoubleHours: 10,
        includeAguinaldo: true,
        daysWorkedYear: 365,
      },
    });
    expectStatus(calculated, 200, "cálculo de nómina");
    assert.equal(calculated.body?.perceptions, 7442.82);
    const concepts = calculated.body?.concepts as Array<{ key: string; amount: number }>;
    assert.equal(concepts.find((c) => c.key === "HORAS_EXTRA_DOBLE")?.amount, 708.84);
    assert.equal(concepts.find((c) => c.key === "HORAS_EXTRA_TRIPLE")?.amount, 118.14);
    assert.equal(concepts.find((c) => c.key === "AGUINALDO")?.amount, 4725.6);
  });
});
