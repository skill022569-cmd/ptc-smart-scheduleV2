// Usage: npm run db:seed -- --yes   (WIPES and refills all data tables)
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, q } from "../src/lib/db";
import { BUILDINGS } from "../src/lib/campus";
import { runAutoSchedule } from "../src/lib/timetable";

if (!process.argv.includes("--yes")) {
  console.error("This deletes ALL data first. Re-run with: npm run db:seed -- --yes");
  process.exit(1);
}

const DEPTS = [
  { code: "AUTO", name: "ช่างยนต์", building: "AUTO", lab: "โรงฝึกงาน",
    subjects: ["งานเครื่องยนต์เล็ก", "งานส่งกำลังรถยนต์", "งานไฟฟ้ารถยนต์", "งานเครื่องยนต์ดีเซล", "งานจักรยานยนต์", "งานปรับอากาศรถยนต์", "งานระบบฉีดเชื้อเพลิง", "งานตรวจวิเคราะห์เครื่องยนต์"] },
  { code: "ELEC", name: "ช่างไฟฟ้ากำลัง", building: "ELEC", lab: "โรงฝึกงาน",
    subjects: ["เครื่องมือวัดไฟฟ้า", "การติดตั้งไฟฟ้าในอาคาร", "เครื่องกลไฟฟ้า", "การควบคุมมอเตอร์", "ระบบไฟฟ้าโรงงาน", "เครื่องทำความเย็น", "พีแอลซีเบื้องต้น", "การออกแบบระบบไฟฟ้า"] },
  { code: "ELEX", name: "ช่างอิเล็กทรอนิกส์", building: "ELEX", lab: "Lab",
    subjects: ["วงจรไฟฟ้า", "อุปกรณ์อิเล็กทรอนิกส์", "ดิจิทัลเบื้องต้น", "ไมโครคอนโทรลเลอร์", "เครื่องรับวิทยุ", "ระบบสื่อสาร", "อิเล็กทรอนิกส์อุตสาหกรรม", "ระบบ IoT"] },
  { code: "MECH", name: "ช่างกลโรงงาน", building: "MECH", lab: "โรงฝึกงาน",
    subjects: ["งานฝึกฝีมือ", "งานเครื่องมือกล", "งานกลึง", "งานเชื่อมและโลหะแผ่น", "งานไส", "งานซีเอ็นซี", "งานเครื่องมือกลขั้นสูง", "งานบำรุงรักษา"] },
  { code: "ACC", name: "การบัญชี", building: "BUS", lab: "Lab",
    subjects: ["การบัญชีเบื้องต้น", "บัญชีห้างหุ้นส่วน", "การบัญชีต้นทุน", "โปรแกรมสำเร็จรูปทางการบัญชี", "การภาษีอากร", "บัญชีบริษัทจำกัด", "การตรวจสอบภายใน", "การวิเคราะห์งบการเงิน"] },
  { code: "DBT", name: "เทคโนโลยีธุรกิจดิจิทัล", building: "BUS", lab: "Lab",
    subjects: ["คอมพิวเตอร์และสารสนเทศ", "การออกแบบกราฟิก", "การเขียนโปรแกรมเว็บ", "ฐานข้อมูลเบื้องต้น", "การตลาดดิจิทัล", "การพัฒนาแอปพลิเคชัน", "ระบบเครือข่าย", "พาณิชย์อิเล็กทรอนิกส์"] },
];
const LEVELS = [
  { code: "C1", name: "ปวช.1", hv: false }, { code: "C2", name: "ปวช.2", hv: false }, { code: "C3", name: "ปวช.3", hv: false },
  { code: "H1", name: "ปวส.1", hv: true }, { code: "H2", name: "ปวส.2", hv: true },
];
const COMMON = [
  { key: "THAI", name: "ภาษาไทย", teachers: ["ครูสมศรี ใจดี", "ครูวิไล แสงทอง", "ครูประภา ศรีสุข"] },
  { key: "ENG", name: "ภาษาอังกฤษ", teachers: ["ครูจอห์น สมิธ", "ครูนภา พรหมมา", "ครูกิตติ ทองดี"] },
  { key: "MATH", name: "คณิตศาสตร์", teachers: ["ครูสมชาย คำดี", "ครูอรุณี บุญมา", "ครูวีระ ชัยศรี"] },
];
const FIRST = ["ธนพล", "ศิริพร", "อนุชา", "กมลชนก", "ณัฐวุฒิ", "พิมพ์ชนก", "สุรเชษฐ์", "จิราพร", "วรวุฒิ", "ปวีณา"];
const LAST = ["ศรีโพน", "ทองคำ", "บุญเรือง", "แก้วมณี", "ไชยมงคล", "พลซา", "สายทอง", "วงศ์ไชย"];

