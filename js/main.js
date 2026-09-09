import "./shell.js";
import { createWorld } from "./world.js";
import { api, escapeHTML } from "./api.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hero = createWorld(document.querySelector("#eco-world"));
const growing = createWorld(document.querySelector("#growth-world"), {
  growth: 0,
  story: true,
});
const preview = createWorld(document.querySelector("#preview-world"), {
  growth: 0,
});
if (!reduced) {
  const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  gsap.from(".hero-copy > *", {
    y: 35,
    opacity: 0,
    stagger: 0.13,
    duration: 1,
    delay: 0.15,
  });
  if (growing)
    gsap.to(growing.controls, {
      growth: 1,
      travel: 1,
      ease: "none",
      scrollTrigger: {
        trigger: ".growth-story",
        start: "top top",
        end: "+=380%",
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          const index = Math.min(4, Math.floor(self.progress * 5));
          document
            .querySelectorAll(".story-caption")
            .forEach((el, i) => el.classList.toggle("active", i === index));
          document.querySelector("#story-number").textContent = String(
            index + 1,
          ).padStart(2, "0");
          document.querySelector(".story-meter i").style.transform =
            `scaleX(${self.progress})`;
        },
      },
    });
} else {
  growing?.setGrowth(1);
  document.querySelectorAll('.story-caption').forEach(el=>el.classList.remove('active'));
  document.querySelector(".story-caption:last-child")?.classList.add("active");
}
api("/user/progress")
  .then((s) => {
    preview?.setProgress(s);
    document.querySelector("#preview-title").textContent =
      `Level ${s.forestLevel} · ${s.ecoPoints.toLocaleString()} points`;
    document.querySelector("#preview-copy").textContent =
      `${s.treesUnlocked} trees unlocked · ${s.challengesCompleted} verified actions`;
    document.querySelector("#home-actions").textContent = s.challengesCompleted;
    document.querySelector("#home-points").textContent = s.ecoPoints;
    document.querySelector("#home-trees").textContent = s.treesUnlocked;
  })
  .catch(() => {
    document.querySelector("#preview-title").textContent =
      "Your first seed is waiting";
    document.querySelector("#preview-copy").textContent =
      "Create an account to begin your personal ecosystem.";
  });
api("/challenges")
  .then((rows) => {
    document.querySelector("#home-challenges").innerHTML = rows
      .slice(0, 3)
      .map(
        (c) =>
          `<a class="mission-preview" href="challenges.html"><span>${escapeHTML(c.category)}</span><h3>${escapeHTML(c.title)}</h3><strong>+${c.points} <small>EP</small></strong><b>↗</b></a>`,
      )
      .join("");
  })
  .catch(
    () =>
      (document.querySelector("#home-challenges").textContent =
        "Challenges will appear when the service reconnects."),
  );
addEventListener(
  "pagehide",
  () => {
    hero?.destroy();
    growing?.destroy();
    preview?.destroy();
  },
  { once: true },
);
