"use client";
import { useState } from "react";
import { api } from "@/lib/api";

type Portal = "student" | "staff";

export default function LoginPage() {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
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
  const verify = () => run(async () => {
    await api("/api/auth/verify-otp", "POST", { code });
    window.location.href = "/schedule";
  });

  if (!portal) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <h1 className="text-center text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="text-center text-slate-500">เลือกสถานะของคุณ</p>
        <button onClick={() => setPortal("student")} className="card w-full text-left transition hover:ring-indigo-400">
          <div className="text-3xl">🎓</div>
          <div className="mt-2 text-lg font-bold">สำหรับนักเรียน/นักศึกษา</div>
          <div className="text-sm text-slate-500">ใช้รหัสนักศึกษาเป็นชื่อผู้ใช้</div>
        </button>
        <button onClick={() => setPortal("staff")} className="card w-full text-left transition hover:ring-indigo-400">
          <div className="text-3xl">👩‍🏫</div>
          <div className="mt-2 text-lg font-bold">สำหรับบุคลากร</div>
          <div className="text-sm text-slate-500">ครูและฝ่ายวิชาการ (ยืนยันตัวตน 2 ชั้นด้วย OTP ทางอีเมล)</div>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="card space-y-4">
        <button onClick={() => { setPortal(null); setOtpEmail(null); setError(""); }} className="text-sm text-indigo-600">← เปลี่ยนสถานะ</button>
        <h1 className="text-xl font-bold">{portal === "student" ? "🎓 นักเรียน/นักศึกษา" : "👩‍🏫 บุคลากร"}</h1>
        {!otpEmail ? (
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
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
            <p className="text-sm text-slate-600">ส่งรหัส OTP 6 หลักไปที่ <b>{otpEmail}</b> แล้ว (ใช้ได้ 5 นาที)</p>
            <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" autoFocus aria-label="รหัส OTP" />
            <button className="btn w-full" disabled={busy || code.length !== 6}>ยืนยัน OTP</button>
            <button type="button" className="btn-ghost w-full" disabled={busy} onClick={login}>ส่งรหัสใหม่</button>
          </form>
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
