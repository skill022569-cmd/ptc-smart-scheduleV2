"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function ProfileActions({ canDelete }: { canDelete: boolean }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/me", "PATCH", { current, password: pw });
      setMsg({ ok: true, text: "เปลี่ยนรหัสผ่านแล้ว" });
      setCurrent(""); setPw("");
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }
  async function del() {
    if (!confirm("ลบบัญชีและข้อมูลส่วนตัวถาวร? การกระทำนี้ย้อนกลับไม่ได้")) return;
    try { await api("/api/me", "DELETE"); window.location.href = "/"; } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }

  return (
    <section className="card space-y-4">
      <form onSubmit={changePw} className="space-y-2">
        <h2 className="font-bold">🔑 เปลี่ยนรหัสผ่าน</h2>
        <input type="password" className="input" placeholder="รหัสผ่านเดิม" aria-label="รหัสผ่านเดิม" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <input type="password" className="input" placeholder="รหัสผ่านใหม่" aria-label="รหัสผ่านใหม่" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button className="btn">บันทึก</button>
      </form>
      <div className="space-y-2 border-t pt-4">
        <h2 className="font-bold">🛡️ สิทธิ์ของคุณตาม PDPA</h2>
        <a href="/api/me" className="btn-ghost w-full">⬇️ ส่งออกข้อมูลของฉัน (JSON)</a>
        {canDelete && <button onClick={del} className="btn-danger w-full">🗑️ ลบบัญชีและข้อมูลส่วนตัว</button>}
      </div>
      {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
    </section>
  );
}
