import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { loadTimetable, parseJson } from "@/lib/timetable";
import { DAYS, PERIODS, LUNCH_PERIOD } from "@/lib/config";

async function myTeacher() {
  const s = await apiUser(["teacher"]);
  if (!s) return null;
  const [t] = await q<{ teacher_id: string; unavailable_slots: unknown }>(
    "SELECT teacher_id, unavailable_slots FROM teachers WHERE user_id=?", [s.uid]);
  return t ?? null;
}

export async function GET() {
  const t = await myTeacher();
  if (!t) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const unavailable = parseJson<{ day: number; period: number }[]>(t.unavailable_slots, []);
  const cells = await loadTimetable({ teacher_id: t.teacher_id });
  const blocked = new Set(unavailable.map((u) => `${u.day}|${u.period}`));
  const conflicts = cells
    .filter((c) => blocked.has(`${c.day_of_week}|${c.period_slot}`))
    .map((c) => ({ day: c.day_of_week, period: c.period_slot }));
  return NextResponse.json({ unavailable, conflicts, cells });
}

const Slots = z.object({
  slots: z.array(z.object({
    day: z.number().int().min(1).max(DAYS.length),
    period: z.number().int().min(1).max(PERIODS.length).refine((p) => p !== LUNCH_PERIOD),
  })).max(DAYS.length * PERIODS.length),
});

export async function PUT(req: Request) {
  const t = await myTeacher();
  if (!t) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Slots.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลช่วงเวลาไม่ถูกต้อง" }, { status: 400 });
  await q("UPDATE teachers SET unavailable_slots=? WHERE teacher_id=?", [JSON.stringify(parsed.data.slots), t.teacher_id]);
  return NextResponse.json({ ok: true });
}
