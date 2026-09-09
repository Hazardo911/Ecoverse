import "./shell.js";
import { createWorld } from "./world.js";
import { getForestProgress } from "./state.js";
import { errorState, escapeHTML } from "./api.js";
import { initShop } from "./shop.js";
import { activityList } from "./verification-ui.js";
import { initForestGame } from "./forest-game.js";
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
  container.innerHTML = `<div class="forest-shell"><canvas id="forest-canvas" aria-label="Your personal 3D forest"></canvas><div class="forest-hud"><span class="eyebrow">YOUR ECOSYSTEM / LEVEL 0${state.forestLevel}</span><h2>${names[state.forestLevel - 1]}</h2><p>${state.ecoPoints} Eco Points · ${state.treesUnlocked} trees · ${state.wildlifeUnlocked} wildlife unlocks</p><div class="progress-track"><i style="transform:scaleX(${state.forestProgress / 100})"></i></div><p>${state.nextLevelPoints ? `${state.nextLevelPoints - state.ecoPoints} points until the next level` : "Your ecosystem is fully unlocked"}</p></div><div class="time-controls"><button class="time-btn active" data-time="day">Day</button><button class="time-btn" data-time="sunset">Sunset</button><button class="time-btn" data-time="night">Night</button></div></div><div class="forest-details"><div><p class="eyebrow">FIELD NOTES</p><h3 id="object-title">A world shaped by you.</h3><p id="object-copy">Select a tree or river to explore. Keyboard users can use the inspection controls.</p><div class="filters"><button data-inspect="tree">Inspect trees</button><button data-inspect="river">Inspect river</button><button data-inspect="wildlife">Inspect wildlife</button></div></div><div><p class="eyebrow">EARNED BADGES</p>${state.badges.length ? state.badges.map((b) => `<span class="badge-label">✳ ${escapeHTML(b.name)}</span>`).join("") : "<p>Your first approved challenge unlocks First Seed.</p>"}<a class="text-link" href="challenges.html">Grow your forest ↗</a></div></div>`;
  const select = (data) => {
    document.querySelector("#object-title").textContent = data.title;
    document.querySelector("#object-copy").textContent = data.description;
  };
  const quality = document.createElement("button");
  quality.className = "time-btn";
  quality.textContent =
    localStorage.getItem("eco-quality") === "low"
      ? "Graphics: low"
      : "Graphics: auto";
  quality.setAttribute("aria-label", "Toggle graphics quality");
  quality.onclick = () => {
    localStorage.setItem(
      "eco-quality",
      localStorage.getItem("eco-quality") === "low" ? "auto" : "low",
    );
    location.reload();
  };
  container.querySelector(".time-controls").append(quality);
  const season = document.createElement("button");
  season.className = "time-btn";
  let seasonIndex = 0;
  const seasons = ["summer", "autumn", "winter", "spring"];
  season.textContent = "Season: summer";
  season.onclick = () => {
    seasonIndex = (seasonIndex + 1) % seasons.length;
    document.querySelector(".forest-shell").dataset.season =
      seasons[seasonIndex];
    season.textContent = "Season: " + seasons[seasonIndex];
  };
  container.querySelector(".time-controls").append(season);
  const sound = document.createElement("button");
  sound.className = "time-btn";
  sound.textContent = "Ambient: off";
  let audio;
  sound.onclick = () => {
    if (!audio) {
      audio = new AudioContext();
      const osc = audio.createOscillator(),
        gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = 174;
      gain.gain.value = 0.01;
      osc.connect(gain).connect(audio.destination);
      osc.start();
      sound.textContent = "Ambient: on";
    } else {
      audio.close();
      audio = null;
      sound.textContent = "Ambient: off";
    }
  };
  container.querySelector(".time-controls").append(sound);
  container.insertAdjacentHTML(
    "beforeend",
    `<section class="field-section recent-verified"><p class="eyebrow">VERIFIED GROWTH / TRUST ${state.trustScore}%</p><h2>The actions behind your forest</h2><p>Pending and rejected evidence never grows this ecosystem.</p>${activityList(state.recentVerified)}</section>`,
  );
  const world = createWorld(document.querySelector("#forest-canvas"), {
    growth: state.visualGrowth,
    treeLimit: state.treesUnlocked,
    wildlifeLimit: state.wildlifeUnlocked,
    onSelect: select,
  });
  const game = document.createElement("section");
  game.className = "forest-game";
  game.innerHTML = '<p class="loading-state">Preparing your playable habitat…</p>';
  container.querySelector(".forest-details").before(game);
  await initForestGame(game);
  if (!world)
    document
      .querySelector(".forest-shell")
      .insertAdjacentHTML(
        "beforeend",
        '<p class="webgl-note">3D is unavailable on this device. Your progress is shown below.</p>',
      );
  const workshop = document.createElement("section");
  workshop.className = "forest-workshop";
  workshop.id = "workshop";
  container.append(workshop);
  initShop(workshop, world);
  document.querySelectorAll("[data-time]").forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll("[data-time]")
          .forEach((x) => x.classList.toggle("active", x === b));
        world?.setTime(b.dataset.time);
      }),
  );
  document.querySelectorAll("[data-inspect]").forEach(
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
              : "Only approved evidence grows this forest. Submit real-world actions for review to unlock more life.",
        })),
  );
  addEventListener("pagehide", () => world?.destroy(), { once: true });
} catch (e) {
  errorState(container, e);
}
