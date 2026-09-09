const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function phase(progress, start, end) {
  const x = clamp01((progress - start) / (end - start));
  return x * x * (3 - 2 * x);
}

// Independent ecological layers make the scene read as elapsed time instead of zoom.
export function ecosystemGrowth(progress) {
  const p = clamp01(progress);
  return {
    seed: 1 - phase(p, 0.03, 0.14),
    soil: phase(p, 0.02, 0.24),
    moss: phase(p, 0.08, 0.38),
    understory: phase(p, 0.18, 0.55),
    canopy: phase(p, 0.28, 0.82),
    background: phase(p, 0.42, 0.86),
    water: phase(p, 0.46, 0.68),
    wildlife: phase(p, 0.7, 0.94),
    atmosphere: phase(p, 0.76, 1),
  };
}

export function treeGrowth(progress, index, total = 46) {
  const stagger = total <= 1 ? 0 : index / (total - 1);
  const start = 0.12 + stagger * 0.38;
  const trunk = phase(progress, start, start + 0.24);
  const crown = phase(progress, start + 0.1, start + 0.44);
  return {
    visible: trunk > 0.002,
    height: 0.035 + trunk * 0.965,
    width: 0.025 + crown * 0.975,
    maturity: crown,
  };
}

