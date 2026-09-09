import test from "node:test";
import assert from "node:assert/strict";
import { ecosystemGrowth, phase, treeGrowth } from "../js/ecosystem-growth.js";

test("ecological layers establish in a believable order", () => {
  const early = ecosystemGrowth(0.16);
  assert.ok(early.soil > early.understory);
  assert.equal(early.water, 0);
  assert.equal(early.wildlife, 0);
  const mature = ecosystemGrowth(1);
  for (const [key, value] of Object.entries(mature))
    if (key !== "seed") assert.equal(value, 1);
  assert.equal(mature.seed, 0);
});

test("trees grow upward before their crowns fill and emerge in cohorts", () => {
  const first = treeGrowth(0.32, 0, 40);
  const late = treeGrowth(0.32, 39, 40);
  assert.ok(first.height > first.width);
  assert.ok(first.height > late.height);
  assert.equal(late.visible, false);
  assert.deepEqual(treeGrowth(1, 39, 40), {
    visible: true,
    height: 1,
    width: 1,
    maturity: 1,
  });
});

test("phase easing clamps and has no abrupt endpoints", () => {
  assert.equal(phase(-1, 0.2, 0.6), 0);
  assert.equal(phase(1, 0.2, 0.6), 1);
  assert.ok(phase(0.4, 0.2, 0.6) > 0.49);
});
