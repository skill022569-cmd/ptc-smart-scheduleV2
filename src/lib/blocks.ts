import type { Cell } from "./timetable";

export type Block = Cell & { span: number; ids: string[] };

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
