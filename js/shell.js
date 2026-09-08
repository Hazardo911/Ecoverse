import { api, escapeHTML, toast } from "./api.js";
import '../css/features.css';
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
const links = [
  ["home", "Home", "index.html"],
  ["explore", "Explore", "explore.html"],
  ["challenges", "Challenges", "challenges.html"],
  ["journey", "Journey", "journey.html"],
  ["forest", "My Forest", "forest.html"],
  ["impact", "Impact", "impact.html"],
  ["leaderboard", "Leaderboard", "leaderboard.html"],
];
const page = document.body.dataset.page;
document.addEventListener('click',async event=>{
 const link=event.target.closest('a[href="/api/user/report"]');if(!link)return;event.preventDefault();
 if(link.dataset.loading)return;link.dataset.loading='true';
 try{const response=await fetch('/api/user/report',{credentials:'same-origin'});if(!response.ok){const payload=await response.json();throw new Error(payload.error?.message||'Could not download report.')}const url=URL.createObjectURL(await response.blob()),download=document.createElement('a');download.href=url;download.download=`ecoverse-impact-${new Date().toISOString().slice(0,10)}.html`;download.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(e){toast(e.message)}finally{delete link.dataset.loading}
});
document.body.insertAdjacentHTML(
  "afterbegin",
  `<a class="skip-link" href="#main">Skip to content</a><div class="scroll-progress"></div><header class="site-header"><nav aria-label="Main navigation"><a class="brand" href="index.html"><span class="brand-mark">✳</span>ECOVERSE</a><button class="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="main-menu"><span></span><span></span></button><div class="nav-shell" id="main-menu"><div class="nav-links">${links.map(([id, name, href]) => `<a ${id === page ? 'aria-current="page"' : ""} href="${href}">${name}</a>`).join("")}</div><a class="nav-cta" href="auth.html" id="account-link">Start growing ↗</a></div></nav></header>`,
);
document.body.insertAdjacentHTML(
  "beforeend",
  '<footer><a class="brand" href="index.html">✳ ECOVERSE</a><span>Small choices. Living change.</span><a href="about.html">Our story ↗</a><span>© 2026</span></footer>',
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
    link.href = "forest.html";
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
  })
  .catch(() => {});
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.utils
    .toArray("[data-reveal]")
    .forEach((el) =>
      gsap.from(el, {
        y: 35,
        opacity: 0,
        duration: 0.8,
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      }),
    );
}
