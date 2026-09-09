import "./shell.js";
import { api, escapeHTML as esc, errorState } from "./api.js";
import { createWorld } from "./world.js";
import { badgeList } from "./verification-ui.js";
const root = document.querySelector("#showcase-content"),
  id = Number(new URLSearchParams(location.search).get("id"));
try {
  const s = await api("/public/forest/" + id);
  root.innerHTML = `<header class="field-heading"><p class="eyebrow">PUBLIC FOREST / VERIFIED TOTALS ONLY</p><h1>${esc(s.name)}’s<br><em>${esc(s.forestName)}.</em></h1><p>${s.verifiedActions} approved actions · ${s.ecoPoints} Eco Points · ${s.trustScore}% trust. No email, location, or evidence is shown here.</p></header><div class="showcase-world"><canvas id="showcase-world" aria-label="Public digital forest"></canvas></div><section class="badge-gallery">${badgeList(s.badges)}</section>`;
  const w = createWorld(root.querySelector("canvas"), {
    growth: Math.min(1, s.ecoPoints / 2000),
    treeLimit: s.treesUnlocked,
    wildlifeLimit: s.wildlifeUnlocked,
  });
  addEventListener("pagehide", () => w?.destroy(), { once: true });
} catch (e) {
  errorState(root, e);
}
