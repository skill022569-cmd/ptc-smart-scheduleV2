import "server-only";
import { createHash, randomInt } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { q } from "./db";

export type Role = "student" | "teacher" | "admin";
// actor = the admin who is viewing the site as this user (impersonation); absent for normal logins.
export type Session = { uid: string; role: Role; username: string; actor?: { uid: string; username: string } };

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
};
const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const OTP_MINUTES = 5;

async function sign(payload: Record<string, unknown>, exp: string) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(secret());
}
async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret())).payload as T;
  } catch {
    return null;
  }
}

export async function setSession(s: Session) {
  (await cookies()).set("session", await sign(s, "8h"), { ...cookieOpts, maxAge: 8 * 3600 });
}
export async function clearSession() {
  (await cookies()).delete("session");
}
export async function getSession() {
  return verify<Session>((await cookies()).get("session")?.value);
}

// Between password check and OTP check for staff.
export async function setPending(uid: string) {
  (await cookies()).set("pending2fa", await sign({ uid }, `${OTP_MINUTES}m`), { ...cookieOpts, maxAge: OTP_MINUTES * 60 });
}
export async function getPending() {
  return verify<{ uid: string }>((await cookies()).get("pending2fa")?.value);
}
export async function clearPending() {
  (await cookies()).delete("pending2fa");
}

// For server pages: returns the session or redirects. Also enforces first-login steps.
export async function requireUser(roles?: Role[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  const [u] = await q<{ must_change_password: number; pdpa_consent: number }>(
    "SELECT must_change_password, pdpa_consent FROM users WHERE user_id=?", [s.uid]);
  if (!u) redirect("/api/auth/logout");
  // An impersonating admin must not set a password or give PDPA consent on the owner's behalf, so skip onboarding.
  if (!s.actor && (u.must_change_password || !u.pdpa_consent)) redirect("/onboarding");
  if (roles && !roles.includes(s.role)) redirect("/");
  return s;
}

// For API routes: returns session or null (caller answers 401/403).
export async function apiUser(roles?: Role[]) {
  const s = await getSession();
  if (!s || (roles && !roles.includes(s.role))) return null;
  return s;
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function clientInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ua = (h.get("user-agent") ?? "unknown").slice(0, 500);
  // Device fingerprint: browser + /24 network, so a changing last IP octet is not "new device".
  const net = ip.includes(".") ? ip.split(".").slice(0, 3).join(".") : ip;
  return { ip, ua, device: sha256(`${ua}|${net}`).slice(0, 16) };
}

export async function audit(userId: string | null, event: string, detail: Record<string, unknown> = {}) {
  const { ip, ua } = await clientInfo();
  await q("INSERT INTO audit_logs (user_id, event, ip, user_agent, detail) VALUES (?,?,?,?,?)",
    [userId, event, ip, ua, JSON.stringify(detail)]);
}

export async function displayName(uid: string) {
  const [r] = await q<{ name: string | null }>(
    `SELECT COALESCE(u.display_name, st.full_name, t.full_name) AS name FROM users u
       LEFT JOIN students st ON st.user_id = u.user_id LEFT JOIN teachers t ON t.user_id = u.user_id
      WHERE u.user_id = ?`, [uid]);
  return r?.name ?? null;
}

export function maskEmail(email: string | null | undefined) {
  if (!email) return "-";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}
