import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { q } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";
import { answer } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนใช้ผู้ช่วย AI" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ผู้ดูแลระบบยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question?.trim() || question.length > 500) return NextResponse.json({ error: "พิมพ์คำถาม (ไม่เกิน 500 ตัวอักษร)" }, { status: 400 });

  // Simple per-user rate limit: 10 questions per minute.
  const [r] = await q<{ n: string }>(
    "SELECT COUNT(*) n FROM audit_logs WHERE user_id=? AND event='AI_CHAT' AND created_at > NOW() - INTERVAL 1 MINUTE", [s.uid]);
  if (Number(r.n) >= 10) return NextResponse.json({ error: "ถามถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
  await audit(s.uid, "AI_CHAT");

  const [st] = await q<{ group_id: string; group_name: string }>(
    "SELECT st.group_id, g.group_name FROM students st JOIN student_groups g USING (group_id) WHERE st.user_id=?", [s.uid]);
  const [t] = await q<{ teacher_id: string }>("SELECT teacher_id FROM teachers WHERE user_id=?", [s.uid]);

  try {
    const a = await answer(question.trim(), { role: s.role, ...st, ...t });
    // Only admins see the generated SQL (transparency for the academic office).
    return NextResponse.json({ ...a, sql: s.role === "admin" ? a.sql : undefined });
  } catch (err) {
    if (err instanceof Error && err.message === "REFUSED") return NextResponse.json({ error: "ขออภัย ไม่สามารถตอบคำถามนี้ได้" }, { status: 400 });
    if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "ระบบ AI มีผู้ใช้มาก กรุณาลองใหม่" }, { status: 503 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: `ระบบ AI ขัดข้อง (${err.status})` }, { status: 502 });
    throw err;
  }
}
