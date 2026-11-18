import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { clearPending, getPending } from "@/lib/auth";
import { consumeOtp } from "@/lib/otp";
import { finishLogin, lockedMessage, registerFailure, USER_COLS, type LoginUser } from "@/lib/login";

export async function POST(req: Request) {
  const pending = await getPending();
  if (!pending) return NextResponse.json({ error: "หมดเวลา กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "กรอกรหัส 6 หลัก" }, { status: 400 });

  const [u] = await q<LoginUser>(`SELECT ${USER_COLS} FROM users WHERE user_id=?`, [pending.uid]);
  if (!u) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
  if (Number(u.locked)) return NextResponse.json({ error: lockedMessage(u) }, { status: 423 });

  if (!(await consumeOtp(u.user_id, "2FA_LOGIN", code))) return NextResponse.json({ error: await registerFailure(u, "otp") }, { status: 401 });

  await clearPending();
  await finishLogin(u);
  return NextResponse.json({ ok: true });
}
