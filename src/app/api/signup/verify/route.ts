import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { audit, clearPending, getPending } from "@/lib/auth";
import { finishLogin, lockedMessage, registerFailure, USER_COLS, type LoginUser } from "@/lib/login";
import { consumeOtp } from "@/lib/otp";

// { code } → verifies the sign-up email; students are signed in, teachers wait for admin approval.
export async function POST(req: Request) {
  const pending = await getPending();
  if (!pending) return NextResponse.json({ error: "หมดเวลา กรุณาสมัครใหม่อีกครั้ง" }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const [u] = await q<LoginUser>(`SELECT ${USER_COLS} FROM users WHERE user_id=?`, [pending.uid]);
  if (!u) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
  if (Number(u.locked)) return NextResponse.json({ error: lockedMessage(u) }, { status: 423 });
  if (!(await consumeOtp(u.user_id, "VERIFY_EMAIL", String(code ?? "")))) {
    return NextResponse.json({ error: await registerFailure(u, "otp") }, { status: 401 });
  }
  await q("UPDATE users SET is_email_verified=TRUE, failed_attempts=0 WHERE user_id=?", [u.user_id]);
  await clearPending();
  await audit(u.user_id, "SIGNUP_COMPLETE", { role: u.role });
  if (!Number(u.approved)) return NextResponse.json({ ok: true, pendingApproval: true });
  await finishLogin(u);
  return NextResponse.json({ ok: true });
}
