"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Action } from "@/lib/ai";

type Msg = { from: "me" | "ai"; text: string; actions?: Action[]; error?: boolean };

const EXAMPLES = {
  student: ["วันนี้ฉันเรียนที่ไหนบ้าง", "เกณฑ์การติด ร. เป็นอย่างไร?", "แผนกช่างกลอยู่ตึกไหน?"],
  teacher: ["วันพุธฉันสอนที่ไหน", "ครูสมศรีสอนวิชาอะไรบ้าง?", "วิธีขอเปลี่ยนกลุ่มเรียน"],
  admin: ["วันนี้ ปวช.2 ช่างไฟฟ้า เรียนที่ไหน?", "ห้อง AUTO-101 ใช้เรียนวิชาอะไร", "เกณฑ์การติด ร. เป็นอย่างไร?"],
};

export default function Chat({ role }: { role: keyof typeof EXAMPLES }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { from: "me", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api("/api/chat", "POST", { question });
      setMsgs((m) => [...m, { from: "ai", text: r.answer, actions: r.actions }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "ai", text: (e as Error).message, error: true }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">🤖 ผู้ช่วย AI ฝ่ายวิชาการ</h1>
        <p className="text-slate-500">ถามเรื่องตารางเรียน ห้องเรียน ครูผู้สอน หรือระเบียบของวิทยาลัย — ค้นจากฐานข้อมูลจริงล่าสุดด้วย TiDB Vector Search</p>
      </div>
      <div className="card min-h-80 space-y-3" aria-live="polite">
        {!msgs.length && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">ลองถาม:</p>
            {EXAMPLES[role].map((e) => (
              <button key={e} onClick={() => send(e)} className="block rounded-xl bg-indigo-50 px-3 py-2 text-left text-indigo-700 hover:bg-indigo-100">{e}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.from === "me" ? "bg-indigo-600 text-white" : m.error ? "bg-rose-50 text-rose-700" : "bg-slate-100"}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {!!m.actions?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.actions.map((a) => <Link key={a.href} href={a.href} className="rounded-lg bg-white px-3 py-1 text-sm text-indigo-700 ring-1 ring-indigo-200">{a.label}</Link>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-slate-400">กำลังค้นข้อมูล...</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
        <input className="input" placeholder="พิมพ์คำถาม..." aria-label="คำถาม" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} />
        <button className="btn" disabled={busy || !input.trim()}>ส่ง</button>
      </form>
    </div>
  );
}
