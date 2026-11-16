"use client";
import { useCallback, useEffect, useState } from "react";
import { ENTITIES } from "@/lib/entities";
import { api } from "@/lib/api";

type Row = Record<string, string | number | null>;

export default function MasterData() {
  const [entity, setEntity] = useState("subjects");
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const e = ENTITIES[entity];

  const load = useCallback(async () => setRows(await api(`/api/admin/data/${entity}`)), [entity]);
  useEffect(() => { load(); setForm({}); setEditId(null); setMsg(null); }, [load]);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      if (editId) await api(`/api/admin/data/${entity}`, "PUT", { ...form, id: editId });
      else await api(`/api/admin/data/${entity}`, "POST", form);
      setMsg({ ok: true, text: "บันทึกแล้ว" });
      setForm({}); setEditId(null); load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }
  async function remove(r: Row) {
    if (!confirm(`ลบ ${r[e.pk]}?`)) return;
    try { await api(`/api/admin/data/${entity}?id=${encodeURIComponent(String(r[e.pk]))}`, "DELETE"); load(); }
    catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }
  async function importCsv(file: File) {
    try {
      const res = await fetch("/api/admin/import-students", { method: "POST", body: await file.text() });
      const d = await res.json();
      setMsg(res.ok ? { ok: true, text: `นำเข้า ${d.created} คน (รหัสผ่านเริ่มต้น = รหัสนักศึกษา)` } : { ok: false, text: d.error });
      load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }

  const shown = rows.filter((r) => !filter || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(filter.toLowerCase())));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(ENTITIES).map(([k, v]) => (
          <button key={k} onClick={() => setEntity(k)}
            className={`rounded-lg px-3 py-1.5 text-sm ${k === entity ? "bg-slate-800 text-white" : "bg-white ring-1 ring-slate-200"}`}>{v.label}</button>
        ))}
      </div>
      <form onSubmit={save} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="font-bold sm:col-span-2 lg:col-span-3">{editId ? `แก้ไข ${editId}` : `เพิ่ม${e.label}`}</h3>
        {e.fields.map((f) => (
          <label key={f.key} className={f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
            <span className="label">{f.label}{f.required ? " *" : ""}</span>
            {f.type === "textarea" ? (
              <textarea className="input min-h-28" value={form[f.key] ?? ""} onChange={(ev) => setForm({ ...form, [f.key]: ev.target.value })} />
            ) : f.type === "select" ? (
              <select className="input" value={form[f.key] ?? ""} onChange={(ev) => setForm({ ...form, [f.key]: ev.target.value })}>
                <option value="">—</option>{f.options!.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" type={f.type === "number" ? "number" : "text"} disabled={!!editId && f.key === e.pk}
                value={form[f.key] ?? ""} onChange={(ev) => setForm({ ...form, [f.key]: ev.target.value })} />
            )}
          </label>
        ))}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button className="btn">💾 บันทึก</button>
          {editId && <button type="button" className="btn-ghost" onClick={() => { setForm({}); setEditId(null); }}>ยกเลิก</button>}
          {entity === "students" && (
            <label className="btn-ghost cursor-pointer">
              📥 นำเข้า CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(ev) => ev.target.files?.[0] && importCsv(ev.target.files[0])} />
            </label>
          )}
        </div>
        {entity === "students" && <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">CSV หัวตาราง: student_id,full_name,department,year_level,group_id</p>}
        {entity === "teachers" && <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">เวลาที่ไม่สะดวกสอน ครูแจ้งเองในหน้า ตารางสอน · สร้างบัญชีเข้าระบบให้ครูได้ที่แท็บ บัญชีผู้ใช้</p>}
        {msg && <p role="status" className={`rounded-xl p-3 text-sm sm:col-span-2 lg:col-span-3 ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
      </form>
      <div className="card">
        <input className="input mb-3 max-w-sm" placeholder="กรองข้อมูล..." aria-label="กรองข้อมูล" value={filter} onChange={(ev) => setFilter(ev.target.value)} />
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr>{e.fields.map((f) => <th key={f.key} className="py-2 pr-3">{f.label}</th>)}<th /></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={String(r[e.pk])} className="border-t">
                  {e.fields.map((f) => <td key={f.key} className="max-w-xs truncate py-1.5 pr-3">{r[f.key] ?? "-"}</td>)}
                  <td className="whitespace-nowrap text-right">
                    <button className="px-2 text-indigo-600" onClick={() => { setForm(r); setEditId(String(r[e.pk])); window.scrollTo({ top: 0, behavior: "smooth" }); }}>แก้ไข</button>
                    <button className="px-2 text-rose-600" onClick={() => remove(r)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">{shown.length} รายการ</p>
        </div>
      </div>
    </div>
  );
}
