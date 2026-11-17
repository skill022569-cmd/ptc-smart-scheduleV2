// Usage: npm run db:seed-staff   Replaces ONLY the staff directory with the simulated roster (keeps users, timetable, passwords).
import { pool } from "../src/lib/db";
import { seedStaff } from "./staff-data";

seedStaff().then(async (r) => {
  console.log(`✓ seeded ${r.staff} staff positions (${r.docs} Q&A sentences)`);
  await pool().end();
});
