import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";
import { answer } from "@/lib/ai";

export async function POST(req: Request) {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนใช้ผู้ช่วย AI" }, { status: 401 });
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question?.trim() || question.length > 500) return NextResponse.json({ error: "พิมพ์คำถาม (ไม่เกิน 500 ตัวอักษร)" }, { status: 400 });

  // Per-user rate limit (the free TiDB embedding service has usage limits): 10 questions per minute.
  const [r] = await q<{ n: string }>(
    "SELECT COUNT(*) n FROM audit_logs WHERE user_id=? AND event='AI_CHAT' AND created_at > NOW() - INTERVAL 1 MINUTE", [s.uid]);
  if (Number(r.n) >= 10) return NextResponse.json({ error: "ถามถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
  await audit(s.uid, "AI_CHAT");

  const [st] = await q<{ group_id: string }>("SELECT group_id FROM students WHERE user_id=?", [s.uid]);
  const [t] = await q<{ teacher_id: string }>("SELECT teacher_id FROM teachers WHERE user_id=?", [s.uid]);
  return NextResponse.json(await answer(question.trim(), { ...st, ...t }));
}
