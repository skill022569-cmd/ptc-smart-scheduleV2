import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { apiUser, audit, clientInfo } from "@/lib/auth";
import { APP_VERSION, REPORT_CATEGORIES, REPORT_STATUS } from "@/lib/version";

const Report = z.object({
  category: z.enum(REPORT_CATEGORIES as [string, ...string[]]),
  detail: z.string().trim().min(5).max(2000),
  page_url: z.string().max(255).optional(),
});

// Any signed-in user can report a problem.
export async function POST(req: Request) {
  const s = await apiUser();
  if (!s) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนรายงานปัญหา" }, { status: 401 });
  const p = Report.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "เลือกประเภทและเขียนรายละเอียดอย่างน้อย 5 ตัวอักษร" }, { status: 400 });

  const [r] = await q<{ n: string }>(
    "SELECT COUNT(*) n FROM bug_reports WHERE user_id=? AND created_at > NOW() - INTERVAL 10 MINUTE", [s.uid]);
  if (Number(r.n) >= 5) return NextResponse.json({ error: "ส่งรายงานถี่เกินไป กรุณารอสักครู่" }, { status: 429 });

  const { ua } = await clientInfo();
  await q("INSERT INTO bug_reports (user_id, category, detail, page_url, user_agent, app_version) VALUES (?,?,?,?,?,?)",
    [s.uid, p.data.category, p.data.detail, p.data.page_url ?? null, ua, APP_VERSION]);
  await audit(s.uid, "BUG_REPORT");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!(await apiUser(["admin"]))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await q(
    `SELECT r.report_id, r.category, r.detail, r.page_url, r.user_agent, r.app_version, r.status, r.created_at, u.username
       FROM bug_reports r LEFT JOIN users u ON u.user_id = r.user_id
      ORDER BY (r.status = 'done'), r.created_at DESC LIMIT 200`));
}

export async function PATCH(req: Request) {
  const s = await apiUser(["admin"]);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || !status || !(status in REPORT_STATUS)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await q("UPDATE bug_reports SET status=? WHERE report_id=?", [status, id]);
  return NextResponse.json({ ok: true });
}
