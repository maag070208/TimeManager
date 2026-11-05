/**
 * Precedencia y seguridad de la estación de huellas (F1B-12):
 * override del cliente → default de plataforma → `.env`; la contraseña se
 * guarda cifrada y nunca se devuelve.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-station-secret";

type Row = { id: string; tenantId: string | null; url: string; username: string; passwordEncrypted: string };

const loadService = () => import("./fingerprint-station.service");
const loadCrypto = () => import("@core/utils/crypto");

const makeDb = (rows: Row[]) => ({
  fingerprintStationConfig: {
    findFirst: async ({ where }: { where: { tenantId: string | null } }) =>
      rows.find((row) => row.tenantId === where.tenantId) ?? null,
    deleteMany: async ({ where }: { where: { tenantId: string | null } }) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].tenantId === where.tenantId) rows.splice(i, 1);
      return { count: 1 };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
    create: async ({ data }: { data: Row }) => {
      rows.push(data);
      return data;
    },
  },
  tenant: { findUnique: async () => ({ id: "tenant-1" }) },
});

test("precedencia: override del cliente > plataforma > .env", async () => {
  const { FingerprintStationService } = await loadService();
  const { encryptSecret } = await loadCrypto();

  process.env.FINGERPRINT_STATION_URL = "http://env:8080";
  process.env.FINGERPRINT_STATION_USER = "env-user";
  process.env.FINGERPRINT_STATION_PASS = "env-pass";

  const rows: Row[] = [
    {
      id: "platform",
      tenantId: null,
      url: "http://central:8080",
      username: "central",
      passwordEncrypted: encryptSecret("central-pass"),
    },
    {
      id: "tenant",
      tenantId: "tenant-1",
      url: "http://sitio:8080",
      username: "sitio",
      passwordEncrypted: encryptSecret("sitio-pass"),
    },
  ];
  const service = new FingerprintStationService(makeDb(rows) as never);

  const own = await service.resolve("tenant-1");
  assert.equal(own?.url, "http://sitio:8080");
  assert.equal(own?.pass, "sitio-pass");

  const other = await service.resolve("tenant-2");
  assert.equal(other?.url, "http://central:8080");
  assert.equal(other?.pass, "central-pass");

  rows.length = 0;
  const env = await service.resolve("tenant-1");
  assert.equal(env?.url, "http://env:8080");
  assert.equal(env?.pass, "env-pass");
});

test("info no devuelve la contraseña y reporta el origen", async () => {
  const { FingerprintStationService } = await loadService();
  const { encryptSecret } = await loadCrypto();

  const db = makeDb([
    {
      id: "platform",
      tenantId: null,
      url: "http://central:8080",
      username: "central",
      passwordEncrypted: encryptSecret("central-pass"),
    },
  ]);
  const service = new FingerprintStationService(db as never);
  const info = await service.info("tenant-1");
  assert.equal(info.source, "platform");
  assert.equal(info.hasPassword, true);
  assert.equal(JSON.stringify(info).includes("central-pass"), false);
});

test("guardar cifra la contraseña y exige contraseña al crear", async () => {
  const { FingerprintStationService } = await loadService();
  const { decryptSecret } = await loadCrypto();
  const rows: Row[] = [];
  const service = new FingerprintStationService(makeDb(rows) as never);

  const isCode = (code: string) => (error: unknown): boolean =>
    (error as { code?: string }).code === code;
  await assert.rejects(
    service.save({ url: "http://sitio:8080", username: "admin" }, "actor"),
    isCode("FINGERPRINT_STATION_PASSWORD_REQUIRED")
  );

  const info = await service.save(
    { url: "http://sitio:8080", username: "admin", password: "mi-pass" },
    "actor"
  );
  assert.equal(info.source, "platform");
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].passwordEncrypted, "mi-pass");
  assert.equal(decryptSecret(rows[0].passwordEncrypted), "mi-pass");
  assert.equal(JSON.stringify(info).includes("mi-pass"), false);

  await assert.rejects(
    service.save({ url: "ftp://sitio", username: "admin", password: "x" }, "actor"),
    isCode("FINGERPRINT_STATION_INVALID_URL")
  );
});
