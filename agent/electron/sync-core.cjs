"use strict";

/**
 * Núcleo puro del agente: no toca ISAPI, red ni disco. Aquí vive lo que hay que
 * poder probar sin reloj: planear ventanas de consecutivos, normalizar eventos
 * ISAPI, deduplicar la cola local, avanzar el cursor y calcular backoff.
 *
 * El ciclo real (leer → encolar → subir chunks → jobs → heartbeat) está en
 * `agent-service.cjs` y usa estas funciones.
 */

/** `minor` ISAPI (major 5) → cómo se identificó al empleado (misma tabla que el API). */
const METHOD_BY_MINOR = { 1: "CARD", 38: "FINGERPRINT", 75: "FACE" };

/** Lo único que pide el agente al reloj: checadas válidas (tarjeta, huella, rostro). */
const PUNCH_MINORS = [1, 38, 75];

/** Consecutivos por ventana al leer el historial de un reloj. */
const WINDOW_SERIAL = 5000;

/** Decisión del 2026-11-05: chunks cada 15–30 s, configurable. */
const MIN_CHUNK_SECONDS = 15;
const MAX_CHUNK_SECONDS = 30;

/** Tope de checadas por request a `POST /agent/punches`. */
const MAX_PUNCHES_PER_CHUNK = 200;

/** Backoff de la cola local: 5 s, 10 s, 20 s… tope 5 min (mismo criterio que el API). */
const retryDelayMs = (attempts) =>
  Math.min(5000 * 2 ** Math.max(0, Number(attempts || 1) - 1), 300000);

const punchMethod = (minor) => METHOD_BY_MINOR[Number(minor)] ?? "OTHER";

/** Segundos de chunk dentro del rango permitido (15–30). */
const clampChunkSeconds = (value, fallback = 20) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(MAX_CHUNK_SECONDS, Math.max(MIN_CHUNK_SECONDS, Math.round(number)));
};

/** ¿Toca ya un nuevo chunk? `lastRunAt` en ms; sin corrida previa, sí. */
const chunkDue = (lastRunAt, now, seconds) => {
  if (!lastRunAt) return true;
  return now - Number(lastRunAt) >= clampChunkSeconds(seconds) * 1000;
};

/**
 * Ventanas de consecutivos a leer. `cursor` es el último consecutivo ya
 * procesado (inclusive): la primera ventana empieza en `cursor + 1`.
 */
const planWindows = (cursor, upTo, windowSize = WINDOW_SERIAL) => {
  const last = Math.floor(Number(upTo));
  let next = Math.max(1, Math.floor(Number(cursor) || 0) + 1);
  const windows = [];
  while (next <= last) {
    const end = Math.min(next + windowSize - 1, last);
    windows.push({ from: next, to: end });
    next = end + 1;
  }
  return windows;
};

/** Evento ISAPI → checada para el API; `null` si no es una checada válida. */
const toPunch = (event, clockSerial) => {
  const serialNo = Number(event && event.serialNo);
  const occurredAt = new Date(event && event.time);
  const employeeNumber = String((event && event.employeeNoString) || "").trim();
  if (!Number.isFinite(serialNo) || serialNo <= 0) return null;
  if (Number.isNaN(occurredAt.getTime())) return null;
  if (!employeeNumber) return null;
  return {
    clockSerial,
    serialNo,
    employeeNumber,
    name: String((event && event.name) || "").trim(),
    minor: Number(event && event.minor) || 0,
    occurredAt: occurredAt.toISOString(),
  };
};

const punchKey = (punch) => `${punch.clockSerial}:${punch.serialNo}`;

/** Une la cola persistida con lo recién leído sin duplicar (idempotencia local). */
const mergePunches = (queue, incoming) => {
  const byKey = new Map();
  for (const punch of queue || []) byKey.set(punchKey(punch), punch);
  let added = 0;
  for (const punch of incoming || []) {
    const key = punchKey(punch);
    if (!byKey.has(key)) {
      byKey.set(key, punch);
      added += 1;
    }
  }
  const merged = [...byKey.values()].sort(
    (a, b) =>
      Number(a.serialNo) - Number(b.serialNo) ||
      String(a.clockSerial).localeCompare(String(b.clockSerial))
  );
  return { queue: merged, added, duplicates: (incoming || []).length - added };
};

/** Siguiente lote a subir (tope por request) y lo que queda en cola. */
const takeBatch = (queue, max = MAX_PUNCHES_PER_CHUNK) => {
  const list = queue || [];
  return { batch: list.slice(0, max), rest: list.slice(max) };
};

/** Quita de la cola lo que el API confirmó, por su llave. */
const removeUploaded = (queue, uploaded) => {
  const done = new Set((uploaded || []).map(punchKey));
  return (queue || []).filter((punch) => !done.has(punchKey(punch)));
};

/**
 * Cursor monótono: nunca retrocede aunque el reloj se reinicie o el agente
 * reenvíe un chunk viejo.
 */
const nextCursor = (current, confirmed = 0, punches = []) => {
  let cursor = Math.max(Number(current) || 0, Number(confirmed) || 0);
  for (const punch of punches || []) cursor = Math.max(cursor, Number(punch.serialNo) || 0);
  return cursor;
};

/** ¿Toca pedir trabajos? */
const pollDue = (lastPollAt, now, seconds) => {
  if (!lastPollAt) return true;
  return now - Number(lastPollAt) >= Math.max(1, Number(seconds) || 5) * 1000;
};

/** ¿Toca mandar heartbeat? */
const heartbeatDue = (lastBeatAt, now, seconds) => {
  if (!lastBeatAt) return true;
  return now - Number(lastBeatAt) >= Math.max(5, Number(seconds) || 30) * 1000;
};

/** Resumen de la cola local para la UI. */
const summarizeQueue = (queue) => {
  const list = queue || [];
  const byClock = {};
  for (const punch of list) {
    byClock[punch.clockSerial] = (byClock[punch.clockSerial] || 0) + 1;
  }
  const serials = list.map((punch) => Number(punch.serialNo)).filter((n) => Number.isFinite(n));
  return {
    total: list.length,
    byClock,
    oldestSerialNo: serials.length ? Math.min(...serials) : null,
    newestSerialNo: serials.length ? Math.max(...serials) : null,
  };
};

module.exports = {
  METHOD_BY_MINOR,
  PUNCH_MINORS,
  WINDOW_SERIAL,
  MIN_CHUNK_SECONDS,
  MAX_CHUNK_SECONDS,
  MAX_PUNCHES_PER_CHUNK,
  retryDelayMs,
  punchMethod,
  clampChunkSeconds,
  chunkDue,
  planWindows,
  toPunch,
  punchKey,
  mergePunches,
  takeBatch,
  removeUploaded,
  nextCursor,
  pollDue,
  heartbeatDue,
  summarizeQueue,
};
