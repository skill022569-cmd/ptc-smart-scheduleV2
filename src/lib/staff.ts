import { q } from "./db";

// Standard OVEC college structure: executives, four divisions with their work units, then academic departments.
export const DIVISIONS = [
  "ผู้บริหารสถานศึกษา",
  "ฝ่ายบริหารทรัพยากร",
  "ฝ่ายยุทธศาสตร์และแผนงาน",
  "ฝ่ายพัฒนากิจการนักเรียนนักศึกษา",
  "ฝ่ายวิชาการ",
  "แผนกวิชา",
];

export type Staff = { id: string; full_name: string; position: string; rank_title: string | null; division: string; unit: string | null; sort_order: number };

// Staff sentences in kb_docs so the vector Q&A can answer "ใครเป็นหัวหน้างานทะเบียน".
export async function syncStaffDocs() {
  const rows = await q<Staff>("SELECT * FROM staff");
  await q("DELETE FROM kb_docs WHERE source='staff'");
  const docs = rows.map((s) => [
    s.position,
    `${s.full_name} ตำแหน่ง${s.position}${s.unit && !s.position.includes(s.unit) ? ` ${s.unit}` : ""} ${s.division}${s.rank_title ? ` (${s.rank_title})` : ""}`,
    "/staff", "staff",
  ]);
  for (let i = 0; i < docs.length; i += 100) {
    await q("INSERT INTO kb_docs (title, content, action_url, source) VALUES ?", [docs.slice(i, i + 100)]);
  }
  return docs.length;
}
