// AI Auto-Scheduler: constraint-based search (greedy placement + randomized restarts, keeps the best run).
// Pure function: no DB access, so it is unit-testable (scripts/scheduler.test.ts).
import { DAYS, PERIODS, LUNCH_PERIOD } from "./config";

export type Offering = {
  group_id: string;
  subject_id: string;
  teacher_id: string;
  theory_hours: number;
  lab_hours: number;
  required_room_type: string;
  subject_department: string | null;
  group_size: number;
};
export type Room = { room_id: string; room_type: string; department: string | null; capacity: number };
export type TeacherInfo = { teacher_id: string; max_hours_per_week: number; unavailable: { day: number; period: number }[] };
export type Placed = { day: number; period: number; subject_id: string; teacher_id: string; room_id: string; group_id: string };
export type Unplaced = { group_id: string; subject_id: string; teacher_id: string; hours: number; reason: string };

type Block = { o: Offering; len: number; roomType: string; rooms: Room[] };

function chunks(hours: number, max: number) {
  if (hours <= 0) return [];
  const n = Math.ceil(hours / max);
  return Array.from({ length: n }, (_, i) => Math.floor(hours / n) + (i < hours % n ? 1 : 0));
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Consecutive periods [start, start+len) that never cross lunch or the end of day.
function starts(len: number) {
  const out: number[] = [];
  for (let s = 1; s + len - 1 <= PERIODS.length; s++) {
    if (s <= LUNCH_PERIOD && s + len - 1 >= LUNCH_PERIOD) continue;
    out.push(s);
  }
  return out;
}

export function buildBlocks(offerings: Offering[], rooms: Room[]): Block[] {
  const fits = (type: string, o: Offering) =>
    rooms.filter(
      (r) => r.room_type === type && (r.department == null || r.department === o.subject_department) && r.capacity >= o.group_size,
    );
  const blocks: Block[] = [];
  for (const o of offerings) {
    for (const len of chunks(o.lab_hours, 4)) blocks.push({ o, len, roomType: o.required_room_type, rooms: fits(o.required_room_type, o) });
    for (const len of chunks(o.theory_hours, 2)) blocks.push({ o, len, roomType: "ปกติ", rooms: fits("ปกติ", o) });
  }
  return blocks;
}

function attempt(blocks: Block[], teachers: Map<string, TeacherInfo>, rand: () => number) {
  const busy = new Set<string>();
  const sameDay = new Set<string>(); // group|subject|day
  const groupLoad = new Map<string, number>(); // group|day -> hours
  const teacherHours = new Map<string, number>();
  const rows: Placed[] = [];
  const unplaced: Unplaced[] = [];

  for (const t of teachers.values()) for (const u of t.unavailable) busy.add(`t|${t.teacher_id}|${u.day}|${u.period}`);

  // Hardest first: long blocks and blocks with few room options; random tie-break per attempt.
  const order = blocks
    .map((b) => ({ b, k: b.len * 100 - b.rooms.length + rand() * 3 }))
    .sort((a, z) => z.k - a.k)
    .map((x) => x.b);

  for (const b of order) {
    const { o, len } = b;
    const t = teachers.get(o.teacher_id);
    const fail = (reason: string) =>
      unplaced.push({ group_id: o.group_id, subject_id: o.subject_id, teacher_id: o.teacher_id, hours: len, reason });
    if (!b.rooms.length) { fail(`ไม่มีห้องประเภท ${b.roomType} ที่รองรับ`); continue; }
    if ((teacherHours.get(o.teacher_id) ?? 0) + len > (t?.max_hours_per_week ?? 99)) { fail("เกินชั่วโมงสอนสูงสุดของครู"); continue; }

    // Spread a group's load across the week; prefer mornings slightly; randomize the rest.
    const slots = DAYS.flatMap((d) => starts(len).map((s) => ({ day: d.id, s })))
      .filter(({ day }) => !sameDay.has(`${o.group_id}|${o.subject_id}|${day}`))
      .map((x) => ({ ...x, k: (groupLoad.get(`${o.group_id}|${x.day}`) ?? 0) * 2 + x.s * 0.1 + rand() * 2 }))
      .sort((a, z) => a.k - z.k);

    let done = false;
    for (const { day, s } of slots) {
      const ps = Array.from({ length: len }, (_, i) => s + i);
      if (ps.some((p) => busy.has(`g|${o.group_id}|${day}|${p}`) || busy.has(`t|${o.teacher_id}|${day}|${p}`))) continue;
      const room = b.rooms.find((r) => ps.every((p) => !busy.has(`r|${r.room_id}|${day}|${p}`)));
      if (!room) continue;
      for (const p of ps) {
        busy.add(`g|${o.group_id}|${day}|${p}`);
        busy.add(`t|${o.teacher_id}|${day}|${p}`);
        busy.add(`r|${room.room_id}|${day}|${p}`);
        rows.push({ day, period: p, subject_id: o.subject_id, teacher_id: o.teacher_id, room_id: room.room_id, group_id: o.group_id });
      }
      sameDay.add(`${o.group_id}|${o.subject_id}|${day}`);
      groupLoad.set(`${o.group_id}|${day}`, (groupLoad.get(`${o.group_id}|${day}`) ?? 0) + len);
      teacherHours.set(o.teacher_id, (teacherHours.get(o.teacher_id) ?? 0) + len);
      done = true;
      break;
    }
    if (!done) fail("หาช่วงเวลาที่ครู ห้อง และกลุ่มเรียนว่างตรงกันไม่ได้");
  }
  return { rows, unplaced };
}

export function schedule(offerings: Offering[], rooms: Room[], teachers: TeacherInfo[], attempts = 40, seed = 2569) {
  const blocks = buildBlocks(offerings, rooms);
  const tmap = new Map(teachers.map((t) => [t.teacher_id, t]));
  const rand = rng(seed);
  let best: ReturnType<typeof attempt> | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = attempt(blocks, tmap, rand);
    const missing = r.unplaced.reduce((s, u) => s + u.hours, 0);
    if (!best || missing < best.unplaced.reduce((s, u) => s + u.hours, 0)) best = r;
    if (missing === 0) break;
  }
  return best!;
}
