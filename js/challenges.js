import "./shell.js";
import { api, errorState, escapeHTML as esc } from "./api.js";
import { statusPill } from "./verification-ui.js";
const grid = document.querySelector("#challenge-grid");
let challenges = [],
  filter = "all",
  search = "";
function render() {
  const selected = challenges.filter(
    (c) => (filter === "all" || c.category === filter) &&
      (!search || `${c.title} ${c.description} ${c.category} ${c.difficulty}`.toLowerCase().includes(search)),
  );
  grid.innerHTML = selected.length
    ? selected
        .map(
          (c) =>
            `<article class="challenge verified-challenge"><div class="mission-top"><span class="mission-index">${String(c.id).padStart(2, "0")}</span><span>${esc(c.category)}</span><span>${esc(c.difficulty)}</span></div>${statusPill(c.status)}<h3><a href="challenge.html?id=${c.id}">${esc(c.title)}</a></h3><p>${esc(c.description)}</p><p class="challenge-meta">${esc(c.estimated_time)} · ${c.proof_required ? "Photo proof" : "Written evidence"}</p><div class="mission-bottom"><strong>+${c.points}<small> EP on approval</small></strong><a class="complete-btn" href="challenge.html?id=${c.id}">${c.canRepeat ? "Start again" : c.status === "NOT_STARTED" ? "View challenge" : c.status === "PENDING" ? "View submission" : c.status === "APPROVED" ? "Verified ✓" : c.status === "REJECTED" ? "Resubmit proof" : "Continue"} ↗</a></div></article>`,
        )
        .join("")
    : '<div class="empty-state">No active challenges in this category.</div>';
}
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      render();
    }),
);
const searchInput = document.querySelector("#challenge-search");
searchInput?.addEventListener("input", () => {
  search = searchInput.value.trim().toLowerCase();
  render();
});
document.querySelector("#clear-challenge-search")?.addEventListener("click", () => {
  search = "";
  if (searchInput) searchInput.value = "";
  render();
  searchInput?.focus();
});
try {
  const [catalog, s] = await Promise.all([
    api("/challenges"),
    api("/user/progress").catch((e) => {
      if (e.status === 401) return null;
      throw e;
    }),
  ]);
  challenges = catalog;
  document.querySelector("#points").textContent = s?.ecoPoints ?? "—";
  document.querySelector("#completed").textContent = s?.verifiedActions ?? "—";
  document.querySelector("#level").textContent = s?.forestName ?? "—";
  const expeditionHost = document.createElement("section");
  expeditionHost.className = "expedition-feature";
  const focus = s?.nextExpedition?.category || "nature";
  const stories = { water: ["The Lost River", "A dry stream is waiting for consistent care.", "Restore the water region"], waste: ["The Vanishing Meadow", "Small waste decisions can make room for a cleaner habitat.", "Restore the meadow"], energy: ["The Grey Home", "Make everyday energy use more intentional.", "Upgrade the eco home"], transport: ["The Quiet Route", "Change one journey and start a greener movement.", "Open the city route"], nature: ["The Dying Grove", "Give local life a place to take root.", "Regrow the forest"], lifestyle: ["The Living Routine", "Turn one good choice into a repeatable practice.", "Build a sustainable habit"] };
  const story = stories[focus] || stories.nature;
  expeditionHost.innerHTML = `<div><p class="eyebrow">NEXT EXPEDITION / ${esc(focus)}</p><h2>${story[0]}</h2><p>${story[1]}</p></div><div class="expedition-steps"><span>01 Learn</span><span>02 Act</span><span>03 Document</span><span>04 Verify</span></div><div><strong>${story[2]}</strong><small>Choose an action below to begin</small></div>`;
  grid.before(expeditionHost);
  render();
} catch (e) {
  errorState(grid, e);
}
