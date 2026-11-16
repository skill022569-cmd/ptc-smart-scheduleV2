"use client";
import { useRouter } from "next/navigation";
import TimetableGrid from "@/components/TimetableGrid";
import type { Cell } from "@/lib/timetable";

type Opt = { id: string; name: string };
const LABEL = { group: "กลุ่มเรียน", teacher: "ครู", room: "ห้อง" } as const;

export default function AdminView({ subtitle, options, current, cells }: {
  subtitle: string; options: Record<keyof typeof LABEL, Opt[]>; current: Record<string, string | undefined>; cells: Cell[];
}) {
  const router = useRouter();
  const kind = (Object.keys(LABEL) as (keyof typeof LABEL)[]).find((k) => current[k]) ?? "group";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ดูตารางทั้งวิทยาลัย</h1>
        <p className="text-slate-500">{subtitle} · ปรับแก้ตารางได้ที่ จัดการระบบ → ลากวางตาราง</p>
      </div>
      <div className="card flex flex-wrap gap-3">
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
          <label key={k} className="min-w-48 flex-1">
            <span className="label">{LABEL[k]}</span>
            <select className="input" value={current[k] ?? ""} onChange={(e) => router.push(`/schedule?${k}=${encodeURIComponent(e.target.value)}`)}>
              <option value="">— เลือก{LABEL[k]} —</option>
              {options[k].map((o) => <option key={o.id} value={o.id}>{o.id} · {o.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      {cells.length || current[kind] ? (
        <TimetableGrid cells={cells} show={kind === "teacher" ? "group" : kind === "group" ? "teacher" : "both"} />
      ) : (
        <p className="text-slate-500">เลือกกลุ่มเรียน ครู หรือห้อง เพื่อดูตาราง</p>
      )}
    </div>
  );
}
