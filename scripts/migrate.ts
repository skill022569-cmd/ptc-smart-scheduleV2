// Usage: npm run db:migrate   (reads .env.local)
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const AUTO_EMBED = process.env.TIDB_AUTO_EMBEDDING === "true";

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const dbName = u.pathname.slice(1) || "ptc_schedule";
  const c = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: process.env.DB_SSL === "false" ? undefined : { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await c.query(`USE \`${dbName}\``);

  const statements = readFileSync("db/schema.sql", "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
    .split(";").map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await c.query(s);

  // Knowledge base for the AI assistant. On TiDB Cloud Starter (AWS) TiDB embeds the text itself.
  await c.query(
    AUTO_EMBED
      ? `CREATE TABLE IF NOT EXISTS kb_docs (
          id BIGINT AUTO_RANDOM PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          action_url VARCHAR(255) NULL,
          content_vector VECTOR(1024) GENERATED ALWAYS AS (
            EMBED_TEXT("tidbcloud_free/amazon/titan-embed-text-v2", content)
          ) STORED,
          VECTOR INDEX ((VEC_COSINE_DISTANCE(content_vector)))
        )`
      : `CREATE TABLE IF NOT EXISTS kb_docs (
          id BIGINT AUTO_RANDOM PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          action_url VARCHAR(255) NULL
        )`,
  );

  // Timetable sentences for vector Q&A live next to manual documents (see syncTimetableDocs).
  await c.query(`ALTER TABLE kb_docs
    ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS group_id VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS day_of_week TINYINT NULL`);

  if (process.env.TIDB_TIFLASH === "true") {
    for (const t of ["students", "timetable"]) await c.query(`ALTER TABLE ${t} SET TIFLASH REPLICA 1`);
  }


  console.log(`✓ migrated database ${dbName}${AUTO_EMBED ? " (auto-embedding on)" : ""}`);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
