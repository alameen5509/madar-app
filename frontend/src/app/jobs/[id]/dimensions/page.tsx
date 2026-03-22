"use client";

import { use, useState } from "react";
import { api } from "@/lib/api";
import JobPageShell, { useJobData } from "@/components/JobPageShell";
import { JobDimensionNode, calcDimProgress } from "@/components/JobTree";

export default function DimensionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { dims, goals, refresh } = useJobData(id);
  const [addName, setAddName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const rootDims = dims.filter(d => !d.parentDimensionId);

  async function addRootDim() {
    if (!addName.trim()) return;
    await api.post(`/api/jobs/${id}/dimensions`, { name: addName.trim() }).catch(() => {});
    setAddName("");
    setShowAdd(false);
    refresh();
  }

  return (
    <JobPageShell jobId={id}>
      {/* Top bar — add button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>الجوانب والأهداف</p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{rootDims.length} جانب رئيسي · {goals.length} هدف</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
          + جانب رئيسي
        </button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="flex items-center gap-2 mb-4 p-4 rounded-xl border fade-up" style={{ background: "var(--card)", borderColor: "#2D6B9E40" }}>
          <input value={addName} onChange={e => setAddName(e.target.value)}
            placeholder="اسم الجانب الرئيسي…"
            onKeyDown={e => { if (e.key === "Enter") addRootDim(); if (e.key === "Escape") setShowAdd(false); }}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}
            autoFocus />
          <button onClick={addRootDim} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>إضافة</button>
          <button onClick={() => { setShowAdd(false); setAddName(""); }} className="px-3 py-2.5 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
        </div>
      )}

      {/* Dimension summary cards */}
      {rootDims.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {rootDims.map(d => {
            const dp = calcDimProgress(d.id, dims, goals);
            const dimGoals = goals.filter(g => g.dimensionId === d.id);
            const subDims = dims.filter(sd => sd.parentDimensionId === d.id);
            return (
              <div key={d.id} className="rounded-xl p-3 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{d.icon || "📁"}</span>
                  <span className="text-[11px] font-bold flex-1 truncate" style={{ color: "var(--text)" }}>{d.name}</span>
                  <span className="text-[10px] font-black" style={{ color: d.color || "#2D6B9E" }}>{dp}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${d.color || "#2D6B9E"}15` }}>
                  <div className="h-full rounded-full" style={{ width: `${dp}%`, background: d.color || "#2D6B9E" }} />
                </div>
                <p className="text-[9px] mt-1.5" style={{ color: "var(--muted)" }}>{dimGoals.length} هدف · {subDims.length} فرعي</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tree */}
      <div className="space-y-1">
        {rootDims.map(d => (
          <JobDimensionNode key={d.id} dim={d} allDims={dims} allGoals={goals}
            level={0} onRefresh={refresh} />
        ))}
      </div>

      {rootDims.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📁</p>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد جوانب</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>أضف أول جانب لتبدأ بتنظيم أهدافك</p>
        </div>
      )}
    </JobPageShell>
  );
}
