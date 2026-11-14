import assert from "node:assert/strict";
import test from "node:test";
import { openLocation, sealLocation } from "./punch-location";

test("[NOM-GEO] sealLocation cifra y openLocation recupera las coordenadas", () => {
  const sealed = sealLocation({ latitude: 19.4326, longitude: -99.1332, gpsAccuracyMeters: 12 });
  assert.ok(sealed?.startsWith("enc:"));
  assert.ok(!sealed?.includes("19.4326"));
  assert.deepEqual(openLocation({ location: sealed }), { latitude: 19.4326, longitude: -99.1332, gpsAccuracyMeters: 12 });
});

test("[NOM-GEO] sin coordenadas no se guarda nada", () => {
  assert.equal(sealLocation({ latitude: null, longitude: null }), null);
  assert.equal(sealLocation({}), null);
  assert.equal(openLocation({ location: null, latitude: null, longitude: null }), null);
});

test("[NOM-GEO] marcajes anteriores al cifrado se leen de las columnas numéricas", () => {
  assert.deepEqual(openLocation({ location: null, latitude: 1, longitude: 2, gpsAccuracyMeters: null }), { latitude: 1, longitude: 2, gpsAccuracyMeters: null });
});

test("[NOM-GEO] un payload corrupto no rompe la lectura", () => {
  assert.equal(openLocation({ location: "no es json" }), null);
});
