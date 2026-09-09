import "./shell.js";
import { api, escapeHTML as esc, errorState } from "./api.js";
import { activityList, badgeList } from "./verification-ui.js";
import { createWorld } from "./world.js";
import gsap from "gsap";
const root = document.querySelector("#dashboard-content");
try {
  const [u, s] = await Promise.all([
    api("/user/profile"),
    api("/user/progress"),
  ]);
  root.innerHTML = `<header class="dashboard-heading"><div><p class="eyebrow">YOUR VERIFIED JOURNEY</p><h1>A little more life,<br><em>${esc(u.name.split(" ")[0])}.</em></h1></div><a class="button button-dark" href="challenges.html">Find your next action ↗</a></header><div class="dashboard-landscape"><div class="dashboard-world"><canvas id="dashboard-world" aria-label="Your forest, based on approved activity"></canvas><div class="landscape-label"><span class="eyebrow">YOUR ECOSYSTEM / LEVEL ${s.forestLevel}</span><h2>${s.forestName}</h2><a href="forest.html" class="text-link">Step inside ↗</a></div></div><section class="journey-score"><p class="eyebrow">GROWTH YOU CAN TRACE</p><div class="score-number" data-count="${s.ecoPoints}">${s.ecoPoints}</div><p>verified Eco Points</p><div class="progress-track" role="progressbar" aria-label="Progress to next forest level" aria-valuenow="${s.forestProgress}" aria-valuemin="0" aria-valuemax="100"><i style="transform:scaleX(${s.forestProgress / 100})"></i></div><p>${s.nextLevelPoints ? `${s.nextLevelPoints - s.ecoPoints} points to the next stage` : "Living ecosystem unlocked"}</p><dl class="fact-list"><div><dt>Eco Score</dt><dd>${s.ecoScore}/100</dd></div><div><dt>Verified actions</dt><dd>${s.verifiedActions}</dd></div><div><dt>Global rank</dt><dd>${s.leaderboardRank ? "#" + s.leaderboardRank : "Not ranked yet"}</dd></div></dl></section></div><section class="trust-strip"><div><p class="eyebrow">TRUST SCORE</p><strong>${s.trustScore}%</strong></div><div><h3>${s.requiresExtraReview ? "A fresh start is always possible." : "Build trust, one honest action at a time."}</h3><p>${esc(s.trustExplanation)}</p></div></section><div class="dashboard-columns"><section><div class="section-top"><h2>Your field notes</h2><a class="text-link" href="journey.html">Goals & journal ↗</a></div><div class="workflow-counts"><span><strong>${s.activeChallenges}</strong> in progress</span><span><strong>${s.pendingVerification}</strong> awaiting review</span><span><strong>${s.rejectedSubmissions}</strong> to revisit</span></div>${activityList(s.activity.slice(0, 12))}</section><section><h2>Milestones</h2>${badgeList(s.badges)}<p class="field-note">Quiz badges celebrate learning. They never add verified-action points.</p>${s.legacyActions ? `<p class="notice">${s.legacyActions} earlier self-reported actions remain archived locally. They do not count as verified progress.</p>` : ""}</section></div>`;
  const world = createWorld(root.querySelector("#dashboard-world"), {
    growth: s.visualGrowth,
    treeLimit: s.treesUnlocked,
    wildlifeLimit: s.wildlifeUnlocked,
  });
  if (!world) root.querySelector(".dashboard-world").classList.add("no-webgl");
  addEventListener("pagehide", () => world?.destroy(), { once: true });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const value = { n: 0 };
    gsap.to(value, {
      n: s.ecoPoints,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () =>
        (root.querySelector("[data-count]").textContent = Math.round(
          value.n,
        ).toLocaleString()),
    });
  }
} catch (e) {
  errorState(root, e);
}
