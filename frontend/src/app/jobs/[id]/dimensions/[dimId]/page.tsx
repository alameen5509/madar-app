"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { calcDimProgress, calcGoalProgress, type JobDim, type JobGoalData } from "@/components/JobTree";

export default function DimensionPage({ params }: { params: Promise<{ id: string; dimId: string }> }) {
  const { id: jobId, dimId } = use(params);
  const [dims, setDims] = useState<JobDim[]>([]);
  const [goals, setGoals] = useState<JobGoalData[]>([]);
  const [jobName, setJobName] = useState("");
  const [showAddType, setShowAddType] = useState<null | "dim" | "goal">(null);
  const [addName, setAddName] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, g, c] = await Promise.all([
        api.get(`/api/job-dimensions/${jobId}`),
        api.get(`/api/job-goals/${jobId}`),
        api.get("/api/circles"),
      ]);
      setDims(d.data as JobDim[]);
      setGoals(g.data as JobGoalData[]);
      const job = (c.data as { id: string; name: string }[]).find(x => x.id === jobId);
      if (job) setJobName(job.name);
    } catch {}
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const dim = dims.find(d => d.id === dimId);
  const subDims = dims.filter(d => d.parentDimensionId === dimId);
  const directGoals = goals.filter(g => g.dimensionId === dimId && !g.parentGoalId);
  const progress = calcDimProgress(dimId, dims, goals);

  // Build breadcrumb chain
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
    await api.post(`/api/job-dimensions/${dimId}/child`, { name: addName.trim() }).catch(() => {});
    setAddName(""); setShowAddType(null); load();
  }

  async function addGoal() {
    if (!addName.trim()) return;
    await api.post(`/api/job-dimensions/${dimId}/goal`, { title: addName.trim() }).catch(() => {});
    setAddName(""); setShowAddType(null); load();
  }

  if (!dim) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  const color = dim.color || "#2D6B9E";

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[10px] mb-2 flex-wrap">
          <Link href="/jobs" className="hover:underline" style={{ color: "var(--muted)" }}>الوظائف</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/jobs/${jobId}`} className="hover:underline" style={{ color: "var(--muted)" }}>{jobName}</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/jobs/${jobId}/dimensions`} className="hover:underline" style={{ color: "var(--muted)" }}>الجوانب</Link>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <span style={{ color: "var(--muted)" }}>←</span>
              {i < breadcrumb.length - 1 ? (
                <Link href={`/jobs/${jobId}/dimensions/${b.id}`} className="hover:underline" style={{ color: "var(--muted)" }}>{b.name}</Link>
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
        {/* Add button */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddType(showAddType === "dim" ? null : "dim")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: color }}>+ جانب فرعي</button>
          <button onClick={() => setShowAddType(showAddType === "goal" ? null : "goal")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#D4AF37" }}>+ هدف</button>
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

        {/* Sub-dimensions */}
        {subDims.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>📁 الجوانب الفرعية ({subDims.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subDims.map(sd => {
                const sdp = calcDimProgress(sd.id, dims, goals);
                const sdGoals = goals.filter(g => g.dimensionId === sd.id);
                const sdSubs = dims.filter(d => d.parentDimensionId === sd.id);
                return (
                  <Link key={sd.id} href={`/jobs/${jobId}/dimensions/${sd.id}`}
                    className="group rounded-2xl p-4 border transition-all hover:shadow-md hover:border-[#2D6B9E]"
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
                    <p className="text-[10px] mt-2 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color }}>فتح ←</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Goals */}
        {directGoals.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>🎯 الأهداف ({directGoals.length})</p>
            <div className="space-y-3">
              {directGoals.map(g => {
                const gp = calcGoalProgress(g.id, goals);
                const subs = goals.filter(sg => sg.parentGoalId === g.id);
                const gc = gp >= 100 ? "#3D8C5A" : gp >= 50 ? "#2D6B9E" : "#D4AF37";
                return (
                  <Link key={g.id} href={`/jobs/${jobId}/goals/${g.id}`}
                    className="group block rounded-2xl p-4 border transition-all hover:shadow-md hover:border-[#D4AF37]"
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
                    <p className="text-[10px] mt-2 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color: "#D4AF37" }}>فتح ←</p>
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
