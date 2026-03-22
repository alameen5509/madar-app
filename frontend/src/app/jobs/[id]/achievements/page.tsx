"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

const TYPES = [
  { key: "project",   label: "مشروع",  icon: "📦", color: "#2D6B9E" },
  { key: "promotion", label: "ترقية",   icon: "📈", color: "#3D8C5A" },
  { key: "award",     label: "جائزة",   icon: "🏅", color: "#D4AF37" },
  { key: "cert",      label: "شهادة",   icon: "📜", color: "#5E5495" },
  { key: "milestone", label: "إنجاز",   icon: "🎯", color: "#DC2626" },
  { key: "other",     label: "أخرى",    icon: "⭐", color: "#6B7280" },
];

export default function AchievementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [showAdd, setShowAdd] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDate, setFDate] = useState("");
  const [fType, setFType] = useState("milestone");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string | null>(null);

  function add() {
    if (!fTitle.trim()) return;
    setMeta({ ...meta, achievements: [
      { title: fTitle.trim(), description: fDesc.trim() || undefined, date: fDate || new Date().toISOString().slice(0, 10), type: fType },
      ...meta.achievements,
    ]});
    setFTitle(""); setFDesc(""); setFDate(""); setFType("milestone"); setShowAdd(false);
  }

  // Sort by date descending
  const sorted = [...meta.achievements].sort((a, b) => b.date.localeCompare(a.date));

  // Get unique years
  const years = [...new Set(sorted.map(a => a.date.slice(0, 4)))].sort().reverse();

  // Filter
  const filtered = sorted.filter(a => {
    if (filterType && a.type !== filterType) return false;
    if (filterYear && !a.date.startsWith(filterYear)) return false;
    return true;
  });

  // Group by year-month for timeline
  const grouped: { label: string; items: typeof filtered }[] = [];
  for (const a of filtered) {
    const ym = a.date.slice(0, 7);
    const label = new Date(a.date).toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
    const existing = grouped.find(g => g.label === label);
    if (existing) existing.items.push(a);
    else grouped.push({ label, items: [a] });
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>الإنجازات</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{meta.achievements.length} إنجاز مسجل</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + إنجاز جديد
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="rounded-2xl p-5 border-2 space-y-3 fade-up" style={{ borderColor: "#D4AF3740", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "#D4AF37" }}>تسجيل إنجاز</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={add} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>إضافة</button>
              </div>
            </div>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="عنوان الإنجاز *"
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
            <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="وصف تفصيلي (اختياري)" rows={2}
              className="w-full px-4 py-2 rounded-xl border text-xs resize-none focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <div className="flex gap-2 items-center">
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              <div className="flex gap-1 flex-wrap flex-1">
                {TYPES.map(t => (
                  <button key={t.key} onClick={() => setFType(t.key)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold transition"
                    style={{ background: fType === t.key ? t.color : "#F3F4F6", color: fType === t.key ? "#fff" : "#6B7280" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {meta.achievements.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterType(null)}
              className="px-2.5 py-1 rounded-lg text-[9px] font-semibold transition"
              style={{ background: !filterType ? "#2D6B9E" : "#F3F4F6", color: !filterType ? "#fff" : "#6B7280" }}>الكل</button>
            {TYPES.map(t => {
              const count = meta.achievements.filter(a => a.type === t.key).length;
              if (count === 0) return null;
              return (
                <button key={t.key} onClick={() => setFilterType(filterType === t.key ? null : t.key)}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-semibold transition"
                  style={{ background: filterType === t.key ? t.color : "#F3F4F6", color: filterType === t.key ? "#fff" : "#6B7280" }}>
                  {t.icon} {t.label} ({count})
                </button>
              );
            })}
            {years.length > 1 && (
              <>
                <span className="text-[9px] self-center" style={{ color: "var(--muted)" }}>|</span>
                {years.map(y => (
                  <button key={y} onClick={() => setFilterYear(filterYear === y ? null : y)}
                    className="px-2 py-1 rounded-lg text-[9px] font-semibold transition"
                    style={{ background: filterYear === y ? "#2D6B9E" : "#F3F4F6", color: filterYear === y ? "#fff" : "#6B7280" }}>{y}</button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Timeline */}
        {grouped.map(g => (
          <div key={g.label}>
            <p className="text-[10px] font-bold mb-2 px-1" style={{ color: "var(--muted)" }}>{g.label}</p>
            <div className="relative pr-6">
              {/* Vertical line */}
              <div className="absolute right-[10px] top-0 bottom-0 w-[2px] rounded-full" style={{ background: "#2D6B9E20" }} />

              <div className="space-y-3">
                {g.items.map((a, i) => {
                  const globalIdx = meta.achievements.indexOf(a);
                  const typeMeta = TYPES.find(t => t.key === a.type) ?? TYPES[TYPES.length - 1];
                  return (
                    <div key={i} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute right-[-14px] top-4 w-5 h-5 rounded-full flex items-center justify-center text-[8px] z-10"
                        style={{ background: typeMeta.color, color: "#fff", border: "2px solid var(--bg)" }}>
                        {typeMeta.icon}
                      </div>

                      {/* Card */}
                      <div className="rounded-2xl p-4 border transition-all hover:shadow-sm" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: typeMeta.color + "15", color: typeMeta.color }}>{typeMeta.icon} {typeMeta.label}</span>
                              <span className="text-[9px]" style={{ color: "var(--muted)" }}>{a.date}</span>
                            </div>
                            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{a.title}</p>
                            {a.description && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>{a.description}</p>}
                          </div>
                          <button onClick={() => { const arr = [...meta.achievements]; arr.splice(globalIdx, 1); setMeta({ ...meta, achievements: arr }); }}
                            className="text-red-300 hover:text-red-500 text-xs transition flex-shrink-0">✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && meta.achievements.length > 0 && (
          <p className="text-center py-6 text-xs" style={{ color: "var(--muted)" }}>لا توجد إنجازات تطابق التصفية</p>
        )}

        {meta.achievements.length === 0 && !showAdd && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🏆</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد إنجازات</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>سجّل أول إنجاز لك في هذه الوظيفة</p>
          </div>
        )}
      </div>
    </JobPageShell>
  );
}
