import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { q } from "@/lib/db";
import { clearPending, getPending, sha256, OTP_MINUTES } from "@/lib/auth";
import { finishLogin, lockedMessage, registerFailure, USER_COLS, type LoginUser } from "@/lib/login";

export async function POST(req: Request) {
  const pending = await getPending();
  if (!pending) return NextResponse.json({ error: "หมดเวลา กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "กรอกรหัส 6 หลัก" }, { status: 400 });

  const [u] = await q<LoginUser>(`SELECT ${USER_COLS} FROM users WHERE user_id=?`, [pending.uid]);
  if (!u) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
  if (Number(u.locked)) return NextResponse.json({ error: lockedMessage(u) }, { status: 423 });

  // TTL removes old rows eventually; the time check here is what enforces the 5 minutes.
  const [otp] = await q<{ otp_id: string; otp_code: string }>(
    `SELECT otp_id, otp_code FROM otp_logs WHERE user_id=? AND purpose='2FA_LOGIN' AND used=FALSE
       AND created_at > NOW() - INTERVAL ${OTP_MINUTES} MINUTE ORDER BY created_at DESC LIMIT 1`, [u.user_id]);
  const ok = otp && timingSafeEqual(Buffer.from(otp.otp_code), Buffer.from(sha256(code)));
  if (!ok) return NextResponse.json({ error: await registerFailure(u, "otp") }, { status: 401 });

  await q("UPDATE otp_logs SET used=TRUE WHERE otp_id=?", [otp.otp_id]);
  await clearPending();
  await finishLogin(u);
  return NextResponse.json({ ok: true });
}
