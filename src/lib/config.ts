// School-wide settings. Edit here to change the period structure or term.
export const TERM = {
  academicYear: Number(process.env.ACADEMIC_YEAR ?? 2569),
  semester: Number(process.env.SEMESTER ?? 1),
};

export const DAYS = [
  { id: 1, name: "จันทร์", short: "จ." },
  { id: 2, name: "อังคาร", short: "อ." },
  { id: 3, name: "พุธ", short: "พ." },
  { id: 4, name: "พฤหัสบดี", short: "พฤ." },
  { id: 5, name: "ศุกร์", short: "ศ." },
];

export const PERIODS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  start: `${String(8 + i).padStart(2, "0")}:00`,
  end: `${String(9 + i).padStart(2, "0")}:00`,
}));

export const LUNCH_PERIOD = 5;

export const ROOM_TYPES = ["ปกติ", "Lab", "โรงฝึกงาน"];

export const PDPA_VERSION = "1.0";

export const DEFAULT_THEME = { background: "#f5efe6", card: "#ffffff", accent: "#7f1d26" }; // college colors: maroon + gold
