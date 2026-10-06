import "./shell.js";
import { api } from "./api.js";
let mode = "register";
const form = document.querySelector("#auth-form");
document.querySelectorAll("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((x) => x.classList.toggle("active", x === b));
      document.querySelector("#name-field").hidden = mode === "login";
      form.elements.name.required = mode === "register";
      form.elements.password.autocomplete =
        mode === "login" ? "current-password" : "new-password";
      form.querySelector("[type=submit]").textContent =
        mode === "login" ? "Sign in ↗" : "Create my account ↗";
      document.querySelector("#auth-error").textContent = "";
    }),
);
form.onsubmit = async (e) => {
  e.preventDefault();
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  document.querySelector("#auth-error").textContent = "";
  try {
    const body = {
      email: form.elements.email.value,
      password: form.elements.password.value,
    };
    if (mode === "register") body.name = form.elements.name.value;
    await api("/auth/" + mode, { method: "POST", body });
    location.href = mode === "register" ? "assessment.html" : "dashboard.html";
  } catch (err) {
    document.querySelector("#auth-error").textContent = err.message;
    button.disabled = false;
  }
};
if(location.hash==='#login')document.querySelector('[data-mode="login"]').click();
