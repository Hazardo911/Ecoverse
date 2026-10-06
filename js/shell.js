import { api, escapeHTML, toast } from "./api.js";
import "../css/features.css";
import "../css/verification.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
const links = [
  ["dashboard", "My World", "dashboard.html"],
  ["explore", "Discover", "explore.html"],
  ["challenges", "Challenges", "challenges.html"],
  ["community", "Community", "community.html"],
  ["connect", "Connect", "connect.html"],
];
const page = document.body.dataset.page;
if (!document.querySelector('link[rel="manifest"]'))
  document.head.insertAdjacentHTML(
    "beforeend",
    '<link rel="manifest" href="/manifest.webmanifest">',
  );
document.addEventListener("click", async (event) => {
  const link = event.target.closest('a[href="/api/user/report"]');
  if (!link) return;
  event.preventDefault();
  if (link.dataset.loading) return;
  link.dataset.loading = "true";
  try {
    const response = await fetch("/api/user/report", {
      credentials: "same-origin",
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error?.message || "Could not download report.");
    }
    const url = URL.createObjectURL(await response.blob()),
      download = document.createElement("a");
    download.href = url;
    download.download = `ecoverse-impact-${new Date().toISOString().slice(0, 10)}.html`;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    toast(e.message);
  } finally {
    delete link.dataset.loading;
  }
});
document.body.insertAdjacentHTML(
  "afterbegin",
  `<a class="skip-link" href="#main">Skip to content</a><div class="scroll-progress"></div><header class="site-header"><nav aria-label="Main navigation"><a class="brand" href="index.html"><img src="/ecoverse-mark.png" alt="" />ECOVERSE</a><button class="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="main-menu"><span></span><span></span></button><div class="nav-shell" id="main-menu"><div class="nav-links">${links.map(([id, name, href]) => `<a ${id === page ? 'aria-current="page"' : ""} href="${href}">${name}</a>`).join("")}</div><a class="nav-cta" href="auth.html" id="account-link">Start growing ↗</a></div></nav></header>`,
);
document.body.insertAdjacentHTML(
  "beforeend",
  '<footer><a class="brand" href="index.html">ECOVERSE</a><span>Verified environmental action.</span><a href="about.html">Project notes ↗</a><span>© 2026</span></footer>',
);
const header = document.querySelector(".site-header"),
  toggle = document.querySelector(".menu-toggle");
toggle.onclick = () => {
  const open = header.classList.toggle("menu-open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    header.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});
addEventListener(
  "scroll",
  () => {
    header.classList.toggle("scrolled", scrollY > 20);
    document.querySelector(".scroll-progress").style.transform =
      `scaleX(${scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
  },
  { passive: true },
);
api("/auth/me")
  .then((user) => {
    const link = document.querySelector("#account-link");
    link.textContent = user.name;
    link.href = "profile.html";
    const score = document.createElement("span");
    score.className = "nav-score";
    score.textContent = `Eco Score ${user.eco_score}/100`;
    link.before(score);
    const logout = document.createElement("button");
    logout.className = "logout-btn";
    logout.textContent = "Sign out";
    logout.onclick = async () => {
      try {
        await api("/auth/logout", { method: "POST", body: {} });
        location.href = "index.html";
      } catch (e) {
        toast(e.message);
      }
    };
    link.after(logout);
    if (user.role === "admin")
      document
        .querySelector(".nav-links")
        .insertAdjacentHTML("beforeend", '<a href="admin.html">Admin</a>');
    const notes = document.createElement("a");
    notes.href = "community.html";
    notes.className = "notification-link";
    notes.textContent = "Updates";
    link.before(notes);
  })
  .catch((e) => {
    if (e.status === 401) {
      document.querySelector(".nav-links").innerHTML =
        '<a href="dashboard.html">My World</a><a href="explore.html">Discover</a><a href="challenges.html">Challenges</a><a href="community.html">Community</a><a href="connect.html">Connect</a><a href="auth.html#login">Login</a>';
      document.querySelector("#account-link").textContent = "Start journey ↗";
    }
  });
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.utils.toArray("[data-reveal]").forEach((el) =>
    gsap.from(el, {
      y: 35,
      opacity: 0,
      duration: 0.8,
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
    }),
  );
}
if ("serviceWorker" in navigator)
  addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
