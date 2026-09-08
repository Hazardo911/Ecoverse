import "./shell.js";
import { api, escapeHTML as esc, errorState, toast } from "./api.js";
const root = document.querySelector("#journey-content");
let summary,
  entries = [],
  month = new Date();
month.setUTCDate(1);
let view = location.hash.slice(1) || "calendar";
const tabs = ["calendar", "goals", "quests", "journal"];
if (!tabs.includes(view)) view = "calendar";
async function load() {
  try {
    [summary, entries] = await Promise.all([
      api("/user/journey"),
      api("/user/journal"),
    ]);
    render();
  } catch (e) {
    errorState(root, e);
  }
}
function render() {
  root.innerHTML = `<div class="journey-stats"><div><strong>${summary.streak.current}<small> days</small></strong><span>Current streak</span></div><div><strong>${summary.streak.longest}<small> days</small></strong><span>Best streak</span></div><div><strong>${summary.wallet.balance}</strong><span>Spendable points</span></div><a class="button button-dark" href="/api/user/report" download>Download report ↓</a></div><p class="field-note">${summary.streak.activeToday ? "You showed up today. Come back tomorrow to keep growing." : "One completed action today keeps your momentum going."} Days and quests use UTC.</p><div class="filters journey-tabs">${tabs.map((t) => `<button class="${view === t ? "active" : ""}" data-view="${t}">${t}</button>`).join("")}</div><div id="journey-panel"></div>`;
  root.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        history.replaceState(null, "", "#" + view);
        render();
      }),
  );
  ({ calendar, goals, quests, journal })[view]();
}
function calendar() {
  const panel = document.querySelector("#journey-panel");
  const year = month.getUTCFullYear(),
    m = month.getUTCMonth(),
    offset = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7,
    total = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  panel.innerHTML = `<div class="calendar-panel"><div class="calendar-heading"><button class="filter" id="prev-month" aria-label="Previous month">←</button><h2>${month.toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" })}</h2><button class="filter" id="next-month" aria-label="Next month">→</button></div><div class="calendar-grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span class="weekday">${d}</span>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
    { length: total },
    (_, i) => {
      const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
        count = summary.calendar[date] || 0;
      return `<button data-day="${date}" class="calendar-day ${count ? "has-actions" : ""} ${date === summary.today ? "is-today" : ""}" aria-label="${date}: ${count} actions"><b>${i + 1}</b><small>${count ? `${count} action${count > 1 ? "s" : ""}` : "·"}</small></button>`;
    },
  ).join(
    "",
  )}</div><div id="day-detail" aria-live="polite"><p>Select a date to see its actions.</p></div></div>`;
  document.querySelector("#prev-month").onclick = () => {
    month.setUTCMonth(m - 1);
    calendar();
  };
  document.querySelector("#next-month").onclick = () => {
    month.setUTCMonth(m + 1);
    calendar();
  };
  panel.querySelectorAll("[data-day]").forEach(
    (b) =>
      (b.onclick = () => {
        panel
          .querySelectorAll("[data-day]")
          .forEach((x) => x.classList.toggle("selected", x === b));
        const rows = entries.filter((e) => e.completion_day === b.dataset.day);
        document.querySelector("#day-detail").innerHTML =
          `<h3>${b.dataset.day}</h3>${rows.length ? rows.map((e) => `<p>✓ ${esc(e.title)}</p>`).join("") : "<p>No actions recorded on this day.</p>"}`;
      }),
  );
}
function goals() {
  const panel = document.querySelector("#journey-panel");
  panel.innerHTML = `<div class="journey-columns"><div><h2>Make room for a goal.</h2><p>Count actions from today through your deadline. Existing actions from today count too.</p><form id="goal-form" class="feature-form"><label>Goal name<input name="title" required minlength="3" maxlength="100" placeholder="Build a water-saving habit"></label><label>Category<select name="category">${["all", "energy", "water", "waste", "transport", "lifestyle"].map((c) => `<option>${c}</option>`).join("")}</select></label><div class="form-row"><label>Target actions<input name="target" type="number" min="1" max="500" value="10" required></label><label>Deadline (UTC)<input name="deadline" type="date" min="${summary.today}" required></label></div><button class="button button-dark">Set goal ↗</button><p class="form-error" role="alert"></p></form></div><div class="goal-list">${summary.goals.length ? summary.goals.map((g) => `<article class="goal-item"><span class="eyebrow">${esc(g.category)} / ${g.status}</span><h3>${esc(g.title)}</h3><div class="goal-track"><i style="width:${Math.min(100, (g.progress / g.target) * 100)}%"></i></div><p>${g.progress} / ${g.target} actions · Due ${g.deadline}</p><button data-archive="${g.id}" class="text-button">Archive goal</button></article>`).join("") : '<p class="empty-state">Set your first goal. Every small milestone counts.</p>'}</div></div>`;
  const form = document.querySelector("#goal-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await api("/user/goals", {
        method: "POST",
        body: {
          title: form.elements.title.value,
          category: form.elements.category.value,
          target: Number(form.elements.target.value),
          deadline: form.elements.deadline.value,
        },
      });
      toast("Goal created.");
      await load();
    } catch (err) {
      form.querySelector(".form-error").textContent = err.message;
      button.disabled = false;
    }
  };
  panel.querySelectorAll("[data-archive]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          await api("/user/goals/" + b.dataset.archive, {
            method: "DELETE",
            body: {},
          });
          await load();
        } catch (e) {
          toast(e.message);
          b.disabled = false;
        }
      }),
  );
}
function quests() {
  const panel = document.querySelector("#journey-panel");
  panel.innerHTML = `<div class="feature-heading"><div><h2>A week of possibilities.</h2><p>Week beginning ${summary.quests[0].week}. Resets Monday at 00:00 UTC.</p></div><p>Quest bonuses are spendable points only. Your lifetime score comes from actions.</p></div><div class="quest-grid">${summary.quests.map((q) => `<article class="quest-item ${q.claimed ? "claimed" : ""}"><span class="eyebrow">WEEKLY QUEST / +${q.reward} POINTS</span><h3>${q.title}</h3><p>${q.description}</p>${q.steps ? `<div class="quest-steps">${q.steps.map((s) => `<span class="${s.done ? "done" : ""}">${s.done ? "✓" : "○"} ${s.label}</span>`).join("")}</div>` : ""}<div class="goal-track"><i style="width:${(q.progress / q.target) * 100}%"></i></div><p>${q.progress} / ${q.target}</p><button class="button button-dark" data-claim="${q.id}" ${q.claimed || q.progress < q.target ? "disabled" : ""}>${q.claimed ? "Reward claimed ✓" : q.progress === q.target ? "Claim reward ↗" : "In progress"}</button></article>`).join("")}</div>`;
  panel.querySelectorAll("[data-claim]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          const result = await api(
            "/user/quests/" + b.dataset.claim + "/claim",
            { method: "POST", body: {} },
          );
          toast(`+${result.reward} spendable points!`);
          await load();
        } catch (e) {
          toast(e.message);
          b.disabled = false;
        }
      }),
  );
}
function journal() {
  const panel = document.querySelector("#journey-panel");
  panel.innerHTML = `<div class="feature-heading"><div><h2>Your actions, remembered.</h2><p>Add a note or photo to an action you have recorded. Photos stay private to your account.</p></div><a class="text-link" href="challenges.html">Record an action ↗</a></div><div class="journal-list">${entries.length ? entries.map((e) => `<article class="journal-entry"><div><span class="eyebrow">${e.completion_day} / ${esc(e.category)}</span><h3>${esc(e.title)}</h3></div>${e.photo ? `<img src="${esc(e.photo)}" alt="Photo attached to ${esc(e.title)}" loading="lazy">` : ""}<p class="journal-note">${esc(e.note) || "No note added yet."}</p><button class="text-button" data-edit-entry="${e.id}">${e.note || e.photo ? "Edit entry" : "Add note / photo"} ↗</button></article>`).join("") : '<p class="empty-state">Complete a challenge to start your journal.</p>'}</div><dialog id="journal-dialog"><form id="journal-form" class="feature-form"><div class="calendar-heading"><h3>Edit journal entry</h3><button type="button" id="close-journal" aria-label="Close editor">×</button></div><label>Your note<textarea name="note" maxlength="1500" rows="5" placeholder="What did you do? How did it feel?"></textarea></label><label>Photo (JPEG or PNG, up to 5 MB)<input name="photoFile" type="file" accept="image/jpeg,image/png"></label><img id="photo-preview" alt="Selected journal photo" hidden><button type="button" class="text-button" id="remove-photo">Remove photo</button><p class="form-error" role="alert"></p><button class="button button-dark" type="submit">Save entry</button></form></dialog>`;
  const dialog = document.querySelector("#journal-dialog"),
    form = document.querySelector("#journal-form");
  let selected,
    photo = null,
    processing = false;
  function preview() {
    const image = document.querySelector("#photo-preview");
    image.hidden = !photo;
    if (photo) image.src = photo;
    else image.removeAttribute("src");
  }
  panel.querySelectorAll("[data-edit-entry]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = entries.find((e) => e.id === Number(b.dataset.editEntry));
        form.elements.note.value = selected.note;
        form.elements.photoFile.value = "";
        photo = selected.photo;
        form.querySelector(".form-error").textContent = "";
        preview();
        dialog.showModal();
      }),
  );
  document.querySelector("#close-journal").onclick = () => dialog.close();
  document.querySelector("#remove-photo").onclick = () => {
    photo = null;
    form.elements.photoFile.value = "";
    preview();
  };
  form.elements.photoFile.onchange = async () => {
    const file = form.elements.photoFile.files[0];
    if (!file) return;
    processing = true;
    form.querySelector("[type=submit]").disabled = true;
    try {
      photo = await resizePhoto(file);
      preview();
      form.querySelector(".form-error").textContent = "";
    } catch (e) {
      form.querySelector(".form-error").textContent = e.message;
    } finally {
      processing = false;
      form.querySelector("[type=submit]").disabled = false;
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (processing) return;
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    try {
      await api("/user/journal/" + selected.id, {
        method: "PUT",
        body: { note: form.elements.note.value, photo },
      });
      dialog.close();
      toast("Journal entry saved.");
      await load();
    } catch (err) {
      form.querySelector(".form-error").textContent = err.message;
      b.disabled = false;
    }
  };
}
async function resizePhoto(file) {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a JPEG or PNG photo under 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let photo = canvas.toDataURL("image/jpeg", 0.75);
    if (photo.length > 490000) photo = canvas.toDataURL("image/jpeg", 0.45);
    if (photo.length > 490000)
      throw new Error("This photo is too detailed. Choose a smaller image.");
    return photo;
  } finally {
    bitmap.close();
  }
}
load();
