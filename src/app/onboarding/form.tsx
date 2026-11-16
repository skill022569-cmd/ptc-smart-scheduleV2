"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { PDPA_VERSION } from "@/lib/config";

export default function OnboardingForm({ mustChange }: { mustChange: boolean }) {
  const [consent, setConsent] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mustChange && pw !== pw2) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    setError("");
    try {
      await api("/api/me/onboarding", "POST", { consent, newPassword: mustChange ? pw : undefined });
      window.location.href = "/schedule";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pdpa-title"
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h1 id="pdpa-title" className="text-xl font-bold">🔒 นโยบายความเป็นส่วนตัว (PDPA) ฉบับ {PDPA_VERSION}</h1>
        <div className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
          <p>วิทยาลัยการอาชีพโพนทองเก็บข้อมูลของคุณเท่าที่จำเป็นต่อการจัดและแสดงตารางเรียน-ตารางสอน ได้แก่ ชื่อ รหัสนักศึกษา/บุคลากร แผนก กลุ่มเรียน อีเมล (บุคลากร) และประวัติการเข้าสู่ระบบเพื่อความปลอดภัย</p>
          <p>ข้อมูลถูกเข้ารหัสทั้งขณะจัดเก็บและรับส่ง อีเมลจะแสดงแบบปิดบังบางส่วนต่อผู้อื่น ประวัติการเข้าสู่ระบบจะถูกลบอัตโนมัติเมื่อครบ 1 ปี</p>
          <p>คุณสามารถขอส่งออกข้อมูลของตนเอง หรือขอลบบัญชีได้ตลอดเวลาที่หน้า โปรไฟล์</p>
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัว</span>
        </label>
        {mustChange && (
          <div className="space-y-3 border-t pt-4">
            <p className="font-medium">ตั้งรหัสผ่านใหม่ (เข้าใช้ครั้งแรก)</p>
            <div>
              <label className="label" htmlFor="np">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข)</label>
              <input id="np" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
            </div>
            <div>
              <label className="label" htmlFor="np2">ยืนยันรหัสผ่านใหม่</label>
              <input id="np2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <a href="/api/auth/logout" className="btn-ghost flex-1">ไม่ยอมรับ / ออกจากระบบ</a>
          <button className="btn flex-1" disabled={!consent || busy}>ยอมรับและเริ่มใช้งาน</button>
        </div>
      </form>
    </div>
  );
}