const pw = () => randomBytes(6).toString("base64url");
const at = (b: string, dx: number, dy: number) => {
  const B = BUILDINGS.find((x) => x.id === b)!;
  return JSON.stringify({ x: +(B.x + B.w * dx).toFixed(1), y: +(B.y + B.h * dy).toFixed(1) });
};

async function main() {
  for (const t of ["timetable", "timetable_snapshots", "course_offerings", "students", "student_groups", "teachers",
    "classrooms", "subjects", "users", "otp_logs", "audit_logs", "announcements", "kb_docs"]) await q(`DELETE FROM ${t}`);

  // Rooms: 12 general classrooms + 3 labs/workshops per department.
  for (let i = 1; i <= 6; i++) {
    await q("INSERT INTO classrooms VALUES (?,?,?,?,?,?,?)", [`B1-10${i}`, "อาคารเรียนรวม 1", 1, "ปกติ", null, 40, at("B1", 0.15 * i, 0.5)]);
    await q("INSERT INTO classrooms VALUES (?,?,?,?,?,?,?)", [`B2-20${i}`, "อาคารเรียนรวม 2", 2, "ปกติ", null, 40, at("B2", 0.15 * i, 0.5)]);
  }
  for (const d of DEPTS) {
    const bname = BUILDINGS.find((b) => b.id === d.building)!.name;
    const offset = d.code === "DBT" ? 0.55 : 0;
    for (let i = 1; i <= 3; i++) {
      await q("INSERT INTO classrooms VALUES (?,?,?,?,?,?,?)",
        [`${d.code}-10${i}`, bname, 1, d.lab, d.name, 40, at(d.building, offset + 0.13 * i + (offset ? 0 : 0.1), 0.5)]);
    }
  }

  // Teachers.
  const commonTeacherIds: Record<string, string[]> = {};
  for (const c of COMMON) {
    commonTeacherIds[c.key] = [];
    for (const [i, n] of c.teachers.entries()) {
      const id = `T-${c.key}-${i + 1}`;
      commonTeacherIds[c.key].push(id);
      await q("INSERT INTO teachers (teacher_id, full_name, department, max_hours_per_week, unavailable_slots) VALUES (?,?,?,?,?)",
        [id, n, "สามัญสัมพันธ์", 24, "[]"]);
    }
  }
  for (const [di, d] of DEPTS.entries()) {
    for (let i = 1; i <= 4; i++) {
      const name = `ครู${FIRST[(di * 4 + i) % FIRST.length]} ${LAST[(di + i) % LAST.length]}`;
      // A few teachers have prior commitments (ติดราชการ) on Wednesday morning.
      const blocked = i === 2 ? JSON.stringify([1, 2, 3, 4].map((p) => ({ day: 3, period: p }))) : "[]";
      await q("INSERT INTO teachers (teacher_id, full_name, department, max_hours_per_week, unavailable_slots) VALUES (?,?,?,?,?)",
        [`T-${d.code}-${i}`, name, d.name, 24, blocked]);
    }
  }

  // Subjects, groups, offerings, students.
  for (const c of COMMON) {
    for (const hv of [false, true]) {
      const code = `${hv ? "3" : "2"}0000-${c.key}`;
      await q("INSERT INTO subjects VALUES (?,?,?,?,?,?,?)", [code, `${c.name}${hv ? "เพื่ออาชีพ" : "พื้นฐาน"}`, null, 2, 2, 0, "ปกติ"]);
    }
  }
  let groupCounter = 0;
  const studentRows: unknown[][] = [];
  for (const [di, d] of DEPTS.entries()) {
    for (const [li, L] of LEVELS.entries()) {
      const gid = `${d.code}-${L.code}`;
      await q("INSERT INTO student_groups VALUES (?,?,?,?,?)", [gid, `${L.name} ${d.name}`, d.name, L.name, 35]);
      for (const c of COMMON) {
        const tid = commonTeacherIds[c.key][groupCounter % 3];
        await q("INSERT INTO course_offerings (group_id, subject_id, teacher_id) VALUES (?,?,?)", [gid, `${L.hv ? "3" : "2"}0000-${c.key}`, tid]);
      }
      groupCounter++;
      for (let k = 0; k < 4; k++) {
        const sid = `${L.hv ? "3" : "2"}${String(di + 1).padStart(2, "0")}${li}${k}-${d.code}`;
        const sname = d.subjects[(li * 2 + k) % d.subjects.length];
        await q("INSERT INTO subjects VALUES (?,?,?,?,?,?,?)", [sid, sname, d.name, 2, 1, 3, d.lab]);
        await q("INSERT INTO course_offerings (group_id, subject_id, teacher_id) VALUES (?,?,?)", [gid, sid, `T-${d.code}-${k + 1}`]);
      }
      for (let n = 1; n <= 5; n++) {
        const id = `69${di + 1}${li + 1}${String(n).padStart(3, "0")}`;
        studentRows.push([id, `${FIRST[(n + di) % FIRST.length]} ${LAST[(n + li) % LAST.length]}`, d.name, L.name, gid]);
      }
    }
  }

  // Student accounts: username = student id, initial password = student id (forced change on first login).
  for (const s of studentRows) {
    const [uid] = await insertUser(String(s[0]), String(s[0]), "student", null, true);
    await q("INSERT INTO students (student_id, user_id, full_name, department, year_level, group_id) VALUES (?,?,?,?,?,?)", [s[0], uid, ...s.slice(1)]);
  }

  // Demo accounts with random passwords (printed once below).
  const creds = { admin: pw(), teacher: pw(), student: pw() };
  await insertUser("admin", creds.admin, "admin", process.env.SEED_ADMIN_EMAIL ?? "admin@example.com", false);
  const [tuid] = await insertUser("teacher", creds.teacher, "teacher", process.env.SEED_TEACHER_EMAIL ?? "teacher@example.com", false);
  await q("UPDATE teachers SET user_id=? WHERE teacher_id='T-AUTO-1'", [tuid]);
  const demoStudent = "6921001";
  await q("UPDATE users SET password_hash=?, must_change_password=FALSE WHERE username=?", [await bcrypt.hash(creds.student, 10), demoStudent]);

  await q("INSERT INTO announcements (title, body) VALUES (?,?),(?,?),(?,?)", [
    "ตารางเรียนภาคเรียนที่ 1/2569 ออกแล้ว", "นักเรียนทุกแผนกตรวจสอบตารางเรียนได้ที่เมนู ตารางเรียน หากพบปัญหาติดต่อฝ่ายวิชาการ อาคารอำนวยการ ชั้น 1",
    "ครูผู้สอนแจ้งช่วงเวลาไม่สะดวกสอน", "ขอให้ครูทุกท่านแจ้งช่วงเวลาที่ติดราชการในเมนู ตารางสอน > ล็อกเวลาส่วนตัว ภายในวันศุกร์นี้",
    "นักศึกษาใหม่ หาห้องเรียนไม่เจอ?", "ใช้เมนู แผนที่วิทยาลัย พิมพ์รหัสห้อง เช่น AUTO-101 ระบบจะไฮไลต์อาคารให้ทันที",
  ]);

  const kb: [string, string, string | null][] = [
    ["เกณฑ์การติด ร. (ไม่มีสิทธิ์สอบ)", "นักเรียนต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 ของเวลาเรียนทั้งหมดในแต่ละรายวิชา หากเวลาเรียนไม่ถึงจะได้ผล ขร. (ขาดเรียน) และไม่มีสิทธิ์สอบปลายภาค ส่วน ร. หมายถึงผลการเรียนยังไม่สมบูรณ์ เช่น ส่งงานไม่ครบ ต้องติดต่อครูผู้สอนเพื่อแก้ ร. ภายใน 2 สัปดาห์หลังประกาศผล มิฉะนั้นจะได้ผลการเรียน 0", null],
    ["วิธีขอเปลี่ยนกลุ่มเรียน", "ยื่นคำร้องขอเปลี่ยนกลุ่มเรียนที่งานทะเบียน ฝ่ายวิชาการ ภายใน 2 สัปดาห์แรกของภาคเรียน โดยต้องได้รับความเห็นชอบจากครูที่ปรึกษาและหัวหน้าแผนก การเปลี่ยนจะมีผลเมื่อฝ่ายวิชาการอนุมัติและปรับตารางเรียนในระบบแล้ว", null],
    ["ที่ตั้งแผนกช่างยนต์", "แผนกช่างยนต์อยู่ที่อาคารช่างยนต์ ทางทิศตะวันตกเฉียงใต้ของวิทยาลัย มีโรงฝึกงาน AUTO-101 ถึง AUTO-103", "/map?q=AUTO"],
    ["ที่ตั้งแผนกช่างไฟฟ้ากำลัง", "แผนกช่างไฟฟ้ากำลังอยู่ที่อาคารช่างไฟฟ้ากำลัง ถัดจากอาคารช่างยนต์ มีโรงฝึกงาน ELEC-101 ถึง ELEC-103", "/map?q=ELEC"],
    ["ที่ตั้งแผนกช่างอิเล็กทรอนิกส์", "แผนกช่างอิเล็กทรอนิกส์อยู่ที่อาคารช่างอิเล็กทรอนิกส์ มีห้องปฏิบัติการ ELEX-101 ถึง ELEX-103", "/map?q=ELEX"],
    ["ที่ตั้งแผนกช่างกล (ช่างกลโรงงาน)", "แผนกช่างกลโรงงานอยู่ที่อาคารช่างกลโรงงาน ฝั่งตะวันออกของวิทยาลัย มีโรงฝึกงาน MECH-101 ถึง MECH-103", "/map?q=MECH"],
    ["ที่ตั้งแผนกการบัญชีและเทคโนโลยีธุรกิจดิจิทัล", "แผนกการบัญชีและแผนกเทคโนโลยีธุรกิจดิจิทัลอยู่ที่อาคารพาณิชยกรรม กลางวิทยาลัย มีห้องปฏิบัติการคอมพิวเตอร์ ACC-101 ถึง ACC-103 และ DBT-101 ถึง DBT-103", "/map?q=BUS"],
    ["เวลาเรียนและคาบเรียน", "วิทยาลัยเรียนวันจันทร์ถึงศุกร์ คาบละ 60 นาที เริ่มคาบ 1 เวลา 08:00 น. ถึงคาบ 10 เวลา 18:00 น. คาบ 5 (12:00-13:00) เป็นเวลาพักกลางวัน วิชาปฏิบัติจะเรียนต่อเนื่องเป็นบล็อก 3-4 ชั่วโมง", null],
    ["การติดต่อฝ่ายวิชาการ", "ฝ่ายวิชาการตั้งอยู่ที่อาคารอำนวยการ ชั้น 1 เปิดทำการวันจันทร์ถึงศุกร์ 08:30-16:30 น. ติดต่อเรื่องตารางเรียน การลงทะเบียน การเปลี่ยนกลุ่ม และคำร้องต่าง ๆ", "/map?q=ADM"],
    ["นโยบายข้อมูลส่วนบุคคล (PDPA)", "ระบบเก็บข้อมูลเท่าที่จำเป็นต่อการจัดตารางเรียน ผู้ใช้สามารถขอส่งออกข้อมูลของตนเอง หรือขอลบข้อมูลได้ที่หน้าโปรไฟล์ ประวัติการเข้าสู่ระบบจะถูกลบอัตโนมัติเมื่อครบ 1 ปี", "/profile"],
  ];
  for (const [title, content, url] of kb) {
    await q("INSERT INTO kb_docs (title, content, action_url) VALUES (?,?,?)", [title, `${title}\n${content}`, url]);
  }

  const r = await runAutoSchedule(null);
  console.log(`✓ seeded. AI scheduler placed ${r.placedHours} hours, unplaced blocks: ${r.unplaced.length}`);
  for (const u of r.unplaced) console.log("   - unplaced:", u);
  console.log("\nDemo accounts (save these — shown only once):");
  console.log(`  admin   / ${creds.admin}   (OTP → ${process.env.SEED_ADMIN_EMAIL ?? "admin@example.com"})`);
  console.log(`  teacher / ${creds.teacher}   (OTP → ${process.env.SEED_TEACHER_EMAIL ?? "teacher@example.com"})`);
  console.log(`  ${demoStudent} / ${creds.student}   (student)`);
  console.log("  Other students: username = password = student id (e.g. 6911001), forced to change on first login.");
  await pool().end();
}

async function insertUser(username: string, password: string, role: string, email: string | null, mustChange: boolean) {
  await q("INSERT INTO users (username, password_hash, email, is_email_verified, role, must_change_password) VALUES (?,?,?,?,?,?)",
    [username, await bcrypt.hash(password, 10), email, email != null, role, mustChange]);
  const [u] = await q<{ user_id: string }>("SELECT user_id FROM users WHERE username=?", [username]);
  return [u.user_id];
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
