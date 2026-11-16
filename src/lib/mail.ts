import "server-only";
import nodemailer from "nodemailer";

const configured = () => !!process.env.SMTP_HOST;

export async function sendMail(to: string, subject: string, text: string) {
  if (!configured()) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is not configured");
    // Local development without SMTP: print instead of sending.
    console.log(`\n[DEV MAIL] to=${to}\nsubject=${subject}\n${text}\n`);
    return;
  }
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to, subject, text });
}
