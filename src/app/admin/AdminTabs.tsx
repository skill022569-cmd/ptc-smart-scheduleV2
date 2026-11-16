"use client";
import { useState } from "react";
import SchedulerPanel from "./SchedulerPanel";
import Canvas from "./Canvas";
import MasterData from "./MasterData";
import Users from "./Users";

const TABS = [
  ["ai", "🤖 จัดตารางด้วย AI"],
  ["canvas", "✋ ลากวางตาราง"],
  ["data", "🗂️ ข้อมูลหลัก"],
  ["users", "👥 บัญชีผู้ใช้"],
] as const;

export default function AdminTabs({ groups }: { groups: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("ai");
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-4 py-2 font-medium ${tab === id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "ai" && <SchedulerPanel />}
      {tab === "canvas" && <Canvas groups={groups} />}
      {tab === "data" && <MasterData />}
      {tab === "users" && <Users />}
    </div>
  );
}
