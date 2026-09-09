import "./shell.js";
import { api, escapeHTML as esc, errorState, toast } from "./api.js";
import { statusPill } from "./verification-ui.js";
const root = document.querySelector("#challenge-content"),
  id = Number(new URLSearchParams(location.search).get("id"));
let user = null;
async function load() {
  try {
    const [c, u] = await Promise.all([
      api("/challenges/" + id),
      api("/auth/me").catch((e) => {
        if (e.status === 401) return null;
        throw e;
      }),
    ]);
    user = u;
    document.title = c.title + " — EcoVerse";
    const canSubmit = ["IN_PROGRESS", "REJECTED"].includes(c.status),
      required = Boolean(c.proof_required || user?.trust_score < 30);
    root.innerHTML = `<header class="field-heading"><p class="eyebrow">FIELD CHALLENGE / ${esc(c.category)}</p><h1>${esc(c.title)}</h1><p>${esc(c.description)}</p>${statusPill(c.status)}</header><div class="field-layout"><div><section class="field-section"><h2>Why it matters</h2><p>${esc(c.benefit)}</p></section><section class="field-section"><h2>Make it happen</h2><p>${esc(c.instructions)}</p></section><section class="field-section"><h2>Show your journey</h2><p>${esc(c.proof_requirements)}</p><p class="field-note">Photo review helps document participation; it cannot guarantee that an action happened. Avoid faces, private documents, and exact home addresses.</p></section>${c.impact_value !== null ? `<section class="measurement-note"><h3>Estimated impact</h3><p>${esc(c.impact_value)} ${esc(c.impact_unit)} per approved action · ${esc(c.impact_type)}</p><p>${esc(c.impact_note)}</p></section>` : ""}</div><aside class="field-action"><p class="eyebrow">YOUR NEXT STEP</p><div class="reward-value">${c.completion && !c.canRepeat ? "Up to " : "+"}${c.points}<small> Eco Points</small></div><p>Only after evidence is approved.</p><dl class="fact-list"><div><dt>Difficulty</dt><dd>${esc(c.difficulty)}</dd></div><div><dt>Time</dt><dd>${esc(c.estimated_time)}</dd></div><div><dt>Evidence</dt><dd>${required ? "Photo + description" : "Description; photo optional"}</dd></div></dl>${!user ? '<a class="button button-dark" href="auth.html">Sign in to start ↗</a>' : c.status === "NOT_STARTED" || c.canRepeat ? `<button id="start-challenge" class="button button-dark">${c.canRepeat ? "Start a new daily action" : "Start challenge"} ↗</button>` : c.status === "PENDING" ? '<div class="notice"><h3>Your proof is in the queue.</h3><p>No points or forest growth yet. You can check the review result here or on your dashboard.</p><button class="button button-outline-dark" id="refresh-status">Refresh status</button></div>' : c.status === "APPROVED" ? '<div class="notice"><h3>Verified. A little more life.</h3><p>Your reward is included in your dashboard and forest. A new attempt is available on the next UTC day.</p><a href="forest.html" class="text-link">Visit your forest ↗</a></div>' : '<a href="#proof-form" class="button button-dark">' + (c.status === "REJECTED" ? "Resubmit proof" : "Submit proof") + " ↓</a>"}</aside></div>${canSubmit ? `<section class="proof-section" id="proof-section"><div><p class="eyebrow">DOCUMENT YOUR ACTION</p><h2>${c.status === "REJECTED" ? "Let’s take another look." : "Submit your proof."}</h2><p>Your review begins after you send this form. Only an approval awards points.</p>${c.completion?.rejection_reason ? `<div class="notice warning"><strong>Reviewer’s feedback</strong><p>${esc(c.completion.rejection_reason)}</p></div>` : ""}${user?.trust_score < 30 ? '<p class="notice warning">Your recent submissions require additional verification. Include a clear photo and specific details. You can still participate.</p>' : ""}</div><form id="proof-form" class="eco-form"><label>Upload evidence ${required ? "(required)" : "(optional)"}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" ${required ? "required" : ""}></label><p class="field-note">JPEG, PNG, or WebP · up to 4 MB / 24 megapixels. Location metadata is stripped. Visible only to you and administrators.</p><img id="proof-preview" alt="Preview of your selected evidence" hidden><label>What did you do?<textarea name="description" minlength="20" maxlength="2000" rows="5" required placeholder="Describe what you did, when, and how the photo relates to your action."></textarea></label><label>Optional location<input name="location" maxlength="200" placeholder="A general area is enough"></label><p id="proof-error" class="form-error" role="alert"></p><button class="button button-dark" type="submit">Submit for verification ↗</button></form></section>` : ""}`;
    root.querySelector("#refresh-status")?.addEventListener("click", load);
    root
      .querySelector("#start-challenge")
      ?.addEventListener("click", async (e) => {
        e.currentTarget.disabled = true;
        try {
          await api(`/challenges/${id}/start`, { method: "POST", body: {} });
          toast(
            "Challenge started. Complete the action in real life, then share your proof.",
          );
          await load();
        } catch (err) {
          toast(err.message);
          e.target.disabled = false;
        }
      });
    const form = root.querySelector("#proof-form");
    if (form) {
      const draftKey = `eco-proof-draft-${id}`,
        draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft) {
        form.elements.description.value = draft.description || "";
        form.elements.location.value = draft.location || "";
        form.insertAdjacentHTML(
          "afterbegin",
          '<p class="notice">Draft restored. Photos are never stored in this browser; choose the file again.</p>',
        );
      }
      const saveDraft = () =>
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            description: form.elements.description.value,
            location: form.elements.location.value,
          }),
        );
      form.elements.description.addEventListener("input", saveDraft);
      form.elements.location.addEventListener("input", saveDraft);
      let photo = null;
      form.elements.photo.onchange = async () => {
        const file = form.elements.photo.files[0],
          preview = root.querySelector("#proof-preview");
        photo = null;
        preview.hidden = true;
        root.querySelector("#proof-error").textContent = "";
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          root.querySelector("#proof-error").textContent =
            "Please choose a photo under 4 MB.";
          form.elements.photo.value = "";
          return;
        }
        photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        preview.src = photo;
        preview.hidden = false;
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        root.querySelector("#proof-error").textContent = "";
        try {
          await api(`/challenges/${id}/submit`, {
            method: "POST",
            body: {
              photo,
              description: form.elements.description.value,
              location: form.elements.location.value,
            },
          });
          toast("Proof submitted. Your points stay unchanged until approval.");
          localStorage.removeItem(draftKey);
          await load();
          root.scrollIntoView({ block: "start" });
        } catch (err) {
          root.querySelector("#proof-error").textContent = err.message;
          button.disabled = false;
        }
      };
    }
  } catch (e) {
    errorState(root, e);
  }
}
load();
