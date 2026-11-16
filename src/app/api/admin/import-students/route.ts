import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { tx } from "@/lib/db";
import { apiUser, audit } from "@/lib/auth";

export const maxDuration = 60;

// CSV columns: student_id,full_name,department,year_level,group_id (header row required)
export async function POST(req: Request) {
  const s = await apiUser(["admin"]);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const text = (await req.text()).replace(/^﻿/, "");
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const cols = header?.split(",").map((c) => c.trim());
  const need = ["student_id", "full_name", "department", "year_level", "group_id"];
  if (!cols || need.some((n) => !cols.includes(n))) {
    return NextResponse.json({ error: `หัวตารางต้องมีคอลัมน์: ${need.join(",")}` }, { status: 400 });
  }
  const rows = lines.map((l) => { const v = l.split(",").map((x) => x.trim()); return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""])); });
  const bad = rows.findIndex((r) => need.some((n) => !r[n]) || !/^[0-9A-Za-z-]{1,20}$/.test(r.student_id));
  if (bad >= 0) return NextResponse.json({ error: `แถวที่ ${bad + 2} ข้อมูลไม่ครบหรือรหัสไม่ถูกต้อง` }, { status: 400 });

  let created = 0;
  try {
    await tx(async (c) => {
      for (const r of rows) {
        // Initial password = student id (forced change at first login); lower bcrypt cost keeps bulk import within the time limit.
        await c.query("INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?,?, 'student', TRUE)",
          [r.student_id, await bcrypt.hash(r.student_id, 8)]);
        const [[u]] = (await c.query("SELECT user_id FROM users WHERE username=?", [r.student_id])) as unknown as [{ user_id: string }[]];
        await c.query("INSERT INTO students (student_id, user_id, full_name, department, year_level, group_id) VALUES (?,?,?,?,?,?)",
          [r.student_id, u.user_id, r.full_name, r.department, r.year_level, r.group_id]);
        created++;
      }
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json({ error: e.code === "ER_DUP_ENTRY" ? `รหัสซ้ำกับที่มีอยู่แล้ว (แถวที่ ${created + 2}) — ไม่ได้นำเข้าข้อมูลใด ๆ` : e.message }, { status: 400 });
  }
  await audit(s.uid, "ADMIN_IMPORT_STUDENTS", { count: created });
  return NextResponse.json({ ok: true, created });
}
