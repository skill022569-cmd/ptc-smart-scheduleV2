import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { TERM } from "@/lib/config";
import AdminTabs from "./AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireUser(["admin"]);
  const groups = await q<{ id: string; name: string }>("SELECT group_id id, group_name name FROM student_groups ORDER BY group_id");
  const [stats] = await q<{ teachers: string; rooms: string; groups: string; students: string; hours: string }>(
    `SELECT (SELECT COUNT(*) FROM teachers) teachers, (SELECT COUNT(*) FROM classrooms) rooms, (SELECT COUNT(*) FROM student_groups) \`groups\`,
            (SELECT COUNT(*) FROM students) students, (SELECT COUNT(*) FROM timetable WHERE academic_year=? AND semester=?) hours`,
    [TERM.academicYear, TERM.semester]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">⚙️ จัดการระบบ (ฝ่ายวิชาการ)</h1>
        <p className="text-stone-500">ภาคเรียนที่ {TERM.semester}/{TERM.academicYear}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[["ครู", stats.teachers], ["ห้อง", stats.rooms], ["กลุ่มเรียน", stats.groups], ["นักเรียน", stats.students], ["ชั่วโมงในตาราง", stats.hours]].map(([l, v]) => (
          <div key={l} className="card !p-4 text-center"><div className="text-2xl font-bold text-brand-700">{v}</div><div className="text-sm text-stone-500">{l}</div></div>
        ))}
      </div>
      <AdminTabs groups={groups} />
    </div>
  );
}
