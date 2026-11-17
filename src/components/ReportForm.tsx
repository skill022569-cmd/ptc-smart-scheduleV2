"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { REPORT_CATEGORIES } from "@/lib/version";

export default function ReportForm() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [detail, setDetail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/reports", "POST", { category, detail, page_url: window.location.pathname });
      setMsg({ ok: true, text: "ส่งรายงานถึงผู้พัฒนาแล้ว ขอบคุณครับ 🙏" });
      setDetail("");
      setOpen(false);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <section className="card !p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-brand-800">🐞 พบปัญหาการใช้งาน?</div>
          <div className="text-sm text-stone-500">แจ้งผู้พัฒนาได้ที่นี่ ระบบจะแนบหน้าเว็บ เบราว์เซอร์ และเวอร์ชันให้อัตโนมัติ</div>
        </div>
        <button type="button" className="btn-ghost" aria-expanded={open} onClick={() => { setOpen(!open); setMsg(null); }}>
          {open ? "ปิด" : "รายงานปัญหา"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3 border-t border-stone-200 pt-3">
          <label className="block">
            <span className="label">ประเภทปัญหา</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">รายละเอียด (ทำอะไรอยู่ แล้วเกิดอะไรขึ้น)</span>
            <textarea className="input min-h-28" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={2000} required minLength={5} />
          </label>
          <button className="btn" disabled={busy || detail.trim().length < 5}>{busy ? "กำลังส่ง..." : "ส่งรายงาน"}</button>
        </form>
      )}
      {msg && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
    </section>
  );
}
