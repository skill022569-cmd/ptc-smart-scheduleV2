// Master-data tables editable by admins. Columns are a whitelist: nothing else can be read or written.
export type Field = { key: string; label: string; type?: "number" | "text" | "textarea" | "select"; options?: string[]; required?: boolean };
export type Entity = { table: string; label: string; pk: string; autoPk?: boolean; fields: Field[]; order: string; where?: string };

const DEPT = { key: "department", label: "แผนก" };

export const ENTITIES: Record<string, Entity> = {
  subjects: {
    table: "subjects", label: "รายวิชา", pk: "subject_id", order: "subject_id",
    fields: [
      { key: "subject_id", label: "รหัสวิชา", required: true }, { key: "subject_name", label: "ชื่อวิชา", required: true },
      { ...DEPT, label: "แผนก (เว้นว่าง = วิชาสามัญ)" }, { key: "credits", label: "หน่วยกิต", type: "number" },
      { key: "theory_hours", label: "ชม.ทฤษฎี", type: "number" }, { key: "lab_hours", label: "ชม.ปฏิบัติ", type: "number" },
      { key: "required_room_type", label: "ประเภทห้องปฏิบัติ", type: "select", options: ["ปกติ", "Lab", "โรงฝึกงาน"] },
    ],
  },
  teachers: {
    table: "teachers", label: "ครูผู้สอน", pk: "teacher_id", order: "teacher_id",
    fields: [
      { key: "teacher_id", label: "รหัสครู", required: true }, { key: "full_name", label: "ชื่อ-สกุล", required: true },
      { ...DEPT, required: true }, { key: "max_hours_per_week", label: "ชม.สอนสูงสุด/สัปดาห์", type: "number" },
    ],
  },
  classrooms: {
    table: "classrooms", label: "ห้องเรียน/โรงฝึกงาน", pk: "room_id", order: "room_id",
    fields: [
      { key: "room_id", label: "รหัสห้อง", required: true }, { key: "building_name", label: "อาคาร", required: true },
      { key: "floor", label: "ชั้น", type: "number" },
      { key: "room_type", label: "ประเภท", type: "select", options: ["ปกติ", "Lab", "โรงฝึกงาน"] },
      { ...DEPT, label: "แผนกเจ้าของห้อง (เว้นว่าง = ใช้ร่วม)" }, { key: "capacity", label: "ความจุ", type: "number" },
    ],
  },
  student_groups: {
    table: "student_groups", label: "กลุ่มเรียน", pk: "group_id", order: "group_id",
    fields: [
      { key: "group_id", label: "รหัสกลุ่ม", required: true }, { key: "group_name", label: "ชื่อกลุ่ม", required: true },
      { ...DEPT, required: true }, { key: "year_level", label: "ชั้นปี", required: true }, { key: "size", label: "จำนวนนักเรียน", type: "number" },
    ],
  },
  course_offerings: {
    table: "course_offerings", label: "วิชาที่กลุ่มเรียน (หลักสูตร)", pk: "offering_id", autoPk: true, order: "group_id, subject_id",
    fields: [
      { key: "group_id", label: "รหัสกลุ่ม", required: true }, { key: "subject_id", label: "รหัสวิชา", required: true },
      { key: "teacher_id", label: "รหัสครูผู้สอน", required: true },
    ],
  },
  students: {
    table: "students", label: "นักเรียน", pk: "student_id", order: "student_id",
    fields: [
      { key: "student_id", label: "รหัสนักศึกษา", required: true }, { key: "full_name", label: "ชื่อ-สกุล", required: true },
      { ...DEPT, required: true }, { key: "year_level", label: "ชั้นปี", required: true }, { key: "group_id", label: "รหัสกลุ่ม", required: true },
    ],
  },
  announcements: {
    table: "announcements", label: "ประกาศ", pk: "id", autoPk: true, order: "created_at DESC",
    fields: [{ key: "title", label: "หัวข้อ", required: true }, { key: "body", label: "เนื้อหา", type: "textarea", required: true }],
  },
  kb_docs: {
    // Timetable sentences are generated automatically; only hand-written documents are editable here.
    table: "kb_docs", label: "ฐานความรู้ AI", pk: "id", autoPk: true, order: "title", where: "source='manual'",
    fields: [
      { key: "title", label: "หัวข้อ", required: true }, { key: "content", label: "เนื้อหา", type: "textarea", required: true },
      { key: "action_url", label: "ลิงก์ปุ่ม (เช่น /map?q=AUTO)" },
    ],
  },
};
