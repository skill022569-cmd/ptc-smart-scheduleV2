// Usage: npm test
import assert from "node:assert/strict";
import { schedule, type Offering, type Room, type TeacherInfo } from "../src/lib/scheduler";
import { LUNCH_PERIOD } from "../src/lib/config";

const rooms: Room[] = [
  { room_id: "R1", room_type: "ปกติ", department: null, capacity: 40 },
  { room_id: "W1", room_type: "โรงฝึกงาน", department: "ช่างยนต์", capacity: 40 },
  { room_id: "W2", room_type: "โรงฝึกงาน", department: "ช่างไฟฟ้า", capacity: 40 },
];
const off = (g: string, s: string, t: string, th: number, lab: number, dept: string | null, type = "ปกติ"): Offering => ({
  group_id: g, subject_id: s, teacher_id: t, theory_hours: th, lab_hours: lab, required_room_type: type, subject_department: dept, group_size: 30,
});
const offerings = [
  off("G1", "AUTO1", "T1", 1, 3, "ช่างยนต์", "โรงฝึกงาน"),
  off("G1", "THAI", "T2", 2, 0, null),
  off("G2", "THAI2", "T2", 2, 0, null),
  off("G2", "AUTO2", "T1", 1, 4, "ช่างยนต์", "โรงฝึกงาน"),
];
const teachers: TeacherInfo[] = [
  { teacher_id: "T1", max_hours_per_week: 20, unavailable: [{ day: 1, period: 1 }, { day: 1, period: 2 }] },
  { teacher_id: "T2", max_hours_per_week: 20, unavailable: [] },
];

const { rows, unplaced } = schedule(offerings, rooms, teachers);
assert.equal(unplaced.length, 0, "everything placed");
assert.equal(rows.length, 1 + 3 + 2 + 2 + 1 + 4);
for (const k of ["room_id", "teacher_id", "group_id"] as const) {
  const seen = new Set(rows.map((r) => `${r[k]}|${r.day}|${r.period}`));
  assert.equal(seen.size, rows.length, `no ${k} double booking`);
}
assert.ok(rows.every((r) => r.period !== LUNCH_PERIOD), "lunch is free");
assert.ok(!rows.some((r) => r.teacher_id === "T1" && r.day === 1 && r.period <= 2), "teacher time block respected");
assert.ok(rows.filter((r) => r.room_id === "W2").length === 0, "other department's workshop not used");
const lab = rows.filter((r) => r.subject_id === "AUTO2" && r.room_id === "W1");
assert.equal(lab.length, 4);
assert.ok(lab.every((r, i) => r.day === lab[0].day && r.period === lab[0].period + i), "lab hours are one consecutive block");

// Impossible case is reported, not silently dropped.
const bad = schedule([off("G3", "X", "T9", 0, 3, "บัญชี", "Lab")], rooms, [{ teacher_id: "T9", max_hours_per_week: 10, unavailable: [] }]);
assert.equal(bad.unplaced.length, 1);
console.log("✓ scheduler tests passed");

// AI text-to-SQL guard.
import { safeSql } from "../src/lib/sqlguard";
assert.ok(safeSql("SELECT * FROM timetable WHERE group_id='ELEC-C2';"));
assert.ok(safeSql("select t.room_id from timetable t join student_groups g using (group_id)"));
for (const bad of [
  "DELETE FROM timetable", "SELECT 1; DROP TABLE users", "SELECT * FROM users", "SELECT password_hash FROM `users`",
  "SELECT * FROM students", "SELECT * FROM information_schema.tables", "SELECT SLEEP(10)", "SELECT 1 -- x",
  "SELECT * FROM timetable FOR UPDATE", "WITH x AS (SELECT 1) DELETE FROM timetable", "SELECT @@version",
  "SELECT * FROM timetable INTO OUTFILE '/tmp/x'", "SELECT * FROM mysql.user",
]) assert.equal(safeSql(bad), null, bad);
console.log("✓ sql guard tests passed");
