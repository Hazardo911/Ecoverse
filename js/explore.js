import "./shell.js";
import { createWorld } from "./world.js";
const topics = {
  forest: [
    "The roots of everything.",
    "Forests support habitats, store carbon, and help regulate water. Protecting existing trees matters alongside planting new ones.",
    "Care for a native plant.",
  ],
  water: [
    "Every drop connects us.",
    "Rivers connect landscapes. Using less water reduces pressure on freshwater supplies and the energy needed to treat and move it.",
    "Shorten your shower.",
  ],
  wildlife: [
    "Make room for life.",
    "Native plants offer food and shelter for local wildlife. Small connected habitats help pollinators and birds move through our cities.",
    "Grow pollinator-friendly plants.",
  ],
  energy: [
    "Use only what you need.",
    "Small reductions in wasted energy add up when repeated. Turn off unused equipment and choose efficient routines.",
    "Switch off idle devices.",
  ],
  waste: [
    "Keep good things going.",
    "Preventing waste starts before the bin. Reuse containers, repair useful objects, and plan meals around what you already have.",
    "Save a meal from waste.",
  ],
  climate: [
    "Consistency becomes change.",
    "Climate action includes the systems we support and the habits we repeat. Track meaningful choices and make room to improve over time.",
    "Choose a lower-emission journey.",
  ],
};
const filters = document.querySelector("#topic-filters"),
  panel = document.querySelector("#topic-panel");
const world = createWorld(document.querySelector("#explore-world"), {
  onSelect: (d) =>
    select(
      d.kind === "river" ? "water" : d.kind === "tree" ? "forest" : "wildlife",
    ),
});
filters.innerHTML = Object.keys(topics)
  .map((key) => `<button data-topic="${key}">${key}</button>`)
  .join("");
function select(key) {
  const [title, copy, action] = topics[key];
  document.querySelectorAll("[data-topic]").forEach((b) => {
    b.classList.toggle("active", b.dataset.topic === key);
    b.setAttribute("aria-pressed", String(b.dataset.topic === key));
  });
  panel.innerHTML = `<p class="eyebrow">FIELD GUIDE / ${key}</p><h2>${title}</h2><p>${copy}</p><a class="text-link" href="challenges.html">${action} ↗</a>`;
  world?.setTime(
    key === "climate" ? "sunset" : key === "wildlife" ? "night" : "day",
  );
}
filters
  .querySelectorAll("button")
  .forEach((b) => (b.onclick = () => select(b.dataset.topic)));
select("forest");
addEventListener("pagehide", () => world?.destroy(), { once: true });
