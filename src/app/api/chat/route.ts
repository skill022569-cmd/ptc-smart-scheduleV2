import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";
import { answer, type Turn } from "@/lib/ai";

export const maxDuration = 60; // room for the 25 s Gemini timeout on Vercel

export async function POST(req: Request) {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนใช้ผู้ช่วย AI" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { question?: string; history?: unknown };
  const { question } = body;
  // Last few turns from the browser for follow-up questions; untrusted, so keep only well-formed, short text.
  const history: Turn[] = (Array.isArray(body.history) ? body.history : [])
    .filter((t): t is Turn => !!t && (t.role === "user" || t.role === "ai") && typeof t.text === "string")
    .slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 600) }));
  if (!question?.trim() || question.length > 500) return NextResponse.json({ error: "พิมพ์คำถาม (ไม่เกิน 500 ตัวอักษร)" }, { status: 400 });

  // Per-user rate limit (the free TiDB embedding service has usage limits): 10 questions per minute.
  const [r] = await q<{ n: string }>(
    "SELECT COUNT(*) n FROM audit_logs WHERE user_id=? AND event='AI_CHAT' AND created_at > NOW() - INTERVAL 1 MINUTE", [s.uid]);
  if (Number(r.n) >= 10) return NextResponse.json({ error: "ถามถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
  await audit(s.uid, "AI_CHAT");

  const [st] = await q<{ group_id: string }>("SELECT group_id FROM students WHERE user_id=?", [s.uid]);
  const [t] = await q<{ teacher_id: string }>("SELECT teacher_id FROM teachers WHERE user_id=?", [s.uid]);
  const a = await answer(question!.trim(), { ...st, ...t }, history);
  return NextResponse.json({ ...a, note: s.role === "admin" ? a.note : undefined });
}
