import "./shell.js";
import { api, errorState, toast } from "./api.js";
const root = document.querySelector("#settings-content");
try {
  const user = await api("/auth/me");
  root.innerHTML = `<div class="settings-grid"><section><h2>Security</h2><form id="password-form" class="eco-form"><label>Current password<input name="current" type="password" required></label><label>New password<input name="next" type="password" minlength="10" required></label><button class="button button-dark">Change password</button></form><button id="reset-link" class="text-link">Create password-reset link</button><p id="reset-result" class="field-note"></p></section><section><h2>Privacy & sharing</h2><label class="checkbox-label"><input id="public-forest" type="checkbox" ${user.public_forest ? "checked" : ""}> Make my forest totals public</label><p class="field-note">This exposes only your display name, verified totals, trust and badges—never email, location or evidence.</p><h2>Your data</h2><p>Download your account, attempts, decisions and badges as JSON.</p><a class="button button-outline-dark" href="/api/account/export" download>Download my data â†“</a><h3>Evidence retention</h3><p>Reviewed evidence is retained for audit and resubmission history. Public sharing is always optional and can only use approved actions.</p><a href="showcase.html?id=${user.id}" class="text-link">Open my public forest view â†—</a></section><section class="danger-zone"><h2>Delete account</h2><p>This permanently removes your account and database records. Private proof files are deleted with the database records.</p><form id="delete-form" class="eco-form"><label>Password<input name="password" type="password" required></label><label>Type DELETE MY ECOVERSE<input name="confirmation" required></label><button class="button button-outline-dark">Delete permanently</button></form></section></div>`;
  root.querySelector("#public-forest").onchange = async (e) => {
    try {
      await api("/account/privacy", {
        method: "PATCH",
        body: { publicForest: e.target.checked },
      });
      toast(
        e.target.checked ? "Public forest enabled." : "Public forest disabled.",
      );
    } catch (err) {
      e.target.checked = !e.target.checked;
      toast(err.message);
    }
  };
  root.querySelector("#password-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api("/account/password", {
        method: "PATCH",
        body: {
          currentPassword: f.elements.current.value,
          newPassword: f.elements.next.value,
        },
      });
      f.reset();
      toast("Password changed.");
    } catch (err) {
      toast(err.message);
    }
  };
  root.querySelector("#reset-link").onclick = async () => {
    const r = await api("/account/reset-link", { method: "POST", body: {} });
    root.querySelector("#reset-result").textContent = r.developmentToken
      ? `${r.message} Local token: ${r.developmentToken}`
      : r.message;
  };
  root.querySelector("#delete-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!confirm("Permanently delete this account? This cannot be undone."))
      return;
    try {
      await api("/account", {
        method: "DELETE",
        body: {
          password: f.elements.password.value,
          confirmation: f.elements.confirmation.value,
        },
      });
      location.href = "index.html";
    } catch (err) {
      toast(err.message);
    }
  };
} catch (e) {
  errorState(root, e);
}
