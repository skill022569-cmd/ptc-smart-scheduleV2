import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Noto_Sans_Thai } from "next/font/google";
import { getSession } from "@/lib/auth";
import "./globals.css";

const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai", "latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "PTC Smart Schedule | วิทยาลัยการอาชีพโพนทอง",
  description: "ระบบจัดตารางเรียน-ตารางสอน วิทยาลัยการอาชีพโพนทอง",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const links = [
    { href: "/", label: "หน้าแรก" },
    { href: "/schedule", label: s?.role === "teacher" ? "ตารางสอน" : "ตารางเรียน" },
    { href: "/map", label: "แผนที่วิทยาลัย" },
    { href: "/assistant", label: "ถาม AI" },
    ...(s?.role === "admin" ? [{ href: "/admin", label: "จัดการระบบ" }] : []),
  ];
  return (
    <html lang="th">
      <body className={`${thai.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
            <Link href="/" className="mr-3 shrink-0 font-bold text-indigo-700">📅 PTC Smart Schedule</Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="shrink-0 rounded-lg px-3 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                {l.label}
              </Link>
            ))}
            <span className="ml-auto" />
            {s ? (
              <Link href="/profile" className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 font-medium text-indigo-700">👤 {s.username}</Link>
            ) : (
              <Link href="/login" className="btn shrink-0 !py-1.5">เข้าสู่ระบบ</Link>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="py-8 text-center text-xs text-slate-400">วิทยาลัยการอาชีพโพนทอง · PTC Smart Schedule</footer>
      </body>
    </html>
  );
}
