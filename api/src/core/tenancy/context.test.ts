import { test } from "node:test";
import assert from "node:assert/strict";
import { currentTenant, currentTenantId, requireTenantId, runWithTenant } from "./context";

test("el contexto se hereda a través de await y no se fuga afuera", async () => {
  const seen = await runWithTenant("tenant-a", async () => {
    await new Promise((r) => setTimeout(r, 1));
    return currentTenantId();
  });
  assert.equal(seen, "tenant-a");
  assert.equal(currentTenant(), null);
});

test("contextos simultáneos no se mezclan", async () => {
  const run = (id: string, ms: number) =>
    runWithTenant(id, async () => {
      await new Promise((r) => setTimeout(r, ms));
      return currentTenantId();
    });
  assert.deepEqual(await Promise.all([run("a", 5), run("b", 1)]), ["a", "b"]);
});

test("platform y requireTenantId", async () => {
  await runWithTenant(null, () => {
    assert.deepEqual(currentTenant(), { tenantId: null, platform: true });
    assert.throws(() => requireTenantId());
  }, true);
  assert.equal(await runWithTenant("t", () => requireTenantId()), "t");
});
