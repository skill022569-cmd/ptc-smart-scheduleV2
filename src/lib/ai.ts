import "server-only";
import { q } from "./db";
import { askedDay, detectScope, expandQuery } from "./query";

export type Action = { label: string; href: string };
export type Answer = { answer: string; actions: Action[]; note?: string }; // note: why the LLM was skipped (shown to admins)
export type Turn = { role: "user" | "ai"; text: string };
type Who = { group_id?: string; teacher_id?: string };
type Doc = { title: string; content: string; action_url: string | null; source: string; day_of_week?: number | null };

// shortcut: local dev has no EMBED_TEXT, so rank by shared character pairs (Thai has no spaces); fine for testing only.
function keywordRank(question: string, docs: Doc[]) {
  const q2 = question.replace(/\s/g, "");
  const pairs = new Set(Array.from({ length: Math.max(q2.length - 1, 0) }, (_, i) => q2.slice(i, i + 2)));
  const score = (d: Doc) => [...pairs].filter((p) => d.content.includes(p)).length;
  return docs.map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.d);
}

async function vectorSearch(question: string, where: string, params: unknown[], k: number) {
  return process.env.TIDB_AUTO_EMBEDDING === "true"
    ? q<Doc>(`SELECT title, content, action_url, source FROM kb_docs WHERE ${where}
               ORDER BY VEC_EMBED_COSINE_DISTANCE(content_vector, ?) LIMIT ${k}`, [...params, question])
    : keywordRank(question, await q<Doc>(`SELECT title, content, action_url, source FROM kb_docs WHERE ${where} LIMIT 3000`, params)).slice(0, k);
}

// Exact timetable rows for the groups / teachers / rooms the question names (SQL), so the LLM sees the whole picture
// instead of the 12 "most similar" sentences. Returns null when the question names none of them.
// prevText (short follow-ups only): parts the new question leaves out — department, level, or a whole subject — come from it.
async function timetableFor(text: string, prevText: string | null, day: number | null, who: Who) {
  const scope = detectScope(text);
  const prev = prevText ? detectScope(prevText) : null;
  const allTeachers = await q<{ teacher_id: string; full_name: string }>("SELECT teacher_id, full_name FROM teachers");
  // A teacher is named when the question contains their first name (after the title "ครู").
  const matchTeachers = (t: string) => allTeachers.filter((x) => { const first = x.full_name.replace(/^ครู/, "").split(" ")[0]; return first.length >= 3 && t.includes(first); })
    .map((x) => x.teacher_id);
  let teachers = matchTeachers(text);
  if (prev && prevText) {
    const named = scope.departments.length || scope.level || scope.rooms.length || teachers.length;
    if (!scope.departments.length && (scope.level || !named)) scope.departments = prev.departments;
    if (!scope.level && (scope.departments.length || !named)) scope.level = prev.level;
    if (!named) { scope.rooms = prev.rooms; teachers = matchTeachers(prevText); }
  }
  const conds: string[] = [];
  const params: unknown[] = [];

  if (scope.departments.length || scope.level) {
    const g: string[] = [];
    const gp: unknown[] = [];
    if (scope.departments.length) { g.push("department IN (?)"); gp.push(scope.departments); }
    if (scope.level) { g.push("year_level=?"); gp.push(scope.level); }
    const groups = (await q<{ group_id: string }>(`SELECT group_id FROM student_groups WHERE ${g.join(" AND ")}`, gp)).map((r) => r.group_id);
    if (!groups.length) return null;
    conds.push("group_id IN (?)"); params.push(groups);
  }
  if (teachers.length) { conds.push("teacher_id IN (?)"); params.push(teachers); }
  if (scope.rooms.length) { conds.push(`(${scope.rooms.map(() => "content LIKE ?").join(" OR ")})`); params.push(...scope.rooms.map((r) => `%ห้อง ${r} %`)); }
  if (!conds.length && scope.mine && (who.group_id || who.teacher_id)) {
    conds.push(who.group_id ? "group_id=?" : "teacher_id=?"); params.push(who.group_id ?? who.teacher_id);
  }
  if (!conds.length) return null;
  if (day) { conds.push("day_of_week=?"); params.push(day); }

  const rows = await q<Doc>(
    `SELECT title, content, action_url, source, day_of_week FROM kb_docs WHERE source='timetable' AND ${conds.join(" AND ")} LIMIT 120`, params);
  const period = (d: Doc) => Number(d.content.match(/คาบ (\d+)/)?.[1] ?? 0);
  return rows.sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0) || period(a) - period(b));
}

