"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import RolePageShell, { useRoleData } from "@/components/RolePageShell";
import { calcDimProgress } from "@/components/RoleTree";

export default function RoleDimensionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role, dims, goals, refresh } = useRoleData(slug);
  const [addName, setAddName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const rootDims = dims.filter(d => !d.parentDimensionId);
  const color = role?.color ?? "#5E5495";

  async function addRootDim() {
    if (!addName.trim() || !role?.id) return;
    await api.post(`/api/roles/${role.id}/dimensions`, { name: addName.trim() }).catch(() => {});
    setAddName(""); setShowAdd(false); refresh();
  }

  return (
    <RolePageShell slug={slug}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>الجوانب والأهداف</p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{rootDims.length} جانب رئيسي · {goals.length} هدف</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${color}, #C9A84C)` }}>
          + جانب رئيسي
        </button>
      </div>

      {showAdd && (
        <div className="flex items-center gap-2 mb-4 p-4 rounded-xl border fade-up" style={{ background: "var(--card)", borderColor: color + "40" }}>
          <input value={addName} onChange={e => setAddName(e.target.value)}
            placeholder="اسم الجانب الرئيسي…"
            onKeyDown={e => { if (e.key === "Enter") addRootDim(); if (e.key === "Escape") setShowAdd(false); }}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}
            autoFocus />
          <button onClick={addRootDim} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: color }}>إضافة</button>
          <button onClick={() => { setShowAdd(false); setAddName(""); }} className="px-3 py-2.5 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
        </div>
      )}

      <div className="space-y-3">
        {rootDims.map(d => {
          const dp = calcDimProgress(d.id, dims, goals);
          const dimGoals = goals.filter(g => g.dimensionId === d.id && !g.parentGoalId);
          const subDims = dims.filter(sd => sd.parentDimensionId === d.id);
          const dc = d.color || color;
          return (
            <Link key={d.id} href={`/circles/${slug}/dimensions/${d.id}`}
              className="group block rounded-2xl p-5 border transition-all hover:shadow-lg"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: dc + "12" }}>{d.icon || "📁"}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{d.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                    {subDims.length} جانب فرعي · {dimGoals.length} هدف
                  </p>
                </div>
                <span className="text-lg font-black" style={{ color: dc }}>{dp}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: dc + "15" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${dp}%`, background: dc }} />
              </div>

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

              <div className="flex items-center justify-between mt-3">
                <p className="text-[10px] font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color: dc }}>فتح الجانب ←</p>
                <button onClick={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (!confirm(`حذف الجانب "${d.name}" وكل محتوياته؟`)) return;
                  try { await api.delete(`/api/role-dimensions/${d.id}`); refresh(); } catch { alert("فشل الحذف"); }
                }}
                  className="text-[10px] px-3 py-1.5 rounded-lg font-medium transition hover:bg-red-50"
                  style={{ color: "#ef4444", border: "1px solid #ef444430" }}>
                  🗑️ حذف
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      {rootDims.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📁</p>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد جوانب</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>أضف أول جانب لتبدأ بتنظيم أهداف هذا الدور</p>
        </div>
      )}
    </RolePageShell>
  );
}
