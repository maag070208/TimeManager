/**
 * Credencial del empleado (EMP-04): payload v2 del QR, DPI del PNG, medidas de
 * la tarjeta y fecha local de un acta (HR-03).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QR_PAYLOAD_VERSION,
  buildQrPayload,
  serializeQrPayload,
} from "./buildQrPayload.ts";
import { setPngDpi } from "./pngDpi.ts";
import {
  CREDENTIAL_ASPECT,
  CREDENTIAL_DPI,
  CREDENTIAL_H_PX,
  CREDENTIAL_W_PX,
  LAYOUT,
  PX_PER_CM,
} from "./cardSpec.ts";
import { localToDateStr } from "../../../features/hr/disciplinary-reports/model/dateStr.ts";
import type { PersonalProfile } from "@entities/hr";

const profile = (patch: Partial<PersonalProfile> = {}): PersonalProfile =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    name: "María G. Hernández",
    employeeNumber: "1234",
    jobTitle: "Recepcionista",
    department: { id: "d1", name: "Recepción" },
    ...patch,
  }) as unknown as PersonalProfile;

test("[EMP-04] buildQrPayload arma el esquema v2 y recorta campos opcionales", () => {
  const payload = buildQrPayload(
    profile({ employeeNumber: " 1234 ", name: " María G. Hernández ", jobTitle: " Recepcionista " })
  );
  assert.equal(payload.v, QR_PAYLOAD_VERSION);
  assert.equal(payload.v, 2);
  assert.equal(payload.id, "00000000-0000-0000-0000-000000000001");
  assert.equal(payload.no, "1234");
  assert.equal(payload.name, "María G. Hernández");
  assert.equal(payload.pos, "Recepcionista");
  assert.equal(payload.dept, "Recepción");
});

test("[EMP-04] buildQrPayload omite nulos y cadenas vacías", () => {
  const payload = buildQrPayload(
    profile({ employeeNumber: "", name: undefined, jobTitle: "  ", department: undefined })
  );
  assert.equal(payload.v, 2);
  assert.equal(payload.id, "00000000-0000-0000-0000-000000000001");
  assert.equal(payload.no, undefined);
  assert.equal(payload.name, undefined);
  assert.equal(payload.pos, undefined);
  assert.equal(payload.dept, undefined);
});

test("[EMP-04] serializeQrPayload es JSON estable y sin llaves vacías", () => {
  const withAll = serializeQrPayload(buildQrPayload(profile()));
  assert.equal(
    withAll,
    '{"v":2,"id":"00000000-0000-0000-0000-000000000001","no":"1234","name":"María G. Hernández","pos":"Recepcionista","dept":"Recepción"}'
  );
  const minimal = serializeQrPayload(buildQrPayload(profile({ employeeNumber: null, jobTitle: null })));
  assert.equal(JSON.parse(minimal).no, undefined);
  assert.equal(JSON.parse(minimal).pos, undefined);
});

const pngWithIhdr = (): Uint8Array => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrLength = [0, 0, 0, 13];
  const ihdrType = [0x49, 0x48, 0x44, 0x52];
  const ihdrData = new Array(13).fill(0);
  const crc = [0, 0, 0, 0];
  return new Uint8Array([...signature, ...ihdrLength, ...ihdrType, ...ihdrData, ...crc]);
};

test("[EMP-04] setPngDpi inserta el chunk pHYs con 300 DPI (px/metro)", () => {
  const png = pngWithIhdr();
  const output = setPngDpi(png, CREDENTIAL_DPI);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  assert.equal(output.length, png.length + 21, "chunk pHYs = 4 + 4 + 9 + 4");
  assert.equal(output[ihdrEnd], 0);
  assert.equal(output[ihdrEnd + 3], 9, "largo de datos = 9");
  assert.equal(String.fromCharCode(...output.slice(ihdrEnd + 4, ihdrEnd + 8)), "pHYs");
  const ppm = ((output[ihdrEnd + 8] << 24) | (output[ihdrEnd + 9] << 16) | (output[ihdrEnd + 10] << 8) | output[ihdrEnd + 11]) >>> 0;
  assert.equal(ppm, Math.round(300 / 0.0254));
  assert.equal(output[ihdrEnd + 16], 1, "unidad = metro");
});

test("[EMP-04] setPngDpi no toca bytes que no son PNG", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
  assert.equal(setPngDpi(jpeg, 300), jpeg);
});

test("[EMP-04] la tarjeta mide 8.6 × 5.4 cm a 300 DPI y el layout cabe", () => {
  assert.equal(CREDENTIAL_DPI, 300);
  assert.equal(CREDENTIAL_W_PX, 1016);
  assert.equal(CREDENTIAL_H_PX, 638);
  assert.ok(Math.abs(PX_PER_CM - 118.11) < 0.01);
  assert.ok(Math.abs(CREDENTIAL_ASPECT - 1016 / 638) < 1e-9);
  for (const [name, box] of Object.entries(LAYOUT)) {
    const item = box as Record<string, number>;
    if (item.x !== undefined && item.w !== undefined) {
      assert.ok(item.x + item.w <= CREDENTIAL_W_PX + 1, `${name} se sale a lo ancho`);
    }
    if (item.y !== undefined && item.h !== undefined) {
      assert.ok(item.y + item.h <= CREDENTIAL_H_PX + 1, `${name} se sale a lo alto`);
    }
  }
});

test("[HR-03] localToDateStr usa la fecha local del acta sin correrse por UTC", () => {
  assert.equal(localToDateStr(new Date(2026, 0, 1, 23, 30)), "2026-01-01");
  assert.equal(localToDateStr(new Date(2026, 10, 5, 0, 5)), "2026-11-05");
});
