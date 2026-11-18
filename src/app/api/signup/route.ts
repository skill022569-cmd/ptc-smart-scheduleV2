import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, tx } from "@/lib/db";
import { audit, clientInfo, maskEmail, setPending } from "@/lib/auth";
import { passwordProblem } from "@/lib/login";
import { sendOtp } from "@/lib/otp";
import { PDPA_VERSION } from "@/lib/config";

const Body = z.object({
  role: z.enum(["student", "teacher"]),
  code: z.string().trim().min(1).max(20),          // student id or teacher id
  first_name: z.string().trim().min(1).max(100),  // must match the college roster
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
  consent: z.literal(true),
});
const firstName = (full: string) => full.trim().replace(/^(นางสาว|นาย|นาง|ครู|น\.ส\.)\s*/, "").split(/\s+/)[0];
const NOT_FOUND = "ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบรหัสและชื่อจริงให้ตรงกับที่วิทยาลัยบันทึกไว้";

// Self sign-up for people already on the college roster. Creates (or re-claims a never-used) account,
// then sends an OTP to the email; /api/signup/verify finishes it.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const f = p.error.issues[0]?.path[0];
    return NextResponse.json({ error: f === "email" ? "รูปแบบอีเมลไม่ถูกต้อง" : f === "consent" ? "ต้องยอมรับนโยบายความเป็นส่วนตัว" : "กรอกข้อมูลไม่ครบ" }, { status: 400 });
  }
  const d = p.data;

  // Per-IP limit against guessing ids/names: 10 sign-up attempts per hour.
  const { ip } = await clientInfo();
  const [r] = await q<{ n: string }>("SELECT COUNT(*) n FROM audit_logs WHERE event='SIGNUP_START' AND ip=? AND created_at > NOW() - INTERVAL 1 HOUR", [ip]);
  if (Number(r.n) >= 10) return NextResponse.json({ error: "พยายามสมัครบ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
  await audit(null, "SIGNUP_START", { role: d.role, code: d.code });

  const isStudent = d.role === "student";
  const recordId = isStudent ? d.code : d.code.toUpperCase();
  const [rec] = await q<{ full_name: string; user_id: string | null }>(
    isStudent ? "SELECT full_name, user_id FROM students WHERE student_id=?" : "SELECT full_name, user_id FROM teachers WHERE teacher_id=?", [recordId]);
  if (!rec || firstName(rec.full_name) !== firstName(d.first_name)) return NextResponse.json({ error: NOT_FOUND }, { status: 400 });

  const username = isStudent ? recordId : recordId.toLowerCase();
  const pwErr = passwordProblem(d.password, username);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  // An existing account can be re-claimed only if it was never used: email unverified and no successful login.
  if (rec.user_id) {
    const [u] = await q<{ is_email_verified: number; used: string }>(
      `SELECT is_email_verified, (SELECT COUNT(*) FROM audit_logs WHERE user_id=? AND event='LOGIN_SUCCESS') AS used FROM users WHERE user_id=?`,
      [rec.user_id, rec.user_id]);
    if (u && (u.is_email_verified || Number(u.used) > 0)) {
      return NextResponse.json({ error: "รหัสนี้มีบัญชีที่ใช้งานแล้ว กรุณาเข้าสู่ระบบ (ลืมรหัสผ่านติดต่อฝ่ายวิชาการ)" }, { status: 409 });
    }
  }
  const [taken] = await q("SELECT 1 FROM users WHERE email=? AND (user_id<>? OR ? IS NULL)", [d.email, rec.user_id, rec.user_id]);
  if (taken) return NextResponse.json({ error: "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว" }, { status: 400 });

  const hash = await bcrypt.hash(d.password, 10);
  // Teachers can see student rosters and edit their time blocks, so a self-signed-up teacher waits for admin approval.
  const approved = isStudent;
  const userId = await tx(async (c) => {
    if (rec.user_id) {
      await c.query(`UPDATE users SET password_hash=?, email=?, is_email_verified=FALSE, must_change_password=FALSE, approved=?,
                       pdpa_consent=TRUE, pdpa_version=?, consent_at=NOW(), failed_attempts=0, locked_until=NULL WHERE user_id=?`,
        [hash, d.email, approved, PDPA_VERSION, rec.user_id]);
      return rec.user_id;
    }
    await c.query(`INSERT INTO users (username, password_hash, email, is_email_verified, role, must_change_password, approved, pdpa_consent, pdpa_version, consent_at)
                   VALUES (?,?,?,FALSE,?,FALSE,?,TRUE,?,NOW())`, [username, hash, d.email, d.role, approved, PDPA_VERSION]);
    const [[u]] = (await c.query("SELECT user_id FROM users WHERE username=?", [username])) as unknown as [{ user_id: string }[]];
    await c.query(isStudent ? "UPDATE students SET user_id=? WHERE student_id=?" : "UPDATE teachers SET user_id=? WHERE teacher_id=?", [u.user_id, recordId]);
    return u.user_id;
  });

  const err = await sendOtp(userId, d.email, "VERIFY_EMAIL");
  if (err) return NextResponse.json({ error: err }, { status: 429 });
  await setPending(userId);
  return NextResponse.json({ ok: true, email: maskEmail(d.email), username });
}
