import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { apiUser, audit, getSession, setSession, type Role } from "@/lib/auth";

// Admin starts viewing the site as a student or teacher account. { username }
export async function POST(req: Request) {
  const admin = await apiUser(["admin"]);
  if (!admin || admin.actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  const [u] = await q<{ user_id: string; username: string; role: Role }>(
    "SELECT user_id, username, role FROM users WHERE username=?", [String(username ?? "").trim()]);
  if (!u) return NextResponse.json({ error: "ไม่พบบัญชีนี้" }, { status: 404 });
  // Only non-admin accounts: viewing as another admin would add nothing and blur the audit trail.
  if (u.role === "admin") return NextResponse.json({ error: "ดูในมุมมองของบัญชีแอดมินอื่นไม่ได้" }, { status: 400 });

  await audit(admin.uid, "IMPERSONATE_START", { target: u.username });
  await audit(u.user_id, "VIEWED_BY_ADMIN", { admin: admin.username });
  await setSession({ uid: u.user_id, role: u.role, username: u.username, actor: { uid: admin.uid, username: admin.username } });
  return NextResponse.json({ ok: true });
}

// Back to the admin's own session.
export async function GET(req: Request) {
  const s = await getSession();
  if (s?.actor) {
    await audit(s.actor.uid, "IMPERSONATE_STOP", { target: s.username });
    await setSession({ uid: s.actor.uid, role: "admin", username: s.actor.username });
  }
  return NextResponse.redirect(new URL("/admin", req.url));
}
