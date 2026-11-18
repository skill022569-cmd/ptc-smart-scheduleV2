"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { PDPA_VERSION } from "@/lib/config";
import OtpModal from "@/components/OtpModal";

type Role = "student" | "teacher";

export default function SignupPage() {
  const [role, setRole] = useState<Role>("student");
  const [f, setF] = useState({ code: "", first_name: "", email: "", password: "", password2: "" });
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState<{ email: string; username: string } | null>(null);
  const [done, setDone] = useState<"" | "approval">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const start = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (f.password !== f.password2) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    run(sendSignup);
  };
  const sendSignup = async () => setSent(await api("/api/signup", "POST", { role, code: f.code, first_name: f.first_name, email: f.email, password: f.password, consent }));
  const verify = async (otp: string) => {
    const r = await api("/api/signup/verify", "POST", { code: otp });
    if (r.pendingApproval) setDone("approval");
    else window.location.href = "/schedule";
  };

  if (done === "approval") {
    return (
      <div className="mx-auto max-w-md pt-6">
        <div className="card space-y-3 text-center">
          <div className="text-4xl">⏳</div>
          <h1 className="text-xl font-bold text-brand-800">ยืนยันอีเมลเรียบร้อย</h1>
          <p className="text-stone-600">บัญชีครู <b>{sent?.username}</b> รอฝ่ายวิชาการอนุมัติ เมื่ออนุมัติแล้วเข้าสู่ระบบด้วยชื่อผู้ใช้นี้และรหัสผ่านที่ตั้งไว้ได้เลย</p>
          <Link href="/login" className="btn w-full">ไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="card space-y-4">
        <h1 className="text-xl font-bold text-brand-800">สมัครสมาชิก</h1>
        <form onSubmit={start} className="space-y-3">
          <div role="radiogroup" aria-label="สถานะ" className="grid grid-cols-2 gap-2">
            {([["student", "🎓 นักเรียน/นักศึกษา"], ["teacher", "👩‍🏫 ครู"]] as const).map(([r, label]) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                className={`rounded-lg px-3 py-2 font-medium ring-1 ${role === r ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-stone-700 ring-stone-300"}`}>{label}</button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="code">{role === "student" ? "รหัสนักศึกษา" : "รหัสครู (เช่น T-ELEC-2)"}</label>
            <input id="code" className="input" value={f.code} onChange={set("code")} required autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="fn">ชื่อจริง (ไม่ต้องใส่คำนำหน้าและนามสกุล)</label>
            <input id="fn" className="input" value={f.first_name} onChange={set("first_name")} required placeholder="เช่น ธนพล" />
          </div>
          <div>
            <label className="label" htmlFor="em">อีเมล (ใช้รับรหัส OTP)</label>
            <input id="em" type="email" className="input" value={f.email} onChange={set("email")} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="pw">รหัสผ่าน (อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข)</label>
            <input id="pw" type="password" className="input" value={f.password} onChange={set("password")} required autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="pw2">ยืนยันรหัสผ่าน</label>
            <input id="pw2" type="password" className="input" value={f.password2} onChange={set("password2")} required autoComplete="new-password" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>ฉันยอมรับนโยบายความเป็นส่วนตัว (PDPA) ฉบับ {PDPA_VERSION} ให้วิทยาลัยเก็บชื่อ รหัส อีเมล และประวัติการเข้าสู่ระบบเพื่อใช้งานระบบตารางเรียน</span>
          </label>
          {role === "teacher" && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">บัญชีครูต้องรอฝ่ายวิชาการอนุมัติหลังยืนยันอีเมล</p>}
          <button className="btn w-full" disabled={busy || !consent}>{busy ? "กำลังตรวจสอบ..." : "สมัครและส่งรหัส OTP"}</button>
        </form>
        {sent && (
          <OtpModal email={sent.email} title="ยืนยันอีเมลเพื่อสมัครสมาชิก" note={`ชื่อผู้ใช้สำหรับเข้าสู่ระบบของคุณคือ ${sent.username}`}
            onVerify={verify} onResend={sendSignup} onCancel={() => setSent(null)} cancelLabel="แก้ไขข้อมูล" />
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <p className="text-center text-sm text-stone-500">มีบัญชีแล้ว? <Link href="/login" className="font-medium text-brand-700">เข้าสู่ระบบ</Link></p>
      </div>
    </div>
  );
}
