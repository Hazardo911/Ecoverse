import "./shell.js";
import { api, escapeHTML as esc } from "./api.js";

const form = document.querySelector("#assessment-form");
const root = document.querySelector("#assessment-questions");
const questions = [
  ["mobility", "How often do you choose walking, cycling or public transport?", ["rarely", "sometimes", "often"]],
  ["energy", "How often do you switch off unused lights and devices?", ["rarely", "sometimes", "often"]],
  ["water", "How often do you actively reduce water use?", ["rarely", "sometimes", "often"]],
  ["waste", "How often do you avoid, reuse or correctly sort waste?", ["rarely", "sometimes", "often"]],
  ["food", "How often do you reduce food waste or choose lower-impact meals?", ["rarely", "sometimes", "often"]],
  ["nature", "How often do you care for plants or local wildlife?", ["rarely", "sometimes", "often"]],
  ["shopping", "How often do you repair, borrow or buy less?", ["rarely", "sometimes", "often"]],
  ["motivation", "What would help you stay consistent?", ["learn", "routine", "community"]],
];
const labels = { rarely: "Not yet", sometimes: "Sometimes", often: "Usually", learn: "Learn first", routine: "Build a routine", community: "Join others" };
root.innerHTML = questions.map(([key, title, values], index) => `<fieldset><legend><span>${String(index + 1).padStart(2, "0")}</span>${esc(title)}</legend><div class="assessment-options">${values.map((value, i) => `<label><input type="radio" name="${key}" value="${value}" ${i === 0 ? "required" : ""} /><span>${labels[value]}</span></label>`).join("")}</div></fieldset>`).join("");
try {
  const existing = await api("/user/assessment");
  if (existing) for (const [key] of questions) {
    const input = form.elements[key]?.namedItem(existing[key]);
    if (input) input.checked = true;
  }
} catch {}
form.onsubmit = async (event) => {
  event.preventDefault();
  const button = form.querySelector("button"), error = document.querySelector("#assessment-error");
  button.disabled = true; error.textContent = "";
  try {
    const body = Object.fromEntries(new FormData(form).entries());
    await api("/user/assessment", { method: "PUT", body });
    location.href = "dashboard.html";
  } catch (e) { error.textContent = e.message; button.disabled = false; }
};
