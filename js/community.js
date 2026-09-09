import "./shell.js";
import { api, escapeHTML as esc, errorState, toast } from "./api.js";
import { date } from "./verification-ui.js";
const root = document.querySelector("#community-content");
async function load() {
  try {
    const [posts, campaigns, teams, progress, recs, notes, streaks] =
      await Promise.all([
        api("/community/feed"),
        api("/community/campaigns"),
        api("/community/teams"),
        api("/user/progress").catch(() => null),
        api("/account/recommendations").catch(() => []),
        api("/account/notifications").catch(() => []),
        api("/account/streaks").catch(() => []),
      ]);
    root.innerHTML = `<section class="community-rail"><article><p class="eyebrow">LIVE CAMPAIGNS</p>${campaigns.map((c) => `<h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><strong>${c.participants} participants · ${c.verifiedActions} verified actions</strong><small>Ends ${esc(date(c.ends_at))}</small>`).join("") || "<p>No active campaigns.</p>"}</article><article><p class="eyebrow">TEAM FORESTS</p><ol>${
      teams
        .slice(0, 5)
        .map(
          (t) =>
            `<li><strong>${esc(t.name)}</strong><span>${t.points} verified EP · ${t.members} members</span></li>`,
        )
        .join("") || "<li>No teams yet.</li>"
    }</ol>${progress ? '<form id="team-form" class="mini-form"><input name="name" placeholder="New team name" minlength="3" required><button>Create</button></form><form id="join-form" class="mini-form"><input name="code" placeholder="8-character code" maxlength="8" required><button>Join</button></form>' : '<a href="auth.html">Sign in to join ↗</a>'}</article><article><p class="eyebrow">FOR YOU</p>${recs.map((r) => `<a class="recommendation" href="challenge.html?id=${r.id}"><strong>${esc(r.title)}</strong><small>${esc(r.reason)}</small></a>`).join("") || "<p>Sign in for personal recommendations.</p>"}</article></section>${progress ? `<section class="share-approved"><h2>Share an approved action</h2><form id="share-form" class="mini-form"><select name="completionId" required><option value="">Choose verified action</option>${progress.recentVerified.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select><input name="caption" maxlength="500" placeholder="What did you learn?"><label><input type="checkbox" name="sharePhoto"> Publicly share its evidence photo</label><button>Share</button></form><p class="field-note">Your email, location, and original description never appear. Photo sharing is off by default.</p></section>` : ""}<div class="community-grid"><section><div class="section-top"><h2>Community field notes</h2></div>${posts.map((p) => `<article class="community-post">${p.photo ? `<img src="${esc(p.photo)}" alt="Evidence voluntarily shared by ${esc(p.name)}">` : ""}<p class="eyebrow">${esc(p.category)} / VERIFIED</p><h3>${esc(p.name)} · ${esc(p.title)}</h3><p>${esc(p.caption || "Shared a verified action.")}</p><small>${esc(date(p.created_at))} · ${p.reactions} reactions</small>${p.comments.map((c) => `<p class="comment"><strong>${esc(c.name)}</strong> ${esc(c.body)}</p>`).join("")}<div><button data-react="${p.id}">Inspired</button>${progress ? `<form class="comment-form" data-comment="${p.id}"><input name="body" required minlength="2" maxlength="500" aria-label="Comment"><button>Reply</button></form>` : ""}</div></article>`).join("") || '<div class="empty-state"><h3>No shared field notes yet.</h3><p>Approved actions appear only when their owners choose to share them.</p></div>'}</section><aside><div class="section-top"><h2>Notifications</h2>${notes.some((n) => !n.read_at) ? '<button id="read-all">Mark read</button>' : ""}</div>${notes.map((n) => `<a class="notification ${n.read_at ? "" : "unread"}" href="${esc(n.link || "#")}"><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><small>${esc(date(n.created_at))}</small></a>`).join("") || "<p>No notifications yet.</p>"}</aside></div>`;
    if (streaks.length)
      root
        .querySelector(".community-rail article:last-child")
        .insertAdjacentHTML(
          "beforeend",
          `<h3>Verified category streaks</h3>${streaks.map((s) => `<p><strong>${esc(s.category)}</strong> · ${s.verifiedDays} approved active days</p>`).join("")}`,
        );
    root
      .querySelector("#team-form")
      ?.addEventListener("submit", (e) =>
        action(e, "/community/teams", (f) => ({ name: f.elements.name.value })),
      );
    root.querySelector("#join-form")?.addEventListener("submit", (e) =>
      action(e, "/community/teams/join", (f) => ({
        code: f.elements.code.value,
      })),
    );
    root.querySelector("#share-form")?.addEventListener("submit", (e) =>
      action(e, "/community/posts", (f) => ({
        completionId: Number(f.elements.completionId.value),
        caption: f.elements.caption.value,
        sharePhoto: f.elements.sharePhoto.checked,
      })),
    );
    root.querySelectorAll("[data-react]").forEach(
      (b) =>
        (b.onclick = async () => {
          await api(`/community/posts/${b.dataset.react}/react`, {
            method: "POST",
            body: { kind: "inspired" },
          });
          toast("Reaction added.");
          load();
        }),
    );
    root
      .querySelectorAll("[data-comment]")
      .forEach(
        (f) =>
          (f.onsubmit = (e) =>
            action(
              e,
              `/community/posts/${f.dataset.comment}/comments`,
              (x) => ({ body: x.elements.body.value }),
            )),
      );
    root.querySelector("#read-all")?.addEventListener("click", async () => {
      await api("/account/notifications/read", { method: "POST", body: {} });
      load();
    });
  } catch (e) {
    errorState(root, e);
  }
}
async function action(e, path, body) {
  e.preventDefault();
  const f = e.currentTarget,
    b = f.querySelector("button");
  b.disabled = true;
  try {
    await api(path, { method: "POST", body: body(f) });
    toast("Saved.");
    await load();
  } catch (err) {
    toast(err.message);
    b.disabled = false;
  }
}
load();
