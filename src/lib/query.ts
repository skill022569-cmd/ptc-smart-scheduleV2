const DAY_WORDS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"]; // index = JS getDay() = day_of_week (0, 6 = weekend)

function bangkokDow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getDay(); // 0 = Sunday
}

// Which day the question is about: "วันนี้", "พรุ่งนี้" or a day name. null = no day mentioned.
export function askedDay(question: string, today = bangkokDow()): number | null {
  if (question.includes("พรุ่งนี้")) return (today + 1) % 7;
  if (question.includes("วันนี้")) return today;
  const i = DAY_WORDS.findIndex((d) => question.includes(d));
  return i >= 0 ? i : null;
}

// Common Thai school abbreviations the embedding model does not understand; expanded before searching.
const ABBREVIATIONS: [RegExp, string][] = [
  [/ผอ\.?(?![มง])/g, "ผู้อำนวยการ"], // "ผอ." / "รองผอ." — but not ผอม/ผอง
  [/หน\.(?=\S)/g, "หัวหน้า"],
  [/จนท\.?/g, "เจ้าหน้าที่"],
  [/วก\.?/g, "วิทยาลัยการอาชีพ"],
  [/อ\.(?=[ก-๙])/g, "ครู"],
];

export function expandQuery(question: string) {
  return ABBREVIATIONS.reduce((s, [re, full]) => s.replace(re, full), question);
}

// Words people use for each department → the department name stored in student_groups.
const DEPARTMENTS: [RegExp, string][] = [
  [/ช่างยนต์|ยานยนต์/, "ช่างยนต์"],
  [/ช่างกล|กลโรงงาน/, "ช่างกลโรงงาน"],
  [/อิเล็ก/, "ช่างอิเล็กทรอนิกส์"],
  [/ไฟฟ้า/, "ช่างไฟฟ้ากำลัง"],
  [/บัญชี/, "การบัญชี"],
  [/ดิจิทัล|ดิจิตอล|คอมพิวเตอร์|คอม/, "เทคโนโลยีธุรกิจดิจิทัล"],
];

// What part of the timetable a question is about, so it can be fetched exactly with SQL.
export function detectScope(question: string) {
  const level = question.match(/(ปวช|ปวส)\.?\s*([1-3])/);
  return {
    departments: DEPARTMENTS.filter(([re]) => re.test(question)).map(([, d]) => d),
    level: level ? `${level[1]}.${level[2]}` : null,
    rooms: [...question.matchAll(/\b([A-Za-z]{1,4}\d?-\d{3})\b/g)].map((m) => m[1].toUpperCase()),
    mine: /ฉัน|ผม|หนู|ของเรา|ของตัวเอง/.test(question),
  };
}
