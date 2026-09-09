import "./shell.js";
import { api, escapeHTML as esc, errorState, toast } from "./api.js";
import { date, statusPill } from "./verification-ui.js";
const root = document.querySelector("#admin-content");
let catalog = [];
async function load() {
  try {
    const [stats, queue, challenges, recent] = await Promise.all([
      api("/admin/stats"),
      api("/admin/submissions/pending"),
      api("/admin/challenges"),
      api("/admin/completions"),
    ]);
    catalog = challenges;
    root.innerHTML = `<div class="admin-metrics">${Object.entries(stats)
      .map(([k, v]) => `<div><strong>${v}</strong><span>${esc(k)}</span></div>`)
      .join(
        "",
      )}</div><section class="admin-section"><div class="section-top"><div><p class="eyebrow">HUMAN REVIEW / OLDEST FIRST</p><h2>Verification queue</h2></div><button class="button button-outline-dark" id="refresh-queue">Refresh queue</button></div><p class="field-note">Review whether the photo and explanation reasonably support the action. Photos do not guarantee real-world impact. Never approve your own evidence.</p><div class="review-queue">${queue.length ? queue.map((s) => `<article class="queue-row"><div><strong>${esc(s.title)}</strong><p>${esc(s.name)} · ${esc(date(s.submitted_at))}</p>${s.review_flags ? `<p class="review-flag">${esc(s.review_flags)}</p>` : ""}</div><span>Trust ${s.trustScore}%</span><button class="button button-dark" data-review="${s.id}">Review evidence ↗</button></article>`).join("") : '<div class="empty-state"><h3>All caught up.</h3><p>New evidence will appear here after a member submits proof.</p></div>'}</div></section><section class="admin-section"><div class="section-top"><h2>Challenge catalog</h2><button id="new-challenge" class="button button-dark">Create challenge</button></div><div id="editor"></div><div class="admin-list"><table><thead><tr><th>Challenge</th><th>Points</th><th>Photo</th><th>Status</th><th>Action</th></tr></thead><tbody>${catalog.map((c) => `<tr><td>${esc(c.title)}</td><td>${c.points}</td><td>${c.proof_required ? "Required" : "Optional"}</td><td>${c.is_active ? "Active" : "Disabled"}</td><td><button data-edit="${c.id}">Edit</button></td></tr>`).join("")}</tbody></table></div></section><section class="admin-section"><h2>Recent submission history</h2><div class="activity-feed">${
      recent
        .slice(0, 30)
        .map(
          (c) =>
            `<button class="activity-item" data-review="${c.id}"><span>${esc(c.name)} / ${esc(c.title)}</span>${statusPill(c.status)}</button>`,
        )
        .join("") || "<p>No submission history yet.</p>"
    }</div></section>`;
    const analytics = await api("/admin/analytics");
    root
      .querySelector(".admin-metrics")
      .insertAdjacentHTML(
        "afterend",
        `<section class="admin-section"><div class="section-top"><div><p class="eyebrow">30-DAY REVIEW HEALTH</p><h2>Verification analytics</h2></div><a class="text-link" href="/api/admin/audit.csv" download>Export audit CSV ↓</a></div><div class="analytics-bars">${analytics.categories.map((c) => `<div><span>${esc(c.category)}</span><i style="--value:${c.submissions ? c.approved / c.submissions : 0}"></i><strong>${c.approved}/${c.submissions} approved</strong></div>`).join("") || "<p>No reviewed submissions yet.</p>"}</div></section>`,
      );
    root.querySelector("#refresh-queue").onclick = load;
    root.querySelector("#new-challenge").onclick = () => edit(null);
    root
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            edit(catalog.find((c) => c.id === Number(b.dataset.edit)))),
      );
    root
      .querySelectorAll("[data-review]")
      .forEach((b) => (b.onclick = () => review(Number(b.dataset.review), b)));
    root.querySelectorAll(".review-queue [data-review]").forEach((b) => {
      const assign = document.createElement("button");
      assign.className = "button button-outline-dark";
      assign.textContent = "Assign to me";
      assign.onclick = async () => {
        assign.disabled = true;
        try {
          await api(`/admin/submissions/${b.dataset.review}/assign`, {
            method: "POST",
            body: {},
          });
          assign.textContent = "Assigned ✓";
        } catch (e) {
          toast(e.message);
          assign.disabled = false;
        }
      };
      b.before(assign);
    });
  } catch (e) {
    errorState(root, e);
  }
}
async function review(id, trigger) {
  const dialog = document.createElement("dialog");
  dialog.className = "review-dialog";
  dialog.setAttribute("aria-label", "Submission evidence review");
  dialog.innerHTML =
    '<button class="dialog-close" aria-label="Close review">×</button><p role="status">Loading evidence…</p>';
  document.body.append(dialog);
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger.isConnected) trigger.focus();
  });
  dialog.showModal();
  try {
    const s = await api("/admin/submissions/" + id);
    dialog.innerHTML = `<button class="dialog-close" aria-label="Close review">×</button><p class="eyebrow">EVIDENCE / SUBMISSION ${id}</p><h2>${esc(s.title)}</h2><p>${esc(s.name)} · Trust ${s.trustScore}%</p>${statusPill(s.status)}${s.review_flags ? `<p class="notice warning">${esc(s.review_flags)}</p>` : ""}<div class="review-evidence">${s.proof_url ? `<img src="${esc(s.proof_url)}" alt="Evidence submitted for ${esc(s.title)}">` : "<p>No photo supplied. This challenge allowed written evidence.</p>"}<div><h3>What happened</h3><p class="preserve-lines">${esc(s.description || "Not submitted yet.")}</p><dl class="fact-list"><div><dt>Submitted</dt><dd>${esc(date(s.submitted_at))}</dd></div><div><dt>Location</dt><dd>${esc(s.location || "Not shared")}</dd></div><div><dt>Reward on approval</dt><dd>${s.points_snapshot} EP</dd></div></dl><h3>Proof requirement</h3><p>${esc(s.proof_requirements)}</p></div></div><h3>Previous review history</h3><div class="review-history">${s.history.map((h) => `<p>${esc(date(h.reviewed_at))} · ${esc(h.title)} · ${h.decision} · trust ${h.trust_delta > 0 ? "+" : ""}${h.trust_delta}${h.reason ? "<br>" + esc(h.reason) : ""}</p>`).join("") || "<p>No previous reviews.</p>"}</div>${s.status === "PENDING" ? '<form class="eco-form" id="decision-form"><label>Review note / optional rejection reason<textarea name="reason" maxlength="500" rows="3" placeholder="Give specific, constructive feedback if the evidence needs improvement."></textarea></label><p class="form-error" id="decision-error" role="alert"></p><div class="decision-actions"><button type="submit" name="decision" value="approve" class="button button-dark">Approve evidence</button><button type="submit" name="decision" value="reject" class="button button-outline-dark">Reject evidence</button></div></form>' : '<p class="notice">This record is not pending. No further reward can be issued.</p>'}`;
    dialog.querySelector(".dialog-close").onclick = () => dialog.close();
    dialog.querySelector("form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const decision = e.submitter.value,
        form = e.currentTarget;
      form.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        const r = await api(`/admin/submissions/${id}/${decision}`, {
          method: "POST",
          body: { reason: form.elements.reason.value },
        });
        dialog.close();
        toast(
          r.status === "APPROVED"
            ? `Approved · ${r.awardedPoints} verified Eco Points awarded.`
            : "Rejected · no points awarded.",
        );
        await load();
      } catch (err) {
        dialog.querySelector("#decision-error").textContent = err.message;
        form.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    });
  } catch (e) {
    const close = dialog.querySelector("button");
    dialog.insertAdjacentHTML(
      "beforeend",
      `<p role="alert">${esc(e.message)}</p>`,
    );
    close.focus();
  }
}
function edit(c) {
  const editor = root.querySelector("#editor"),
    text = (key, label, max = 2000) =>
      `<label>${label}<textarea name="${key}" required minlength="10" maxlength="${max}">${esc(c?.[key] || "")}</textarea></label>`;
  editor.innerHTML = `<form class="eco-form admin-editor"><h3>${c ? "Edit challenge" : "New challenge"}</h3><p class="field-note">Existing attempts retain their original reward and proof requirement. Changes apply to new starts.</p><label>Title<input name="title" required minlength="3" maxlength="100" value="${esc(c?.title || "")}"></label>${text("description", "Short description", 500)}${text("benefit", "Environmental benefit")}${text("instructions", "Instructions")}${text("proof_requirements", "Evidence guidance")}<div class="form-grid"><label>Category<select name="category">${["energy", "water", "waste", "transport", "lifestyle", "nature"].map((x) => `<option ${c?.category === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Difficulty<select name="difficulty">${["Easy", "Medium", "Bold"].map((x) => `<option ${c?.difficulty === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Eco Points<input name="points" type="number" required min="1" max="100" value="${c?.points || 20}"></label><label>Estimated time<input name="estimated_time" required maxlength="80" value="${esc(c?.estimated_time || "10 minutes")}"></label></div><label class="checkbox-label"><input type="checkbox" name="proof_required" ${!c || c.proof_required ? "checked" : ""}> Require photo proof</label><label class="checkbox-label"><input type="checkbox" name="is_active" ${!c || c.is_active ? "checked" : ""}> Active challenge</label><details><summary>Optional impact estimate</summary><p>Leave blank unless you have a defensible assumption. Estimates are not measured savings.</p><div class="form-grid"><label>Type<input name="impact_type" maxlength="40" value="${esc(c?.impact_type || "")}" placeholder="e.g. avoided_single_use_items"></label><label>Value per action<input name="impact_value" type="number" min="0" max="10000" step="0.001" value="${c?.impact_value ?? ""}"></label><label>Unit<input name="impact_unit" maxlength="30" value="${esc(c?.impact_unit || "")}"></label></div><label>Assumption and limitations<textarea name="impact_note" maxlength="500">${esc(c?.impact_note || "")}</textarea></label></details><p id="editor-error" class="form-error" role="alert"></p><div><button class="button button-dark" type="submit">Save challenge</button> <button class="button button-outline-dark" id="cancel-edit" type="button">Cancel</button></div></form>`;
  editor.querySelector("#cancel-edit").onclick = () => editor.replaceChildren();
  editor.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      button = f.querySelector("[type=submit]"),
      body = {};
    for (const k of [
      "title",
      "description",
      "category",
      "difficulty",
      "benefit",
      "instructions",
      "proof_requirements",
      "estimated_time",
    ])
      body[k] = f.elements[k].value;
    body.points = Number(f.elements.points.value);
    body.is_active = f.elements.is_active.checked;
    body.proof_required = f.elements.proof_required.checked;
    for (const k of ["impact_type", "impact_unit", "impact_note"])
      body[k] = f.elements[k].value || null;
    body.impact_value =
      f.elements.impact_value.value === ""
        ? null
        : Number(f.elements.impact_value.value);
    button.disabled = true;
    try {
      await api("/admin/challenges" + (c ? "/" + c.id : ""), {
        method: c ? "PATCH" : "POST",
        body,
      });
      toast("Challenge saved.");
      await load();
    } catch (err) {
      editor.querySelector("#editor-error").textContent = err.message;
      button.disabled = false;
    }
  };
  editor.scrollIntoView({ block: "start" });
  editor.querySelector("input").focus();
}
load();
