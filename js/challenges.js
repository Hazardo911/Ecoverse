import "./shell.js";
import { getChallenges, getUser, completeChallenge } from "./state.js";
import { errorState, escapeHTML, toast } from "./api.js";
import gsap from "gsap";
let challenges = [],
  state = null,
  filter = "all";
const grid = document.querySelector("#challenge-grid");
function stats() {
  if(state&&!document.querySelector('#journey-link')){const link=document.createElement('a');link.id='journey-link';link.className='text-link';link.href='journey.html';link.textContent='View your streak, quests & journal ↗';document.querySelector('.stat-strip').after(link)}
  document.querySelector("#points").textContent = state?.ecoPoints ?? "—";
  document.querySelector("#completed").textContent =
    state?.challengesCompleted ?? "—";
  document.querySelector("#level").textContent = state
    ? `0${state.forestLevel}`
    : "—";
}
function render() {
  const rows = challenges.filter(
    (c) => filter === "all" || c.category === filter,
  );
  grid.innerHTML = rows.length
    ? rows
        .map((c, i) => {
          const done = state?.completedChallenges.includes(c.id);
          return `<article class="challenge ${done ? "done" : ""}"><div class="mission-top"><span class="mission-index">${String(c.id).padStart(2, "0")}</span><span>${escapeHTML(c.category)}</span><span>${escapeHTML(c.difficulty)}</span></div><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p><div class="mission-bottom"><strong>+${c.points}<small> EP</small></strong><button class="complete-btn" data-id="${c.id}" ${done ? "disabled" : ""}>${done ? "Completed today ✓" : state ? "Record action ↗" : "Sign in to begin ↗"}</button></div></article>`;
        })
        .join("")
    : '<p class="empty-state">No active challenges in this category.</p>';
  grid
    .querySelectorAll("[data-id]")
    .forEach((b) => (b.onclick = () => finish(Number(b.dataset.id), b)));
}
async function finish(id, button) {
  if (!state) {
    location.href = "auth.html";
    return;
  }
  button.disabled = true;
  button.textContent = "Recording…";
  try {
    const result = await completeChallenge(id);
    state = result.state;
    stats();
    render();
    toast(
      `${result.newBadges.length ? "Badge unlocked: " + result.newBadges.join(", ") : "Action recorded"} · +${result.challenge.points} Eco Points`,
    );
    const burst = document.createElement("div");
    burst.className = "reward-burst";
    burst.textContent = `+${result.challenge.points} EP`;
    document.body.append(burst);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        burst,
        { y: 40, scale: 0.8, opacity: 0 },
        {
          y: -70,
          scale: 1,
          opacity: 1,
          duration: 1,
          onComplete: () => burst.remove(),
        },
      );
      for (let i = 0; i < 18; i++) {
        const leaf = document.createElement("i");
        leaf.className = "reward-leaf";
        document.body.append(leaf);
        gsap.to(leaf, {
          x: (Math.random() - 0.5) * 500,
          y: -250 + Math.random() * 400,
          rotation: Math.random() * 360,
          opacity: 0,
          duration: 1.5,
          onComplete: () => leaf.remove(),
        });
      }
    } else setTimeout(() => burst.remove(), 1500);
  } catch (e) {
    toast(e.message);
    button.disabled = false;
    button.textContent = "Retry action ↗";
  }
}
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-filter]")
        .forEach((x) => x.classList.toggle("active", x === b));
      filter = b.dataset.filter;
      render();
    }),
);
try {
  [challenges, state] = await Promise.all([
    getChallenges(),
    getUser().catch((e) => {
      if (e.status === 401) return null;
      throw e;
    }),
  ]);
  stats();
  render();
} catch (e) {
  errorState(grid, e);
}
