import nodemailer from "nodemailer";
let transport;
function client() {
  if (!process.env.SMTP_HOST) return null;
  return (transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  }));
}
export async function sendReviewEmail({
  email,
  name,
  decision,
  points,
  reason,
}) {
  const mail = client();
  if (!mail) return { sent: false, reason: "SMTP not configured" };
  await mail.sendMail({
    from: process.env.EMAIL_FROM || "EcoVerse <no-reply@localhost>",
    to: email,
    subject:
      decision === "APPROVED"
        ? "Your EcoVerse evidence was approved"
        : "Your EcoVerse evidence needs another look",
    text:
      decision === "APPROVED"
        ? `Hi ${name}, your evidence was approved and ${points} verified Eco Points were added.`
        : `Hi ${name}, your evidence was not approved. ${reason || "Open EcoVerse for reviewer feedback and resubmit when ready."}`,
  });
  return { sent: true };
}
