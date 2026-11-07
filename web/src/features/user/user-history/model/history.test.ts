/**
 * Historial de la cuenta del empleado (EMP-07): familias de eventos, orden,
 * totales y días con actividad.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_FAMILIES, dayKey, familyOf, historyStats } from "./history.ts";
import type { HistoryEntry } from "./types.ts";

const entry = (type: string, timestamp: string): HistoryEntry =>
  ({ id: `${type}-${timestamp}`, type, timestamp, actor: null, detail: null }) as unknown as HistoryEntry;

test("[EMP-07] familyOf mapea los eventos de cuenta y manda lo desconocido a other", () => {
  assert.equal(familyOf("USER_DEACTIVATED"), "account");
  assert.equal(familyOf("USER_REACTIVATED"), "account");
  assert.equal(familyOf("ALGO_NUEVO"), "other");
  assert.deepEqual(HISTORY_FAMILIES, ["account", "other"]);
});

test("[EMP-07] dayKey agrupa por día local sin correrse de zona", () => {
  assert.equal(dayKey(new Date(2026, 10, 5, 23, 30).toISOString()), "2026-11-5");
  assert.equal(dayKey(new Date(2026, 10, 6, 0, 30).toISOString()), "2026-11-6");
});

test("[EMP-07] historyStats ordena del más reciente al más viejo y cuenta familias", () => {
  const stats = historyStats([
    entry("USER_DEACTIVATED", "2026-11-05T10:00:00.000Z"),
    entry("USER_REACTIVATED", "2026-11-07T10:00:00.000Z"),
    entry("ALGO_NUEVO", "2026-11-05T18:00:00.000Z"),
  ]);
  assert.deepEqual(
    stats.sorted.map((item) => item.timestamp),
    ["2026-11-07T10:00:00.000Z", "2026-11-05T18:00:00.000Z", "2026-11-05T10:00:00.000Z"]
  );
  assert.deepEqual(stats.counts, { account: 2, other: 1 });
  assert.equal(stats.days, 2, "5 y 7 de noviembre (hora local), 2 días");
  assert.equal(stats.newest?.timestamp, "2026-11-07T10:00:00.000Z");
  assert.equal(stats.oldest?.timestamp, "2026-11-05T10:00:00.000Z");
});

test("[EMP-07] historyStats con historial vacío no inventa extremos", () => {
  const stats = historyStats([]);
  assert.deepEqual(stats.counts, { account: 0, other: 0 });
  assert.equal(stats.days, 0);
  assert.equal(stats.newest, null);
  assert.equal(stats.oldest, null);
});
