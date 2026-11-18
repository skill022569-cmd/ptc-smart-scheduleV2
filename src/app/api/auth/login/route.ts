import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q } from "@/lib/db";
import { audit, setPending, maskEmail } from "@/lib/auth";
import { finishLogin, lockedMessage, registerFailure, USER_COLS, type LoginUser } from "@/lib/login";
import { sendOtp } from "@/lib/otp";

const Body = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200), portal: z.enum(["student", "staff"]) });
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", 10);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
  const { username, password, portal } = parsed.data;

  const [u] = await q<LoginUser>(`SELECT ${USER_COLS} FROM users WHERE username=?`, [username.trim()]);
  if (!u) {
    await bcrypt.compare(password, DUMMY_HASH); // same timing as a real user
    await audit(null, "LOGIN_FAIL", { username, reason: "unknown_user" });
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  if (Number(u.locked)) return NextResponse.json({ error: lockedMessage(u) }, { status: 423 });
  if ((portal === "student") !== (u.role === "student")) {
    return NextResponse.json({ error: `บัญชีนี้ต้องเข้าทางปุ่ม "${u.role === "student" ? "นักเรียน/นักศึกษา" : "บุคลากร"}"` }, { status: 400 });
  }
  if (!(await bcrypt.compare(password, u.password_hash))) {
    return NextResponse.json({ error: await registerFailure(u, "password") }, { status: 401 });
  }

  if (!Number(u.approved)) {
    return NextResponse.json({ error: "บัญชีนี้รอแอดมินอนุมัติก่อนใช้งาน กรุณาติดต่อฝ่ายวิชาการ" }, { status: 403 });
  }

  // Email not verified yet (new or admin-created account): sign in, then onboarding verifies the email by OTP
  // before anything else works (requireUser / apiUser block until it is done).
  // shortcut: SKIP_OTP_USERNAMES (comma list, set only in Vercel env) bypasses login 2FA for verified accounts while email delivery is being fixed; remove before real use.
  const skipOtp = (process.env.SKIP_OTP_USERNAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(u.username);
  if (u.role === "student" || !Number(u.is_email_verified) || !u.email || skipOtp) {
    if (skipOtp && Number(u.is_email_verified)) await audit(u.user_id, "OTP_BYPASSED");
    await finishLogin(u);
    return NextResponse.json({ ok: true });
  }

  // Staff with a verified email: second factor by email OTP.
  const err = await sendOtp(u.user_id, u.email, "2FA_LOGIN");
  if (err) return NextResponse.json({ error: err }, { status: 429 });
  await setPending(u.user_id);
  return NextResponse.json({ otp: true, email: maskEmail(u.email) });
}
