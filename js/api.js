export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response
    .json()
    .catch(() => ({
      error: { message: "The server returned an invalid response." },
    }));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload.data;
}
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function errorState(container, error) {
  container.innerHTML = `<div class="empty-state" role="alert"><h3>${error.status === 401 ? "Your world starts here." : "Unable to load this view"}</h3><p>${escapeHTML(error.message)}</p>${error.status === 401 ? '<a class="button button-primary" href="auth.html">Sign in / Register ↗</a>' : '<button class="button button-primary" data-retry>Try again</button>'}</div>`;
  container
    .querySelector("[data-retry]")
    ?.addEventListener("click", () => location.reload());
}
export function toast(message) {
  let region = document.querySelector(".toast-stack");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-stack";
    region.setAttribute("role", "status");
    document.body.append(region);
  }
  const el = document.createElement("div");
  el.className = "eco-toast";
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 5000);
}
