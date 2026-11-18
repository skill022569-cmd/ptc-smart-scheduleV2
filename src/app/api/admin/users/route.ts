import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, tx } from "@/lib/db";
import { apiUser, audit, maskEmail } from "@/lib/auth";

const tempPassword = () => randomBytes(6).toString("base64url") + "7";

export async function GET() {
  if (!(await apiUser(["admin"]))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await q<{ email: string | null }>(
    `SELECT u.user_id, u.username, u.role, u.email, u.pdpa_consent, (u.locked_until > NOW()) AS locked, t.teacher_id
       FROM users u LEFT JOIN teachers t ON t.user_id=u.user_id WHERE u.role <> 'student' ORDER BY u.role, u.username`);
  return NextResponse.json(rows.map((r) => ({ ...r, email: maskEmail(r.email) })));
}

const Create = z.object({
  username: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/), email: z.string().email(), role: z.enum(["teacher", "admin"]),
  teacher_id: z.string().optional(),
});

// Creates a staff account; the temporary password is returned once and must be changed at first login.
export async function POST(req: Request) {
  const s = await apiUser(["admin"]);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = Create.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    // Name the field that is wrong; the old combined message made a valid email look invalid.
    const field = p.error.issues[0]?.path[0];
    const error = field === "username"
      ? "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือ . _ - ยาว 3–64 ตัว ห้ามมีภาษาไทยหรือเว้นวรรค เช่น navakit.m"
      : field === "email" ? "รูปแบบอีเมลไม่ถูกต้อง" : "ข้อมูลไม่ถูกต้อง";
    return NextResponse.json({ error }, { status: 400 });
  }
  const password = tempPassword();
  try {
    await tx(async (c) => {
      await c.query("INSERT INTO users (username, password_hash, email, is_email_verified, role, must_change_password) VALUES (?,?,?,FALSE,?,TRUE)",
        [p.data.username, await bcrypt.hash(password, 10), p.data.email, p.data.role]);
      if (p.data.teacher_id) {
        const [r] = await c.query("UPDATE teachers SET user_id=(SELECT user_id FROM users WHERE username=?) WHERE teacher_id=?",
          [p.data.username, p.data.teacher_id]);
        if ((r as { affectedRows: number }).affectedRows !== 1) throw new Error("ไม่พบรหัสครูนี้");
      }
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json({ error: e.code === "ER_DUP_ENTRY" ? "ชื่อผู้ใช้/อีเมล/ครูคนนี้มีบัญชีแล้ว" : e.message }, { status: 400 });
  }
  await audit(s.uid, "ADMIN_CREATE_USER", { username: p.data.username, role: p.data.role });
  return NextResponse.json({ ok: true, password });
}

// { id, action: "unlock" | "reset" }
export async function PATCH(req: Request) {
  const s = await apiUser(["admin"]);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; username?: string; action?: string };
  const { action } = body;
  // Students are not listed, so they can be addressed by username (student id).
  const id = body.id ?? (await q<{ user_id: string }>("SELECT user_id FROM users WHERE username=?", [body.username ?? ""]))[0]?.user_id;
  if (!id) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  if (action === "unlock") {
    await q("UPDATE users SET locked_until=NULL, failed_attempts=0 WHERE user_id=?", [id]);
    await audit(s.uid, "ADMIN_UNLOCK", { user: id });
    return NextResponse.json({ ok: true });
  }
  if (action === "reset") {
    const password = tempPassword();
    await q("UPDATE users SET password_hash=?, must_change_password=TRUE, locked_until=NULL, failed_attempts=0 WHERE user_id=?",
      [await bcrypt.hash(password, 10), id]);
    await audit(s.uid, "ADMIN_RESET_PASSWORD", { user: id });
    return NextResponse.json({ ok: true, password });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
