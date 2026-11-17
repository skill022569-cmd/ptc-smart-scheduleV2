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
