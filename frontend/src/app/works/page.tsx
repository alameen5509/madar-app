"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

interface WorkData {
  id: string; type: string; name: string; title?: string; employer?: string;
  salary: number; startDate?: string; endDate?: string; status: string;
  sector?: string; role?: string; ownershipPercentage?: number;
  jobCount: number; jobs: { id: string; title: string; status: string }[];
}

export default function WorksPage() {
  const [works, setWorks] = useState<WorkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "job" | "entrepreneur">("all");
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<"job" | "entrepreneur" | null>(null);
  // Job fields
  const [fName, setFName] = useState(""); const [fTitle, setFTitle] = useState(""); const [fEmployer, setFEmployer] = useState("");
  const [fSalary, setFSalary] = useState(""); const [fStart, setFStart] = useState("");
  // Entrepreneur fields
  const [fSector, setFSector] = useState(""); const [fRole, setFRole] = useState(""); const [fOwnership, setFOwnership] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/api/works"); setWorks(data); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? works : works.filter(w => w.type === filter);
  const jobCount = works.filter(w => w.type === "job").length;
  const entCount = works.filter(w => w.type === "entrepreneur").length;

  function resetForm() {
    setFName(""); setFTitle(""); setFEmployer(""); setFSalary(""); setFStart("");
    setFSector(""); setFRole(""); setFOwnership(""); setNewType(null); setShowNew(false);
  }

  async function create() {
    if (!fName.trim()) return;
    const body: Record<string, unknown> = { name: fName.trim(), type: newType };
    if (newType === "job") {
      body.title = fTitle.trim() || undefined;
      body.employer = fEmployer.trim() || undefined;
      body.salary = Number(fSalary) || 0;
      body.startDate = fStart || undefined;
    } else {
      body.sector = fSector.trim() || undefined;
      body.role = fRole.trim() || undefined;
      body.ownershipPercentage = Number(fOwnership) || 0;
      body.startDate = fStart || undefined;
    }
    try {
      await api.post("/api/works", body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل الحفظ";
      alert(msg);
      return;
    }
    resetForm(); load();
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-8 py-4 pr-16 md:pr-8" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>الأعمال</h2>
            {!loading && <p className="text-xs" style={{ color: "var(--muted)" }}>{jobCount} وظيفة · {entCount} رجل أعمال</p>}
          </div>
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + عمل جديد
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {[{ key: "all" as const, label: `الكل (${works.length})` }, { key: "job" as const, label: `وظائف (${jobCount})` }, { key: "entrepreneur" as const, label: `رجال أعمال (${entCount})` }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: filter === f.key ? "#2D6B9E" : "var(--card)", color: filter === f.key ? "#fff" : "var(--muted)", border: `1px solid ${filter === f.key ? "#2D6B9E" : "var(--card-border)"}` }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">💼</p>
            <p className="font-semibold" style={{ color: "var(--text)" }}>لا توجد أعمال</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف وظيفتك أو عملك الحر</p>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {filtered.map(w => (
            <div key={w.id} className="group rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:border-[#2D6B9E]"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <Link href={`/works/${w.id}`} className="block p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: w.type === "entrepreneur" ? "#D4AF3715" : "#2D6B9E15" }}>
                    {w.type === "entrepreneur" ? "👔" : "💼"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>{w.name}</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: w.status === "active" ? "#3D8C5A15" : "#6B728015", color: w.status === "active" ? "#3D8C5A" : "#6B7280" }}>
                        {w.status === "active" ? "نشط" : "منتهي"}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: w.type === "entrepreneur" ? "#D4AF3715" : "#2D6B9E15", color: w.type === "entrepreneur" ? "#D4AF37" : "#2D6B9E" }}>
                        {w.type === "entrepreneur" ? "رجل أعمال" : "وظيفة"}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                      {w.type === "job" ? `${w.employer || w.title || ""} · ${w.salary > 0 ? w.salary.toLocaleString() + " ريال" : ""}` : `${w.sector || ""} · ${w.role || ""} · ${w.jobCount} وظيفة`}
                    </p>
                  </div>
                  {w.type === "entrepreneur" && w.jobCount > 0 && (
                    <span className="text-lg font-black" style={{ color: "#D4AF37" }}>{w.jobCount}</span>
                  )}
                  <span className="text-xs group-hover:translate-x-[-4px] transition-transform" style={{ color: "#2D6B9E" }}>←</span>
                </div>
              </Link>
              {/* Delete button */}
              <div className="flex justify-end px-5 pb-3 -mt-1">
                <button onClick={async () => {
                  if (!confirm(`حذف "${w.name}" نهائياً؟`)) return;
                  try { await api.delete(`/api/works/${w.id}`); load(); } catch { alert("فشل الحذف"); }
                }}
                  className="text-[10px] px-3 py-1.5 rounded-lg font-medium transition hover:bg-red-50"
                  style={{ color: "#ef4444", border: "1px solid #ef444430" }}>
                  🗑️ حذف
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {/* New work dialog */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-up"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
              <h3 className="font-bold" style={{ color: "var(--text)" }}>عمل جديد</h3>
              <div className="flex gap-2">
                <button onClick={resetForm} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                {newType && <button onClick={create} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>إنشاء</button>}
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Type selection */}
              {!newType ? (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setNewType("job")}
                    className="rounded-2xl p-6 border-2 text-center transition-all hover:shadow-md hover:border-[#2D6B9E]"
                    style={{ borderColor: "var(--card-border)" }}>
                    <span className="text-4xl block mb-3">💼</span>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>وظيفة</p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>موظف في جهة</p>
                  </button>
                  <button onClick={() => setNewType("entrepreneur")}
                    className="rounded-2xl p-6 border-2 text-center transition-all hover:shadow-md hover:border-[#D4AF37]"
                    style={{ borderColor: "var(--card-border)" }}>
                    <span className="text-4xl block mb-3">👔</span>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>رجل أعمال</p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>رجل أعمال / مشاريع</p>
                  </button>
                </div>
              ) : newType === "job" ? (
                <>
                  <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>💼 وظيفة جديدة</p>
                  <input value={fName} onChange={e => setFName(e.target.value)} placeholder="اسم الوظيفة *" autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="المسمى الوظيفي"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input value={fEmployer} onChange={e => setFEmployer(e.target.value)} placeholder="جهة العمل"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input type="number" value={fSalary} onChange={e => setFSalary(e.target.value)} placeholder="الراتب"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input type="date" value={fStart} onChange={e => setFStart(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <button onClick={() => setNewType(null)} className="text-[10px]" style={{ color: "var(--muted)" }}>← تغيير النوع</button>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold" style={{ color: "#D4AF37" }}>👔 رجل أعمال جديد</p>
                  <input value={fName} onChange={e => setFName(e.target.value)} placeholder="اسم العمل *" autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input value={fSector} onChange={e => setFSector(e.target.value)} placeholder="القطاع (تقنية، تجارة، عقار…)"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input value={fRole} onChange={e => setFRole(e.target.value)} placeholder="دورك (مؤسس، شريك، مدير…)"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input type="number" value={fOwnership} onChange={e => setFOwnership(e.target.value)} placeholder="نسبة الملكية %"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <input type="date" value={fStart} onChange={e => setFStart(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <button onClick={() => setNewType(null)} className="text-[10px]" style={{ color: "var(--muted)" }}>← تغيير النوع</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
