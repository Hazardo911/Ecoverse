export const thresholds = (
  process.env.FOREST_THRESHOLDS || "0,200,500,1000,2000"
)
  .split(",")
  .map(Number);
if (
  thresholds.length !== 5 ||
  thresholds[0] !== 0 ||
  thresholds.some(
    (t, i) =>
      !Number.isInteger(t) || t < 0 || (i > 0 && t <= thresholds[i - 1]),
  )
)
  throw new Error(
    "FOREST_THRESHOLDS must contain five increasing integers starting at zero.",
  );
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
    "Your first approved challenge",
    (s) => s.actions >= 1,
  ],
  [
    "growing-strong",
    "Growing Strong",
    "Earn 500 verified Eco Points",
    (s) => s.points >= 500,
  ],
  [
    "forest-keeper",
    "Forest Keeper",
    "Earn 1,000 verified Eco Points",
    (s) => s.points >= 1000,
  ],
  [
    "ecosystem-builder",
    "Ecosystem Builder",
    "Have 20 challenges approved",
    (s) => s.actions >= 20,
  ],
  [
    "planet-friend",
    "Planet Friend",
    "Earn 2,000 verified Eco Points",
    (s) => s.points >= 2000,
  ],
  [
    "trust-keeper",
    "Trust Keeper",
    "Reach 90 trust with at least 20 approved actions",
    (s) => s.trust >= 90 && s.actions >= 20,
  ],
];
