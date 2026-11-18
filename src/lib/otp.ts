import "server-only";
import { timingSafeEqual } from "node:crypto";
import { q } from "./db";
import { audit, clientInfo, newOtp, sha256, OTP_MINUTES } from "./auth";
import { sendMail } from "./mail";

export type OtpPurpose = "2FA_LOGIN" | "VERIFY_EMAIL";

const SUBJECT: Record<OtpPurpose, string> = {
  "2FA_LOGIN": "รหัส OTP สำหรับเข้าสู่ระบบ",
  VERIFY_EMAIL: "รหัส OTP สำหรับยืนยันอีเมล",
};

// Sends a 6-digit code (only its hash is stored). Returns an error message when rate-limited, else null.
export async function sendOtp(userId: string, email: string, purpose: OtpPurpose) {
  const [r] = await q<{ last_min: string; last_hour: string }>(
    `SELECT SUM(created_at > NOW() - INTERVAL 1 MINUTE) last_min, COUNT(*) last_hour
       FROM otp_logs WHERE user_id=? AND created_at > NOW() - INTERVAL 1 HOUR`, [userId]);
  if (Number(r?.last_min) > 0) return "เพิ่งส่งรหัสไป กรุณารอ 1 นาทีก่อนขอรหัสใหม่";
  if (Number(r?.last_hour) >= 5) return "ขอรหัสบ่อยเกินไป กรุณาลองใหม่ในอีก 1 ชั่วโมง";
  const code = newOtp();
  const { ua } = await clientInfo();
  await q("INSERT INTO otp_logs (user_id, target_email, otp_code, purpose, device_info) VALUES (?,?,?,?,?)",
    [userId, email, sha256(code), purpose, ua]);
  await sendMail(email, `[PTC Smart Schedule] ${SUBJECT[purpose]}`,
    `รหัส OTP ของคุณคือ ${code}\nรหัสนี้ใช้ได้ภายใน ${OTP_MINUTES} นาที ห้ามเปิดเผยรหัสนี้แก่ผู้อื่น`);
  await audit(userId, "OTP_SENT", { purpose });
  return null;
}

// True when the code matches the latest unused, unexpired code of this purpose (and marks it used).
export async function consumeOtp(userId: string, purpose: OtpPurpose, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  // TTL removes old rows eventually; the time check here is what enforces the expiry.
  const [otp] = await q<{ otp_id: string; otp_code: string }>(
    `SELECT otp_id, otp_code FROM otp_logs WHERE user_id=? AND purpose=? AND used=FALSE
       AND created_at > NOW() - INTERVAL ${OTP_MINUTES} MINUTE ORDER BY created_at DESC LIMIT 1`, [userId, purpose]);
  if (!otp || !timingSafeEqual(Buffer.from(otp.otp_code), Buffer.from(sha256(code)))) return false;
  await q("UPDATE otp_logs SET used=TRUE WHERE otp_id=?", [otp.otp_id]);
  return true;
}
