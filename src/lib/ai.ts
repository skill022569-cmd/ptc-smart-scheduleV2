import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { q, readOnlyPool } from "./db";
import { PERIODS, LUNCH_PERIOD, TERM } from "./config";
import { safeSql } from "./sqlguard";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export type Action = { label: string; href: string };
export type Answer = { answer: string; intent: string; sql?: string; actions: Action[] };

// Tables the AI may query. Personal data (users, students, logs) is deliberately absent.
const SCHEMA = `
timetable(academic_year INT, semester INT, day_of_week TINYINT 1=จันทร์..5=ศุกร์, period_slot TINYINT 1..10, subject_id, teacher_id, room_id, group_id)
  -- one row = one 60-minute period. Current term: academic_year=${TERM.academicYear} AND semester=${TERM.semester}
subjects(subject_id, subject_name, department NULL=วิชาสามัญ, credits, theory_hours, lab_hours, required_room_type)
teachers(teacher_id, full_name e.g. 'ครูสมศรี ใจดี', department, max_hours_per_week)
classrooms(room_id e.g. 'AUTO-101', building_name, floor, room_type 'ปกติ'|'Lab'|'โรงฝึกงาน', department, capacity)
student_groups(group_id e.g. 'ELEC-C2', group_name e.g. 'ปวช.2 ช่างไฟฟ้ากำลัง', department, year_level 'ปวช.1'..'ปวช.3'|'ปวส.1'|'ปวส.2', size)
Departments: ช่างยนต์(AUTO), ช่างไฟฟ้ากำลัง(ELEC), ช่างอิเล็กทรอนิกส์(ELEX), ช่างกลโรงงาน(MECH), การบัญชี(ACC), เทคโนโลยีธุรกิจดิจิทัล(DBT)
Periods: ${PERIODS.map((p) => `${p.id}=${p.start}-${p.end}`).join(", ")}; period ${LUNCH_PERIOD} is lunch.`;

const ROUTER_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["schedule_sql", "knowledge", "chitchat"] },
    sql: { type: "string", description: "A single MySQL SELECT for intent=schedule_sql, else empty string" },
  },
  required: ["intent", "sql"],
  additionalProperties: false,
};

function bangkokNow() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const dow = now.getDay(); // 0=Sun
  return { text: now.toLocaleString("th-TH"), day: dow >= 1 && dow <= 5 ? dow : null, hour: now.getHours() };
}

async function ask(system: string, user: string, effort: "low" | "medium", format?: Record<string, unknown>) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, ...(format ? { format: { type: "json_schema", schema: format } } : {}) },
    // On a safety decline, the API retries on a fallback model inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (res.stop_reason === "refusal") throw new Error("REFUSED");
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

async function runSql(sql: string) {
  const c = await readOnlyPool().getConnection();
  try {
    await c.query("SET SESSION MAX_EXECUTION_TIME = 5000");
    // TiDB stale-read transaction: read-only by design (writes inside it are rejected).
    await c.query("START TRANSACTION READ ONLY AS OF TIMESTAMP NOW() - INTERVAL 1 SECOND");
    const [rows] = await c.query(`SELECT * FROM (${sql}) AS ai_result LIMIT 60`);
    return rows as Record<string, unknown>[];
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
  }
}

async function searchKb(question: string) {
  if (process.env.TIDB_AUTO_EMBEDDING === "true") {
    return q<{ title: string; content: string; action_url: string | null }>(
      `SELECT title, content, action_url FROM kb_docs ORDER BY VEC_EMBED_COSINE_DISTANCE(content_vector, ?) LIMIT 4`, [question]);
  }
  // shortcut: without TiDB Cloud auto-embedding (local dev) send the whole small KB; fine below ~30 docs.
  return q<{ title: string; content: string; action_url: string | null }>("SELECT title, content, action_url FROM kb_docs LIMIT 30");
}

