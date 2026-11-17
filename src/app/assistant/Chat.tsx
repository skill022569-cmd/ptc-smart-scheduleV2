"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ReportForm from "@/components/ReportForm";
import type { Action } from "@/lib/ai";

type Msg = { from: "me" | "ai"; text: string; actions?: Action[]; note?: string; error?: boolean };

const EXAMPLES = {
  student: ["วันนี้ฉันเรียนที่ไหนบ้าง", "เกณฑ์การติด ร. เป็นอย่างไร?", "แผนกช่างกลอยู่ตึกไหน?"],
  teacher: ["วันพุธฉันสอนที่ไหน", "ครูสมศรีสอนวิชาอะไรบ้าง?", "วิธีขอเปลี่ยนกลุ่มเรียน"],
  admin: ["วันนี้ ปวช.2 ช่างไฟฟ้า เรียนที่ไหน?", "ห้อง AUTO-101 ใช้เรียนวิชาอะไร", "เกณฑ์การติด ร. เป็นอย่างไร?"],
};

const PREFIX = "ptc-chat:";

// Called on the login page (where logout lands) so a chat never outlives its login.
export function clearSavedChats() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* storage blocked: nothing saved */ }
}

// storageKey is unique per login, so the chat survives page changes and reloads but starts fresh after logging in again.
export default function Chat({ role, storageKey }: { role: keyof typeof EXAMPLES; storageKey: string }) {
  const key = PREFIX + storageKey;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && k !== key) localStorage.removeItem(k);
      const saved = localStorage.getItem(key);
      if (saved) setMsgs(JSON.parse(saved));
    } catch { /* private mode or corrupt data: start empty */ }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (msgs.length) localStorage.setItem(key, JSON.stringify(msgs));
      else localStorage.removeItem(key);
    } catch { /* storage full or blocked: chat still works, just not saved */ }
  }, [msgs, loaded, key]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { from: "me", text: question }]);
    setInput("");
    setBusy(true);
    try {
      // Last 3 Q&A pairs (errors excluded) so the AI can follow up on what was just discussed.
      const history = msgs.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.from === "me" ? "user" : "ai", text: m.text }));
      const r = await api("/api/chat", "POST", { question, history });
      setMsgs((m) => [...m, { from: "ai", text: r.answer, actions: r.actions, note: r.note }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "ai", text: (e as Error).message, error: true }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">🤖 ผู้ช่วย AI ฝ่ายวิชาการ</h1>
        <p className="text-stone-500">ถามเรื่องตารางเรียน ห้องเรียน ครูผู้สอน หรือระเบียบของวิทยาลัย — ค้นจากฐานข้อมูลจริงล่าสุดด้วย TiDB Vector Search แล้วเรียบเรียงคำตอบด้วย Google Gemini</p>
      </div>
      <div className="card min-h-80 space-y-3" aria-live="polite">
        {!!msgs.length && (
          <div className="-mt-1 flex justify-end border-b border-stone-100 pb-2">
            <button type="button" onClick={() => setMsgs([])} disabled={busy}
              className="rounded-lg px-2 py-1 text-xs text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50 hover:text-brand-700 disabled:opacity-50">
              🔄 เริ่มแชทใหม่
            </button>
          </div>
        )}
        {!msgs.length && (
          <div className="space-y-2">
            <p className="text-sm text-stone-500">ลองถาม:</p>
            {EXAMPLES[role].map((e) => (
              <button key={e} onClick={() => send(e)} className="block rounded-xl bg-brand-50 px-3 py-2 text-left text-brand-700 hover:bg-brand-100">{e}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.from === "me" ? "bg-brand-600 text-white" : m.error ? "bg-rose-50 text-rose-700" : "bg-stone-100"}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.note && <p className="mt-2 rounded bg-gold-100 px-2 py-1 text-xs text-gold-700">⚙️ (เห็นเฉพาะแอดมิน) โหมดสำรอง: {m.note}</p>}
              {!!m.actions?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.actions.map((a) => <Link key={a.href} href={a.href} className="rounded-lg bg-white px-3 py-1 text-sm text-brand-700 ring-1 ring-brand-200">{a.label}</Link>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-stone-400">กำลังค้นข้อมูล...</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
        <input className="input" placeholder="พิมพ์คำถาม..." aria-label="คำถาม" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} />
        <button className="btn" disabled={busy || !input.trim()}>ส่ง</button>
      </form>
      <p className="text-xs text-stone-400">คำถามจะถูกส่งไปประมวลผลที่ Google Gemini · โปรดอย่าพิมพ์ข้อมูลส่วนตัว เช่น เลขบัตรประชาชน หรือรหัสผ่าน</p>
      <ReportForm />
    </div>
  );
}
