"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

const PERIODS = [
  { key: "monthly",   label: "شهري" },
  { key: "quarterly", label: "ربع سنوي" },
  { key: "yearly",    label: "سنوي" },
];

export default function KPIsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [showAdd, setShowAdd] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fTarget, setFTarget] = useState("");
  const [fCurrent, setFCurrent] = useState("");
  const [fPeriod, setFPeriod] = useState("monthly");

  function add() {
    if (!fTitle.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    setMeta({ ...meta, kpis: [...meta.kpis, {
      title: fTitle.trim(), description: fDesc.trim() || undefined,
      target: fTarget || "100", current: fCurrent || "0",
      period: fPeriod,
      history: [{ date: today, value: fCurrent || "0" }],
    }]});
    setFTitle(""); setFDesc(""); setFTarget(""); setFCurrent(""); setFPeriod("monthly"); setShowAdd(false);
  }

  function updateCurrent(i: number, val: string) {
    const kpis = [...meta.kpis];
    const today = new Date().toISOString().slice(0, 10);
    const hist = [...(kpis[i].history ?? [])];
    // Update today's entry or add new
    const todayIdx = hist.findIndex(h => h.date === today);
    if (todayIdx >= 0) hist[todayIdx] = { date: today, value: val };
    else hist.push({ date: today, value: val });
    kpis[i] = { ...kpis[i], current: val, history: hist };
    setMeta({ ...meta, kpis });
  }

  function getColor(pct: number) {
    if (pct >= 80) return "#3D8C5A";
    if (pct >= 50) return "#D4AF37";
    return "#DC2626";
  }

  // Summary stats
  const avgPct = meta.kpis.length > 0
    ? Math.round(meta.kpis.reduce((s, k) => s + (Number(k.target) > 0 ? Math.min(100, Number(k.current) / Number(k.target) * 100) : 0), 0) / meta.kpis.length)
    : 0;
  const greenCount = meta.kpis.filter(k => { const p = Number(k.target) > 0 ? Number(k.current) / Number(k.target) * 100 : 0; return p >= 80; }).length;
  const redCount = meta.kpis.filter(k => { const p = Number(k.target) > 0 ? Number(k.current) / Number(k.target) * 100 : 0; return p < 50; }).length;

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        {/* Header + add button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>مؤشرات الأداء</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{meta.kpis.length} مؤشر · متوسط التقدم {avgPct}%</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + مؤشر جديد
          </button>
        </div>

        {/* Summary cards */}
        {meta.kpis.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>متوسط التقدم</p>
              <p className="text-xl font-black" style={{ color: getColor(avgPct) }}>{avgPct}%</p>
            </div>
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>محققة (≥80%)</p>
              <p className="text-xl font-black text-[#3D8C5A]">{greenCount}</p>
            </div>
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>متأخرة (&lt;50%)</p>
              <p className="text-xl font-black text-[#DC2626]">{redCount}</p>
            </div>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="rounded-2xl p-5 border-2 space-y-3 fade-up" style={{ borderColor: "#2D6B9E40", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>مؤشر أداء جديد</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={add} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>إضافة</button>
              </div>
            </div>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="اسم المؤشر *"
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
            <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="الوصف (اختياري)"
              className="w-full px-4 py-2 rounded-xl border text-xs focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <div className="flex gap-2">
              <input value={fTarget} onChange={e => setFTarget(e.target.value)} placeholder="القيمة المستهدفة" type="number"
                className="flex-1 px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              <input value={fCurrent} onChange={e => setFCurrent(e.target.value)} placeholder="القيمة الحالية" type="number"
                className="flex-1 px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            </div>
            <div className="flex gap-1.5">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setFPeriod(p.key)}
                  className="flex-1 py-2 rounded-xl text-[10px] font-semibold transition"
                  style={{ background: fPeriod === p.key ? "#2D6B9E" : "#F3F4F6", color: fPeriod === p.key ? "#fff" : "#6B7280" }}>{p.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {meta.kpis.map((k, i) => {
          const pct = Number(k.target) > 0 ? Math.min(100, Math.round(Number(k.current) / Number(k.target) * 100)) : 0;
          const color = getColor(pct);
          const hist = k.history ?? [];
          const maxVal = Math.max(Number(k.target), ...hist.map(h => Number(h.value)), 1);
          const periodLabel = PERIODS.find(p => p.key === k.period)?.label ?? "شهري";

          return (
            <div key={i} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="p-5">
                {/* Title row */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>📊 {k.title}</p>
                    {k.description && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{k.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>{periodLabel}</span>
                    <button onClick={() => { const kpis = [...meta.kpis]; kpis.splice(i, 1); setMeta({ ...meta, kpis }); }}
                      className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
                  </div>
                </div>

                {/* Big number + progress */}
                <div className="flex items-end gap-4 mt-3 mb-3">
                  <div>
                    <span className="text-3xl font-black" style={{ color }}>{k.current}</span>
                    <span className="text-sm font-medium mr-1" style={{ color: "var(--muted)" }}>/ {k.target}</span>
                  </div>
                  <span className="text-lg font-black mb-1" style={{ color }}>{pct}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: `${color}15` }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>

                {/* Mini chart */}
                {hist.length > 1 && (
                  <div className="mb-3">
                    <p className="text-[9px] font-semibold mb-1" style={{ color: "var(--muted)" }}>التقدم عبر الزمن</p>
                    <div className="flex items-end gap-[2px] h-12">
                      {hist.slice(-12).map((h, hi) => {
                        const barH = Math.max(4, (Number(h.value) / maxVal) * 48);
                        const barColor = getColor(Number(k.target) > 0 ? (Number(h.value) / Number(k.target)) * 100 : 0);
                        return (
                          <div key={hi} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full rounded-sm transition-all" style={{ height: barH, background: barColor, minWidth: 4 }}
                              title={`${h.date}: ${h.value}`} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[7px]" style={{ color: "var(--muted)" }}>{hist[Math.max(0, hist.length - 12)]?.date?.slice(5)}</span>
                      <span className="text-[7px]" style={{ color: "var(--muted)" }}>{hist[hist.length - 1]?.date?.slice(5)}</span>
                    </div>
                  </div>
                )}

                {/* Update current */}
                <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>تحديث القيمة:</span>
                  <input value={k.current} onChange={e => updateCurrent(i, e.target.value)} type="number"
                    className="w-24 px-3 py-1.5 rounded-lg border text-sm text-center font-bold focus:outline-none"
                    style={{ borderColor: color + "40", background: "var(--bg)", color }} />
                  <div className="flex gap-1">
                    {[25, 50, 75, 100].map(q => {
                      const val = String(Math.round(Number(k.target) * q / 100));
                      return (
                        <button key={q} onClick={() => updateCurrent(i, val)}
                          className="px-2 py-1 rounded text-[9px] font-bold transition"
                          style={{ background: k.current === val ? color : "#F3F4F6", color: k.current === val ? "#fff" : "#6B7280" }}>
                          {q}%
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {meta.kpis.length === 0 && !showAdd && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📊</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد مؤشرات أداء</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>أضف مؤشرات لقياس تقدمك في هذه الوظيفة</p>
          </div>
        )}
      </div>
    </JobPageShell>
  );
}
