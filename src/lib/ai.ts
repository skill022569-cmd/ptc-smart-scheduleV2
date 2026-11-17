import "server-only";
import { q } from "./db";
import { askedDay } from "./day";

export type Action = { label: string; href: string };
export type Answer = { answer: string; actions: Action[] };
type Doc = { title: string; content: string; action_url: string | null; source: string };

// shortcut: local dev has no EMBED_TEXT, so rank by shared character pairs (Thai has no spaces); fine for testing only.
function keywordRank(question: string, docs: Doc[]) {
  const q2 = question.replace(/\s/g, "");
  const pairs = new Set(Array.from({ length: Math.max(q2.length - 1, 0) }, (_, i) => q2.slice(i, i + 2)));
  const score = (d: Doc) => [...pairs].filter((p) => d.content.includes(p)).length;
  return docs.map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.d);
}

// Q&A with TiDB Vector Search: the question is embedded by TiDB (EMBED_TEXT) and matched against
// college documents and the timetable sentences produced by syncTimetableDocs().
export async function answer(question: string, who: { group_id?: string; teacher_id?: string }): Promise<Answer> {
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
          ORDER BY VEC_EMBED_COSINE_DISTANCE(content_vector, ?) LIMIT 6`, [...params, question])
    : keywordRank(question, await q<Doc>(`SELECT title, content, action_url, source FROM kb_docs WHERE ${where} LIMIT 3000`, params)).slice(0, 6);

  if (!docs.length) {
    return { answer: "ไม่พบข้อมูลที่ตรงกับคำถาม ลองระบุกลุ่มเรียน ชื่อครู วิชา หรือชื่อวันให้ชัดขึ้น หรือติดต่อฝ่ายวิชาการ อาคารอำนวยการ ชั้น 1", actions: [] };
  }

  const actions: Action[] = [];
  for (const d of docs) {
    if (!d.action_url || actions.some((a) => a.href === d.action_url) || actions.length >= 3) continue;
    const room = d.source === "timetable" ? decodeURIComponent(d.action_url.split("room=")[1] ?? "") : "";
    actions.push({ label: room ? `📍 ดูตำแหน่งห้อง ${room} บนแผนที่` : `➡️ ${d.title}`, href: d.action_url });
  }
  return { answer: `🔎 ข้อมูลที่เกี่ยวข้องที่สุดจากฐานข้อมูล:\n\n${docs.map((d) => `• ${d.content}`).join("\n\n")}`, actions };
}
