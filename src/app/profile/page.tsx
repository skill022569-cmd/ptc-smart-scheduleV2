import { requireUser, maskEmail } from "@/lib/auth";
import { q } from "@/lib/db";
import ProfileActions from "./actions";

export const dynamic = "force-dynamic";

const EVENT_TH: Record<string, string> = {
  LOGIN_SUCCESS: "เข้าสู่ระบบสำเร็จ", LOGIN_FAIL: "รหัสผ่านผิด", OTP_SENT: "ส่ง OTP", OTP_FAIL: "OTP ผิด",
  ACCOUNT_LOCKED: "บัญชีถูกล็อก", SUSPICIOUS_LOGIN: "⚠️ เข้าสู่ระบบจากอุปกรณ์ใหม่", PDPA_CONSENT: "ยอมรับนโยบาย PDPA",
  PASSWORD_CHANGED: "เปลี่ยนรหัสผ่าน", DATA_EXPORT: "ส่งออกข้อมูลส่วนตัว",
};
const ROLE_TH = { student: "นักเรียน/นักศึกษา", teacher: "ครูผู้สอน", admin: "ฝ่ายวิชาการ/ผู้ดูแลระบบ" };

export default async function Profile() {
  const s = await requireUser();
  const [u] = await q<{ email: string | null; pdpa_version: string; consent_at: string }>(
    "SELECT email, pdpa_version, consent_at FROM users WHERE user_id=?", [s.uid]);
  const [student] = await q<{ full_name: string; group_name: string }>(
    "SELECT st.full_name, g.group_name FROM students st JOIN student_groups g USING (group_id) WHERE st.user_id=?", [s.uid]);
  const [teacher] = await q<{ full_name: string; department: string }>("SELECT full_name, department FROM teachers WHERE user_id=?", [s.uid]);
  const history = await q<{ event: string; ip: string; user_agent: string; created_at: string }>(
    "SELECT event, ip, user_agent, created_at FROM audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 20", [s.uid]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card space-y-2">
        <h1 className="text-xl font-bold">👤 โปรไฟล์</h1>
        <p><span className="text-stone-500">ชื่อผู้ใช้:</span> {s.username}</p>
        <p><span className="text-stone-500">ชื่อ:</span> {student?.full_name ?? teacher?.full_name ?? "-"}</p>
        <p><span className="text-stone-500">สถานะ:</span> {ROLE_TH[s.role]}</p>
        {student && <p><span className="text-stone-500">กลุ่มเรียน:</span> {student.group_name}</p>}
        {teacher && <p><span className="text-stone-500">แผนก:</span> {teacher.department}</p>}
        <p><span className="text-stone-500">อีเมล:</span> {maskEmail(u.email)}</p>
        <p className="text-sm text-stone-500">ยอมรับนโยบาย PDPA ฉบับ {u.pdpa_version} เมื่อ {u.consent_at}</p>
        <a href="/api/auth/logout" className="btn-ghost mt-2">ออกจากระบบ</a>
      </section>
      <ProfileActions canDelete={s.role !== "admin"} />
      <section className="card md:col-span-2">
        <h2 className="mb-3 font-bold">🕘 ประวัติการเข้าใช้งาน (20 รายการล่าสุด)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-stone-500"><tr><th className="py-1">เวลา</th><th>เหตุการณ์</th><th>IP</th><th>อุปกรณ์</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className={`border-t ${h.event === "SUSPICIOUS_LOGIN" || h.event === "ACCOUNT_LOCKED" ? "bg-rose-50" : ""}`}>
                  <td className="whitespace-nowrap py-1 pr-3">{h.created_at}</td>
                  <td className="pr-3">{EVENT_TH[h.event] ?? h.event}</td>
                  <td className="pr-3">{h.ip}</td>
                  <td className="max-w-xs truncate text-stone-500">{h.user_agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
