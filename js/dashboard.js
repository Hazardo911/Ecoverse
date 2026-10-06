import "./shell.js";
import { api, escapeHTML as esc, errorState } from "./api.js";
import { activityList, badgeList } from "./verification-ui.js";
import { createWorld } from "./world.js";
import gsap from "gsap";
const root = document.querySelector("#dashboard-content");
try {
  const [u, s, board] = await Promise.all([
    api("/user/profile"),
    api("/user/progress"),
    api("/leaderboard?period=global").catch(() => []),
  ]);
  root.innerHTML = `<header class="dashboard-heading"><div><p class="eyebrow">YOUR VERIFIED JOURNEY</p><h1>A little more life,<br><em>${esc(u.name.split(" ")[0])}.</em></h1></div><a class="button button-dark" href="challenges.html">Find your next action ↗</a></header><div class="dashboard-landscape"><div class="dashboard-world"><canvas id="dashboard-world" aria-label="Your forest, based on approved activity"></canvas><div class="landscape-label"><span class="eyebrow">YOUR ECOSYSTEM / LEVEL ${s.forestLevel}</span><h2>${s.forestName}</h2><a href="forest.html" class="text-link">Step inside ↗</a></div></div><section class="journey-score"><p class="eyebrow">GROWTH YOU CAN TRACE</p><div class="score-number" data-count="${s.ecoPoints}">${s.ecoPoints}</div><p>verified Eco Points</p><div class="progress-track" role="progressbar" aria-label="Progress to next forest level" aria-valuenow="${s.forestProgress}" aria-valuemin="0" aria-valuemax="100"><i style="transform:scaleX(${s.forestProgress / 100})"></i></div><p>${s.nextLevelPoints ? `${s.nextLevelPoints - s.ecoPoints} points to the next stage` : "Living ecosystem unlocked"}</p><dl class="fact-list"><div><dt>Eco Score</dt><dd>${s.ecoScore}/100</dd></div><div><dt>Verified actions</dt><dd>${s.verifiedActions}</dd></div><div><dt>Global rank</dt><dd>${s.leaderboardRank ? "#" + s.leaderboardRank : "Not ranked yet"}</dd></div></dl></section></div><section class="trust-strip"><div><p class="eyebrow">TRUST SCORE</p><strong>${s.trustScore}%</strong></div><div><h3>${s.requiresExtraReview ? "A fresh start is always possible." : "Build trust, one honest action at a time."}</h3><p>${esc(s.trustExplanation)}</p></div></section><div class="dashboard-columns"><section><div class="section-top"><h2>Your field notes</h2><a class="text-link" href="journey.html">Goals & journal ↗</a></div><div class="workflow-counts"><span><strong>${s.activeChallenges}</strong> in progress</span><span><strong>${s.pendingVerification}</strong> awaiting review</span><span><strong>${s.rejectedSubmissions}</strong> to revisit</span></div>${activityList(s.activity.slice(0, 12))}</section><section><h2>Milestones</h2>${badgeList(s.badges)}<p class="field-note">Quiz badges celebrate learning. They never add verified-action points.</p>${s.legacyActions ? `<p class="notice">${s.legacyActions} earlier self-reported actions remain archived locally. They do not count as verified progress.</p>` : ""}</section></div>`;
  if (s.recommendations?.length) {
    root.insertAdjacentHTML("beforeend", `<section class="recommendation-panel"><div class="section-top"><div><p class="eyebrow">YOUR NEXT BEST STEPS</p><h2>Keep your ecosystem balanced.</h2></div><a class="text-link" href="challenges.html">Browse challenges</a></div><div class="recommendation-grid">${s.recommendations.map((r) => `<article><span class="category-tag">${esc(r.category)}</span><h3>${esc(r.title)}</h3><p>${esc(r.reason)}</p><a class="button button-outline-dark" href="challenges.html">Explore ${esc(r.category)}</a></article>`).join("")}</div></section>`);
  }
  if (s.worldHealth) {
    const regions = [["Forest", "nature"], ["Water", "water"], ["Biodiversity", "nature"], ["Waste", "waste"], ["Energy", "energy"], ["Mobility", "transport"]];
    root.insertAdjacentHTML("beforeend", `<section class="world-status"><div class="section-top"><div><p class="eyebrow">WORLD STATUS</p><h2>The parts of your world that are growing.</h2></div>${s.nextExpedition ? `<a class="button button-dark" href="challenges.html">Begin ${esc(s.nextExpedition.title)}</a>` : ""}</div><div class="world-health-grid">${regions.map(([label, key]) => `<div><div><span>${label}</span><strong>${s.worldHealth[key] || 0}%</strong></div><div class="health-track"><i style="transform:scaleX(${(s.worldHealth[key] || 0) / 100})"></i></div></div>`).join("")}</div>${s.worldEvents?.length ? `<div class="world-events"><p class="eyebrow">RECENT WORLD EVENTS</p>${s.worldEvents.slice(-3).map((event) => `<article><strong>${esc(event.title)}</strong><span>${esc(event.description)}</span></article>`).join("")}</div>` : ""}</section>`);
  }
  const leaders = (board || []).slice(0, 5);
  root.insertAdjacentHTML("beforeend", `<section class="progress-hub"><div class="hub-achievements"><div class="section-top"><div><p class="eyebrow">ACHIEVEMENTS</p><h2>Your collection</h2></div><a class="text-link" href="profile.html">View all</a></div><div class="achievement-row">${s.badges?.slice(0, 5).map((badge) => `<span title="${esc(badge.description)}">${esc(badge.name)}</span>`).join("") || '<span class="locked-achievement">Your first approved action unlocks a badge.</span>'}</div></div><div class="hub-leaderboard"><div class="section-top"><div><p class="eyebrow">COMMUNITY PULSE</p><h2>Leaderboard</h2></div><a class="text-link" href="community.html">Connect</a></div><div class="leaderboard-preview">${leaders.length ? leaders.map((leader, index) => `<div><b>${index + 1}</b><span>${esc(leader.name)}</span><strong>${Number(leader.points).toLocaleString()} EP</strong></div>`).join("") : '<p class="field-note">Complete a verified action to enter the community leaderboard.</p>'}</div></div></section>`);
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
