import "./shell.js";
import { api, escapeHTML, errorState } from "./api.js";
const list = document.querySelector("#rank-list");
let request = 0;
async function render(period) {
  const current = ++request;
  list.innerHTML = '<p class="loading-state">Gathering the forest…</p>';
  try {
    const rows = await api("/leaderboard?period=" + period);
    if (current !== request) return;
    list.innerHTML = rows.length
      ? rows
          .map(
            (r, i) =>
              `<article class="rank-row ${i < 3 ? "top" : ""}"><span class="rank">${String(i + 1).padStart(2, "0")}</span><div class="person"><span class="avatar">${escapeHTML(r.name[0])}</span><strong>${escapeHTML(r.name)}</strong></div><div><strong>${r.points.toLocaleString()}</strong><small>Eco Points</small></div><div><strong>Level ${r.forestLevel}</strong><small>Forest</small></div><div><strong>${r.challenges}</strong><small>Actions</small></div></article>`,
          )
          .join("")
      : '<div class="empty-state"><h3>Be the first to grow.</h3><p>No recorded actions in this period yet.</p><a class="button button-primary" href="challenges.html">Choose a challenge ↗</a></div>';
  } catch (e) {
    if (current === request) errorState(list, e);
  }
}
document.querySelectorAll("[data-board]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-board]")
        .forEach((x) => x.classList.toggle("active", x === b));
      render(b.dataset.board);
    }),
);
render("global");
