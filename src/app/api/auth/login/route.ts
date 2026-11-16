import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q } from "@/lib/db";
import { audit, clientInfo, newOtp, setPending, sha256, maskEmail } from "@/lib/auth";
import { finishLogin, lockedMessage, registerFailure, USER_COLS, type LoginUser } from "@/lib/login";
import { sendMail } from "@/lib/mail";

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

  if (u.role === "student") {
    await finishLogin(u);
    return NextResponse.json({ ok: true });
  }

  // Staff: second factor by email OTP.
  if (!u.email) return NextResponse.json({ error: "บัญชีนี้ยังไม่ได้ลงทะเบียนอีเมล ติดต่อผู้ดูแลระบบ" }, { status: 400 });
  const code = newOtp();
  const { ua } = await clientInfo();
  await q("INSERT INTO otp_logs (user_id, target_email, otp_code, purpose, device_info) VALUES (?,?,?,?,?)",
    [u.user_id, u.email, sha256(code), "2FA_LOGIN", ua]);
  await sendMail(u.email, "[PTC Smart Schedule] รหัส OTP สำหรับเข้าสู่ระบบ",
    `รหัส OTP ของคุณคือ ${code}\nรหัสนี้ใช้ได้ภายใน 5 นาที ห้ามเปิดเผยรหัสนี้แก่ผู้อื่น`);
  await setPending(u.user_id);
  await audit(u.user_id, "OTP_SENT");
  return NextResponse.json({ otp: true, email: maskEmail(u.email) });
}
