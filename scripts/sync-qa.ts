// Usage: npm run db:sync-qa   Rebuilds the timetable sentences used by the vector Q&A (also runs automatically on every timetable change).
import { syncTimetableDocs } from "../src/lib/timetable";
import { pool } from "../src/lib/db";

syncTimetableDocs().then(async (n) => {
  console.log(n >= 0 ? `✓ indexed ${n} timetable sentences for Q&A` : "✗ failed, see error above");
  await pool().end();
  process.exit(n >= 0 ? 0 : 1);
});
