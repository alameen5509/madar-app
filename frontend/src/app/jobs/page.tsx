"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getCircles, createCircle, updateCircle, deleteCircle, api, type LifeCircle, type CreateCirclePayload } from "@/lib/api";
import { JobDimensionNode, calcJobProgress, calcDimProgress, type JobDim, type JobGoalData } from "@/components/JobTree";

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
  const [jobTab, setJobTab] = useState<"dims" | "team" | "kpi" | "achievements" | "skills" | "meetings" | "lessons">("dims");
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string; type: "job" | "dim" }[]>([]);
  // Inline form states for tabs
  const [addField, setAddField] = useState("");
  const [addField2, setAddField2] = useState("");
  const [addField3, setAddField3] = useState("");
  // Local data for simple tabs (stored in user preferences)
  const [jobMeta, setJobMeta] = useState<Record<string, { team: {name:string;role:string}[]; kpis: {title:string;target:string;current:string}[]; achievements: {title:string;date:string}[]; skills: string[]; meetings: {title:string;date:string;notes:string}[]; lessons: string[] }>>({});

  function getJobMeta(jobId: string) {
    return jobMeta[jobId] ?? { team: [], kpis: [], achievements: [], skills: [], meetings: [], lessons: [] };
  }
  function setMeta(jobId: string, data: ReturnType<typeof getJobMeta>) {
    const updated = { ...jobMeta, [jobId]: data };
    setJobMeta(updated);
    // Save to API
    api.put("/api/users/me/preferences", { jobMeta: updated }).catch(() => {});
  }

  // Load jobMeta from preferences on mount
  useEffect(() => {
    api.get("/api/users/me/preferences").then(({ data }) => {
      if (data?.jobMeta) setJobMeta(data.jobMeta);
    }).catch(() => {});
  }, []);

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

  function toggleExpand(jobId: string, jobName: string) {
    if (expandedJob === jobId) { setExpandedJob(null); setBreadcrumb([]); return; }
    setExpandedJob(jobId);
    setBreadcrumb([{ id: jobId, name: jobName, type: "job" }]);
    setJobTab("dims");
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
                      <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>{job.name}</h3>
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
                    <button onClick={() => toggleExpand(job.id, job.name)}
                      className="text-[10px] px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: expandedJob === job.id ? "#2D6B9E" : "#2D6B9E15", color: expandedJob === job.id ? "#fff" : "#2D6B9E" }}>
                      {expandedJob === job.id ? "▲ طي" : "▼ الجوانب"}
                    </button>
                    <button onClick={() => toggleActive(job)}
                      className="text-[10px] px-2 py-1 rounded-lg font-semibold"
                      style={{ background: job.isActive ? "#D4AF3715" : "#3D8C5A15", color: job.isActive ? "#D4AF37" : "#3D8C5A" }}>
                      {job.isActive ? "إيقاف" : "تفعيل"}
                    </button>
                    <button onClick={() => handleDelete(job.id)} className="text-[#9CA3AF] hover:text-red-500 text-xs">✕</button>
                  </div>
                </div>

                {/* ═══ Dimensions & Goals Panel ═══ */}
                {expandedJob === job.id && (() => {
                  const calcProgress = calcJobProgress(job.id, jobDims, jobGoals);
                  const rootDims = jobDims.filter(d => !d.parentDimensionId);

                  return (
                    <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--card-border)" }}>
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-1 pt-3 pb-2 text-[10px] flex-wrap">
                        <span className="text-[#6B7280]">الوظائف</span>
                        {breadcrumb.map((b, i) => (
                          <span key={b.id} className="flex items-center gap-1">
                            <span className="text-[#6B7280]">←</span>
                            <button onClick={() => setBreadcrumb(breadcrumb.slice(0, i + 1))}
                              className="font-semibold hover:underline" style={{ color: "#2D6B9E" }}>{b.name}</button>
                          </span>
                        ))}
                      </div>

                      {/* Job progress from dimensions */}
                      <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: "#2D6B9E08", border: "1px solid #2D6B9E20" }}>
                        <span className="text-sm font-bold" style={{ color: "#2D6B9E" }}>تقدم الوظيفة</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#2D6B9E20" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${calcProgress}%`, background: "#2D6B9E" }} />
                        </div>
                        <span className="text-sm font-black" style={{ color: "#2D6B9E" }}>{calcProgress}%</span>
                      </div>

                      {/* Tabs */}
                      {(() => {
                        const TABS = [
                          { key: "dims" as const, label: "الجوانب والأهداف", icon: "📁" },
                          { key: "team" as const, label: "الفريق", icon: "👥" },
                          { key: "kpi" as const, label: "مؤشرات الأداء", icon: "📊" },
                          { key: "achievements" as const, label: "الإنجازات", icon: "🏆" },
                          { key: "skills" as const, label: "المهارات", icon: "💡" },
                          { key: "meetings" as const, label: "الاجتماعات", icon: "📅" },
                          { key: "lessons" as const, label: "الدروس المستفادة", icon: "📝" },
                        ];
                        const meta = getJobMeta(job.id);
                        return (
                          <>
                            <div className="flex gap-1.5 mb-4 flex-wrap">
                              {TABS.map(t => (
                                <button key={t.key} onClick={() => setJobTab(t.key)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition"
                                  style={{ background: jobTab === t.key ? "#2D6B9E" : "#F3F4F6", color: jobTab === t.key ? "#fff" : "#6B7280" }}>
                                  {t.icon} {t.label}
                                </button>
                              ))}
                            </div>

                            {/* ═══ TAB: Dims ═══ */}
                            {jobTab === "dims" && (
                              <div className="space-y-1">
                                {rootDims.map(d => (
                                  <JobDimensionNode key={d.id} dim={d} allDims={jobDims} allGoals={jobGoals}
                                    level={0} onRefresh={() => loadJobTree(job.id)} />
                                ))}
                                <div className="flex items-center gap-2 pt-3 mt-2" style={{ borderTop: "1px dashed var(--card-border)" }}>
                                  <input value={addDimName} onChange={e => setAddDimName(e.target.value)}
                                    placeholder="اسم جانب رئيسي جديد…"
                                    onKeyDown={e => { if (e.key === "Enter") addRootDim(job.id); }}
                                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
                                    style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <button onClick={() => addRootDim(job.id)} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ جانب</button>
                                </div>
                                {rootDims.length === 0 && <p className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>لا توجد جوانب — أضف أول جانب لهذه الوظيفة</p>}
                              </div>
                            )}

                            {/* ═══ TAB: Team ═══ */}
                            {jobTab === "team" && (
                              <div className="space-y-3">
                                {meta.team.map((m, i) => (
                                  <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border" style={{ borderColor: "var(--card-border)" }}>
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#2D6B9E" }}>{m.name[0]}</div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{m.name}</p>
                                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.role}</p>
                                    </div>
                                    <button onClick={() => { const t = [...meta.team]; t.splice(i, 1); setMeta(job.id, { ...meta, team: t }); }}
                                      className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="الاسم"
                                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <select value={addField2} onChange={e => setAddField2(e.target.value)}
                                    className="px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
                                    <option value="">الدور</option>
                                    <option value="مدير">مدير</option>
                                    <option value="شريك">شريك</option>
                                    <option value="موظف">موظف</option>
                                    <option value="عميل">عميل</option>
                                    <option value="مستشار">مستشار</option>
                                  </select>
                                  <button onClick={() => { if (!addField.trim() || !addField2) return; setMeta(job.id, { ...meta, team: [...meta.team, { name: addField.trim(), role: addField2 }] }); setAddField(""); setAddField2(""); }}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ إضافة</button>
                                </div>
                                {meta.team.length === 0 && <p className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>لا يوجد أعضاء — أضف فريقك</p>}
                              </div>
                            )}

                            {/* ═══ TAB: KPIs ═══ */}
                            {jobTab === "kpi" && (
                              <div className="space-y-3">
                                {meta.kpis.map((k, i) => {
                                  const pct = Number(k.target) > 0 ? Math.min(100, Math.round(Number(k.current) / Number(k.target) * 100)) : 0;
                                  return (
                                    <div key={i} className="bg-white rounded-xl px-4 py-3 border" style={{ borderColor: "var(--card-border)" }}>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{k.title}</p>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold" style={{ color: pct >= 100 ? "#3D8C5A" : "#2D6B9E" }}>{k.current}/{k.target}</span>
                                          <button onClick={() => { const kpis = [...meta.kpis]; kpis.splice(i, 1); setMeta(job.id, { ...meta, kpis }); }}
                                            className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                        </div>
                                      </div>
                                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2D6B9E20" }}>
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#3D8C5A" : "#2D6B9E" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="flex gap-2">
                                  <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="اسم المؤشر"
                                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <input value={addField2} onChange={e => setAddField2(e.target.value)} placeholder="الهدف" type="number"
                                    className="w-20 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <input value={addField3} onChange={e => setAddField3(e.target.value)} placeholder="الحالي" type="number"
                                    className="w-20 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <button onClick={() => { if (!addField.trim()) return; setMeta(job.id, { ...meta, kpis: [...meta.kpis, { title: addField.trim(), target: addField2 || "100", current: addField3 || "0" }] }); setAddField(""); setAddField2(""); setAddField3(""); }}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
                                </div>
                              </div>
                            )}

                            {/* ═══ TAB: Achievements ═══ */}
                            {jobTab === "achievements" && (
                              <div className="space-y-3">
                                {meta.achievements.map((a, i) => (
                                  <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border" style={{ borderColor: "var(--card-border)" }}>
                                    <span className="text-lg">🏆</span>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{a.title}</p>
                                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{a.date}</p>
                                    </div>
                                    <button onClick={() => { const arr = [...meta.achievements]; arr.splice(i, 1); setMeta(job.id, { ...meta, achievements: arr }); }}
                                      className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="الإنجاز"
                                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <input type="date" value={addField2} onChange={e => setAddField2(e.target.value)}
                                    className="px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <button onClick={() => { if (!addField.trim()) return; setMeta(job.id, { ...meta, achievements: [...meta.achievements, { title: addField.trim(), date: addField2 || new Date().toISOString().slice(0, 10) }] }); setAddField(""); setAddField2(""); }}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
                                </div>
                              </div>
                            )}

                            {/* ═══ TAB: Skills ═══ */}
                            {jobTab === "skills" && (
                              <div className="space-y-3">
                                <div className="flex gap-2 flex-wrap">
                                  {meta.skills.map((s, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>
                                      💡 {s}
                                      <button onClick={() => { const arr = [...meta.skills]; arr.splice(i, 1); setMeta(job.id, { ...meta, skills: arr }); }}
                                        className="text-red-300 hover:text-red-500 mr-1">✕</button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="مهارة جديدة"
                                    onKeyDown={e => { if (e.key === "Enter" && addField.trim()) { setMeta(job.id, { ...meta, skills: [...meta.skills, addField.trim()] }); setAddField(""); } }}
                                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <button onClick={() => { if (!addField.trim()) return; setMeta(job.id, { ...meta, skills: [...meta.skills, addField.trim()] }); setAddField(""); }}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
                                </div>
                              </div>
                            )}

                            {/* ═══ TAB: Meetings ═══ */}
                            {jobTab === "meetings" && (
                              <div className="space-y-3">
                                {meta.meetings.map((m, i) => (
                                  <div key={i} className="bg-white rounded-xl px-4 py-3 border" style={{ borderColor: "var(--card-border)" }}>
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>📅 {m.title}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>{m.date}</span>
                                        <button onClick={() => { const arr = [...meta.meetings]; arr.splice(i, 1); setMeta(job.id, { ...meta, meetings: arr }); }}
                                          className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                      </div>
                                    </div>
                                    {m.notes && <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.notes}</p>}
                                  </div>
                                ))}
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="عنوان الاجتماع"
                                      className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                    <input type="date" value={addField2} onChange={e => setAddField2(e.target.value)}
                                      className="px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  </div>
                                  <div className="flex gap-2">
                                    <input value={addField3} onChange={e => setAddField3(e.target.value)} placeholder="ملاحظات (اختياري)"
                                      className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                    <button onClick={() => { if (!addField.trim()) return; setMeta(job.id, { ...meta, meetings: [...meta.meetings, { title: addField.trim(), date: addField2 || new Date().toISOString().slice(0, 10), notes: addField3.trim() }] }); setAddField(""); setAddField2(""); setAddField3(""); }}
                                      className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ إضافة</button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ═══ TAB: Lessons ═══ */}
                            {jobTab === "lessons" && (
                              <div className="space-y-3">
                                {meta.lessons.map((l, i) => (
                                  <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border" style={{ borderColor: "var(--card-border)" }}>
                                    <span className="text-sm">📝</span>
                                    <p className="text-sm flex-1" style={{ color: "var(--text)" }}>{l}</p>
                                    <button onClick={() => { const arr = [...meta.lessons]; arr.splice(i, 1); setMeta(job.id, { ...meta, lessons: arr }); }}
                                      className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="درس مستفاد…"
                                    onKeyDown={e => { if (e.key === "Enter" && addField.trim()) { setMeta(job.id, { ...meta, lessons: [...meta.lessons, addField.trim()] }); setAddField(""); } }}
                                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                                  <button onClick={() => { if (!addField.trim()) return; setMeta(job.id, { ...meta, lessons: [...meta.lessons, addField.trim()] }); setAddField(""); }}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}
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
