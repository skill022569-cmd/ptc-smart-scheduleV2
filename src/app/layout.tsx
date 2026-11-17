import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import { Sarabun } from "next/font/google";
import { getSession } from "@/lib/auth";
import NavLinks from "@/components/NavLinks";
import { APP_VERSION } from "@/lib/version";
import "./globals.css";

const thai = Sarabun({ variable: "--font-thai", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "ระบบจัดตารางเรียน-ตารางสอน | วิทยาลัยการอาชีพโพนทอง",
  description: "ระบบจัดตารางเรียน-ตารางสอน วิทยาลัยการอาชีพโพนทอง",
  icons: { icon: "/logo.jpg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7f1d26" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const links = [
    { href: "/", label: "หน้าแรก" },
    { href: "/schedule", label: s?.role === "teacher" ? "ตารางสอน" : "ตารางเรียน" },
    { href: "/map", label: "แผนที่วิทยาลัย" },
    { href: "/staff", label: "บุคลากร" },
    { href: "/assistant", label: "ถาม-ตอบ AI" },
    ...(s?.role === "admin" ? [{ href: "/admin", label: "งานวิชาการ" }] : []),
  ];
  return (
    <html lang="th">
      <body className={`${thai.variable} flex min-h-screen flex-col font-sans antialiased`}>
        <header className="sticky top-0 z-30 shadow-sm">
          {s?.actor && (
            <div role="status" className="bg-amber-500 text-amber-950">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm">
                <span>👁️ <b>{s.actor.username}</b> กำลังดูเว็บในมุมมองของ <b>{s.username}</b> ({s.role === "teacher" ? "ครู" : "นักเรียน"})</span>
                <a href="/api/impersonate" className="ml-auto rounded-md bg-amber-950 px-3 py-0.5 font-semibold text-amber-50 hover:bg-black">กลับเป็นแอดมิน</a>
              </div>
            </div>
          )}
          <div className="border-b-[3px] border-gold-500 bg-brand-700 text-white">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <Image src="/logo.jpg" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={48} height={48} priority
                  className="h-11 w-11 shrink-0 rounded-full bg-white ring-2 ring-gold-400 sm:h-12 sm:w-12" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-base font-bold sm:text-lg"><span className="hidden sm:inline">ระบบจัด</span>ตารางเรียน-ตารางสอน</span>
                  <span className="block truncate text-xs text-gold-100 sm:text-sm">วิทยาลัยการอาชีพโพนทอง<span className="hidden md:inline"> · Phonthong Industrial and Community Education College</span></span>
                </span>
              </Link>
              <span className="ml-auto" />
              {s ? (
                <Link href="/profile" className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-white/25 hover:bg-white/20">👤 {s.username}</Link>
              ) : (
                <Link href="/login" className="shrink-0 rounded-lg bg-gold-400 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-gold-300">เข้าสู่ระบบ</Link>
              )}
            </div>
          </div>
          <nav className="bg-white/95 backdrop-blur" aria-label="เมนูหลัก">
            <div className="mx-auto flex max-w-6xl overflow-x-auto px-2 text-sm">
              <NavLinks links={links} />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t-[3px] border-gold-500 bg-brand-900 text-sm text-brand-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-white">วิทยาลัยการอาชีพโพนทอง</div>
              <div>สังกัดสำนักงานคณะกรรมการการอาชีวศึกษา กระทรวงศึกษาธิการ</div>
            </div>
            <div className="text-xs text-brand-200 sm:text-right">
              <div>ระบบจัดตารางเรียน-ตารางสอน (PTC Smart Schedule) · คุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. PDPA</div>
              <div className="mt-0.5">เวอร์ชัน <span className="font-semibold text-gold-300">{APP_VERSION}</span></div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
