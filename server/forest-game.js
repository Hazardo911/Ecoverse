const today = (now = new Date()) => now.toISOString().slice(0, 10);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const species = {
  oak: { name: "Native oak", water: 2, biodiversity: 8, icon: "♣" },
  birch: { name: "Silver birch", water: 1, biodiversity: 5, icon: "♠" },
  willow: { name: "River willow", water: 3, biodiversity: 10, icon: "❧" },
};

export function createForestGame(progress, now = new Date()) {
  return {
    day: today(now),
    resources: {
      seeds: clamp(1 + progress.treesUnlocked, 2, 8),
      water: 8,
      energy: 6,
    },
    plots: Array.from({ length: 12 }, (_, id) => ({ id, zone: id < 6 ? 1 : id < 9 ? 2 : 3 })),
    actions: 0,
    event: null,
    rescued: 0,
  };
}

function refreshDay(game, now) {
  if (game.day === today(now)) return;
  game.day = today(now);
  game.resources.water = 8;
  game.resources.energy = 6;
  game.resources.seeds = clamp(game.resources.seeds + 2, 0, 8);
  game.actionsToday = 0;
  for (const plot of game.plots) {
    if (!plot.species) continue;
    plot.water = clamp((plot.water || 0) - 1, 0, 3);
    plot.weeds = clamp((plot.weeds || 0) + 1, 0, 3);
    plot.age = (plot.age || 0) + 1;
  }
}

export function gameView(game, progress, now = new Date()) {
  refreshDay(game, now);
  const zone = clamp(progress.forestLevel, 1, 3),
    planted = game.plots.filter((p) => p.species),
    healthy = planted.filter((p) => p.water >= 1 && p.weeds <= 1).length,
    water = planted.length ? Math.round(planted.reduce((n, p) => n + (p.water || 0), 0) / (planted.length * 3) * 100) : 100,
    soil = planted.length ? Math.round(planted.reduce((n, p) => n + (3 - (p.weeds || 0)), 0) / (planted.length * 3) * 100) : 72,
    biodiversity = clamp(planted.reduce((n, p) => n + species[p.species].biodiversity, 0) + game.rescued * 4, 0, 100),
    pollution = clamp(28 - game.rescued * 5 - healthy * 2 + (game.event ? 12 : 0), 0, 100),
    habitat = Math.round((water + soil + biodiversity + (100 - pollution)) / 4),
    wildlife = [
      { name: "Meadow butterflies", icon: "🦋", unlocked: biodiversity >= 15 },
      { name: "Woodland birds", icon: "🐦", unlocked: biodiversity >= 30 && water >= 55 },
      { name: "Red squirrel", icon: "🐿", unlocked: biodiversity >= 55 && habitat >= 60 },
      { name: "River otter", icon: "◉", unlocked: zone >= 3 && water >= 80 && pollution <= 10 },
    ];
  return {
    ...game,
    unlockedZone: zone,
    health: { water, soil, biodiversity, pollution, habitat },
    wildlife,
    species,
    daily: {
      plant: { current: Math.min(1, planted.filter((p) => p.plantedDay === game.day).length), target: 1 },
      care: { current: Math.min(3, game.actionsToday || 0), target: 3 },
      rescue: { current: game.rescueDay === game.day ? 1 : 0, target: 1 },
    },
  };
}

export function playForestAction(game, progress, input, now = new Date()) {
  refreshDay(game, now);
  const plot = game.plots.find((p) => p.id === input.plot);
  if (!plot) throw Object.assign(new Error("Forest plot not found."), { status: 404 });
  if (plot.zone > clamp(progress.forestLevel, 1, 3))
    throw Object.assign(new Error("Grow your forest level to unlock this habitat."), { status: 409 });
  if (input.action === "plant") {
    if (plot.species) throw Object.assign(new Error("This plot is already planted."), { status: 409 });
    if (!species[input.species]) throw Object.assign(new Error("Choose a valid native species."), { status: 400 });
    if (game.resources.seeds < 1 || game.resources.energy < 1)
      throw Object.assign(new Error("You need one seed and one energy."), { status: 409 });
    game.resources.seeds--; game.resources.energy--;
    Object.assign(plot, { species: input.species, plantedDay: game.day, age: 0, water: 1, weeds: 0 });
  } else if (input.action === "water") {
    if (!plot.species) throw Object.assign(new Error("Plant this plot first."), { status: 409 });
    if (game.resources.water < species[plot.species].water)
      throw Object.assign(new Error("Not enough water. It refills tomorrow."), { status: 409 });
    game.resources.water -= species[plot.species].water;
    plot.water = clamp((plot.water || 0) + 1, 0, 3);
  } else if (input.action === "weed") {
    if (!plot.species) throw Object.assign(new Error("Plant this plot first."), { status: 409 });
    if (game.resources.energy < 1) throw Object.assign(new Error("Your energy refills tomorrow."), { status: 409 });
    game.resources.energy--; plot.weeds = clamp((plot.weeds || 0) - 1, 0, 3);
  } else if (input.action === "rescue") {
    if (!game.event) throw Object.assign(new Error("Your forest is safe right now."), { status: 409 });
    const cost = game.event === "drought" ? "water" : "energy";
    if (game.resources[cost] < 2) throw Object.assign(new Error(`You need 2 ${cost} to complete this rescue.`), { status: 409 });
    game.resources[cost] -= 2; game.event = null; game.rescued++; game.rescueDay = game.day;
  }
  game.actions++;
  game.actionsToday = (game.actionsToday || 0) + 1;
  if (!game.event && game.actions % 5 === 0)
    game.event = ["drought", "litter", "pests"][game.actions % 3];
  return gameView(game, progress, now);
}
