"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import TimetableGrid, { type Block } from "@/components/TimetableGrid";
import type { Cell } from "@/lib/timetable";
import { DAYS } from "@/lib/config";
import { api } from "@/lib/api";
import { exportPng } from "./StudentView";

type Slot = { day: number; period: number };
const key = (s: Slot) => `${s.day}|${s.period}`;

export default function TeacherView({ title, subtitle, cells: initialCells, roster }: {
  title: string; subtitle: string; cells: Cell[]; roster: { group_id: string; student_id: string; full_name: string }[];
}) {
  const [cells, setCells] = useState(initialCells);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Block | null>(null);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Live alert: re-check every 30 s in case the academic office moved a class into a blocked slot.
  const refresh = useCallback(async () => {
    const r = await api<{ unavailable: Slot[]; conflicts: Slot[]; cells: Cell[] }>("/api/teacher/blocks");
    setBlocked(new Set(r.unavailable.map(key)));
    setConflicts(new Set(r.conflicts.map(key)));
    setCells(r.cells);
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  function toggle(day: number, period: number) {
    const k = `${day}|${period}`;
    const next = new Set(blocked);
    if (next.has(k)) next.delete(k); else next.add(k);
    setBlocked(next);
  }
  async function saveBlocks() {
    const slots = [...blocked].map((k) => { const [day, period] = k.split("|").map(Number); return { day, period }; });
    await api("/api/teacher/blocks", "PUT", { slots });
    setEditing(false);
    setMsg("ส่งช่วงเวลาไม่สะดวกสอนให้ฝ่ายวิชาการแล้ว");
    refresh();
  }

  const hours = cells.length;
  return (
    <div className="space-y-4">
      {conflicts.size > 0 && (
        <div role="alert" className="rounded-2xl bg-rose-600 p-4 font-medium text-white shadow-lg">
          ⚠️ มีคาบสอน {conflicts.size} คาบที่ชนกับเวลาที่คุณแจ้งว่าไม่สะดวก:{" "}
          {[...conflicts].map((k) => { const [d, p] = k.split("|"); return `${DAYS[+d - 1].name} คาบ ${p}`; }).join(", ")}
          {" "}— โปรดติดต่อฝ่ายวิชาการ
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-slate-500">{subtitle} · สอน {hours} ชั่วโมง/สัปดาห์</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button className="btn-ghost" onClick={() => { setEditing(false); refresh(); }}>ยกเลิก</button>
              <button className="btn" onClick={saveBlocks}>💾 บันทึกเวลาไม่สะดวก</button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => setEditing(true)}>🔒 ล็อกเวลาส่วนตัว</button>
              <button className="btn" onClick={() => exportPng(ref.current, title)}>🖼️ บันทึกรูป</button>
            </>
          )}
        </div>
      </div>
      {editing && <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">คลิกช่องว่างในตารางเพื่อเลือก/ยกเลิกช่วงเวลาที่ &quot;ไม่สะดวกสอน/ติดราชการ&quot; แล้วกดบันทึก</p>}
      {msg && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      <TimetableGrid ref={ref} cells={cells} show="group" blocked={blocked} conflicts={conflicts}
        onCellClick={editing ? toggle : undefined} onCardClick={editing ? undefined : setSelected} />
      {selected && (
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">👥 รายชื่อนักเรียน {selected.group_name} — {selected.subject_name}</h2>
            <button className="text-slate-400" onClick={() => setSelected(null)} aria-label="ปิด">✕</button>
          </div>
          <ol className="mt-2 grid list-decimal gap-1 pl-6 text-sm sm:grid-cols-2">
            {roster.filter((r) => r.group_id === selected.group_id).map((r) => (
              <li key={r.student_id}>{r.student_id} {r.full_name}</li>
            ))}
          </ol>
        </section>
      )}
      {!selected && !editing && <p className="text-sm text-slate-500">คลิกการ์ดวิชาเพื่อดูรายชื่อนักเรียนในคลาส</p>}
    </div>
  );
}
