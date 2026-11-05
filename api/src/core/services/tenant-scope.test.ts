import { test } from "node:test";
import assert from "node:assert/strict";
import { scopedObjectKey, tenantStoragePrefix } from "./storage";
import { tenantChannel, userChannel } from "./ably";

test("storage: las claves quedan bajo tenant/<id>/", () => {
  assert.equal(tenantStoragePrefix("t1"), "tenant/t1/");
  assert.equal(scopedObjectKey("hr/u1/photo/x.jpg", "t1"), "tenant/t1/hr/u1/photo/x.jpg");
  assert.equal(scopedObjectKey("/hr/u1/photo/x.jpg", "t1"), "tenant/t1/hr/u1/photo/x.jpg");
});

test("storage: el prefijo es idempotente y no se duplica", () => {
  const key = "tenant/t1/hr/u1/photo/x.jpg";
  assert.equal(scopedObjectKey(key, "t1"), key);
  // Una clave de OTRO cliente no puede leerse con el contexto actual.
  assert.equal(scopedObjectKey(key, "t2"), "tenant/t2/tenant/t1/hr/u1/photo/x.jpg");
});

test("storage: sin contexto de cliente no se prefija (objetos históricos)", () => {
  assert.equal(tenantStoragePrefix(null), null);
  assert.equal(scopedObjectKey("hr/u1/photo/x.jpg", null), "hr/u1/photo/x.jpg");
});

test("ably: canales con espacio de nombres por cliente", () => {
  assert.equal(tenantChannel("t1", "user:u1"), "tenant:t1:user:u1");
  assert.equal(tenantChannel("t1", "broadcast"), "tenant:t1:broadcast");
  assert.equal(userChannel("u1"), "user:u1");
});
