import "./shell.js";
import { api, escapeHTML as esc, errorState, toast } from "./api.js";
const root = document.querySelector("#admin-content");
let challenges = [],
  editing = null;
async function load() {
  try {
    const [stats, users, completions, catalog] = await Promise.all([
      api("/admin/stats"),
      api("/admin/users"),
      api("/admin/completions"),
      api("/admin/challenges"),
    ]);
    challenges = catalog;
    root.innerHTML = `<div class="impact-totals">${Object.entries(stats)
      .map(
        ([k, v]) => `<article><strong>${v}</strong><span>${k}</span></article>`,
      )
      .join(
        "",
      )}</div><section class="admin-section"><h2>Challenge catalog</h2><button id="new-challenge" class="button button-dark">Create challenge</button><div id="editor"></div><div class="admin-list"><table><thead><tr><th>Challenge</th><th>Points</th><th>Status</th><th>Action</th></tr></thead><tbody>${catalog.map((c) => `<tr><td>${esc(c.title)}</td><td>${c.points}</td><td>${c.is_active ? "Active" : "Disabled"}</td><td><button data-edit="${c.id}">Edit</button></td></tr>`).join("")}</tbody></table></div></section><section class="admin-section"><h2>Members</h2><div class="admin-list"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td></tr>`).join("")}</tbody></table></div></section><section class="admin-section"><h2>Recent actions</h2><div class="admin-list">${completions.length ? `<table><thead><tr><th>Member</th><th>Challenge</th><th>Completed</th></tr></thead><tbody>${completions.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.title)}</td><td>${esc(new Date(c.completed_at).toLocaleString())}</td></tr>`).join("")}</tbody></table>` : "<p>No recorded actions yet.</p>"}</div></section>`;
    root.querySelector("#new-challenge").onclick = () => edit(null);
    root
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            edit(challenges.find((c) => c.id === Number(b.dataset.edit)))),
      );
  } catch (e) {
    errorState(root, e);
  }
}
function edit(c) {
  editing = c;
  const editor = document.querySelector("#editor");
  editor.innerHTML = `<form class="admin-form"><h3>${c ? "Edit challenge" : "New challenge"}</h3><label>Title<input name="title" required maxlength="100" value="${esc(c?.title || "")}"></label><label>Description<textarea name="description" required minlength="10" maxlength="500">${esc(c?.description || "")}</textarea></label><label>Category<select name="category">${["energy", "water", "waste", "transport", "lifestyle"].map((v) => `<option ${c?.category === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Difficulty<select name="difficulty">${["Easy", "Medium", "Bold"].map((v) => `<option ${c?.difficulty === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Points<input name="points" type="number" min="1" max="100" required value="${c?.points || 20}"></label><label><input name="is_active" type="checkbox" ${!c || c.is_active ? "checked" : ""}> Active</label><button class="button button-dark">Save challenge</button></form>`;
  editor.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      button = f.querySelector("button");
    button.disabled = true;
    try {
      await api("/admin/challenges" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PATCH" : "POST",
        body: {
          title: f.elements.title.value,
          description: f.elements.description.value,
          category: f.elements.category.value,
          difficulty: f.elements.difficulty.value,
          points: Number(f.elements.points.value),
          is_active: f.elements.is_active.checked,
        },
      });
      toast("Challenge saved.");
      await load();
    } catch (err) {
      toast(err.message);
      button.disabled = false;
    }
  };
  editor.scrollIntoView({ block: "center", behavior: "smooth" });
}
load();
