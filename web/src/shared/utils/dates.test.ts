/**
 * Formatos de fecha/hora (CLK-02 entradas y salidas, SET-01 zona horaria del
 * cliente, PAY-01 horas de pre-nómina). Todo con fechas locales o zonas fijas
 * para no depender de la TZ de la máquina que corre las pruebas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateAtNoonFromKey,
  dateKeyInTimeZone,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatMinutesAsHhMm,
  formatTimeInTZ,
} from "./dates.ts";

test("[CLK-02] formatDate deja DD/MM/AAAA (o vacío sin fecha)", () => {
  assert.equal(formatDate("2026-11-05T15:04:00"), "05/11/2026");
  assert.equal(formatDate("2026-01-09T00:05:00"), "09/01/2026");
  assert.equal(formatDate(""), "");
});

test("[CLK-02] formatDateTime agrega HH:mm local y rellena con ceros", () => {
  assert.equal(formatDateTime("2026-11-05T09:07:00"), "05/11/2026 09:07");
  assert.equal(formatDateTime("2026-03-01T23:59:00"), "01/03/2026 23:59");
  assert.equal(formatDateTime(""), "");
});

test("[SET-01] formatTimeInTZ respeta la zona del cliente (h23, sin 24:00)", () => {
  assert.equal(formatTimeInTZ("2026-11-05T22:30:00Z", "America/Mexico_City"), "16:30");
  assert.equal(formatTimeInTZ("2026-11-05T00:00:00Z", "America/Mexico_City"), "18:00");
  assert.equal(formatTimeInTZ("2026-01-10T04:59:00Z", "America/Mexico_City"), "22:59");
});

test("[SET-01] dateKeyInTimeZone usa el día del cliente, no el del navegador", () => {
  const lateNightUtc = new Date("2026-11-06T02:30:00Z");
  assert.equal(dateKeyInTimeZone(lateNightUtc, "America/Mexico_City"), "2026-11-05");
  assert.equal(dateKeyInTimeZone(lateNightUtc, "UTC"), "2026-11-06");
});

test("[SET-01] dateKeyInTimeZone cae a la zona local con TZ inválida o sin TZ", () => {
  const localDate = new Date(2026, 10, 5, 12, 0, 0);
  const expected = "2026-11-05";
  assert.equal(dateKeyInTimeZone(localDate), expected);
  assert.equal(dateKeyInTimeZone(localDate, "Zona/Inventada"), expected);
});

test("[SET-01] dateAtNoonFromKey devuelve mediodía local del día pedido", () => {
  const date = dateAtNoonFromKey("2026-11-05");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 10);
  assert.equal(date.getDate(), 5);
  assert.equal(date.getHours(), 12);
});

test("[PAY-01] formatMinutesAsHhMm convierte minutos a hh:mm", () => {
  assert.equal(formatMinutesAsHhMm(0), "00:00");
  assert.equal(formatMinutesAsHhMm(59), "00:59");
  assert.equal(formatMinutesAsHhMm(60), "01:00");
  assert.equal(formatMinutesAsHhMm(135), "02:15");
  assert.equal(formatMinutesAsHhMm(1440), "24:00");
});

test("[PAY-01] formatMinutesAsHhMm redondea y no baja de cero", () => {
  assert.equal(formatMinutesAsHhMm(90.4), "01:30");
  assert.equal(formatMinutesAsHhMm(90.5), "01:31");
  assert.equal(formatMinutesAsHhMm(-30), "00:00");
});

test("[NOM-01] formatLongDate arma la fecha larga en es/en", () => {
  const date = new Date(2026, 10, 5, 12, 0, 0);
  assert.match(formatLongDate(date, "es-MX"), /jueves 5 de noviembre/i);
  assert.match(formatLongDate(date, "en-US"), /Thursday, November 5/i);
});
