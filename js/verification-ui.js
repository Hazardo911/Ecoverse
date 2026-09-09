import { escapeHTML as esc } from "./api.js";
export const statusNames = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PENDING: "Pending verification",
  APPROVED: "Verified ✓",
  REJECTED: "Needs another look",
};
export const statusPill = (status) =>
  `<span class="status-pill status-${esc(status)}">${statusNames[status] || esc(status)}</span>`;
export const date = (value) =>
  value
    ? new Date(
        value.includes("T") ? value : value.replace(" ", "T") + "Z",
      ).toLocaleString()
    : "—";
export const activityList = (items) =>
  items.length
    ? `<div class="activity-feed">${items.map((c) => `<a class="activity-item" href="challenge.html?id=${c.challenge_id}"><div><strong>${esc(c.title)}</strong><small>${esc(date(c.reviewed_at || c.submitted_at || c.created_at))}</small>${c.rejection_reason ? `<p>${esc(c.rejection_reason)}</p>` : ""}</div>${statusPill(c.status)}</a>`).join("")}</div>`
    : '<div class="empty-state"><h3>Your next chapter starts outside.</h3><p>Choose a challenge, do the action, and document your journey.</p><a class="button button-dark" href="challenges.html">Find a challenge ↗</a></div>';
export const badgeList = (items) =>
  items.length
    ? items
        .map(
          (b) =>
            `<article class="earned-badge"><span aria-hidden="true">Award</span><div><strong>${esc(b.name)}</strong><small>${esc(b.description)}</small><small>${b.kind === "learning" ? "Learning badge · no Eco Points" : "Verified participation"}</small></div></article>`,
        )
        .join("")
    : '<p class="field-note">Your first approved action unlocks First Seed.</p>';
