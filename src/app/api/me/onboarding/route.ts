import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q } from "@/lib/db";
import { audit, getSession } from "@/lib/auth";
import { PDPA_VERSION } from "@/lib/config";
import { passwordProblem } from "@/lib/login";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (s.actor) return NextResponse.json({ error: "ยอมรับ PDPA แทนเจ้าของบัญชีไม่ได้" }, { status: 403 });
  const { consent, newPassword } = (await req.json().catch(() => ({}))) as { consent?: boolean; newPassword?: string };
  if (consent !== true) return NextResponse.json({ error: "ต้องยอมรับนโยบายความเป็นส่วนตัวก่อนใช้งาน" }, { status: 400 });

  const [u] = await q<{ must_change_password: number; is_email_verified: number }>(
    "SELECT must_change_password, is_email_verified FROM users WHERE user_id=?", [s.uid]);
  if (!u?.is_email_verified) return NextResponse.json({ error: "กรุณายืนยันอีเมลด้วยรหัส OTP ก่อน" }, { status: 400 });
  if (u?.must_change_password) {
    const err = passwordProblem(newPassword, s.username);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await q("UPDATE users SET password_hash=?, must_change_password=FALSE WHERE user_id=?", [await bcrypt.hash(newPassword!, 10), s.uid]);
    await audit(s.uid, "PASSWORD_CHANGED", { first_login: true });
  }
  await q("UPDATE users SET pdpa_consent=TRUE, pdpa_version=?, consent_at=NOW() WHERE user_id=?", [PDPA_VERSION, s.uid]);
  await audit(s.uid, "PDPA_CONSENT", { version: PDPA_VERSION });
  return NextResponse.json({ ok: true });
}
