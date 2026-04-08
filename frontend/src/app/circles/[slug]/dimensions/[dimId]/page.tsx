"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { calcDimProgress, calcGoalProgress, type RoleDim, type RoleGoalData } from "@/components/RoleTree";

export default function RoleDimensionPage({ params }: { params: Promise<{ slug: string; dimId: string }> }) {
  const { slug, dimId } = use(params);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#5E5495");
  const [dims, setDims] = useState<RoleDim[]>([]);
  const [goals, setGoals] = useState<RoleGoalData[]>([]);
  const [showAddType, setShowAddType] = useState<null | "dim" | "goal">(null);
  const [addName, setAddName] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/api/circle-groups/circles/${slug}`);
      const rid = r.data?.id as string;
      setRoleId(rid);
      setRoleName(r.data?.name ?? "");
      setRoleColor(r.data?.color ?? "#5E5495");
      if (rid) {
        const [d, g] = await Promise.all([
          api.get(`/api/role-dimensions/${rid}`),
          api.get(`/api/role-goals/${rid}`),
        ]);
        setDims(d.data as RoleDim[]);
        setGoals(g.data as RoleGoalData[]);
      }
    } catch {}
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const dim = dims.find(d => d.id === dimId);
  const subDims = dims.filter(d => d.parentDimensionId === dimId);
  const directGoals = goals.filter(g => g.dimensionId === dimId && !g.parentGoalId);
  const progress = calcDimProgress(dimId, dims, goals);

  const breadcrumb: { id: string; name: string }[] = [];
  {
    let cur = dim;
    while (cur) {
      breadcrumb.unshift({ id: cur.id, name: cur.name });
      const pid = cur.parentDimensionId;
      cur = pid ? dims.find(d => d.id === pid) : undefined;
    }
  }

  async function addSubDim() {
    if (!addName.trim()) return;
    await api.post(`/api/role-dimensions/${dimId}/child`, { name: addName.trim() }).catch(() => {});
    setAddName(""); setShowAddType(null); load();
  }

  async function addGoal() {
    if (!addName.trim()) return;
    await api.post(`/api/role-dimensions/${dimId}/goal`, { title: addName.trim() }).catch(() => {});
    setAddName(""); setShowAddType(null); load();
  }

  if (!dim) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  const color = dim.color || roleColor;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-1 text-[10px] mb-2 flex-wrap">
          <Link href="/circles" className="hover:underline" style={{ color: "var(--muted)" }}>أدوار الحياة</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/circles/${slug}`} className="hover:underline" style={{ color: "var(--muted)" }}>{roleName}</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/circles/${slug}/dimensions`} className="hover:underline" style={{ color: "var(--muted)" }}>الجوانب</Link>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <span style={{ color: "var(--muted)" }}>←</span>
              {i < breadcrumb.length - 1 ? (
                <Link href={`/circles/${slug}/dimensions/${b.id}`} className="hover:underline" style={{ color: "var(--muted)" }}>{b.name}</Link>
              ) : (
                <span className="font-semibold" style={{ color }}>{b.name}</span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: color + "15" }}>{dim.icon || "📁"}</div>
          <div className="flex-1">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{dim.name}</h2>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{subDims.length} فرعي · {directGoals.length} هدف</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: color + "20" }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: color }} />
            </div>
            <span className="text-sm font-black" style={{ color }}>{progress}%</span>
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddType(showAddType === "dim" ? null : "dim")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: color }}>+ جانب فرعي</button>
          <button onClick={() => setShowAddType(showAddType === "goal" ? null : "goal")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#D4AF37" }}>+ هدف</button>
          <div className="flex-1" />
          <button onClick={async () => {
            if (!confirm(`حذف الجانب "${dim.name}" وكل محتوياته نهائياً؟`)) return;
            try { await api.delete(`/api/role-dimensions/${dimId}`); window.history.back(); } catch { alert("فشل الحذف"); }
          }}
            className="px-3 py-2 rounded-xl text-[10px] font-medium transition hover:bg-red-50"
            style={{ color: "#ef4444", border: "1px solid #ef444430" }}>
            🗑️ حذف الجانب
          </button>
        </div>

        {showAddType && (
          <div className="flex gap-2 p-4 rounded-xl border fade-up" style={{ background: "var(--card)", borderColor: color + "40" }}>
            <input value={addName} onChange={e => setAddName(e.target.value)}
              placeholder={showAddType === "dim" ? "اسم الجانب الفرعي…" : "عنوان الهدف…"}
              onKeyDown={e => { if (e.key === "Enter") showAddType === "dim" ? addSubDim() : addGoal(); }}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
            <button onClick={showAddType === "dim" ? addSubDim : addGoal}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: showAddType === "dim" ? color : "#D4AF37" }}>إضافة</button>
            <button onClick={() => { setShowAddType(null); setAddName(""); }} className="px-3 py-2.5 rounded-xl text-xs text-[#6B7280] bg-gray-100">✕</button>
          </div>
        )}

        {subDims.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>📁 الجوانب الفرعية ({subDims.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subDims.map(sd => {
                const sdp = calcDimProgress(sd.id, dims, goals);
                const sdGoals = goals.filter(g => g.dimensionId === sd.id);
                const sdSubs = dims.filter(d => d.parentDimensionId === sd.id);
                return (
                  <Link key={sd.id} href={`/circles/${slug}/dimensions/${sd.id}`}
                    className="group rounded-2xl p-4 border transition-all hover:shadow-md"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{sd.icon || "📁"}</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{sd.name}</p>
                        <p className="text-[9px]" style={{ color: "var(--muted)" }}>{sdSubs.length} فرعي · {sdGoals.length} هدف</p>
                      </div>
                      <span className="text-xs font-black" style={{ color: sd.color || color }}>{sdp}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: (sd.color || color) + "15" }}>
                      <div className="h-full rounded-full" style={{ width: `${sdp}%`, background: sd.color || color }} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color }}>فتح ←</p>
                      <button onClick={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (!confirm(`حذف "${sd.name}" وكل محتوياته؟`)) return;
                        try { await api.delete(`/api/role-dimensions/${sd.id}`); load(); } catch { alert("فشل الحذف"); }
                      }} className="text-[9px] px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: "#ef4444" }}>🗑️</button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {directGoals.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>🎯 الأهداف ({directGoals.length})</p>
            <div className="space-y-3">
              {directGoals.map(g => {
                const gp = calcGoalProgress(g.id, goals);
                const subs = goals.filter(sg => sg.parentGoalId === g.id);
                const gc = gp >= 100 ? "#3D8C5A" : gp >= 50 ? "#5E5495" : "#D4AF37";
                return (
                  <Link key={g.id} href={`/circles/${slug}/goals/${g.id}`}
                    className="group block rounded-2xl p-4 border transition-all hover:shadow-md"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">🎯</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{g.title}</p>
                        <p className="text-[9px]" style={{ color: "var(--muted)" }}>
                          {subs.length} فرعي · {g.projects.length} مشروع · {g.tasks.length} مهمة
                          {g.timeframe && ` · ${g.timeframe}`}
                        </p>
                      </div>
                      <span className="text-sm font-black" style={{ color: gc }}>{gp}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: gc + "15" }}>
                      <div className="h-full rounded-full" style={{ width: `${gp}%`, background: gc }} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color: "#D4AF37" }}>فتح ←</p>
                      <button onClick={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (!confirm(`حذف الهدف "${g.title}" وكل أهدافه الفرعية؟`)) return;
                        try { await api.delete(`/api/role-goals/${g.id}`); load(); } catch { alert("فشل الحذف"); }
                      }} className="text-[9px] px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: "#ef4444" }}>🗑️</button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {subDims.length === 0 && directGoals.length === 0 && !showAddType && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📁</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>جانب فارغ</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>أضف جوانب فرعية أو أهداف</p>
          </div>
        )}
      </div>
    </main>
  );
}
