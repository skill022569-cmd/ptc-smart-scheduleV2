import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";
import { TERM } from "@/lib/config";
import { restoreSnapshot, runAutoSchedule } from "@/lib/timetable";

export const maxDuration = 60;

// List versions (snapshots) of the current term's timetable.
export async function GET() {
  if (!(await apiUser(["admin"]))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const snapshots = await q(
    `SELECT snapshot_id, label, row_count, created_at FROM timetable_snapshots
      WHERE academic_year=? AND semester=? ORDER BY created_at DESC LIMIT 30`, [TERM.academicYear, TERM.semester]);
  const [stat] = await q<{ n: string }>("SELECT COUNT(*) n FROM timetable WHERE academic_year=? AND semester=?", [TERM.academicYear, TERM.semester]);
  return NextResponse.json({ snapshots, current: Number(stat.n) });
}

// { action: "run" } runs the AI scheduler; { action: "restore", id } rolls back to a snapshot.
export async function POST(req: Request) {
  const s = await apiUser(["admin"]);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
  if (body.action === "run") {
    const r = await runAutoSchedule(s.uid);
    await audit(s.uid, "AI_SCHEDULE_RUN", { placed: r.placedHours, unplaced: r.unplaced.length });
    return NextResponse.json(r);
  }
  if (body.action === "restore" && body.id) {
    const n = await restoreSnapshot(body.id, s.uid);
    await audit(s.uid, "TIMETABLE_RESTORE", { snapshot: body.id });
    return NextResponse.json({ restored: n });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