export async function answer(question: string, who: { role: string; group_id?: string; group_name?: string; teacher_id?: string }): Promise<Answer> {
  const now = bangkokNow();
  const context = `ตอนนี้: ${now.text} (day_of_week วันนี้ = ${now.day ?? "วันหยุด"})
ผู้ถาม: ${who.role}${who.group_id ? `, กลุ่มเรียนของผู้ถาม group_id='${who.group_id}' (${who.group_name})` : ""}${who.teacher_id ? `, teacher_id ของผู้ถาม='${who.teacher_id}'` : ""}`;

  // 1) Intent router + text-to-SQL in one structured call.
  const routed = JSON.parse(await ask(
    `คุณคือตัวคัดแยกคำถามของระบบตารางเรียนวิทยาลัยการอาชีพโพนทอง
- schedule_sql: คำถามเกี่ยวกับตารางเรียน/ตารางสอนที่ตอบได้จากฐานข้อมูล (ใครสอนอะไร เรียนที่ไหน กี่โมง ห้องว่าง ภาระงานครู) -> เขียน SQL
- knowledge: ระเบียบ วิธีปฏิบัติ ที่ตั้งแผนก/อาคาร ข้อมูลทั่วไปของวิทยาลัย
- chitchat: ทักทายหรือคำถามที่ไม่เกี่ยวกับวิทยาลัย
กติกา SQL: SELECT เดียว (MySQL/TiDB) ใช้เฉพาะตารางด้านล่าง ห้ามใช้ตารางอื่น กรองภาคเรียนปัจจุบันเสมอ
JOIN เพื่อคืนชื่อวิชา ชื่อครู ชื่อกลุ่ม และคืน room_id ทุกครั้งที่เกี่ยวกับสถานที่ ใช้ LIKE '%...%' กับชื่อคน/กลุ่ม เรียงตาม day_of_week, period_slot
${SCHEMA}`,
    `${context}\nคำถาม: ${question}`, "low", ROUTER_SCHEMA)) as { intent: string; sql: string };

  let data = "";
  let sql: string | undefined;
  const actions: Action[] = [];

  if (routed.intent === "schedule_sql") {
    sql = safeSql(routed.sql) ?? undefined;
    if (!sql) data = "ไม่สามารถค้นข้อมูลได้ (คำสั่งไม่ผ่านการตรวจความปลอดภัย)";
    else {
      try {
        const rows = await runSql(sql);
        data = rows.length ? JSON.stringify(rows) : "ไม่พบข้อมูลตามเงื่อนไข";
        const roomIds = [...new Set(rows.map((r) => r.room_id).filter(Boolean).map(String))].slice(0, 3);
        for (const r of roomIds) actions.push({ label: `📍 ดูตำแหน่งห้อง ${r} บนแผนที่`, href: `/map?room=${encodeURIComponent(r)}` });
      } catch (e) {
        console.error("AI SQL failed", sql, e);
        data = "ค้นข้อมูลจากฐานข้อมูลไม่สำเร็จ";
      }
    }
  } else if (routed.intent === "knowledge") {
    const docs = await searchKb(question);
    data = docs.map((d, i) => `[เอกสาร ${i + 1}] ${d.content}`).join("\n\n");
    for (const d of docs.slice(0, 2)) if (d.action_url) actions.push({ label: `➡️ ${d.title}`, href: d.action_url });
  }

  // 2) Response synthesizer.
  const text = await ask(
    `คุณคือผู้ช่วยฝ่ายวิชาการ วิทยาลัยการอาชีพโพนทอง ตอบเป็นภาษาไทยที่สุภาพ กระชับ อ่านง่าย (ใช้รายการหัวข้อย่อยเมื่อมีหลายรายการ)
ใช้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามเดาหรือแต่งข้อมูลเพิ่ม ถ้าข้อมูลไม่พอให้บอกตรง ๆ และแนะนำให้ติดต่อฝ่ายวิชาการ อาคารอำนวยการ ชั้น 1
แปลง day_of_week เป็นชื่อวัน (1=จันทร์ … 5=ศุกร์) และ period_slot เป็นช่วงเวลา (${PERIODS.map((p) => `${p.id}=${p.start}-${p.end}`).join(", ")})
ถ้าเป็นคำถามทั่วไปที่ไม่เกี่ยวกับวิทยาลัย ให้ตอบสั้น ๆ อย่างเป็นมิตรแล้วชวนกลับมาถามเรื่องตารางเรียน`,
    `${context}\nคำถาม: ${question}\n\nข้อมูลที่ค้นได้ (${routed.intent}):\n${data || "-"}`, "low");

  return { answer: text, intent: routed.intent, sql, actions };
}
