import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q, tx } from "@/lib/db";
import { apiUser, audit, clearSession } from "@/lib/auth";
import { passwordProblem } from "@/lib/login";

// PDPA: export everything the system stores about me.
export async function GET() {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [user] = await q(
    "SELECT user_id, username, email, role, pdpa_consent, pdpa_version, consent_at, ui_theme, created_at FROM users WHERE user_id=?", [s.uid]);
  const data = {
    exported_at: new Date().toISOString(),
    user,
    student: await q("SELECT * FROM students WHERE user_id=?", [s.uid]),
    teacher: await q("SELECT * FROM teachers WHERE user_id=?", [s.uid]),
    login_history: await q("SELECT event, ip, user_agent, created_at FROM audit_logs WHERE user_id=? ORDER BY created_at DESC", [s.uid]),
  };
  await audit(s.uid, "DATA_EXPORT");
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="my-data-${s.username}.json"` },
  });
}

export async function PATCH(req: Request) {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ui_theme?: Record<string, string>; current?: string; password?: string };

  if (body.ui_theme) {
    const theme = Object.fromEntries(
      Object.entries(body.ui_theme).filter(([k, v]) => ["background", "card", "accent"].includes(k) && /^#[0-9a-f]{6}$/i.test(v)));
    await q("UPDATE users SET ui_theme=? WHERE user_id=?", [JSON.stringify(theme), s.uid]);
    return NextResponse.json({ ok: true });
  }
  if (body.password) {
    const [u] = await q<{ password_hash: string }>("SELECT password_hash FROM users WHERE user_id=?", [s.uid]);
    if (!(await bcrypt.compare(body.current ?? "", u.password_hash))) return NextResponse.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 400 });
    const err = passwordProblem(body.password, s.username);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await q("UPDATE users SET password_hash=? WHERE user_id=?", [await bcrypt.hash(body.password, 10), s.uid]);
    await audit(s.uid, "PASSWORD_CHANGED");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}

// PDPA: right to be forgotten. Security audit logs stay until their 1-year TTL (legal retention).
export async function DELETE() {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (s.role === "admin") return NextResponse.json({ error: "บัญชีผู้ดูแลระบบต้องให้ผู้ดูแลคนอื่นลบให้" }, { status: 400 });
  await audit(s.uid, "ACCOUNT_DELETED");
  await tx(async (c) => {
    await c.query("DELETE FROM students WHERE user_id=?", [s.uid]);
    // A teacher's name stays in published timetables; only the login account and its link are removed.
    await c.query("UPDATE teachers SET user_id=NULL WHERE user_id=?", [s.uid]);
    await c.query("DELETE FROM otp_logs WHERE user_id=?", [s.uid]);
    await c.query("DELETE FROM users WHERE user_id=?", [s.uid]);
  });
  await clearSession();
  return NextResponse.json({ ok: true });
}
