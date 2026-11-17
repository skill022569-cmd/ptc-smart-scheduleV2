import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q, tx } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";
import { ENTITIES, type Entity } from "@/lib/entities";
import { syncStaffDocs } from "@/lib/staff";

type Ctx = { params: Promise<{ entity: string }> };

async function guard(ctx: Ctx) {
  const s = await apiUser(["admin"]);
  const e = ENTITIES[(await ctx.params).entity];
  return s && e ? { s, e } : null;
}
const deny = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

function clean(e: Entity, body: Record<string, unknown>, forInsert: boolean) {
  const out: Record<string, unknown> = {};
  for (const f of e.fields) {
    if (!(f.key in body)) continue;
    let v = body[f.key];
    if (typeof v === "string") v = v.trim();
    if (v === "") v = null;
    if (f.type === "number" && v != null) v = Number(v);
    if (f.type === "number" && v != null && !Number.isFinite(v)) throw new Error(`${f.label} ต้องเป็นตัวเลข`);
    out[f.key] = v;
  }
  if (forInsert) for (const f of e.fields) if (f.required && out[f.key] == null) throw new Error(`กรุณากรอก ${f.label}`);
  return out;
}
const sqlError = (err: unknown) => {
  const m = err as { code?: string; message?: string };
  return NextResponse.json({ error: m.code === "ER_DUP_ENTRY" ? "ข้อมูลซ้ำกับที่มีอยู่แล้ว" : m.message ?? "error" }, { status: 400 });
};

export async function GET(_: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (!g) return deny();
  const cols = [g.e.pk, ...g.e.fields.map((f) => f.key)].filter((v, i, a) => a.indexOf(v) === i);
  return NextResponse.json(await q(`SELECT ${cols.join(",")} FROM ${g.e.table} ${g.e.where ? `WHERE ${g.e.where}` : ""} ORDER BY ${g.e.order} LIMIT 5000`));
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (!g) return deny();
  try {
    const data = clean(g.e, await req.json(), true);
    if (g.e.table === "students") {
      // New student also gets a login: username = password = student id, forced change on first login.
      await tx(async (c) => {
        await c.query("INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?,?, 'student', TRUE)",
          [data.student_id, await bcrypt.hash(String(data.student_id), 10)]);
        const [[u]] = (await c.query("SELECT user_id FROM users WHERE username=?", [data.student_id])) as unknown as [{ user_id: string }[]];
        await c.query("INSERT INTO students SET ?", [{ ...data, user_id: u.user_id }]);
      });
    } else {
      await q(`INSERT INTO ${g.e.table} SET ?`, [data]);
    }
    if (g.e.table === "staff") await syncStaffDocs(); // keep Q&A answers about staff current
    await audit(g.s.uid, "ADMIN_CREATE", { table: g.e.table });
    return NextResponse.json({ ok: true });
  } catch (err) { return sqlError(err); }
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (!g) return deny();
  try {
    const body = await req.json();
    const data = clean(g.e, body, false);
    delete data[g.e.pk];
    if (g.e.table === "classrooms" && body.map_coordinates) {
      const { x, y } = body.map_coordinates;
      if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) throw new Error("พิกัดไม่ถูกต้อง");
      data.map_coordinates = JSON.stringify({ x, y });
    }
    if (!Object.keys(data).length) throw new Error("ไม่มีข้อมูลให้แก้ไข");
    await q(`UPDATE ${g.e.table} SET ? WHERE ${g.e.pk}=?`, [data, body.id]);
    if (g.e.table === "staff") await syncStaffDocs(); // keep Q&A answers about staff current
    await audit(g.s.uid, "ADMIN_UPDATE", { table: g.e.table, id: body.id });
    return NextResponse.json({ ok: true });
  } catch (err) { return sqlError(err); }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (!g) return deny();
  const id = new URL(req.url).searchParams.get("id");
  try {
    await tx(async (c) => {
      if (g.e.table === "students") {
        const [[st]] = (await c.query("SELECT user_id FROM students WHERE student_id=?", [id])) as unknown as [{ user_id: string | null }[]];
        if (st?.user_id) await c.query("DELETE FROM users WHERE user_id=?", [st.user_id]);
      }
      await c.query(`DELETE FROM ${g.e.table} WHERE ${g.e.pk}=?`, [id]);
    });
    if (g.e.table === "staff") await syncStaffDocs(); // keep Q&A answers about staff current
    await audit(g.s.uid, "ADMIN_DELETE", { table: g.e.table, id });
    return NextResponse.json({ ok: true });
  } catch (err) { return sqlError(err); }
}
