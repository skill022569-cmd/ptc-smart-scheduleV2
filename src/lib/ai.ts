import "server-only";
import { q } from "./db";
import { askedDay, expandQuery } from "./query";

export type Action = { label: string; href: string };
export type Answer = { answer: string; actions: Action[]; note?: string }; // note: why the LLM was skipped (shown to admins)
type Doc = { title: string; content: string; action_url: string | null; source: string };

// shortcut: local dev has no EMBED_TEXT, so rank by shared character pairs (Thai has no spaces); fine for testing only.
function keywordRank(question: string, docs: Doc[]) {
  const q2 = question.replace(/\s/g, "");
  const pairs = new Set(Array.from({ length: Math.max(q2.length - 1, 0) }, (_, i) => q2.slice(i, i + 2)));
  const score = (d: Doc) => [...pairs].filter((p) => d.content.includes(p)).length;
  return docs.map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.d);
}

const TOP_K = 12; // documents retrieved for the LLM; the no-LLM fallback shows the first 6

// "Brain" on top of retrieval: Gemini reads only the retrieved TiDB documents and writes a Thai answer.
// Plain REST call (no SDK). Returns null when no key is set, so the caller falls back to the raw search results.
async function think(question: string, docs: Doc[], who: { group_id?: string; teacher_id?: string }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  // Flash-Lite answers in ~1-3 s; thinking models (Flash/Pro) were timing out on the free tier for this simple summarising job.
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const system = `คุณคือผู้ช่วยฝ่ายวิชาการ วิทยาลัยการอาชีพโพนทอง ตอบเป็นภาษาไทยสุภาพ กระชับ อ่านง่าย
- ใช้เฉพาะข้อมูลใน <ข้อมูล> เท่านั้น ห้ามแต่งหรือเดาข้อมูลที่ไม่มี ถ้าข้อมูลไม่พอให้บอกตรง ๆ และแนะนำให้ติดต่อฝ่ายวิชาการ อาคารอำนวยการ ชั้น 1
- คิดต่อจากข้อมูลได้ เช่น เรียงคาบตามเวลา หาคาบแรก/คาบสุดท้าย นับจำนวนคาบหรือชั่วโมง รวมรายการซ้ำ
- ข้อมูลบางรายการอาจไม่เกี่ยวกับคำถาม ให้เลือกใช้เฉพาะที่ตรงคำถาม
- หลายรายการให้ขึ้นบรรทัดใหม่ขึ้นต้นด้วย "• " ห้ามใช้ markdown เช่น ** หรือ #
- ตอนนี้: ${now}${who.group_id ? ` · กลุ่มเรียนของผู้ถาม: ${who.group_id}` : ""}${who.teacher_id ? ` · ผู้ถามเป็นครู รหัส ${who.teacher_id}` : ""}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: `<ข้อมูล>\n${docs.map((d, i) => `[${i + 1}] ${d.content}`).join("\n")}\n</ข้อมูล>\n\nคำถาม: ${question}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text || null;
}

// Q&A with TiDB Vector Search: the question is embedded by TiDB (EMBED_TEXT) and matched against
// college documents and the timetable sentences produced by syncTimetableDocs().
export async function answer(asked: string, who: { group_id?: string; teacher_id?: string }): Promise<Answer> {
  const question = expandQuery(asked);
  const day = askedDay(question);
  if (day === 0 || day === 6) return { answer: "วันนั้นเป็นวันหยุด ไม่มีคาบเรียนครับ 😊", actions: [] };

  // Narrow timetable sentences by day and by "my" schedule before the vector ranking.
  const mine = /ฉัน|ผม|หนู|ของเรา|ของตัวเอง/.test(question);
  const filters: string[] = [];
  const params: unknown[] = [];
  if (day) { filters.push("day_of_week=?"); params.push(day); }
  if (mine && who.group_id) { filters.push("group_id=?"); params.push(who.group_id); }
  else if (mine && who.teacher_id) { filters.push("teacher_id=?"); params.push(who.teacher_id); }
  const where = filters.length ? `source<>'timetable' OR (source='timetable' AND ${filters.join(" AND ")})` : "1=1";

  const docs = process.env.TIDB_AUTO_EMBEDDING === "true"
    ? await q<Doc>(
        `SELECT title, content, action_url, source FROM kb_docs WHERE ${where}
          ORDER BY VEC_EMBED_COSINE_DISTANCE(content_vector, ?) LIMIT ${TOP_K}`, [...params, question])
    : keywordRank(question, await q<Doc>(`SELECT title, content, action_url, source FROM kb_docs WHERE ${where} LIMIT 3000`, params)).slice(0, TOP_K);

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
  const llm = await think(question, docs, who).catch((e) => {
    console.error("Gemini failed", e);
    note = `เรียก Gemini ไม่สำเร็จ: ${(e as Error).message}`;
    return null;
  });
  if (llm) return { answer: llm, actions };
  return { note, answer: `🔎 ข้อมูลที่เกี่ยวข้องที่สุดจากฐานข้อมูล:\n\n${docs.slice(0, 6).map((d) => `• ${d.content}`).join("\n\n")}`, actions };
}
