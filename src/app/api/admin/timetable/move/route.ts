import { NextResponse } from "next/server";
import { z } from "zod";
import { tx } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";
import { DAYS, PERIODS, LUNCH_PERIOD, TERM } from "@/lib/config";
import { parseJson, syncTimetableDocs } from "@/lib/timetable";

const Body = z.object({ ids: z.array(z.string().regex(/^\d+$/)).min(1).max(10), day: z.number().int(), start: z.number().int() });

class Conflict extends Error {}

// Move a block of periods (one class card) to another day/start period.
// Concurrency-safe: rows are locked in a transaction and the unique keys reject any double booking.
export async function POST(req: Request) {
  const s = await apiUser(["admin"]);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { ids, day, start } = parsed.data;
  const end = start + ids.length - 1;
  if (day < 1 || day > DAYS.length || start < 1 || end > PERIODS.length) return NextResponse.json({ error: "ตำแหน่งอยู่นอกตาราง" }, { status: 400 });
  if (start <= LUNCH_PERIOD && end >= LUNCH_PERIOD) return NextResponse.json({ error: "วางคร่อมคาบพักเที่ยงไม่ได้" }, { status: 400 });

  try {
    const { warning, group } = await tx(async (c) => {
      const [moving] = (await c.query(
        `SELECT schedule_id, period_slot, teacher_id, room_id, group_id FROM timetable
          WHERE schedule_id IN (?) AND academic_year=? AND semester=? ORDER BY period_slot FOR UPDATE`,
        [ids, TERM.academicYear, TERM.semester])) as unknown as [{ schedule_id: string; teacher_id: string; room_id: string; group_id: string }[]];
      if (moving.length !== ids.length) throw new Conflict("ตารางถูกแก้ไขโดยผู้อื่นแล้ว กรุณารีเฟรช");
      const { teacher_id, room_id, group_id } = moving[0];

      const [clash] = (await c.query(
        `SELECT t.period_slot, t.teacher_id, t.room_id, t.group_id, s.subject_name FROM timetable t JOIN subjects s USING (subject_id)
          WHERE t.academic_year=? AND t.semester=? AND t.day_of_week=? AND t.period_slot BETWEEN ? AND ?
            AND t.schedule_id NOT IN (?) AND (t.teacher_id=? OR t.room_id=? OR t.group_id=?) FOR UPDATE`,
        [TERM.academicYear, TERM.semester, day, start, end, ids, teacher_id, room_id, group_id])) as unknown as
        [{ period_slot: number; teacher_id: string; room_id: string; group_id: string; subject_name: string }[]];
      if (clash.length) {
        const x = clash[0];
        const who = x.teacher_id === teacher_id ? `ครู ${teacher_id} สอน` : x.room_id === room_id ? `ห้อง ${room_id} ถูกใช้สอน` : `กลุ่ม ${group_id} เรียน`;
        throw new Conflict(`ชนกัน: คาบ ${x.period_slot} ${who}วิชา ${x.subject_name} อยู่แล้ว`);
      }

      // Park rows outside the grid first so shifting a block onto itself never trips the unique keys mid-update.
      for (const [i, m] of moving.entries()) await c.query("UPDATE timetable SET period_slot=? WHERE schedule_id=?", [-1 - i, m.schedule_id]);
      for (const [i, m] of moving.entries()) {
        await c.query("UPDATE timetable SET day_of_week=?, period_slot=?, version_tag='MANUAL' WHERE schedule_id=?", [day, start + i, m.schedule_id]);
      }

      const [[t]] = (await c.query("SELECT unavailable_slots FROM teachers WHERE teacher_id=?", [teacher_id])) as unknown as [{ unavailable_slots: unknown }[]];
      const blocked = parseJson<{ day: number; period: number }[]>(t?.unavailable_slots, [])
        .some((u) => u.day === day && u.period >= start && u.period <= end);
      return {
        group: group_id,
        warning: blocked ? `ย้ายแล้ว แต่ครู ${teacher_id} แจ้งว่าไม่สะดวกในช่วงนี้ (ระบบแจ้งเตือนครูแล้ว)` : null,
      };
    });
    await syncTimetableDocs(group);
    await audit(s.uid, "TIMETABLE_MOVE", { ids, day, start });
    return NextResponse.json({ ok: true, warning });
  } catch (err) {
    if (err instanceof Conflict) return NextResponse.json({ error: err.message }, { status: 409 });
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ error: "ชนกับคาบอื่น (มีผู้แก้ไขพร้อมกัน) กรุณารีเฟรช" }, { status: 409 });
    throw err;
  }
}
