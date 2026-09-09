import "./shell.js";
import { createWorld } from "./world.js";
import { api, escapeHTML as esc, toast } from "./api.js";
let lessons = [];
const topics = {
  living: [
    "Habits that last.",
    "Choose practical routines you can repeat. Honest evidence builds trust; learning helps you make informed choices.",
    "Find a sustainable habit.",
  ],
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
if (!world)
  document
    .querySelector(".explore-world")
    .insertAdjacentHTML(
      "beforeend",
      '<p class="scene-fallback-note">Explore the field guide below. Interactive 3D needs hardware acceleration; every lesson and quiz works without it.</p>',
    );
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
  const lesson = lessons.find((l) => l.id === key);
  if (lesson) {
    panel.insertAdjacentHTML(
      "beforeend",
      `<form class="quiz-panel"><p class="eyebrow">KNOWLEDGE CHECK ${lesson.passed ? " / PASSED ✓" : ""}</p><fieldset><legend>${esc(lesson.question)}</legend>${lesson.options.map((o, i) => `<label><input type="radio" name="answer" value="${i}" required> ${esc(o)}</label>`).join("")}</fieldset><button class="button button-dark">Check answer</button><p role="status">Pass all seven quizzes to earn Curious Mind. Learning never awards real-world Eco Points.</p></form>`,
    );
    panel.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget,
        b = f.querySelector("button");
      b.disabled = true;
      try {
        const r = await api(`/learn/${key}/quiz`, {
          method: "POST",
          body: { answer: Number(f.elements.answer.value) },
        });
        f.querySelector("[role=status]").textContent =
          (r.passed ? "Correct. " : "Not quite. ") +
          r.explanation +
          " No Eco Points awarded.";
        if (r.passed) lesson.passed = true;
      } catch (err) {
        toast(
          err.status === 401 ? "Sign in to save quiz progress." : err.message,
        );
      } finally {
        b.disabled = false;
      }
    };
  }
  world?.setTime(
    key === "climate" ? "sunset" : key === "wildlife" ? "night" : "day",
  );
}
filters
  .querySelectorAll("button")
  .forEach((b) => (b.onclick = () => select(b.dataset.topic)));
select("forest");
api("/learn")
  .then((rows) => {
    lessons = rows;
    select(
      document.querySelector("[data-topic].active")?.dataset.topic || "forest",
    );
  })
  .catch(() => {
    panel.insertAdjacentHTML(
      "beforeend",
      '<p role="alert">Quizzes are temporarily unavailable. <button id="retry-learn">Try again</button></p>',
    );
    panel.querySelector("#retry-learn").onclick = () => location.reload();
  });
addEventListener("pagehide", () => world?.destroy(), { once: true });
