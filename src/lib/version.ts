import pkg from "../../package.json";

// package.json version + the git commit Vercel deployed (absent in local dev).
export const APP_VERSION = `v${pkg.version}${process.env.VERCEL_GIT_COMMIT_SHA ? ` · ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}`;

export const REPORT_CATEGORIES = ["ใช้งานไม่ได้/มีข้อผิดพลาด", "แสดงผลผิดปกติ", "ข้อมูลตารางไม่ถูกต้อง", "ข้อเสนอแนะ"];
export const REPORT_STATUS: Record<string, string> = { new: "ใหม่", doing: "กำลังแก้", done: "แก้แล้ว" };
