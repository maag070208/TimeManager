import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPlansFixture } from "./fixtures";

test("los planes de arranque son 500/750/1000 personas y 1/2/3 relojes", () => {
  const plans = loadPlansFixture();
  assert.equal(plans.length, 3);
  assert.deepEqual(
    plans.map((plan) => [plan.key, plan.employeeLimit, plan.clockLimit, plan.monthlyPrice]),
    [
      ["PLAN_500", 500, 1, "500.00"],
      ["PLAN_750", 750, 2, "750.00"],
      ["PLAN_1000", 1000, 3, "1000.00"],
    ]
  );
  assert.equal(new Set(plans.map((plan) => plan.id)).size, 3);
  assert.ok(plans.every((plan) => plan.active));
});

test("los planes se pueden ordenar en la consola", () => {
  const orders = loadPlansFixture()
    .map((plan) => plan.sortOrder)
    .sort((a, b) => a - b);
  assert.deepEqual(orders, [1, 2, 3]);
});
