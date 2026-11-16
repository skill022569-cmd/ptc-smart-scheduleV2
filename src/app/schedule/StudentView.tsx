"use client";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import TimetableGrid, { type Theme } from "@/components/TimetableGrid";
import type { Cell } from "@/lib/timetable";
import { DEFAULT_THEME } from "@/lib/config";
import { api } from "@/lib/api";

const PRESETS: Theme[] = [
  DEFAULT_THEME,
  { background: "#fdf2f8", card: "#ffffff", accent: "#db2777" },
  { background: "#ecfdf5", card: "#ffffff", accent: "#059669" },
  { background: "#e0f2fe", card: "#ffffff", accent: "#0284c7" },
  { background: "#fff7ed", card: "#ffffff", accent: "#ea580c" },
];

export async function exportPng(node: HTMLElement | null, name: string) {
  if (!node) return;
  const url = await toPng(node, { pixelRatio: 2 });
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.png`;
  a.click();
}

export default function StudentView({ title, subtitle, cells, theme: initial }: { title: string; subtitle: string; cells: Cell[]; theme: Theme }) {
  const [theme, setTheme] = useState(initial);
  const [saved, setSaved] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  async function save(t: Theme) {
    setTheme(t);
    await api("/api/me", "PATCH", { ui_theme: t });
    setSaved("บันทึกธีมแล้ว");
    setTimeout(() => setSaved(""), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-slate-500">{subtitle}</p>
        </div>
        <button className="btn" onClick={() => exportPng(ref.current, title)}>🖼️ บันทึกเป็นรูปภาพ</button>
      </div>
      <TimetableGrid ref={ref} cells={cells} show="teacher" theme={theme} />
      <section className="card flex flex-wrap items-center gap-4">
        <span className="font-bold">🎨 ตกแต่งตาราง</span>
        <div className="flex gap-2">
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => save(p)} aria-label={`ธีมที่ ${i + 1}`}
              className="h-8 w-8 rounded-full ring-2 ring-white shadow" style={{ background: `linear-gradient(135deg, ${p.background} 50%, ${p.accent} 50%)` }} />
          ))}
        </div>
        {(["background", "card", "accent"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1 text-sm text-slate-600">
            {{ background: "พื้นหลัง", card: "การ์ด", accent: "สีหลัก" }[k]}
            <input type="color" value={theme[k]} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} onBlur={() => save(theme)} />
          </label>
        ))}
        {saved && <span className="text-sm text-emerald-600">{saved}</span>}
      </section>
    </div>
  );
}
