"use client";
import { useState } from "react";
import { BUILDINGS } from "@/lib/campus";
import { api } from "@/lib/api";

export type MapRoom = {
  room_id: string; building_name: string; floor: number; room_type: string; department: string | null;
  coords: { x: number; y: number } | null;
};

export default function CampusMap({ rooms: initialRooms, initial, isAdmin }: { rooms: MapRoom[]; initial: string; isAdmin: boolean }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState(initial);
  const [pinRoom, setPinRoom] = useState("");
  const [msg, setMsg] = useState("");

  const qq = query.trim().toLowerCase();
  const building = BUILDINGS.find((b) => qq && (b.id.toLowerCase() === qq || b.name.toLowerCase().includes(qq)));
  const matches = qq
    ? rooms.filter((r) => r.room_id.toLowerCase().includes(qq) || r.building_name.toLowerCase().includes(qq) ||
        (r.department ?? "").toLowerCase().includes(qq) || (building && r.building_name === building.name))
    : [];
  const highlighted = new Set([
    ...matches.map((r) => r.building_name),
    ...(building ? [building.name] : []),
  ]);

  async function placePin(e: React.MouseEvent<HTMLDivElement>) {
    if (!isAdmin || !pinRoom) return;
    const box = e.currentTarget.getBoundingClientRect();
    const coords = { x: +(((e.clientX - box.left) / box.width) * 100).toFixed(1), y: +(((e.clientY - box.top) / box.height) * 100).toFixed(1) };
    await api("/api/admin/data/classrooms", "PUT", { id: pinRoom, map_coordinates: coords });
    setRooms(rooms.map((r) => (r.room_id === pinRoom ? { ...r, coords } : r)));
    setMsg(`ปักหมุด ${pinRoom} แล้ว`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">🗺️ แผนที่วิทยาลัย</h1>
        <p className="text-stone-500">พิมพ์รหัสห้อง (เช่น AUTO-101) ชื่ออาคาร หรือชื่อแผนก</p>
      </div>
      <input className="input text-lg" placeholder="ค้นหาห้อง / อาคาร / แผนก" aria-label="ค้นหาห้อง" value={query} onChange={(e) => setQuery(e.target.value)} />
      {isAdmin && (
        <div className="card flex flex-wrap items-center gap-3 text-sm">
          <span className="font-bold">📌 โหมดปักหมุด (ผู้ดูแล)</span>
          <select className="input max-w-xs" value={pinRoom} onChange={(e) => setPinRoom(e.target.value)} aria-label="เลือกห้องที่จะปักหมุด">
            <option value="">— เลือกห้อง แล้วคลิกบนแผนที่ —</option>
            {rooms.map((r) => <option key={r.room_id} value={r.room_id}>{r.room_id}{r.coords ? "" : " (ยังไม่ปักหมุด)"}</option>)}
          </select>
          {msg && <span className="text-emerald-600">{msg}</span>}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className={`relative aspect-[10/7] overflow-hidden rounded-2xl ring-1 ring-stone-200 ${pinRoom ? "cursor-crosshair" : ""}`} onClick={placePin}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/campus-map.svg" alt="แผนผังวิทยาลัยการอาชีพโพนทอง" className="absolute inset-0 h-full w-full" />
          {BUILDINGS.filter((b) => highlighted.has(b.name)).map((b) => (
            <div key={b.id} className="absolute animate-pulse rounded-xl bg-amber-400/40 ring-4 ring-amber-500"
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }} />
          ))}
          {rooms.filter((r) => r.coords).map((r) => {
            const hit = matches.includes(r);
            return (
              <div key={r.room_id} title={r.room_id}
                className={`absolute -transtone-x-1/2 -transtone-y-full text-center ${hit ? "z-10" : qq ? "opacity-30" : ""}`}
                style={{ left: `${r.coords!.x}%`, top: `${r.coords!.y}%` }}>
                <div className={`${hit ? "text-3xl" : "text-base"}`}>📍</div>
                {hit && <div className="whitespace-nowrap rounded bg-rose-600 px-1.5 text-xs font-bold text-white">{r.room_id}</div>}
              </div>
            );
          })}
        </div>
        <aside className="space-y-2">
          {matches.slice(0, 12).map((r) => (
            <div key={r.room_id} className="card !p-3 text-sm">
              <div className="font-bold text-brand-700">{r.room_id}</div>
              <div>{r.building_name} ชั้น {r.floor}</div>
              <div className="text-stone-500">{r.room_type}{r.department ? ` · ${r.department}` : ""}</div>
            </div>
          ))}
          {qq && !matches.length && !building && <p className="text-stone-500">ไม่พบห้องที่ค้นหา</p>}
        </aside>
      </div>
    </div>
  );
}
