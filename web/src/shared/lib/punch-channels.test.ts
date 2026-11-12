/**
 * Canales de checada por cliente (helper compartido por la consola de
 * plataforma y las vistas del cliente).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PUNCH_CHANNELS, hasPunchChannel, punchChannelsOf } from "./punch-channels.ts";

test("[CANALES] punchChannelsOf normaliza y cae al default web+app", () => {
  assert.deepEqual(punchChannelsOf(undefined), ["WEB", "APP"]);
  assert.deepEqual(punchChannelsOf(null), ["WEB", "APP"]);
  assert.deepEqual(punchChannelsOf([]), ["WEB", "APP"]);
  assert.deepEqual(punchChannelsOf(["CLOCK"]), ["CLOCK"]);
  assert.deepEqual(punchChannelsOf(["WEB", "APP", "CLOCK"]), ["WEB", "APP", "CLOCK"]);
  // Un valor desconocido (API más nueva) no rompe la vista.
  assert.deepEqual(punchChannelsOf(["WEB", "OTRO", "CLOCK"]), ["WEB", "CLOCK"]);
  assert.deepEqual([...DEFAULT_PUNCH_CHANNELS], ["WEB", "APP"]);
});

test("[CANALES] hasPunchChannel responde por canal", () => {
  assert.equal(hasPunchChannel(["WEB", "APP"], "CLOCK"), false);
  assert.equal(hasPunchChannel(["CLOCK"], "CLOCK"), true);
  // Sesión sin canales (login antes de /auth/me): se comporta como web+app.
  assert.equal(hasPunchChannel(undefined, "WEB"), true);
  assert.equal(hasPunchChannel(undefined, "CLOCK"), false);
});
