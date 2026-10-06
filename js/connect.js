import "./shell.js";
import { api, escapeHTML as esc, errorState } from "./api.js";

const grid = document.querySelector("#org-grid"), status = document.querySelector("#connect-status");
const query = () => new URLSearchParams({ q: document.querySelector("#org-search").value, city: document.querySelector("#org-city").value });
function render(items) {
  status.textContent = `${items.length} official organisation${items.length === 1 ? "" : "s"} found.`;
  grid.innerHTML = items.length ? items.map((org) => `<article class="org-card"><div class="org-image"><img src="${esc(org.image)}" alt="Environmental landscape representing ${esc(org.name)}" loading="lazy"><small>${esc(org.imageCredit)}</small></div><div class="org-card-body"><p class="eyebrow">${esc(org.region)} / ${esc(org.cities.slice(0, 2).join(" · "))}</p><h2>${esc(org.name)}</h2><p>${esc(org.description)}</p><div class="org-tags">${org.focus.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><div class="org-links"><a class="button button-dark" href="${esc(org.volunteer)}" target="_blank" rel="noopener noreferrer">Volunteer</a><a class="text-link" href="${esc(org.contact)}" target="_blank" rel="noopener noreferrer">Official contact ↗</a></div></div></article>`).join("") : `<div class="empty-state"><h2>No matching groups</h2><p>Try a wider city or focus search.</p></div>`;
}
async function load() { try { const result = await api(`/connect/organizations?${query()}`); render(result); } catch (error) { errorState(grid, error); } }
document.querySelectorAll("#org-search, #org-city").forEach((input) => input.addEventListener("input", () => { clearTimeout(input._timer); input._timer = setTimeout(load, 250); }));
load();
