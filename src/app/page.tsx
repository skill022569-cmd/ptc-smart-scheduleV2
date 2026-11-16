import Link from "next/link";
import { q } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSession();
  const news = await q<{ id: string; title: string; body: string; created_at: string }>(
    "SELECT id, title, body, created_at FROM announcements ORDER BY created_at DESC LIMIT 10");
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg sm:p-10">
        <h1 className="text-2xl font-bold sm:text-3xl">ตารางเรียน-ตารางสอน วิทยาลัยการอาชีพโพนทอง</h1>
        <p className="mt-2 text-indigo-100">ดูตารางเรียน หาห้องเรียน และถามคำถามเรื่องการเรียนกับผู้ช่วย AI ได้ในที่เดียว</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={s ? "/schedule" : "/login"} className="rounded-xl bg-white px-4 py-2 font-medium text-indigo-700">
            {s ? "ดูตารางของฉัน" : "เข้าสู่ระบบ"}
          </Link>
          <Link href="/map" className="rounded-xl bg-white/15 px-4 py-2 font-medium ring-1 ring-white/40">หาห้องเรียน</Link>
          <Link href="/assistant" className="rounded-xl bg-white/15 px-4 py-2 font-medium ring-1 ring-white/40">ถาม AI</Link>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">📢 ประกาศจากฝ่ายวิชาการ</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {news.map((n) => (
            <article key={n.id} className="card">
              <h3 className="font-bold">{n.title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{n.body}</p>
              <p className="mt-2 text-xs text-slate-400">{n.created_at}</p>
            </article>
          ))}
          {!news.length && <p className="text-slate-500">ยังไม่มีประกาศ</p>}
        </div>
      </section>
    </div>
  );
}
