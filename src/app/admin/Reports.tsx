"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { REPORT_STATUS } from "@/lib/version";

type R = {
  report_id: string; category: string; detail: string; page_url: string | null; user_agent: string | null;
  app_version: string | null; status: string; created_at: string; username: string | null;
};
const BADGE: Record<string, string> = { new: "bg-rose-100 text-rose-700", doing: "bg-gold-100 text-gold-700", done: "bg-emerald-100 text-emerald-700" };

export default function Reports() {
  const [rows, setRows] = useState<R[]>([]);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setRows(await api("/api/reports")); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    await api("/api/reports", "PATCH", { id, status });
    load();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">รายงานปัญหาที่ผู้ใช้ส่งจากหน้า ถาม-ตอบ AI · ยังไม่แก้ {rows.filter((r) => r.status !== "done").length} รายการ</p>
      {err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      {rows.map((r) => (
        <article key={r.report_id} className="card !p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE[r.status] ?? ""}`}>{REPORT_STATUS[r.status] ?? r.status}</span>
            <span className="font-bold text-brand-800">{r.category}</span>
            <span className="text-stone-400">· {r.created_at} · {r.username ?? "ผู้ใช้ที่ลบบัญชีแล้ว"}</span>
            <select className="input ml-auto !w-auto !py-1 text-sm" aria-label="สถานะ" value={r.status} onChange={(e) => setStatus(r.report_id, e.target.value)}>
              {Object.entries(REPORT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <p className="mt-2 whitespace-pre-wrap">{r.detail}</p>
          <p className="mt-2 truncate text-xs text-stone-400">หน้า {r.page_url ?? "-"} · {r.app_version ?? "-"} · {r.user_agent ?? "-"}</p>
        </article>
      ))}
      {!rows.length && !err && <p className="card text-stone-500">ยังไม่มีรายงานปัญหา 🎉</p>}
    </div>
  );
}
