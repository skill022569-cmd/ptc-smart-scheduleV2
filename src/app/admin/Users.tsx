"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type U = { user_id: string; username: string; role: string; email: string; pdpa_consent: number; locked: string | number | null; teacher_id: string | null };

export default function Users() {
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ username: "", email: "", role: "teacher", teacher_id: "" });
  const [student, setStudent] = useState("");
  const [viewAs, setViewAs] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => setUsers(await api("/api/admin/users")), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<string>) => {
    try { setMsg({ ok: true, text: await fn() }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const create = (ev: React.FormEvent) => {
    ev.preventDefault();
    run(async () => {
      const r = await api("/api/admin/users", "POST", { ...form, teacher_id: form.teacher_id || undefined });
      setForm({ username: "", email: "", role: "teacher", teacher_id: "" });
      return `สร้างบัญชีแล้ว รหัสผ่านชั่วคราว: ${r.password} (แสดงครั้งเดียว ผู้ใช้ต้องเปลี่ยนเมื่อเข้าครั้งแรก)`;
    });
  };
  async function startViewAs(username: string) {
    try {
      await api("/api/impersonate", "POST", { username });
      window.location.href = "/schedule"; // full reload so the header and menu switch to that user's view
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  const patch = (body: object, label: string) => run(async () => {
    const r = await api("/api/admin/users", "PATCH", body);
    return r.password ? `${label} รหัสผ่านชั่วคราว: ${r.password} (แสดงครั้งเดียว)` : label;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-bold">บัญชีบุคลากร</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-stone-500"><tr><th className="py-1">ชื่อผู้ใช้</th><th>สิทธิ์</th><th>อีเมล</th><th>รหัสครู</th><th>สถานะ</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-t">
                <td className="py-1.5">{u.username}</td><td>{u.role}</td><td>{u.email}</td><td>{u.teacher_id ?? "-"}</td>
                <td>{Number(u.locked) ? <span className="text-rose-600">ถูกล็อก</span> : "ปกติ"}</td>
                <td className="whitespace-nowrap text-right">
                  {Number(u.locked) ? <button className="px-2 text-brand-600" onClick={() => patch({ id: u.user_id, action: "unlock" }, `ปลดล็อก ${u.username} แล้ว`)}>ปลดล็อก</button> : null}
                  {u.role !== "admin" && <button className="px-2 text-brand-700" onClick={() => startViewAs(u.username)}>👁️ ดูมุมมอง</button>}
                  <button className="px-2 text-amber-700" onClick={() => confirm(`รีเซ็ตรหัสผ่าน ${u.username}?`) && patch({ id: u.user_id, action: "reset" }, `รีเซ็ต ${u.username} แล้ว`)}>รีเซ็ตรหัสผ่าน</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="space-y-4">
        <form className="card space-y-2 ring-amber-300" onSubmit={(e) => { e.preventDefault(); startViewAs(viewAs); }}>
          <h2 className="font-bold">👁️ ดูเว็บในมุมมองของผู้ใช้</h2>
          <p className="text-xs text-stone-500">สำหรับทดสอบ: เห็นเว็บเหมือนเจ้าของบัญชีทุกอย่าง (ยกเว้นเปลี่ยนรหัสผ่าน ลบบัญชี และยอมรับ PDPA แทน) · ทุกครั้งถูกบันทึกในประวัติ</p>
          <input className="input" placeholder="ชื่อผู้ใช้ / รหัสนักศึกษา" aria-label="ชื่อผู้ใช้ที่จะดูมุมมอง" value={viewAs} onChange={(e) => setViewAs(e.target.value)} required />
          <div className="flex flex-wrap gap-2 text-xs">
            {["6921001", "6911001", "teacher"].map((u) => (
              <button key={u} type="button" className="rounded-md bg-stone-100 px-2 py-1 hover:bg-stone-200" onClick={() => startViewAs(u)}>{u}</button>
            ))}
          </div>
          <button className="btn w-full">ดูในมุมมองนี้</button>
        </form>
        <form onSubmit={create} className="card space-y-2">
          <h2 className="font-bold">➕ สร้างบัญชีครู/แอดมิน</h2>
          <input className="input" placeholder="ชื่อผู้ใช้ภาษาอังกฤษ เช่น navakit.m" aria-label="ชื่อผู้ใช้" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required
            pattern="[a-z0-9._\-]{3,64}" title="ภาษาอังกฤษตัวเล็ก ตัวเลข หรือ . _ - ยาว 3–64 ตัว ไม่มีเว้นวรรค" autoCapitalize="none" />
          <input className="input" type="email" placeholder="อีเมล (รับ OTP)" aria-label="อีเมล" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="สิทธิ์">
            <option value="teacher">ครู</option><option value="admin">ฝ่ายวิชาการ/แอดมิน</option>
          </select>
          {form.role === "teacher" && <input className="input" placeholder="รหัสครูที่ผูก เช่น T-AUTO-2" aria-label="รหัสครู" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} />}
          <button className="btn w-full">สร้างบัญชี</button>
        </form>
        <form className="card space-y-2" onSubmit={(e) => { e.preventDefault(); patch({ username: student, action: "reset" }, `รีเซ็ต ${student} แล้ว`); }}>
          <h2 className="font-bold">🎓 นักเรียนลืมรหัสผ่าน / ถูกล็อก</h2>
          <input className="input" placeholder="รหัสนักศึกษา" aria-label="รหัสนักศึกษา" value={student} onChange={(e) => setStudent(e.target.value)} required />
          <button className="btn w-full">รีเซ็ตรหัสผ่าน + ปลดล็อก</button>
        </form>
        {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
