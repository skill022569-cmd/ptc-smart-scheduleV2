import { q } from "@/lib/db";
import { DIVISIONS, type Staff } from "@/lib/staff";

export const dynamic = "force-dynamic";

function Person({ s, big }: { s: Staff; big?: boolean }) {
  // Initial from the first name, skipping the title (นาย/นาง/นางสาว/ครู).
  const initial = s.full_name.replace(/^(นางสาว|นาย|นาง|ครู)/, "").trim().charAt(0);
  return (
    <div className={`card flex items-center gap-3 ${big ? "!p-5" : "!p-3"}`}>
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700 ring-2 ring-gold-400 ${big ? "h-16 w-16 text-2xl" : "h-11 w-11 text-lg"}`} aria-hidden>
        {initial}
      </div>
      <div className="min-w-0">
        <div className={`font-bold text-stone-800 ${big ? "text-lg" : ""}`}>{s.full_name}</div>
        <div className="text-sm font-medium text-brand-700">{s.position}</div>
        {s.rank_title && <div className="text-xs text-stone-500">{s.rank_title}</div>}
      </div>
    </div>
  );
}

export default async function StaffPage() {
  const all = await q<Staff>("SELECT * FROM staff ORDER BY sort_order, full_name");
  const execs = all.filter((s) => s.division === DIVISIONS[0]);
  const [director, ...deputies] = execs;
  const grouped = (div: string) => {
    const units = new Map<string, Staff[]>();
    for (const s of all.filter((x) => x.division === div)) units.set(s.unit ?? div, [...(units.get(s.unit ?? div) ?? []), s]);
    return [...units];
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">บุคลากรวิทยาลัยการอาชีพโพนทอง</h1>
        <p className="text-stone-500">โครงสร้างการบริหารและบุคลากร · ทั้งหมด {new Set(all.map((s) => s.full_name)).size} คน</p>
      </div>

      {director && (
        <section className="space-y-4">
          <h2 className="section-title">ผู้บริหารสถานศึกษา</h2>
          <div className="mx-auto max-w-md"><Person s={director} big /></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{deputies.map((d) => <Person key={d.id} s={d} />)}</div>
        </section>
      )}

      {DIVISIONS.slice(1).map((div) => {
        const units = grouped(div);
        if (!units.length) return null;
        const deputy = deputies.find((d) => d.unit === div);
        return (
          <section key={div} className="space-y-3">
            <h2 className="section-title">{div}</h2>
            {deputy && <p className="-mt-1 text-sm text-stone-500">กำกับดูแลโดย {deputy.full_name}</p>}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {units.map(([unit, people]) => (
                <div key={unit} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
                  <div className="border-b-2 border-gold-400 bg-brand-700 px-4 py-2 font-semibold text-white">{unit}</div>
                  <ul className="divide-y divide-stone-100">
                    {people.map((p) => (
                      <li key={p.id} className="px-4 py-2">
                        <div className="font-medium text-stone-800">{p.full_name}</div>
                        <div className="text-xs text-stone-500">{p.position}{p.rank_title ? ` · ${p.rank_title}` : ""}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!all.length && <p className="card text-stone-500">ยังไม่มีข้อมูลบุคลากร</p>}
    </div>
  );
}
