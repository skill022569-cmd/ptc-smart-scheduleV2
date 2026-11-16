import mysql from "mysql2/promise";

function makePool(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const u = new URL(url);
  return mysql.createPool({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    // TiDB Cloud requires TLS; local TiDB in docker does not.
    ssl: process.env.DB_SSL === "false" ? undefined : { minVersion: "TLSv1.2", rejectUnauthorized: true },
    // AUTO_RANDOM ids exceed JS safe integers: keep them as strings.
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectionLimit: 5,
    timezone: "+07:00",
    dateStrings: true,
  });
}

const g = globalThis as unknown as { _pool?: mysql.Pool };

export function pool() {
  return (g._pool ??= makePool(process.env.DATABASE_URL));
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool().query(sql, params);
  return rows as T[];
}

export async function tx<T>(fn: (c: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool().getConnection();
  try {
    await c.beginTransaction();
    const r = await fn(c);
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
