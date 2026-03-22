"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import JobPageShell, { useJobData } from "@/components/JobPageShell";
import { calcDimProgress } from "@/components/JobTree";

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
      {/* Header + add */}
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

      {/* Add form */}
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

      {/* Dimension cards — clickable to navigate */}
      <div className="space-y-3">
        {rootDims.map(d => {
          const dp = calcDimProgress(d.id, dims, goals);
          const dimGoals = goals.filter(g => g.dimensionId === d.id && !g.parentGoalId);
          const subDims = dims.filter(sd => sd.parentDimensionId === d.id);
          const color = d.color || "#2D6B9E";
          return (
            <Link key={d.id} href={`/jobs/${id}/dimensions/${d.id}`}
              className="group block rounded-2xl p-5 border transition-all hover:shadow-lg hover:border-[#2D6B9E]"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: color + "12" }}>{d.icon || "📁"}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{d.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                    {subDims.length} جانب فرعي · {dimGoals.length} هدف
                  </p>
                </div>
                <span className="text-lg font-black" style={{ color }}>{dp}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: color + "15" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${dp}%`, background: color }} />
              </div>

              {/* Preview: first 3 goals */}
              {dimGoals.length > 0 && (
                <div className="mt-3 space-y-1">
                  {dimGoals.slice(0, 3).map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-[10px]">
                      <span>🎯</span>
                      <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{g.title}</span>
                      <span className="font-bold" style={{ color: g.progress >= 100 ? "#3D8C5A" : "#6B7280" }}>{g.progress}%</span>
                    </div>
                  ))}
                  {dimGoals.length > 3 && (
                    <p className="text-[9px]" style={{ color: "var(--muted)" }}>و {dimGoals.length - 3} أهداف أخرى...</p>
                  )}
                </div>
              )}

              <p className="text-[10px] mt-3 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color }}>فتح الجانب ←</p>
            </Link>
          );
        })}
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
