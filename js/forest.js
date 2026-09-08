import "./shell.js";
import { createWorld } from "./world.js";
import { getForestProgress } from "./state.js";
import { errorState, escapeHTML } from "./api.js";
import {initShop} from './shop.js';
const container = document.querySelector("#forest-content");
try {
  const state = await getForestProgress();
  const names = [
    "Seed",
    "Sprout",
    "Young forest",
    "Thriving forest",
    "Living ecosystem",
  ];
  container.innerHTML = `<div class="forest-shell"><canvas id="forest-canvas" aria-label="Your personal 3D forest"></canvas><div class="forest-hud"><span class="eyebrow">YOUR ECOSYSTEM / LEVEL 0${state.forestLevel}</span><h2>${names[state.forestLevel - 1]}</h2><p>${state.ecoPoints} Eco Points · ${state.treesUnlocked} trees · ${state.wildlifeUnlocked} wildlife unlocks</p><div class="progress-track"><i style="transform:scaleX(${state.forestProgress / 100})"></i></div><p>${state.nextLevelPoints ? `${state.nextLevelPoints - state.ecoPoints} points until the next level` : "Your ecosystem is fully unlocked"}</p></div><div class="time-controls"><button class="time-btn active" data-time="day">Day</button><button class="time-btn" data-time="sunset">Sunset</button><button class="time-btn" data-time="night">Night</button></div></div><div class="forest-details"><div><p class="eyebrow">FIELD NOTES</p><h3 id="object-title">A world shaped by you.</h3><p id="object-copy">Select a tree or river to explore. Keyboard users can use the inspection controls.</p><div class="filters"><button data-inspect="tree">Inspect trees</button><button data-inspect="river">Inspect river</button><button data-inspect="wildlife">Inspect wildlife</button></div></div><div><p class="eyebrow">EARNED BADGES</p>${state.badges.length ? state.badges.map((b) => `<span class="badge-label">✳ ${escapeHTML(b.name)}</span>`).join("") : "<p>Your first completed challenge unlocks First Seed.</p>"}<a class="text-link" href="challenges.html">Grow your forest ↗</a></div></div>`;
  const select = (data) => {
    document.querySelector("#object-title").textContent = data.title;
    document.querySelector("#object-copy").textContent = data.description;
  };
  const world = createWorld(document.querySelector("#forest-canvas"), {
    growth: Math.min(1, 0.01 + state.ecoPoints / 2000),
    treeLimit: state.treesUnlocked,
    wildlifeLimit: state.wildlifeUnlocked,
    onSelect: select,
  });
  if (!world)
    document
      .querySelector(".forest-shell")
      .insertAdjacentHTML(
        "beforeend",
        '<p class="webgl-note">3D is unavailable on this device. Your progress is shown below.</p>',
      );
  const workshop=document.createElement('section');workshop.className='forest-workshop';workshop.id='workshop';container.append(workshop);initShop(workshop,world);
  document.querySelectorAll("[data-time]").forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll("[data-time]")
          .forEach((x) => x.classList.toggle("active", x === b));
        world?.setTime(b.dataset.time);
      }),
  );
  document
    .querySelectorAll("[data-inspect]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          select({
            title:
              b.dataset.inspect === "tree"
                ? `${state.treesUnlocked} trees unlocked`
                : b.dataset.inspect === "wildlife"
                  ? `${state.wildlifeUnlocked} wildlife unlocks`
                  : "Your waterway",
            description:
              b.dataset.inspect === "river"
                ? "Water-saving actions are recorded on your Impact page."
                : "Your recorded actions determine what grows here. Complete daily challenges to unlock more life.",
          })),
    );
  addEventListener("pagehide", () => world?.destroy(), { once: true });
} catch (e) {
  errorState(container, e);
}
