import "server-only";
import { q } from "./db";
import { audit, clientInfo, setSession, LOCK_MINUTES, MAX_ATTEMPTS, type Role } from "./auth";
import { sendMail } from "./mail";
import { parseJson } from "./timetable";

export type LoginUser = {
  user_id: string; username: string; password_hash: string; email: string | null; role: Role;
  failed_attempts: number; lock_left: number | null; known_devices: unknown;
  locked: number | string; // comparison result is BIGINT, which comes back as the string "0"/"1"
};

export const USER_COLS = `user_id, username, password_hash, email, role, failed_attempts, known_devices,
  (locked_until IS NOT NULL AND locked_until > NOW()) AS locked,
  CEIL(TIMESTAMPDIFF(SECOND, NOW(), locked_until) / 60) AS lock_left`;

export const lockedMessage = (u: LoginUser) => `บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก ${u.lock_left ?? LOCK_MINUTES} นาที`;

// Counts a wrong password or wrong OTP. Returns a message for the user.
export async function registerFailure(u: LoginUser, kind: "password" | "otp") {
  await q("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE user_id=?", [u.user_id]);
  const [r] = await q<{ failed_attempts: number }>("SELECT failed_attempts FROM users WHERE user_id=?", [u.user_id]);
  await audit(u.user_id, kind === "otp" ? "OTP_FAIL" : "LOGIN_FAIL", { attempts: r.failed_attempts });
  if (r.failed_attempts >= MAX_ATTEMPTS) {
    await q(`UPDATE users SET locked_until = NOW() + INTERVAL ${LOCK_MINUTES} MINUTE, failed_attempts = 0 WHERE user_id=?`, [u.user_id]);
    await audit(u.user_id, "ACCOUNT_LOCKED", { minutes: LOCK_MINUTES });
    if (u.email) {
      const { ip } = await clientInfo();
      await sendMail(u.email, "[PTC Smart Schedule] บัญชีของคุณถูกล็อกชั่วคราว",
        `มีการกรอก${kind === "otp" ? "รหัส OTP" : "รหัสผ่าน"}ผิดเกิน ${MAX_ATTEMPTS} ครั้ง จาก IP ${ip}\n` +
        `บัญชีจะถูกล็อก ${LOCK_MINUTES} นาที หากไม่ใช่คุณ โปรดเปลี่ยนรหัสผ่านและแจ้งฝ่ายวิชาการ`).catch(console.error);
    }
    return `ผิดเกิน ${MAX_ATTEMPTS} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`;
  }
  return `${kind === "otp" ? "รหัส OTP" : "ชื่อผู้ใช้หรือรหัสผ่าน"}ไม่ถูกต้อง (เหลือ ${MAX_ATTEMPTS - r.failed_attempts} ครั้ง)`;
}

export async function finishLogin(u: LoginUser) {
  const { ip, ua, device } = await clientInfo();
  const known = parseJson<string[]>(u.known_devices, []);
  if (!known.includes(device)) {
    if (known.length > 0) {
      await audit(u.user_id, "SUSPICIOUS_LOGIN", { reason: "new_device", device });
      if (u.email) {
        await sendMail(u.email, "[PTC Smart Schedule] แจ้งเตือนการเข้าสู่ระบบจากอุปกรณ์ใหม่",
          `มีการเข้าสู่ระบบบัญชี ${u.username} จากอุปกรณ์หรือเครือข่ายที่ไม่เคยใช้มาก่อน\n` +
          `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}\nIP: ${ip}\nอุปกรณ์: ${ua}\n\n` +
          `หากไม่ใช่คุณ โปรดเปลี่ยนรหัสผ่านทันทีและแจ้งฝ่ายวิชาการ`).catch(console.error);
      }
    }
    known.push(device);
  }
  await q("UPDATE users SET failed_attempts=0, locked_until=NULL, known_devices=? WHERE user_id=?",
    [JSON.stringify(known.slice(-10)), u.user_id]);
  await audit(u.user_id, "LOGIN_SUCCESS");
  await setSession({ uid: u.user_id, role: u.role, username: u.username });
}

export function passwordProblem(p: string | undefined, username: string) {
  if (!p || p.length < 8) return "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร";
  if (p === username) return "รหัสผ่านต้องไม่เหมือนชื่อผู้ใช้/รหัสนักศึกษา";
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข";
  return null;
}
