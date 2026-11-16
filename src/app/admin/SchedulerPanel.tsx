"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Unplaced } from "@/lib/scheduler";

type Snap = { snapshot_id: string; label: string; row_count: number; created_at: string };

export default function SchedulerPanel() {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ placedHours: number; unplaced: Unplaced[] } | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ snapshots: Snap[]; current: number }>("/api/admin/schedule");
    setSnaps(r.snapshots);
    setCurrent(r.current);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run() {
    if (!confirm("รัน AI จัดตารางใหม่ทั้งวิทยาลัย? ระบบจะบันทึกเวอร์ชันปัจจุบันไว้ให้ย้อนกลับได้")) return;
    setBusy(true); setMsg(""); setResult(null);
    try { setResult(await api("/api/admin/schedule", "POST", { action: "run" })); await load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function restore(s: Snap) {
    if (!confirm(`ย้อนตารางกลับไปเป็น "${s.label}" (${s.row_count} คาบ)?`)) return;
    setBusy(true);
    try { const r = await api("/api/admin/schedule", "POST", { action: "restore", id: s.snapshot_id }); setMsg(`ย้อนกลับแล้ว (${r.restored} คาบ)`); await load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">🤖 AI Auto-Scheduler</h2>
        <p className="text-sm text-stone-600">
          ดึงข้อมูลหลักสูตร ครู ห้อง และเวลาที่ครูไม่สะดวกจาก TiDB มาคำนวณ โดยห้ามห้อง/ครู/กลุ่มเรียนชนกัน
          ใช้ห้องให้ตรงประเภทวิชาปฏิบัติ วางวิชาปฏิบัติเป็นบล็อกต่อเนื่อง ไม่คร่อมพักเที่ยง และไม่เกินชั่วโมงสอนสูงสุดของครู
        </p>
        <p className="text-sm">ตารางปัจจุบัน: <b>{current}</b> คาบ</p>
        <button className="btn w-full" onClick={run} disabled={busy}>{busy ? "กำลังประมวลผล..." : "▶ รัน AI จัดตารางทั้งวิทยาลัย"}</button>
        {result && (
          <div className={`rounded-xl p-3 text-sm ${result.unplaced.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
            จัดได้ {result.placedHours} ชั่วโมง {result.unplaced.length ? `· วางไม่ได้ ${result.unplaced.length} บล็อก:` : "· ครบทุกวิชา ✓"}
            <ul className="mt-1 list-disc pl-5">
              {result.unplaced.map((u, i) => <li key={i}>{u.group_id} / {u.subject_id} / {u.teacher_id} ({u.hours} ชม.) — {u.reason}</li>)}
            </ul>
          </div>
        )}
        {msg && <p role="status" className="rounded-xl bg-stone-100 p-3 text-sm">{msg}</p>}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <a className="btn-ghost" href="/api/admin/export?type=timetable">⬇️ ส่งออกตาราง (CSV/Excel)</a>
          <a className="btn-ghost" href="/api/admin/export?type=workload">⬇️ ภาระงานครู (CSV/Excel)</a>
        </div>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-bold">⏪ จุดกู้คืน (เวอร์ชันตาราง)</h2>
        <p className="mb-3 text-sm text-stone-500">ระบบบันทึกเวอร์ชันอัตโนมัติก่อนรัน AI และก่อนย้อนกลับทุกครั้ง</p>
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {snaps.map((s) => (
            <li key={s.snapshot_id} className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 p-3 text-sm">
              <div><div className="font-medium">{s.label}</div><div className="text-stone-500">{s.created_at} · {s.row_count} คาบ</div></div>
              <button className="btn-ghost !py-1 text-xs" disabled={busy} onClick={() => restore(s)}>ย้อนกลับ</button>
            </li>
          ))}
          {!snaps.length && <li className="text-sm text-stone-500">ยังไม่มีเวอร์ชันที่บันทึก</li>}
        </ul>
      </section>
    </div>
  );
}
