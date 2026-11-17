// Simulated staff of a typical OVEC vocational college. All names are fictitious.
import { q } from "../src/lib/db";
import { syncStaffDocs } from "../src/lib/staff";

const UNITS: Record<string, string[]> = {
  "ฝ่ายบริหารทรัพยากร": ["งานบริหารงานทั่วไป", "งานบุคลากร", "งานการเงิน", "งานการบัญชี", "งานพัสดุ", "งานอาคารสถานที่", "งานทะเบียน", "งานประชาสัมพันธ์"],
  "ฝ่ายยุทธศาสตร์และแผนงาน": ["งานวางแผนและงบประมาณ", "งานศูนย์ข้อมูลสารสนเทศ", "งานความร่วมมือ", "งานวิจัย พัฒนา นวัตกรรมและสิ่งประดิษฐ์", "งานประกันคุณภาพและมาตรฐานการศึกษา", "งานส่งเสริมผลิตผล การค้าและประกอบธุรกิจ"],
  "ฝ่ายพัฒนากิจการนักเรียนนักศึกษา": ["งานกิจกรรมนักเรียนนักศึกษา", "งานครูที่ปรึกษา", "งานปกครอง", "งานแนะแนวอาชีพและการจัดหางาน", "งานสวัสดิการนักเรียนนักศึกษา", "งานโครงการพิเศษและการบริการชุมชน"],
  "ฝ่ายวิชาการ": ["งานพัฒนาหลักสูตรการเรียนการสอน", "งานวัดผลและประเมินผล", "งานอาชีวศึกษาระบบทวิภาคี", "งานวิทยบริการและห้องสมุด", "งานสื่อการเรียนการสอน"],
};
const DEPUTIES = [
  ["นายวิชัย ศรีสุวรรณ", "ฝ่ายบริหารทรัพยากร", "รองผู้อำนวยการชำนาญการพิเศษ"],
  ["นางสาวรัตนา พรมมา", "ฝ่ายยุทธศาสตร์และแผนงาน", "รองผู้อำนวยการชำนาญการ"],
  ["นายสุรพล แสนทวีสุข", "ฝ่ายพัฒนากิจการนักเรียนนักศึกษา", "รองผู้อำนวยการชำนาญการ"],
  ["นางมาลัย ชัยวงศ์", "ฝ่ายวิชาการ", "รองผู้อำนวยการชำนาญการพิเศษ"],
];
// Support staff per unit (เจ้าหน้าที่ / ลูกจ้าง).
const OFFICERS: [string, string, string][] = [
  ["นางสาวพัชรี บุญศรี", "งานบริหารงานทั่วไป", "พนักงานราชการ (เจ้าหน้าที่)"],
  ["นางวันเพ็ญ ทองสุข", "งานบุคลากร", "เจ้าหน้าที่อัตราจ้าง"],
  ["นางสาวอรอุมา จันทร์แก้ว", "งานการเงิน", "พนักงานราชการ (เจ้าหน้าที่)"],
  ["นางสาวสุภาพร ศรีพรม", "งานการบัญชี", "เจ้าหน้าที่อัตราจ้าง"],
  ["นายธีรวัฒน์ พลอาสา", "งานพัสดุ", "เจ้าหน้าที่อัตราจ้าง"],
  ["นายบุญมี คำภา", "งานอาคารสถานที่", "ลูกจ้างประจำ (นักการภารโรง)"],
  ["นายสมพงษ์ ไชยสิทธิ์", "งานอาคารสถานที่", "ลูกจ้างประจำ (พนักงานขับรถ)"],
  ["นางสาวเบญจวรรณ นามวงศ์", "งานทะเบียน", "เจ้าหน้าที่อัตราจ้าง"],
  ["นางสาวจันทร์เพ็ญ ศรีโพธิ์", "งานศูนย์ข้อมูลสารสนเทศ", "เจ้าหน้าที่อัตราจ้าง"],
  ["นางสาวกนกวรรณ แสงสว่าง", "งานวิทยบริการและห้องสมุด", "บรรณารักษ์อัตราจ้าง"],
];
const RANKS = ["ครู คศ.3", "ครู คศ.2", "ครู คศ.1", "ครูผู้ช่วย", "พนักงานราชการ (ครู)", "ครูอัตราจ้าง"];

export async function seedStaff() {
  const teachers = await q<{ teacher_id: string; full_name: string; department: string }>(
    "SELECT teacher_id, full_name, department FROM teachers ORDER BY teacher_id");
  const rank = new Map(teachers.map((t, i) => [t.teacher_id, RANKS[i % RANKS.length]]));
  const rows: (string | number | null)[][] = [
    ["นายประเสริฐ วงศ์สุวรรณ", "ผู้อำนวยการวิทยาลัยการอาชีพโพนทอง", "ผู้อำนวยการชำนาญการพิเศษ", "ผู้บริหารสถานศึกษา", null, 0],
    ...DEPUTIES.map(([n, div, r], i) => [n, `รองผู้อำนวยการ${div}`, r, "ผู้บริหารสถานศึกษา", div, 1 + i]),
  ];

  // Department heads: first teacher of each department; every teacher also listed under their department.
  const byDept = new Map<string, typeof teachers>();
  for (const t of teachers) byDept.set(t.department, [...(byDept.get(t.department) ?? []), t]);
  const heads = new Set<string>();
  for (const [dept, list] of byDept) {
    const unit = `แผนกวิชา${dept}`;
    heads.add(list[0].teacher_id);
    rows.push([list[0].full_name, `หัวหน้า${unit}`, rank.get(list[0].teacher_id)!, "แผนกวิชา", unit, 200]);
    for (const t of list.slice(1)) rows.push([t.full_name, "ครูผู้สอน", rank.get(t.teacher_id)!, "แผนกวิชา", unit, 210]);
  }

  // Work-unit heads: other teachers, as in real colleges where teachers hold an admin duty on top of teaching.
  const pool = teachers.filter((t) => !heads.has(t.teacher_id));
  let i = 0;
  for (const [div, units] of Object.entries(UNITS)) {
    for (const unit of units) {
      const t = pool[i++ % pool.length];
      rows.push([t.full_name, `หัวหน้า${unit}`, rank.get(t.teacher_id)!, div, unit, 100 + i]);
    }
  }
  for (const [n, unit, r] of OFFICERS) {
    const div = Object.entries(UNITS).find(([, us]) => us.includes(unit))![0];
    rows.push([n, `เจ้าหน้าที่${unit}`, r, div, unit, 150]);
  }

  await q("DELETE FROM staff");
  await q("INSERT INTO staff (full_name, position, rank_title, division, unit, sort_order) VALUES ?", [rows]);
  const docs = await syncStaffDocs();
  return { staff: rows.length, docs };
}
