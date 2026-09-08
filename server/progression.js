export const thresholds = [0, 200, 500, 1000, 2000];
export function forestFromPoints(points) {
  const forestLevel = thresholds.filter((t) => points >= t).length;
  const floor = thresholds[forestLevel - 1];
  const nextLevelPoints = thresholds[forestLevel] ?? null;
  return {
    forestLevel,
    growthPoints: points,
    nextLevelPoints,
    forestProgress: nextLevelPoints
      ? Math.floor(((points - floor) / (nextLevelPoints - floor)) * 100)
      : 100,
    treesUnlocked: points === 0 ? 0 : Math.min(80, 1 + Math.floor(points / 40)),
    wildlifeUnlocked: Math.min(12, Math.floor(points / 200)),
  };
}
export const badgeRules = [
  [
    "first-seed",
    "First Seed",
    "Complete your first challenge",
    (s) => s.actions >= 1,
  ],
  [
    "growing-strong",
    "Growing Strong",
    "Earn 500 points",
    (s) => s.points >= 500,
  ],
  [
    "forest-keeper",
    "Forest Keeper",
    "Earn 1,000 points",
    (s) => s.points >= 1000,
  ],
  [
    "ecosystem-builder",
    "Ecosystem Builder",
    "Complete 20 actions",
    (s) => s.actions >= 20,
  ],
  [
    "planet-friend",
    "Planet Friend",
    "Earn 2,000 points",
    (s) => s.points >= 2000,
  ],
];
