"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSavedChats } from "@/app/assistant/Chat";
import { api } from "@/lib/api";
import OtpModal from "@/components/OtpModal";

type Portal = "student" | "staff";

export default function LoginPage() {
  useEffect(clearSavedChats, []); // logout redirects here: forget the previous user's chat
  const [portal, setPortal] = useState<Portal | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const login = () => run(async () => {
    const r = await api("/api/auth/login", "POST", { username, password, portal });
    if (r.otp) setOtpEmail(r.email);
    else window.location.href = "/schedule";
  });
  const verify = async (code: string) => {
    await api("/api/auth/verify-otp", "POST", { code });
    window.location.href = "/schedule";
  };
  const resend = async () => { await api("/api/auth/login", "POST", { username, password, portal }); };

  if (!portal) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <Image src="/logo.jpg" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={96} height={96} className="mx-auto h-24 w-24 rounded-full ring-4 ring-gold-400" />
        <h1 className="text-center text-2xl font-bold text-brand-800">เข้าสู่ระบบ</h1>
        <p className="text-center text-stone-500">เลือกสถานะของคุณ</p>
        <button onClick={() => setPortal("student")} className="card w-full text-left transition hover:ring-brand-400">
          <div className="text-3xl">🎓</div>
          <div className="mt-2 text-lg font-bold">สำหรับนักเรียน/นักศึกษา</div>
          <div className="text-sm text-stone-500">ใช้รหัสนักศึกษาเป็นชื่อผู้ใช้</div>
        </button>
        <button onClick={() => setPortal("staff")} className="card w-full text-left transition hover:ring-brand-400">
          <div className="text-3xl">👩‍🏫</div>
          <div className="mt-2 text-lg font-bold">สำหรับบุคลากร</div>
          <div className="text-sm text-stone-500">ครูและฝ่ายวิชาการ (ยืนยันตัวตน 2 ชั้นด้วย OTP ทางอีเมล)</div>
        </button>
        <p className="text-center text-sm text-stone-500">ยังไม่มีบัญชี? <Link href="/signup" className="font-medium text-brand-700">สมัครสมาชิก (ยืนยันด้วย OTP ทางอีเมล)</Link></p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="card space-y-4">
        <button onClick={() => { setPortal(null); setOtpEmail(null); setError(""); }} className="text-sm text-brand-600">← เปลี่ยนสถานะ</button>
        <h1 className="text-xl font-bold">{portal === "student" ? "🎓 นักเรียน/นักศึกษา" : "👩‍🏫 บุคลากร"}</h1>
        <form onSubmit={(e) => { e.preventDefault(); login(); }} className="space-y-3">
          <div>
            <label className="label" htmlFor="u">{portal === "student" ? "รหัสนักศึกษา" : "ชื่อผู้ใช้"}</label>
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <label className="label" htmlFor="p">รหัสผ่าน</label>
            <input id="p" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <button className="btn w-full" disabled={busy}>{busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}</button>
        </form>
        {otpEmail && (
          <OtpModal email={otpEmail} title="ยืนยันตัวตนด้วย OTP" onVerify={verify} onResend={resend} onCancel={() => setOtpEmail(null)} />
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
