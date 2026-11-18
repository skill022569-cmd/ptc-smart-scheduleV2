"use client";
import { useEffect, useRef, useState } from "react";

const RESEND_SECONDS = 60; // matches the server's 1-code-per-minute limit

// Pop-up that opens right after a code is sent: input is focused, 6 digits submit automatically.
export default function OtpModal({ email, title = "กรอกรหัส OTP", note, onVerify, onResend, onCancel, cancelLabel = "ยกเลิก" }: {
  email: string;
  title?: string;
  note?: string;
  onVerify: (code: string) => Promise<void>; // throw an Error to show its message
  onResend: () => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel?.();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCancel]);

  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      await onVerify(value);
    } catch (e) {
      setError((e as Error).message);
      setCode("");
      input.current?.focus();
    } finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      await onResend();
      setWait(RESEND_SECONDS);
      setCode("");
      input.current?.focus();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="otp-title" onSubmit={(e) => { e.preventDefault(); verify(code); }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="text-4xl" aria-hidden>📧</div>
        <h2 id="otp-title" className="text-xl font-bold text-brand-800">{title}</h2>
        <p className="text-sm text-stone-600">ส่งรหัส 6 หลักไปที่ <b>{email}</b> แล้ว<br />ใช้ได้ 5 นาที · ถ้าไม่เห็นให้ดูในโฟลเดอร์สแปม</p>
        {note && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{note}</p>}
        <input ref={input} autoFocus className="input text-center text-3xl font-bold tracking-[0.5em]" inputMode="numeric" maxLength={6}
          autoComplete="one-time-code" aria-label="รหัส OTP 6 หลัก" value={code} disabled={busy}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }} />
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
        <button className="btn w-full" disabled={busy || code.length !== 6}>{busy ? "กำลังตรวจสอบ..." : "ยืนยัน"}</button>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1 text-sm" disabled={busy || wait > 0} onClick={resend}>
            {wait > 0 ? `ส่งรหัสใหม่ได้ใน ${wait} วิ` : "ส่งรหัสใหม่"}
          </button>
          {onCancel && <button type="button" className="btn-ghost flex-1 text-sm" disabled={busy} onClick={onCancel}>{cancelLabel}</button>}
        </div>
      </form>
    </div>
  );
}
