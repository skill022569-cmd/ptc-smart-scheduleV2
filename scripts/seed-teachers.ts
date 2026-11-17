// Usage: npm run db:seed-teachers
// Creates a login for every teacher that has none (username = teacher id in lowercase, random password).
// Safe to re-run: teachers that already have an account are skipped; nothing else is changed.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { pool, q, tx } from "../src/lib/db";

const FILE = "teacher-accounts.csv"; // git-ignored: holds passwords

async function main() {
  const teachers = await q<{ teacher_id: string; full_name: string; department: string }>(
    "SELECT teacher_id, full_name, department FROM teachers WHERE user_id IS NULL ORDER BY teacher_id");
  const rows: string[][] = [];
  for (const t of teachers) {
    const username = t.teacher_id.toLowerCase();
    const password = randomBytes(6).toString("base64url") + "7";
    const created = await tx(async (c) => {
      const [taken] = (await c.query("SELECT 1 FROM users WHERE username=?", [username])) as unknown as [unknown[]];
      if (taken.length) return false;
      // No email: these accounts are for testing via the admin "ดูมุมมอง" button, not for OTP login.
      await c.query("INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?,?, 'teacher', TRUE)",
        [username, await bcrypt.hash(password, 10)]);
      await c.query("UPDATE teachers SET user_id=(SELECT user_id FROM users WHERE username=?) WHERE teacher_id=?", [username, t.teacher_id]);
      return true;
    });
    if (created) rows.push([username, password, t.full_name, t.department]);
    else console.log(`  skip ${username}: username already used`);
  }
  if (rows.length) {
    const csv = "﻿" + [["username", "password", "full_name", "department"], ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\r\n");
    writeFileSync(FILE, csv);
  }
  console.log(`✓ created ${rows.length} teacher accounts${rows.length ? ` → passwords saved in ${FILE} (do not commit)` : " (all teachers already have accounts)"}`);
  await pool().end();
}

main().catch((e) => { console.error(e); process.exit(1); });
