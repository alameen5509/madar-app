"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

export default function KPIsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");

  function add() {
    if (!title.trim()) return;
    setMeta({ ...meta, kpis: [...meta.kpis, { title: title.trim(), target: target || "100", current: current || "0" }] });
    setTitle(""); setTarget(""); setCurrent("");
  }

  function updateCurrent(i: number, val: string) {
    const kpis = [...meta.kpis];
    kpis[i] = { ...kpis[i], current: val };
    setMeta({ ...meta, kpis });
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        {/* Add */}
        <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>إضافة مؤشر أداء</p>
          <div className="flex gap-2 flex-wrap">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم المؤشر"
              onKeyDown={e => { if (e.key === "Enter") add(); }}
              className="flex-1 min-w-[160px] px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="الهدف" type="number"
              className="w-24 px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input value={current} onChange={e => setCurrent(e.target.value)} placeholder="الحالي" type="number"
              className="w-24 px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <button onClick={add} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
          </div>
        </div>

        {/* KPIs */}
        {meta.kpis.map((k, i) => {
          const pct = Number(k.target) > 0 ? Math.min(100, Math.round(Number(k.current) / Number(k.target) * 100)) : 0;
          const color = pct >= 100 ? "#3D8C5A" : pct >= 60 ? "#2D6B9E" : pct >= 30 ? "#D4AF37" : "#DC2626";
          return (
            <div key={i} className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>📊 {k.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black" style={{ color }}>{pct}%</span>
                  <button onClick={() => { const kpis = [...meta.kpis]; kpis.splice(i, 1); setMeta({ ...meta, kpis }); }}
                    className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: `${color}20` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>الحالي:</span>
                <input value={k.current} onChange={e => updateCurrent(i, e.target.value)} type="number"
                  className="w-20 px-2 py-1 rounded-lg border text-xs text-center focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>/ {k.target}</span>
              </div>
            </div>
          );
        })}

        {meta.kpis.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد مؤشرات — أضف أول مؤشر أداء</p>}
      </div>
    </JobPageShell>
  );
}
