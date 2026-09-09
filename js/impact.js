import "./shell.js";
import { api, escapeHTML, errorState } from "./api.js";
const container = document.querySelector("#impact-content");
document
  .querySelector(".page-heading")
  .insertAdjacentHTML(
    "beforeend",
    '<a class="button button-dark" href="/api/user/report" download>Download impact report ↓</a><p class="field-note">A printable HTML report. Open it and choose Print → Save as PDF.</p>',
  );
try {
  const s = await api("/user/impact");
  const categories = [
    "energy",
    "water",
    "transport",
    "waste",
    "lifestyle",
    "nature",
  ];
  const counts = Object.fromEntries(
    s.categories.map((c) => [c.category, c.actions]),
  );
  const max = Math.max(1, ...s.categories.map((c) => c.actions));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      actions: s.activity.find((a) => a.date === date)?.actions || 0,
    };
  });
  const peak = Math.max(1, ...days.map((d) => d.actions));
  container.innerHTML = `<div class="impact-totals">${[
    ["Eco Points", s.ecoPoints],
    ["Verified actions", s.challengesCompleted],
    ["Trees unlocked", s.treesUnlocked],
    ["Eco Score", s.ecoScore + "/100"],
  ]
    .map(
      ([label, value]) =>
        `<article><strong>${value}</strong><span>${label}</span></article>`,
    )
    .join(
      "",
    )}</div><div class="impact-columns"><section><p class="eyebrow">YOUR HABITS / ALL TIME</p><h2>Where you make a difference.</h2>${categories.map((c) => `<div class="category-meter"><span>${c}</span><div><i style="transform:scaleX(${(counts[c] || 0) / max})"></i></div><strong>${counts[c] || 0}</strong></div>`).join("")}</section><section><p class="eyebrow">THE LAST SEVEN DAYS / UTC</p><h2>Consistency, made visible.</h2><div class="activity-chart">${days.map((d) => `<div><strong>${d.actions}</strong><i style="height:${Math.max(2, (d.actions / peak) * 160)}px"></i><span>${new Date(d.date + "T12:00:00Z").toLocaleDateString("en", { weekday: "short" })}</span></div>`).join("")}</div></section></div><aside class="measurement-note"><h3>Environmental impact: evidence, not exact measurement</h3><p>${escapeHTML(s.estimateNote)}</p></aside>`;
  if (s.estimates.length)
    container.insertAdjacentHTML(
      "beforeend",
      `<section class="field-section"><h2>Estimated impact</h2>${s.estimates.map((e) => `<article class="measurement-note"><h3>${Number(e.value).toLocaleString()} ${escapeHTML(e.unit)} · ${escapeHTML(e.type.replaceAll("_", " "))}</h3><p>${escapeHTML(e.note)}</p><p>${e.actions} approved actions · estimate, not a measurement.</p></article>`).join("")}</section>`,
    );
} catch (e) {
  errorState(container, e);
}
