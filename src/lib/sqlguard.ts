// Guard for AI-generated SQL. Second line of defense: the read-only DB account and READ ONLY transaction.
const FORBIDDEN = /\b(insert|update|delete|replace|drop|alter|create|grant|revoke|truncate|rename|call|handler|lock|unlock|set|load|outfile|dumpfile|sleep|benchmark|load_file|for\s+update)\b|\b(users|students|otp_logs|audit_logs|timetable_snapshots|course_offerings|kb_docs|mysql|information_schema|performance_schema|metrics_schema)\b|@@|\/\*|--|#/i;

// Returns a cleaned single SELECT, or null if it is not provably read-only on allowed tables.
export function safeSql(sql: string) {
  const s = sql.trim().replace(/;\s*$/, "");
  if (!s || s.includes(";") || !/^\s*select\b/i.test(s) || FORBIDDEN.test(s)) return null;
  return s;
}
