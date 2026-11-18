import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { audit, getSession, maskEmail } from "@/lib/auth";
import { lockedMessage, registerFailure, USER_COLS, type LoginUser } from "@/lib/login";
import { consumeOtp, sendOtp } from "@/lib/otp";

// Step 1 of first-login setup: { email } → save it (unverified) and send a code to it.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (s.actor) return NextResponse.json({ error: "ยืนยันอีเมลแทนเจ้าของบัญชีไม่ได้" }, { status: 403 });
  const p = z.object({ email: z.string().trim().toLowerCase().email().max(255) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  const [u] = await q<{ is_email_verified: number }>("SELECT is_email_verified FROM users WHERE user_id=?", [s.uid]);
  if (!u) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
  if (u.is_email_verified) return NextResponse.json({ error: "บัญชีนี้ยืนยันอีเมลแล้ว" }, { status: 400 });
  const [taken] = await q("SELECT 1 FROM users WHERE email=? AND user_id<>?", [p.data.email, s.uid]);
  if (taken) return NextResponse.json({ error: "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว" }, { status: 400 });

  await q("UPDATE users SET email=? WHERE user_id=?", [p.data.email, s.uid]);
  const err = await sendOtp(s.uid, p.data.email, "VERIFY_EMAIL");
  if (err) return NextResponse.json({ error: err }, { status: 429 });
  return NextResponse.json({ ok: true, email: maskEmail(p.data.email) });
}

// Step 2: { code } → mark the email verified.
export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (s.actor) return NextResponse.json({ error: "ยืนยันอีเมลแทนเจ้าของบัญชีไม่ได้" }, { status: 403 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const [u] = await q<LoginUser>(`SELECT ${USER_COLS} FROM users WHERE user_id=?`, [s.uid]);
  if (!u) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
  if (Number(u.locked)) return NextResponse.json({ error: lockedMessage(u) }, { status: 423 });
  if (!(await consumeOtp(u.user_id, "VERIFY_EMAIL", String(code ?? "")))) {
    return NextResponse.json({ error: await registerFailure(u, "otp") }, { status: 401 });
  }
  await q("UPDATE users SET is_email_verified=TRUE, failed_attempts=0 WHERE user_id=?", [s.uid]);
  await audit(s.uid, "EMAIL_VERIFIED");
  return NextResponse.json({ ok: true });
}
