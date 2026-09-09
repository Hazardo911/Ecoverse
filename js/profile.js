import "./shell.js";
import { api, escapeHTML as esc, errorState, toast } from "./api.js";
import { badgeList } from "./verification-ui.js";
const root = document.querySelector("#profile-content");
try {
  const [u, s, catalog] = await Promise.all([
    api("/user/profile"),
    api("/user/progress"),
    api("/badges"),
  ]);
  root.innerHTML = `<header class="field-heading"><p class="eyebrow">YOUR ECOVERSE IDENTITY</p><h1>Your roots.<br><em>Your story.</em></h1></header><div class="dashboard-columns"><form class="eco-form" id="profile-form"><h2>Profile</h2><label>Your name<input name="name" required minlength="2" maxlength="80" value="${esc(u.name)}"></label><label>Email<input value="${esc(u.email)}" readonly></label><p class="field-note">Your display name appears on the leaderboard. Email and evidence stay private.</p><button class="button button-dark">Save profile</button><p id="profile-result" role="status"></p></form><section><p class="eyebrow">TRUST / ${s.trustScore}%</p><h2>Participation, with accountability.</h2><p>${esc(s.trustExplanation)}</p><p class="notice">Review reduces dishonest self-reporting. It does not perfectly prove real-world impact. Low trust never automatically bans your account.</p><a class="text-link" href="dashboard.html">View your activity ↗</a></section></div><section class="field-section"><h2>Your milestones</h2><div class="badge-gallery">${badgeList(s.badges)}</div><h3>Still growing towards</h3><div class="badge-gallery">${
    catalog
      .filter((b) => !s.badges.some((x) => x.id === b.id))
      .map(
        (b) =>
          `<article class="earned-badge locked"><div><strong>${esc(b.name)}</strong><small>${esc(b.description)}</small></div></article>`,
      )
      .join("") || "<p>All milestones unlocked.</p>"
  }</div></section>`;
  root.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("button");
    b.disabled = true;
    try {
      await api("/user/profile", {
        method: "PATCH",
        body: { name: f.elements.name.value },
      });
      root.querySelector("#profile-result").textContent = "Profile saved.";
      document.querySelector("#account-link").textContent =
        f.elements.name.value;
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  };
} catch (e) {
  errorState(root, e);
}
