import { q } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { DAYS, TERM } from "@/lib/config";

// Timetable / teacher-workload export as CSV (UTF-8 BOM so Excel shows Thai correctly).
export async function GET(req: Request) {
  if (!(await apiUser(["admin"]))) return new Response("forbidden", { status: 403 });
  const type = new URL(req.url).searchParams.get("type") === "workload" ? "workload" : "timetable";
  // With TiFlash replicas enabled, analytical reads go to the columnar engine and do not slow down students.
  const hint = process.env.TIDB_TIFLASH === "true" ? "/*+ READ_FROM_STORAGE(TIFLASH[t]) */" : "";
  const rows = type === "workload"
    ? await q(`SELECT ${hint} t.teacher_id, te.full_name, te.department, COUNT(*) AS hours_per_week, te.max_hours_per_week,
                  COUNT(DISTINCT t.group_id) AS groups_taught
                FROM timetable t JOIN teachers te ON te.teacher_id=t.teacher_id
               WHERE t.academic_year=? AND t.semester=? GROUP BY t.teacher_id, te.full_name, te.department, te.max_hours_per_week
               ORDER BY hours_per_week DESC`, [TERM.academicYear, TERM.semester])
    : (await q(`SELECT ${hint} t.group_id, g.group_name, t.day_of_week, t.period_slot, t.subject_id, s.subject_name,
                  t.teacher_id, te.full_name AS teacher_name, t.room_id
                FROM timetable t JOIN subjects s ON s.subject_id=t.subject_id JOIN teachers te ON te.teacher_id=t.teacher_id
                JOIN student_groups g ON g.group_id=t.group_id
               WHERE t.academic_year=? AND t.semester=? ORDER BY t.group_id, t.day_of_week, t.period_slot`, [TERM.academicYear, TERM.semester]))
        .map((r) => ({ ...r, day_of_week: DAYS[r.day_of_week - 1]?.name }));

  const cols = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${type}-${TERM.semester}-${TERM.academicYear}.csv"` },
  });
}
