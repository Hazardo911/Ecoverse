import "./shell.js";
import { api, errorState, escapeHTML as esc } from "./api.js";
import { statusPill } from "./verification-ui.js";
const grid = document.querySelector("#challenge-grid");
let challenges = [],
  filter = "all";
function render() {
  const selected = challenges.filter(
    (c) => filter === "all" || c.category === filter,
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
  render();
} catch (e) {
  errorState(grid, e);
}