// "Brain" on top of retrieval: Gemini reads only the retrieved TiDB data and writes a Thai answer.
// Plain REST call (no SDK). Returns null when no key is set, so the caller falls back to the raw search results.
async function think(question: string, docs: Doc[], who: Who, history: Turn[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  // Flash-Lite answers in ~1-3 s; thinking models (Flash/Pro) were timing out on the free tier for this simple summarising job.
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const system = `คุณคือผู้ช่วยฝ่ายวิชาการ วิทยาลัยการอาชีพโพนทอง ตอบเป็นภาษาไทยสุภาพ เป็นกันเอง กระชับ
หลักการตอบ:
- ตอบจาก <ข้อมูล> เท่านั้น ห้ามแต่งชื่อ เวลา หรือห้องที่ไม่มีในข้อมูล
- ถ้ามีข้อมูลที่ตอบได้แม้เพียงบางส่วน ให้ตอบเท่าที่มีก่อนเสมอ ห้ามตอบว่า "ข้อมูลไม่เพียงพอ" ถ้ายังสรุปอะไรได้
- ถ้าคำถามกว้าง เช่น ไม่ระบุชั้นปีหรือวัน ให้สรุปแยกตามกลุ่มเรียนหรือตามวันแบบสั้น ๆ แล้วปิดท้ายด้วยการชวนให้ระบุให้แคบลง
- ถ้าไม่ระบุวันแต่ถามแบบ "ตอนนี้/คาบแรก/วันนี้" ให้ใช้วันนี้ (ถ้าวันนี้เป็นวันหยุด ให้บอกของวันจันทร์ถัดไป)
- คิดต่อจากข้อมูลได้: เรียงตามเวลา หาคาบแรก/คาบสุดท้าย นับคาบ/ชั่วโมง รวมรายการซ้ำ
- กลุ่มเรียนหรือรหัสครูของผู้ถามใช้เฉพาะเมื่อเขาถามถึงตัวเอง (ฉัน ผม หนู ของเรา) เท่านั้น
- ถ้าเป็นคำถามต่อเนื่อง ให้ตีความจาก <บทสนทนาก่อนหน้า>
- รูปแบบ: ข้อความธรรมดา หลายรายการให้ขึ้นบรรทัดใหม่ขึ้นต้นด้วย "• " ไม่เกินประมาณ 12 บรรทัด ห้ามใช้ markdown เช่น ** หรือ #
- ตอนนี้: ${now}${who.group_id ? ` · กลุ่มเรียนของผู้ถาม: ${who.group_id}` : ""}${who.teacher_id ? ` · ผู้ถามเป็นครู รหัส ${who.teacher_id}` : ""}`;
  const past = history.map((t) => `${t.role === "user" ? "ผู้ใช้" : "ผู้ช่วย"}: ${t.text}`).join("\n");
  const prompt = `${past ? `<บทสนทนาก่อนหน้า>\n${past}\n</บทสนทนาก่อนหน้า>\n\n` : ""}<ข้อมูล>\n${docs.map((d, i) => `[${i + 1}] ${d.content}`).join("\n")}\n</ข้อมูล>\n\nคำถาม: ${question}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text || null;
}

// Hybrid retrieval on TiDB: exact SQL for the timetable part the question names, vector search
// (EMBED_TEXT + VEC_EMBED_COSINE_DISTANCE) for rules, buildings and staff; Gemini writes the answer.
export async function answer(asked: string, who: Who, history: Turn[] = []): Promise<Answer> {
  const question = expandQuery(asked);
  // Follow-ups ("แล้ว ปวช.2 ล่ะ") inherit the day and subject of the previous question.
  const prev = expandQuery([...history].reverse().find((t) => t.role === "user")?.text ?? "");
  const day = askedDay(question) ?? (prev ? askedDay(prev) : null);
  if (day === 0 || day === 6) return { answer: "วันนั้นเป็นวันหยุด ไม่มีคาบเรียนครับ 😊", actions: [] };

  const timetable = await timetableFor(question, prev && question.length < 40 ? prev : null, day, who);

  let docs: Doc[];
  if (timetable?.length) {
    docs = [...timetable, ...(await vectorSearch(question, "source<>'timetable'", [], 4))];
  } else {
    const where = day ? "source<>'timetable' OR (source='timetable' AND day_of_week=?)" : "1=1";
    docs = await vectorSearch(question, where, day ? [day] : [], 12);
  }

  if (!docs.length) {
    return { answer: "ไม่พบข้อมูลที่ตรงกับคำถาม ลองระบุกลุ่มเรียน ชื่อครู วิชา หรือชื่อวันให้ชัดขึ้น หรือติดต่อฝ่ายวิชาการ อาคารอำนวยการ ชั้น 1", actions: [] };
  }

  const actions: Action[] = [];
  for (const d of docs) {
    if (!d.action_url || actions.some((a) => a.href === d.action_url) || actions.length >= 3) continue;
    const room = d.source === "timetable" ? decodeURIComponent(d.action_url.split("room=")[1] ?? "") : "";
    actions.push({ label: room ? `📍 ดูตำแหน่งห้อง ${room} บนแผนที่` : `➡️ ${d.title}`, href: d.action_url });
  }
  // Any LLM failure (no key, quota, timeout) falls back to showing the search results as before.
  let note = process.env.GEMINI_API_KEY ? "Gemini ไม่ได้ส่งคำตอบกลับมา" : "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel";
  const llm = await think(question, docs, who, history).catch((e) => {
    console.error("Gemini failed", e);
    note = `เรียก Gemini ไม่สำเร็จ: ${(e as Error).message}`;
    return null;
  });
  if (llm) return { answer: llm, actions };
  return { note, answer: `🔎 ข้อมูลที่เกี่ยวข้องที่สุดจากฐานข้อมูล:\n\n${docs.slice(0, 8).map((d) => `• ${d.content}`).join("\n\n")}`, actions };
}
