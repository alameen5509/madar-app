"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getCircles, createCircle, updateCircle, deleteCircle, api, type LifeCircle, type CreateCirclePayload } from "@/lib/api";
import { JobDimensionNode, type JobDim, type JobGoalData } from "@/components/JobTree";

export default function JobsPage() {
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobDims, setJobDims] = useState<JobDim[]>([]);
  const [jobGoals, setJobGoals] = useState<JobGoalData[]>([]);
  const [addDimName, setAddDimName] = useState("");

  async function loadJobTree(jobId: string) {
    try {
      const [d, g] = await Promise.all([
        api.get(`/api/job-dimensions/${jobId}`),
        api.get(`/api/job-goals/${jobId}`),
      ]);
      setJobDims(d.data as JobDim[]);
      setJobGoals(g.data as JobGoalData[]);
    } catch {}
  }

  function toggleExpand(jobId: string) {
    if (expandedJob === jobId) { setExpandedJob(null); return; }
    setExpandedJob(jobId);
    loadJobTree(jobId);
  }

  async function addRootDim(jobId: string) {
    if (!addDimName.trim()) return;
    await api.post(`/api/jobs/${jobId}/dimensions`, { name: addDimName.trim() }).catch(() => {});
    setAddDimName("");
    loadJobTree(jobId);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const data = await getCircles(); setCircles(data); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const jobs = circles.filter(c => c.tier === "Business");
  const filtered = filter === "all" ? jobs : filter === "active" ? jobs.filter(j => j.isActive) : jobs.filter(j => !j.isActive);
  const activeCount = jobs.filter(j => j.isActive).length;
  const totalTasks = jobs.reduce((s, j) => s + j.taskCount, 0);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createCircle({ name: newName.trim(), description: newDesc.trim() || undefined, tier: "Business", iconKey: "💼", colorHex: "#2D6B9E" } as CreateCirclePayload);
      setNewName(""); setNewDesc(""); setShowNew(false);
      fetchData();
    } catch {}
  }

  async function toggleActive(job: LifeCircle) {
    try { await updateCircle(job.id, { isActive: !job.isActive } as Partial<LifeCircle>); fetchData(); } catch {}
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذه الوظيفة؟")) return;
    try { await deleteCircle(id); fetchData(); } catch {}
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>الوظائف</h2>
            {!loading && <p className="text-xs" style={{ color: "var(--muted)" }}>{activeCount} نشطة · {totalTasks} مهمة</p>}
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + وظيفة جديدة
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">
        <div className="flex gap-2 flex-wrap">
          {[{ key: "all", label: `الكل (${jobs.length})` }, { key: "active", label: `نشطة (${activeCount})` }, { key: "inactive", label: `سابقة (${jobs.length - activeCount})` }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
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
            <p className="font-semibold" style={{ color: "var(--text)" }}>لا توجد وظائف</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(job => {
            const pending = job.taskCount - Math.round(job.taskCount * job.progressPercent / 100);
            return (
              <div key={job.id} className="rounded-2xl border overflow-hidden transition-all hover:shadow-md"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: "#2D6B9E15" }}>💼</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{job.name}</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: job.isActive ? "#3D8C5A15" : "#6B728015", color: job.isActive ? "#3D8C5A" : "#6B7280" }}>
                        {job.isActive ? "نشطة" : "متوقفة"}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                      {job.goalCount} هدف · {job.taskCount} مهمة{pending > 0 ? ` · ${pending} معلقة` : ""}
                    </p>
                    <div className="mt-2 rounded-full h-1.5 overflow-hidden" style={{ background: "#2D6B9E15" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${job.progressPercent}%`, background: "#2D6B9E" }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-lg font-black" style={{ color: "#2D6B9E" }}>{job.progressPercent}%</span>
                    <button onClick={() => toggleExpand(job.id)}
                      className="text-[10px] px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: expandedJob === job.id ? "#2D6B9E" : "#2D6B9E15", color: expandedJob === job.id ? "#fff" : "#2D6B9E" }}>
                      {expandedJob === job.id ? "▲ طي" : "▼ الجوانب"}
                    </button>
                    <Link href={`/circles/${job.id}`}
                      className="text-[10px] px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>فتح ←</Link>
                    <button onClick={() => toggleActive(job)}
                      className="text-[10px] px-2 py-1 rounded-lg font-semibold"
                      style={{ background: job.isActive ? "#D4AF3715" : "#3D8C5A15", color: job.isActive ? "#D4AF37" : "#3D8C5A" }}>
                      {job.isActive ? "إيقاف" : "تفعيل"}
                    </button>
                    <button onClick={() => handleDelete(job.id)} className="text-[#9CA3AF] hover:text-red-500 text-xs">✕</button>
                  </div>
                </div>

                {/* ═══ Dimensions Tree ═══ */}
                {expandedJob === job.id && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--card-border)" }}>
                    <div className="pt-4 space-y-1">
                      {/* Root dimensions */}
                      {jobDims.filter(d => !d.parentDimensionId).map(d => (
                        <JobDimensionNode key={d.id} dim={d} allDims={jobDims} allGoals={jobGoals}
                          level={0} onRefresh={() => loadJobTree(job.id)} />
                      ))}

                      {/* Add root dimension */}
                      <div className="flex items-center gap-2 pt-3 mt-2" style={{ borderTop: "1px dashed var(--card-border)" }}>
                        <input value={addDimName} onChange={e => setAddDimName(e.target.value)}
                          placeholder="اسم جانب رئيسي جديد…"
                          onKeyDown={e => { if (e.key === "Enter") addRootDim(job.id); }}
                          className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
                          style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                        <button onClick={() => addRootDim(job.id)}
                          className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                          style={{ background: "#2D6B9E" }}>
                          + جانب
                        </button>
                      </div>

                      {jobDims.length === 0 && (
                        <p className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>
                          لا توجد جوانب — أضف أول جانب لهذه الوظيفة
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md fade-up"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
              <h3 className="font-bold" style={{ color: "var(--text)" }}>💼 وظيفة جديدة</h3>
              <button onClick={() => setShowNew(false)} style={{ color: "var(--muted)" }}>✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم الوظيفة"
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="وصف (اختياري)" rows={2}
                className="w-full px-4 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>إنشاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
