/**
 * Filtros de columna aplicados a tablas server-side (EMP-01 lista de Personal,
 * AUD-01 bitácora, CLK-01 checadas): pie de filtros del PDF/export.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { appliedFilters } from "./tableFilters.ts";

const t = (key: string): string => key.toUpperCase();
const label = (key: string): string => key;

test("[EMP-01] appliedFilters conserva solo filtros con etiqueta y valor", () => {
  const filters = {
    name: "ana",
    status: "",
    empty: null,
    untranslated: "x",
  } as unknown as Parameters<typeof appliedFilters>[0];
  const rows = appliedFilters(filters, { name: "columns.name" }, t);
  assert.deepEqual(rows, [{ label: "COLUMNS.NAME", value: "ana" }]);
});

test("[EMP-01] appliedFilters formatea fechas y rangos como dd/mm/aaaa", () => {
  const filters = {
    date: new Date("2026-11-05T15:00:00"),
    range: [new Date("2026-11-01T12:00:00"), new Date("2026-11-15T12:00:00")],
  } as unknown as Parameters<typeof appliedFilters>[0];
  const rows = appliedFilters(filters, { date: "columns.date", range: "columns.range" }, t);
  assert.deepEqual(rows, [
    { label: "COLUMNS.DATE", value: "05/11/2026" },
    { label: "COLUMNS.RANGE", value: "01/11/2026 – 15/11/2026" },
  ]);
});

test("[AUD-01] appliedFilters traduce enums con translateValue", () => {
  const rows = appliedFilters({ action: "USER_CREATED" }, { action: "columns.action" }, t, {
    translateValue: (key, value) => `${key}:${value}`,
  });
  assert.deepEqual(rows, [{ label: "COLUMNS.ACTION", value: "action:USER_CREATED" }]);
});

test("[CLK-01] appliedFilters resuelve ids de catálogo con su nombre", () => {
  const rows = appliedFilters({ clock: "7" }, { clock: "columns.clock" }, t, {
    catalogs: { clock: [{ id: 7, name: "Entrada principal" }, { id: 9, name: "Bodega" }] },
  });
  assert.deepEqual(rows, [{ label: "COLUMNS.CLOCK", value: "Entrada principal" }]);
});

test("[EMP-01] appliedFilters cae al valor crudo si no hay catálogo ni traductor", () => {
  const rows = appliedFilters({ zone: "norte" }, { zone: "columns.zone" }, label);
  assert.deepEqual(rows, [{ label: "columns.zone", value: "norte" }]);
});
