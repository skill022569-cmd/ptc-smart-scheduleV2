"use client";
import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import TimetableGrid from "@/components/TimetableGrid";
import type { Cell } from "@/lib/timetable";
import { api } from "@/lib/api";

function Draggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="h-full cursor-grab touch-none"
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 50 : undefined, position: "relative", opacity: isDragging ? 0.8 : 1 }}>
      {children}
    </div>
  );
}
function Droppable({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`h-full rounded-xl ${isOver ? "ring-2 ring-brand-500" : ""}`}>{children}</div>;
}

export default function Canvas({ groups }: { groups: { id: string; name: string }[] }) {
  const [group, setGroup] = useState(groups[0]?.id ?? "");
  const [cells, setCells] = useState<Cell[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => { if (group) setCells(await api(`/api/timetable?group=${encodeURIComponent(group)}`)); }, [group]);
  useEffect(() => { load(); }, [load]);

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const ids = String(e.active.id).split(",");
    const [day, start] = String(e.over.id).split("|").map(Number);
    try {
      const r = await api("/api/admin/timetable/move", "POST", { ids, day, start });
      setMsg({ ok: !r.warning, text: r.warning ?? "ย้ายคาบเรียบร้อย ✓" });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
    load();
  }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-medium">กลุ่มเรียน</span>
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.id} · {g.name}</option>)}
          </select>
        </label>
        <span className="text-sm text-stone-500">ลากการ์ดวิชาไปวางในช่องว่าง ระบบตรวจครู/ห้อง/กลุ่มชนกันทันทีด้วย Transaction บน TiDB</span>
      </div>
      {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <TimetableGrid cells={cells} show="teacher"
          renderCard={(b, card) => <Draggable id={b.ids.join(",")}>{card}</Draggable>}
          renderEmpty={(day, p, inner) => <Droppable id={`${day}|${p}`}>{inner}</Droppable>} />
      </DndContext>
    </div>
  );
}
