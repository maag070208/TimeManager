/**
 * F1B-04 — Zona horaria por cliente en el backend.
 *
 * Los cortes de "hoy", el día al que pertenece una checada y los reportes usan
 * `Tenant.timezone`, no la zona del servidor: la misma checada cerca de la
 * medianoche cae en días distintos para dos clientes en zonas distintas.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createPunch,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

const CDMX = "America/Mexico_City";
const TIJUANA = "America/Tijuana";

/** 2026-11-05 07:30 UTC = 01:30 CDMX (día 5) = 23:30 del día 4 en Tijuana. */
const PUNCH_AT = new Date("2026-11-05T07:30:00.000Z");
const DAY_CDMX = "2026-11-05";
const DAY_TIJUANA = "2026-11-04";

const CDMX_NUMBER = unique("TZ-CDMX");
const TIJUANA_NUMBER = unique("TZ-TIJ");

let tenantCdmx: TenantFixture;
let tenantTijuana: TenantFixture;
let adminCdmx: Session;
let adminTijuana: Session;

const report = (session: Session, date: string) =>
  api("POST", "/time-clock/report", {
    token: session.token,
    body: { page: 1, limit: 100, filters: { period: "DAY", date } },
  });

const reportRows = (body: unknown): Array<{ employeeNumber: string }> =>
  ((body as { data?: Array<{ employeeNumber: string }> })?.data ?? []);

const weekly = (session: Session, date: string) =>
  api("POST", "/schedules/weekly-attendance", { token: session.token, body: { date } });

before(async () => {
  await setupSuite();
  const { prismaClient } = await import("@core/config/database");
  tenantCdmx = await prismaClient.tenant.create({
    data: { name: "Cliente CDMX", slug: unique("tz-cdmx"), timezone: CDMX },
  });
  tenantTijuana = await prismaClient.tenant.create({
    data: { name: "Cliente Tijuana", slug: unique("tz-tij"), timezone: TIJUANA },
  });
  adminCdmx = await clientSession("CLIENT_ADMIN", { tenant: tenantCdmx as TenantFixture });
  adminTijuana = await clientSession("CLIENT_ADMIN", { tenant: tenantTijuana as TenantFixture });
  await createPunch(tenantCdmx.id, { employeeNumber: CDMX_NUMBER, name: "CHECADA CDMX", occurredAt: PUNCH_AT });
  await createPunch(tenantTijuana.id, { employeeNumber: TIJUANA_NUMBER, name: "CHECADA TIJUANA", occurredAt: PUNCH_AT });
});

after(async () => {
  await stopSuite();
});

describe("zona horaria por cliente", () => {
  test("el reporte sin tz explícita usa la zona del cliente", async () => {
    const cdmx = await report(adminCdmx, DAY_CDMX);
    expectStatus(cdmx, 200, "reporte CDMX");
    assert.equal(cdmx.body?.summary?.range?.timezone, CDMX);
    assert.ok(
      reportRows(cdmx.body).some((row) => row.employeeNumber === CDMX_NUMBER),
      "la checada de 01:30 local es del día 5 en CDMX"
    );

    const tijuana = await report(adminTijuana, DAY_TIJUANA);
    expectStatus(tijuana, 200, "reporte Tijuana");
    assert.equal(tijuana.body?.summary?.range?.timezone, TIJUANA);
    assert.ok(
      reportRows(tijuana.body).some((row) => row.employeeNumber === TIJUANA_NUMBER),
      "la misma checada es del día 4 en Tijuana (23:30)"
    );
  });

  test("la misma checada no cae en el otro día de cada cliente", async () => {
    const cdmxDay4 = await report(adminCdmx, DAY_TIJUANA);
    expectStatus(cdmxDay4, 200, "reporte CDMX día 4");
    assert.equal(
      reportRows(cdmxDay4.body).some((row) => row.employeeNumber === CDMX_NUMBER),
      false,
      "en CDMX la checada NO es del día 4"
    );

    const tijuanaDay5 = await report(adminTijuana, DAY_CDMX);
    expectStatus(tijuanaDay5, 200, "reporte Tijuana día 5");
    assert.equal(
      reportRows(tijuanaDay5.body).some((row) => row.employeeNumber === TIJUANA_NUMBER),
      false,
      "en Tijuana la checada NO es del día 5"
    );
  });

  test("el reporte semanal usa la semana del cliente", async () => {
    const cdmx = await weekly(adminCdmx, DAY_CDMX);
    expectStatus(cdmx, 200, "weekly CDMX");
    assert.equal(cdmx.body?.range?.timezone, CDMX);

    const tijuana = await weekly(adminTijuana, DAY_CDMX);
    expectStatus(tijuana, 200, "weekly Tijuana");
    assert.equal(tijuana.body?.range?.timezone, TIJUANA);
  });
});
