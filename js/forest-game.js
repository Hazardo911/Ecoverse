import { api, escapeHTML as esc, toast } from "./api.js";

const label = (key) => ({ water: "Water reserve", soil: "Soil condition", biodiversity: "Biodiversity", pollution: "Pollution", habitat: "Habitat score" })[key] || key;
const meters = (health) => Object.entries(health).filter(([key]) => key !== "habitat").map(([key, value]) =>
  `<div class="habitat-meter"><span>${label(key)}</span><i><b style="width:${value}%"></b></i><strong>${value}</strong></div>`).join("");

export async function initForestGame(root) {
  let game, selectedSpecies = "oak", selectedZone = 1;
  async function load() { game = await api("/user/forest/game"); render(); }
  async function act(action, plot = 0, species) {
    root.dataset.busy = "true";
    try {
      game = await api("/user/forest/game/action", { method: "POST", body: { action, plot, ...(species ? { species } : {}) } });
      toast(action === "plant" ? "Seedling planted." : action === "rescue" ? "Habitat restored." : "Plant condition updated.");
      render();
    } catch (error) { toast(error.message); }
    finally { delete root.dataset.busy; }
  }
  function plotMarkup(plot) {
    const locked = plot.zone > game.unlockedZone,
      plant = plot.species && game.species[plot.species],
      stage = Math.min(3, 1 + (plot.age || 0));
    if (locked) return `<article class="habitat-plot locked"><span class="plot-number">${String(plot.id + 1).padStart(2, "0")}</span><p>Zone ${plot.zone}</p><strong>Habitat locked</strong><small>Reach forest level ${plot.zone}</small></article>`;
    if (!plant) return `<article class="habitat-plot empty"><span class="plot-number">${String(plot.id + 1).padStart(2, "0")}</span><p>Open ground</p><button data-plant="${plot.id}">Plant ${esc(game.species[selectedSpecies].name)}</button></article>`;
    return `<article class="habitat-plot planted" style="--maturity:${stage}"><span class="plot-number">${String(plot.id + 1).padStart(2, "0")}</span><p>${plot.age ? `${plot.age} days` : "Planted today"}</p><h3>${esc(plant.name)}</h3><dl><div><dt>Moisture</dt><dd>${plot.water || 0}/3</dd></div><div><dt>Weeds</dt><dd>${plot.weeds || 0}/3</dd></div></dl><div class="plot-actions"><button data-water="${plot.id}">Water</button><button data-weed="${plot.id}">Clear weeds</button></div></article>`;
  }
  function render() {
    const eventCopy = { drought: ["Drought warning", "Low rainfall is stressing the habitat."], litter: ["Waterway obstruction", "Litter has entered the lower clearing."], pests: ["Invasive species", "A pest is spreading through young growth."] },
      planted = game.plots.filter(p => p.species).length;
    root.innerHTML = `<header class="game-heading"><div><p class="eyebrow">FIELD STATION · ${esc(game.day)}</p><h2>Habitat management</h2><p>${planted} of ${game.plots.filter(p => p.zone <= game.unlockedZone).length} available plots planted</p></div><dl class="game-resources"><div><dt>Seeds</dt><dd>${game.resources.seeds}</dd></div><div><dt>Water</dt><dd>${game.resources.water}<small> units</small></dd></div><div><dt>Energy</dt><dd>${game.resources.energy}<small> units</small></dd></div></dl></header>
    ${game.event ? `<aside class="forest-event"><div><p class="eyebrow">ACTIVE FIELD EVENT</p><h3>${esc(eventCopy[game.event][0])}</h3><p>${esc(eventCopy[game.event][1])}</p></div><button data-rescue>Resolve · 2 ${game.event === "drought" ? "water" : "energy"}</button></aside>` : ""}
    <nav class="species-picker" aria-label="Seed selection"><span>Seed stock</span>${Object.entries(game.species).map(([id,s]) => `<button class="${selectedSpecies === id ? "active" : ""}" data-species="${id}"><span>${esc(s.name)}</span><small>${s.water} water / ${s.biodiversity} biodiversity</small></button>`).join("")}</nav>
    <div class="game-layout"><section><div class="habitat-map-heading"><div><span>${["North woodland", "River wetland", "Rocky highlands"][selectedZone - 1]}</span><b>${game.plots.filter(p => p.zone === selectedZone && p.species).length} plots planted</b></div><div class="zone-tabs" aria-label="Habitat zones">${["Woodland", "Wetland", "Highlands"].map((name, index) => { const zone = index + 1, locked = zone > game.unlockedZone; return `<button class="${selectedZone === zone ? "active" : ""}" data-zone="${zone}" ${locked ? "disabled" : ""}>${name}${locked ? ` · Level ${zone}` : ""}</button>`; }).join("")}</div></div><div class="habitat-board" aria-label="Planting map">${game.plots.filter(p => p.zone === selectedZone).map(plotMarkup).join("")}</div></section>
    <aside class="game-sidebar"><section class="health-panel"><p class="eyebrow">LIVE HABITAT INDEX</p><div class="habitat-score"><strong>${game.health.habitat}</strong><span>out of 100</span></div>${meters(game.health)}</section><section class="wildlife-panel"><p class="eyebrow">SPECIES OBSERVATIONS</p>${game.wildlife.map(w => `<div class="wildlife-card ${w.unlocked ? "unlocked" : ""}"><span>${w.unlocked ? "Observed" : "Not recorded"}</span><strong>${w.unlocked ? esc(w.name) : "Requirements unmet"}</strong></div>`).join("")}</section></aside></div>
    <footer class="game-footer"><div><p class="eyebrow">TODAY'S FIELDWORK</p>${Object.entries(game.daily).map(([name,q]) => `<span class="daily-chip ${q.current >= q.target ? "done" : ""}"><b>${String(q.current).padStart(2,"0")}/${String(q.target).padStart(2,"0")}</b> ${name}</span>`).join("")}</div><a class="team-fieldwork" href="community.html">Open team fieldwork →</a></footer>`;
    root.querySelectorAll("[data-species]").forEach(b => b.onclick = () => { selectedSpecies = b.dataset.species; render(); });
    root.querySelectorAll("[data-zone]").forEach(b => b.onclick = () => { selectedZone = Number(b.dataset.zone); render(); });
    root.querySelectorAll("[data-plant]").forEach(b => b.onclick = () => act("plant", Number(b.dataset.plant), selectedSpecies));
    root.querySelectorAll("[data-water]").forEach(b => b.onclick = () => act("water", Number(b.dataset.water)));
    root.querySelectorAll("[data-weed]").forEach(b => b.onclick = () => act("weed", Number(b.dataset.weed)));
    root.querySelector("[data-rescue]")?.addEventListener("click", () => act("rescue"));
  }
  await load();
}
