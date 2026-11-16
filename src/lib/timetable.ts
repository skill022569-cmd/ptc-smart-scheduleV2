import type { PoolConnection } from "mysql2/promise";
import { q, tx } from "./db";
import { TERM } from "./config";
import { schedule, type Offering, type Room, type TeacherInfo } from "./scheduler";

const COLS = ["day_of_week", "period_slot", "subject_id", "teacher_id", "room_id", "group_id", "version_tag"] as const;
type Row = Record<(typeof COLS)[number], string | number | null>;

async function snapshot(c: PoolConnection, label: string, userId: string | null) {
  const [rows] = await c.query(
    `SELECT ${COLS.join(",")} FROM timetable WHERE academic_year=? AND semester=?`,
    [TERM.academicYear, TERM.semester],
  );
  const list = rows as Row[];
  await c.query(
    "INSERT INTO timetable_snapshots (academic_year, semester, label, row_count, rows_json, created_by) VALUES (?,?,?,?,?,?)",
    [TERM.academicYear, TERM.semester, label, list.length, JSON.stringify(list), userId],
  );
}

async function replaceAll(c: PoolConnection, rows: Row[]) {
  await c.query("DELETE FROM timetable WHERE academic_year=? AND semester=?", [TERM.academicYear, TERM.semester]);
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500).map((r) => [TERM.academicYear, TERM.semester, ...COLS.map((k) => r[k])]);
    if (part.length) await c.query(`INSERT INTO timetable (academic_year, semester, ${COLS.join(",")}) VALUES ?`, [part]);
  }
}

export async function runAutoSchedule(userId: string | null) {
  const offerings = await q<Offering>(
    `SELECT o.group_id, o.subject_id, o.teacher_id, s.theory_hours, s.lab_hours, s.required_room_type,
            s.department AS subject_department, g.size AS group_size
       FROM course_offerings o JOIN subjects s USING (subject_id) JOIN student_groups g USING (group_id)`,
  );
  const rooms = await q<Room>("SELECT room_id, room_type, department, capacity FROM classrooms ORDER BY room_id");
  const teachers = (await q<{ teacher_id: string; max_hours_per_week: number; unavailable_slots: unknown }>(
    "SELECT teacher_id, max_hours_per_week, unavailable_slots FROM teachers",
  )).map<TeacherInfo>((t) => ({
    teacher_id: t.teacher_id,
    max_hours_per_week: t.max_hours_per_week,
    unavailable: parseJson(t.unavailable_slots, []),
  }));

  const result = schedule(offerings, rooms, teachers);
  const tag = `AI-${new Date().toISOString().slice(0, 16)}`;
  await tx(async (c) => {
    await snapshot(c, `ก่อนรัน AI (${tag})`, userId);
    await replaceAll(c, result.rows.map((r) => ({
      day_of_week: r.day, period_slot: r.period, subject_id: r.subject_id, teacher_id: r.teacher_id,
      room_id: r.room_id, group_id: r.group_id, version_tag: tag,
    })));
  });
  return { placedHours: result.rows.length, unplaced: result.unplaced, tag };
}

export async function restoreSnapshot(snapshotId: string, userId: string | null) {
  return tx(async (c) => {
    const [found] = await c.query("SELECT rows_json FROM timetable_snapshots WHERE snapshot_id=?", [snapshotId]);
    const snap = (found as { rows_json: unknown }[])[0];
    if (!snap) throw new Error("ไม่พบเวอร์ชันนี้");
    await snapshot(c, `ก่อนย้อนกลับไปเวอร์ชัน #${snapshotId}`, userId);
    const rows = parseJson<Row[]>(snap.rows_json, []);
    await replaceAll(c, rows);
    return rows.length;
  });
}

export function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

// Full joined view used by every timetable screen.
export type Cell = {
  schedule_id: string; day_of_week: number; period_slot: number; subject_id: string; subject_name: string;
  teacher_id: string; teacher_name: string; room_id: string; building_name: string; group_id: string; group_name: string;
};
export async function loadTimetable(filter: { group_id?: string; teacher_id?: string; room_id?: string }) {
  const [k, v] = Object.entries(filter).find(([, val]) => val) ?? [];
  if (!k || !["group_id", "teacher_id", "room_id"].includes(k)) return [];
  return q<Cell>(
    `SELECT t.schedule_id, t.day_of_week, t.period_slot, t.subject_id, s.subject_name, t.teacher_id, te.full_name AS teacher_name,
            t.room_id, c.building_name, t.group_id, g.group_name
       FROM timetable t
       JOIN subjects s ON s.subject_id=t.subject_id
       JOIN teachers te ON te.teacher_id=t.teacher_id
       JOIN classrooms c ON c.room_id=t.room_id
       JOIN student_groups g ON g.group_id=t.group_id
      WHERE t.academic_year=? AND t.semester=? AND t.${k}=?`,
    [TERM.academicYear, TERM.semester, v],
  );
}
