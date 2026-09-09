import test from "node:test";
import assert from "node:assert/strict";
import { createForestGame, gameView, playForestAction } from "../server/forest-game.js";

const progress = { forestLevel: 2, treesUnlocked: 3 };
test("forest game supports planting, care, habitat health and unlock zones", () => {
  const game = createForestGame(progress, new Date("2026-09-09T00:00:00Z"));
  let view = playForestAction(game, progress, { action: "plant", plot: 0, species: "oak" }, new Date("2026-09-09T01:00:00Z"));
  assert.equal(view.plots[0].species, "oak");
  assert.equal(view.unlockedZone, 2);
  assert.ok(view.health.biodiversity > 0);
  view = playForestAction(game, progress, { action: "water", plot: 0 }, new Date("2026-09-09T02:00:00Z"));
  assert.equal(view.plots[0].water, 2);
  assert.throws(() => playForestAction(game, progress, { action: "plant", plot: 10, species: "birch" }));
});

test("daily resources refresh while plants age and need care", () => {
  const game = createForestGame(progress, new Date("2026-09-08T00:00:00Z"));
  playForestAction(game, progress, { action: "plant", plot: 0, species: "birch" }, new Date("2026-09-08T01:00:00Z"));
  game.resources.water = 0;
  const view = gameView(game, progress, new Date("2026-09-09T01:00:00Z"));
  assert.equal(view.resources.water, 8);
  assert.equal(view.plots[0].age, 1);
  assert.equal(view.plots[0].water, 0);
  assert.equal(view.plots[0].weeds, 1);
});
