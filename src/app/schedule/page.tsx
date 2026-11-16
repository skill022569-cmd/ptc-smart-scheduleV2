import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { DEFAULT_THEME, TERM } from "@/lib/config";
import { loadTimetable, parseJson } from "@/lib/timetable";
import StudentView from "./StudentView";
import TeacherView from "./TeacherView";
import AdminView from "./AdminView";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireUser();
  const term = `ภาคเรียนที่ ${TERM.semester}/${TERM.academicYear}`;

  if (s.role === "student") {
    const [st] = await q<{ group_id: string; group_name: string; full_name: string; ui_theme: unknown }>(
      `SELECT st.group_id, g.group_name, st.full_name, u.ui_theme FROM students st
         JOIN student_groups g USING (group_id) JOIN users u ON u.user_id = st.user_id WHERE st.user_id=?`, [s.uid]);
    if (!st) return <p className="card">ไม่พบข้อมูลนักศึกษาที่ผูกกับบัญชีนี้ ติดต่อฝ่ายวิชาการ</p>;
    return (
      <StudentView
        title={`ตารางเรียน ${st.group_name}`} subtitle={`${st.full_name} · ${term}`}
        cells={await loadTimetable({ group_id: st.group_id })}
        theme={{ ...DEFAULT_THEME, ...parseJson(st.ui_theme, {}) }}
      />
    );
  }

  if (s.role === "teacher") {
    const [t] = await q<{ teacher_id: string; full_name: string }>("SELECT teacher_id, full_name FROM teachers WHERE user_id=?", [s.uid]);
    if (!t) return <p className="card">บัญชีนี้ยังไม่ได้ผูกกับข้อมูลครู ติดต่อฝ่ายวิชาการ</p>;
    const cells = await loadTimetable({ teacher_id: t.teacher_id });
    const groups = [...new Set(cells.map((c) => c.group_id))];
    const roster = groups.length
      ? await q<{ group_id: string; student_id: string; full_name: string }>(
          `SELECT group_id, student_id, full_name FROM students WHERE group_id IN (?) ORDER BY student_id`, [groups])
      : [];
    return <TeacherView title={`ตารางสอน ${t.full_name}`} subtitle={term} cells={cells} roster={roster} />;
  }

  const sp = await searchParams;
  const filter = { group_id: sp.group, teacher_id: sp.teacher, room_id: sp.room };
  const options = {
    group: await q<{ id: string; name: string }>("SELECT group_id id, group_name name FROM student_groups ORDER BY group_id"),
    teacher: await q<{ id: string; name: string }>("SELECT teacher_id id, full_name name FROM teachers ORDER BY teacher_id"),
    room: await q<{ id: string; name: string }>("SELECT room_id id, building_name name FROM classrooms ORDER BY room_id"),
  };
  return <AdminView subtitle={term} options={options} current={sp} cells={await loadTimetable(filter)} />;
}
