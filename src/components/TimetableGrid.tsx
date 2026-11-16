"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { DAYS, PERIODS, LUNCH_PERIOD, DEFAULT_THEME } from "@/lib/config";
import type { Cell } from "@/lib/timetable";

export type Block = Cell & { span: number; ids: string[] };
export type Theme = typeof DEFAULT_THEME;

// Merge consecutive periods of the same class into one card.
export function toBlocks(cells: Cell[]): Block[] {
  const sorted = [...cells].sort((a, b) => a.day_of_week - b.day_of_week || a.period_slot - b.period_slot);
  const out: Block[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && last.day_of_week === c.day_of_week && last.period_slot + last.span === c.period_slot &&
      last.subject_id === c.subject_id && last.group_id === c.group_id && last.room_id === c.room_id && last.teacher_id === c.teacher_id) {
      last.span++;
      last.ids.push(c.schedule_id);
    } else out.push({ ...c, span: 1, ids: [c.schedule_id] });
  }
  return out;
}

type Props = {
  cells: Cell[];
  show: "teacher" | "group" | "both";
  theme?: Theme;
  blocked?: Set<string>; // "day|period" the teacher marked unavailable
  conflicts?: Set<string>;
  onCellClick?: (day: number, period: number) => void;
  onCardClick?: (b: Block) => void;
  renderCard?: (b: Block, card: React.ReactNode) => React.ReactNode; // used by the drag & drop canvas
  renderEmpty?: (day: number, period: number, inner: React.ReactNode) => React.ReactNode;
};

const TimetableGrid = forwardRef<HTMLDivElement, Props>(function TimetableGrid(
  { cells, show, theme = DEFAULT_THEME, blocked, conflicts, onCellClick, onCardClick, renderCard, renderEmpty }, ref) {
  const blocks = toBlocks(cells);
  return (
    <div className="overflow-x-auto rounded-2xl">
      <div ref={ref} className="min-w-[960px] p-3" style={{ background: theme.background }}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `72px repeat(${PERIODS.length}, minmax(0, 1fr))` }}>
          <div />
          {PERIODS.map((p) => (
            <div key={p.id} className="text-center text-xs text-slate-500">
              <div className="font-bold text-slate-700">คาบ {p.id}</div>{p.start}-{p.end}
            </div>
          ))}
          {DAYS.map((d) => {
            const row = blocks.filter((b) => b.day_of_week === d.id);
            const items: React.ReactNode[] = [];
            for (let p = 1; p <= PERIODS.length; p++) {
              const b = row.find((x) => x.period_slot === p);
              const key = `${d.id}|${p}`;
              if (b) {
                const clash = b.ids.some((_, i) => conflicts?.has(`${d.id}|${p + i}`));
                const card = (
                  <div
                    onClick={() => onCardClick?.(b)}
                    className={`h-full rounded-xl p-2 text-xs shadow-sm ${onCardClick ? "cursor-pointer" : ""} ${clash ? "ring-2 ring-rose-500" : ""}`}
                    style={{ background: theme.card, borderLeft: `4px solid ${clash ? "#e11d48" : theme.accent}` }}
                  >
                    <div className="font-bold" style={{ color: theme.accent }}>{b.subject_id}</div>
                    <div className="line-clamp-2 font-medium text-slate-800">{b.subject_name}</div>
                    {show !== "group" && <div className="text-slate-500">👩‍🏫 {b.teacher_name}</div>}
                    {show !== "teacher" && <div className="text-slate-500">👥 {b.group_name}</div>}
                    <Link href={`/map?room=${encodeURIComponent(b.room_id)}`} onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-block rounded bg-slate-100 px-1.5 text-slate-700 hover:bg-indigo-100">📍 {b.room_id}</Link>
                    {clash && <div className="mt-1 font-bold text-rose-600">⚠ ชนกับเวลาที่แจ้งไม่สะดวก</div>}
                  </div>
                );
                items.push(
                  <div key={key} style={{ gridColumn: `span ${b.span}` }} className="min-h-24">
                    {renderCard ? renderCard(b, card) : card}
                  </div>,
                );
                p += b.span - 1;
              } else {
                const lunch = p === LUNCH_PERIOD;
                const isBlocked = blocked?.has(key);
                const inner = (
                  <div
                    onClick={() => !lunch && onCellClick?.(d.id, p)}
                    className={`flex h-full min-h-24 items-center justify-center rounded-xl text-xs ${
                      lunch ? "bg-amber-50 text-amber-600" : isBlocked ? "bg-rose-100 text-rose-600" : "bg-white/50 text-slate-300"
                    } ${onCellClick && !lunch ? "cursor-pointer hover:ring-2 hover:ring-indigo-300" : ""}`}
                  >
                    {lunch ? "พักเที่ยง" : isBlocked ? "ไม่สะดวก" : ""}
                  </div>
                );
                items.push(<div key={key}>{renderEmpty && !lunch ? renderEmpty(d.id, p, inner) : inner}</div>);
              }
            }
            return [
              <div key={d.id} className="flex items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: theme.accent }}>
                {d.name}
              </div>,
              ...items,
            ];
          })}
        </div>
      </div>
    </div>
  );
});

export default TimetableGrid;
