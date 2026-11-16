import Link from "next/link";
import Image from "next/image";
import { q } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TERM } from "@/lib/config";

export const dynamic = "force-dynamic";

const SERVICES = [
  { href: "/schedule", icon: "📅", title: "ตารางเรียน-ตารางสอน", desc: "ดูตารางของตนเอง บันทึกเป็นรูปภาพ" },
  { href: "/map", icon: "🗺️", title: "แผนที่วิทยาลัย", desc: "ค้นหาอาคารและห้องปฏิบัติการ" },
  { href: "/assistant", icon: "💬", title: "ถาม-ตอบ AI", desc: "ถามเรื่องตารางเรียนและระเบียบ" },
  { href: "/profile", icon: "🛡️", title: "ข้อมูลส่วนบุคคล", desc: "จัดการบัญชีและสิทธิ์ตาม PDPA" },
];

export default async function Home() {
  const s = await getSession();
  const news = await q<{ id: string; title: string; body: string; created_at: string }>(
    "SELECT id, title, body, created_at FROM announcements ORDER BY created_at DESC LIMIT 10");
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-brand-700 text-white shadow-md">
        <Image src="/logo.jpg" alt="" width={360} height={360} aria-hidden
          className="pointer-events-none absolute -right-16 -top-10 hidden h-80 w-80 rounded-full opacity-15 sm:block" />
        <div className="relative max-w-2xl p-6 sm:p-10">
          <span className="inline-block rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-brand-900">
            ภาคเรียนที่ {TERM.semester}/{TERM.academicYear}
          </span>
          {/* Line breaks only at the hyphen, never inside a Thai word. */}
          <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-4xl">
            <span className="whitespace-nowrap">ระบบจัดตารางเรียน-</span><span className="whitespace-nowrap">ตารางสอน</span><br />วิทยาลัยการอาชีพโพนทอง
          </h1>
          <div className="mt-3 h-1 w-16 rounded bg-gold-400" />
          <p className="mt-3 text-brand-100">ตรวจสอบตารางเรียน ค้นหาห้องเรียน และสอบถามข้อมูลงานวิชาการได้ในที่เดียว ตลอด 24 ชั่วโมง</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={s ? "/schedule" : "/login"} className="rounded-lg bg-gold-400 px-5 py-2.5 font-bold text-brand-900 hover:bg-gold-300">
              {s ? "ดูตารางของฉัน" : "เข้าสู่ระบบ"}
            </Link>
            <Link href="/map" className="rounded-lg px-5 py-2.5 font-medium ring-1 ring-white/50 hover:bg-white/10">ค้นหาห้องเรียน</Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">บริการ</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SERVICES.map((x) => (
            <Link key={x.href} href={x.href} className="card group !p-4 transition hover:-transtone-y-0.5 hover:ring-gold-400">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-2xl">{x.icon}</div>
              <div className="mt-3 font-bold text-stone-800 group-hover:text-brand-700">{x.title}</div>
              <div className="text-sm text-stone-500">{x.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">ประกาศจากงานวิชาการ</h2>
        <div className="divide-y divide-stone-200 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
          {news.map((n) => (
            <article key={n.id} className="flex gap-4 p-4 sm:p-5">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-gold-100 text-gold-700">
                <span className="text-lg font-bold leading-none">{n.created_at.slice(8, 10)}</span>
                <span className="text-xs">{new Date(n.created_at.replace(" ", "T")).toLocaleDateString("th-TH", { month: "short" })}</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-brand-800">{n.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{n.body}</p>
              </div>
            </article>
          ))}
          {!news.length && <p className="p-5 text-stone-500">ยังไม่มีประกาศ</p>}
        </div>
      </section>
    </div>
  );
}
