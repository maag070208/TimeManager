import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTrail } from "./breadcrumb-trail";

const home = { key: "k1", path: "/home", label: "Inicio", trail: [] };

test("desde el inicio, el detalle muestra Inicio como migaja", () => {
  assert.deepEqual(
    nextTrail({ path: "/employees/9", navigation: "PUSH", state: null, remembered: undefined, previous: home }),
    [{ label: "Inicio", path: "/home" }]
  );
});

test("el menú y la carga directa usan las migajas fijas de la página", () => {
  assert.deepEqual(nextTrail({ path: "/employees", navigation: "PUSH", state: { menu: true }, remembered: undefined, previous: home }), []);
  assert.deepEqual(nextTrail({ path: "/employees", navigation: "POP", state: null, remembered: undefined, previous: null }), []);
});

test("la cadena crece al avanzar y se corta al volver a una página ya recorrida", () => {
  const list = { key: "k2", path: "/hr/time-clock/entries-exits?view=LATE", label: "Asistencias", trail: [{ label: "Inicio", path: "/home" }] };
  assert.deepEqual(nextTrail({ path: "/employees/9", navigation: "PUSH", state: null, remembered: undefined, previous: list }), [
    { label: "Inicio", path: "/home" },
    { label: "Asistencias", path: "/hr/time-clock/entries-exits?view=LATE" },
  ]);
  assert.deepEqual(nextTrail({ path: "/home", navigation: "PUSH", state: null, remembered: undefined, previous: list }), []);
});

test("atrás recupera la ruta guardada y reemplazar conserva la de la página", () => {
  const saved = [{ label: "Inicio", path: "/home" }];
  assert.deepEqual(nextTrail({ path: "/employees/9", navigation: "POP", state: null, remembered: saved, previous: home }), saved);
  const detail = { key: "k3", path: "/employees/9", label: "Karla", trail: saved };
  assert.deepEqual(nextTrail({ path: "/employees/9/account", navigation: "REPLACE", state: null, remembered: undefined, previous: detail }), saved);
});
