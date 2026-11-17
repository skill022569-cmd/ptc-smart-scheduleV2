"use client";
import { useEffect, useRef, useState } from "react";
import { BUILDINGS, MAP_DIRECTIONS_URL, MAP_EMBED_URL } from "@/lib/campus";

// The map is rendered at a fixed 1000×700 px and scaled to the box, so Google shows the same area on every
// screen size and the % room pins stay on the right building.
const MAP_W = 1000;
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
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / MAP_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const qq = query.trim().toLowerCase();
  const building = BUILDINGS.find((b) => qq && (b.id.toLowerCase() === qq || b.name.toLowerCase().includes(qq)));
  const matches = qq
    ? rooms.filter((r) => r.room_id.toLowerCase().includes(qq) || r.building_name.toLowerCase().includes(qq) ||
        (r.department ?? "").toLowerCase().includes(qq) || (building && r.building_name === building.name))
    : [];

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
      <div className="flex flex-wrap gap-2">
        <a href={MAP_DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="btn">🧭 นำทางมาวิทยาลัยด้วย Google Maps</a>
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
          <span className="basis-full text-xs text-stone-500">ห้องที่ปักไว้ก่อนเปลี่ยนเป็นแผนที่ดาวเทียมจะอยู่ผิดตำแหน่ง ให้เลือกห้องแล้วคลิกตำแหน่งจริงบนแผนที่เพื่อปักใหม่</span>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div ref={box} className={`relative aspect-[10/7] overflow-hidden rounded-2xl bg-stone-200 ring-1 ring-stone-200 ${pinRoom ? "cursor-crosshair" : ""}`} onClick={placePin}>
          {scale > 0 && (
            <iframe src={MAP_EMBED_URL} title="แผนที่ดาวเทียมวิทยาลัยการอาชีพโพนทอง" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
              style={{ width: MAP_W, height: MAP_W * 0.7, transform: `scale(${scale})` }} />
          )}
          {rooms.filter((r) => r.coords).map((r) => {
            const hit = matches.includes(r);
            return (
              <div key={r.room_id} title={r.room_id}
                className={`absolute -translate-x-1/2 -translate-y-full text-center ${hit ? "z-10" : qq ? "opacity-30" : ""}`}
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
