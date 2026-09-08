import test from "node:test";
import assert from "node:assert/strict";
import { forestFromPoints, badgeRules } from "../server/progression.js";
test("progression handles each boundary and caps final level", () => {
  for (const [points, level] of [
    [0, 1],
    [199, 1],
    [200, 2],
    [499, 2],
    [500, 3],
    [999, 3],
    [1000, 4],
    [1999, 4],
    [2000, 5],
    [10000, 5],
  ])
    assert.equal(forestFromPoints(points).forestLevel, level);
  assert.equal(forestFromPoints(199).forestProgress, 99);
  assert.equal(forestFromPoints(2000).nextLevelPoints, null);
});
test("badge conditions have explicit thresholds", () => {
  assert.equal(
    badgeRules.filter((b) => b[3]({ points: 0, actions: 0 })).length,
    0,
  );
  assert.equal(
    badgeRules.filter((b) => b[3]({ points: 2000, actions: 20 })).length,
    5,
  );
});
