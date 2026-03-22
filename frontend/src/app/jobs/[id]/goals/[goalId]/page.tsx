"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { calcGoalProgress, type JobDim, type JobGoalData } from "@/components/JobTree";

interface ProjectInfo { id: string; title: string; description?: string; status?: string; progressPercent?: number; targetDate?: string; }
interface TaskInfo { id: string; title: string; status: string; description?: string; dueDate?: string; priority?: string; }

export default function GoalPage({ params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: jobId, goalId } = use(params);
  const [dims, setDims] = useState<JobDim[]>([]);
  const [goals, setGoals] = useState<JobGoalData[]>([]);
  const [jobName, setJobName] = useState("");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [showAddType, setShowAddType] = useState<null | "subgoal" | "project" | "task" | "newproject" | "newtask">(null);
  const [addVal, setAddVal] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addPriority, setAddPriority] = useState(3);
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

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
    try { const { data } = await api.get("/api/goals"); setAllProjects((data as ProjectInfo[]) ?? []); } catch {}
    try { const { data } = await api.get("/api/tasks"); setAllTasks((data as TaskInfo[]) ?? []); } catch {}
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const goal = goals.find(g => g.id === goalId);
  const subGoals = goals.filter(g => g.parentGoalId === goalId);
  const progress = calcGoalProgress(goalId, goals);

  useEffect(() => {
    if (!goal) return;
    setProjects(goal.projects.map(pid => allProjects.find(p => p.id === pid) ?? { id: pid, title: pid.slice(0, 8) + "..." }));
    setTasks(goal.tasks.map(tid => allTasks.find(t => t.id === tid) ?? { id: tid, title: tid.slice(0, 8) + "...", status: "Pending" }));
  }, [goal, allProjects, allTasks]);

  // Breadcrumb
  const dimChain: JobDim[] = [];
  const goalChain: JobGoalData[] = [];
  if (goal) {
    let cd = dims.find(d => d.id === goal.dimensionId);
    while (cd) { dimChain.unshift(cd); const p = cd.parentDimensionId; cd = p ? dims.find(d => d.id === p) : undefined; }
    for (let cg: JobGoalData | undefined = goal; cg; cg = cg.parentGoalId ? goals.find(g => g.id === cg!.parentGoalId) : undefined) {
      goalChain.unshift(cg);
    }
  }

  function resetForm() { setAddVal(""); setAddDesc(""); setAddDate(""); setAddPriority(3); setShowAddType(null); }

  async function addSubGoal() {
    if (!addVal.trim()) return;
    await api.post(`/api/job-goals/${goalId}/subgoal`, { title: addVal.trim(), description: addDesc.trim() || undefined }).catch(() => {});
    resetForm(); load();
  }

  async function createAndLinkProject() {
    if (!addVal.trim()) return;
    try {
      const { data } = await api.post("/api/goals", {
        title: addVal.trim(), description: addDesc.trim() || undefined,
        targetDate: addDate || undefined, lifeCircleId: goal?.dimensionId,
      });
      await api.post(`/api/job-goals/${goalId}/link-project`, { id: data.id });
    } catch {}
    resetForm(); load();
  }

  async function createAndLinkTask() {
    if (!addVal.trim()) return;
    try {
      const { data } = await api.post("/api/tasks", {
        title: addVal.trim(), description: addDesc.trim() || undefined,
        dueDate: addDate || undefined, userPriority: addPriority,
      });
      await api.post(`/api/job-goals/${goalId}/link-task`, { id: data.id });
    } catch {}
    resetForm(); load();
  }

  async function linkProject(pid: string) { await api.post(`/api/job-goals/${goalId}/link-project`, { id: pid }).catch(() => {}); setShowAddType(null); load(); }
  async function linkTask(tid: string) { await api.post(`/api/job-goals/${goalId}/link-task`, { id: tid }).catch(() => {}); setShowAddType(null); load(); }
  async function unlinkProject(pid: string) { await api.delete(`/api/job-goals/${goalId}/projects/${pid}`).catch(() => {}); load(); }
  async function unlinkTask(tid: string) { await api.delete(`/api/job-goals/${goalId}/tasks/${tid}`).catch(() => {}); load(); }

  async function completeTask(tid: string) {
    await api.post(`/api/tasks/${tid}/update`, { status: "Completed" }).catch(() => {});
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, status: "Completed" } : t));
  }
  async function reopenTask(tid: string) {
    await api.post(`/api/tasks/${tid}/update`, { status: "Pending" }).catch(() => {});
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, status: "Pending" } : t));
  }
  async function deleteTask(tid: string) {
    if (!confirm("حذف المهمة نهائياً؟")) return;
    await api.delete(`/api/tasks/${tid}`).catch(() => {});
    await unlinkTask(tid);
  }
  async function deleteProject(pid: string) {
    if (!confirm("حذف المشروع نهائياً؟")) return;
    await api.delete(`/api/goals/${pid}`).catch(() => {});
    await unlinkProject(pid);
  }
  async function saveEditTask() {
    if (!editTaskId || !editTitle.trim()) return;
    await api.post(`/api/tasks/${editTaskId}/update`, { title: editTitle.trim(), description: editDesc.trim() || undefined }).catch(() => {});
    setEditTaskId(null); load();
  }

  async function updateProgress(p: number) { await api.put(`/api/job-goals/${goalId}`, { progress: p }).catch(() => {}); load(); }

  if (!goal) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  const gc = progress >= 100 ? "#3D8C5A" : progress >= 50 ? "#2D6B9E" : "#D4AF37";
  const pLabel = goal.priority >= 4 ? "عالية" : goal.priority >= 2 ? "متوسطة" : "منخفضة";
  const pColor = goal.priority >= 4 ? "#DC2626" : goal.priority >= 2 ? "#D4AF37" : "#3D8C5A";
  const inputStyle = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" };

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-1 text-[10px] mb-2 flex-wrap">
          <Link href="/jobs" className="hover:underline" style={{ color: "var(--muted)" }}>الوظائف</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/jobs/${jobId}`} className="hover:underline" style={{ color: "var(--muted)" }}>{jobName}</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/jobs/${jobId}/dimensions`} className="hover:underline" style={{ color: "var(--muted)" }}>الجوانب</Link>
          {dimChain.map(d => (
            <span key={d.id} className="flex items-center gap-1">
              <span style={{ color: "var(--muted)" }}>←</span>
              <Link href={`/jobs/${jobId}/dimensions/${d.id}`} className="hover:underline" style={{ color: "var(--muted)" }}>{d.name}</Link>
            </span>
          ))}
          {goalChain.map((g, i) => (
            <span key={g.id} className="flex items-center gap-1">
              <span style={{ color: "var(--muted)" }}>←</span>
              {i < goalChain.length - 1
                ? <Link href={`/jobs/${jobId}/goals/${g.id}`} className="hover:underline" style={{ color: "var(--muted)" }}>{g.title}</Link>
                : <span className="font-semibold" style={{ color: "#D4AF37" }}>{g.title}</span>}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: "#D4AF3715" }}>🎯</div>
          <div className="flex-1">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{goal.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: pColor + "15", color: pColor }}>{pLabel}</span>
              {goal.timeframe && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{goal.timeframe}</span>}
              {goal.dueDate && <span className="text-[8px]" style={{ color: "var(--muted)" }}>⏰ {new Date(goal.dueDate).toLocaleDateString("ar-SA")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: gc + "20" }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: gc }} />
            </div>
            <span className="text-sm font-black" style={{ color: gc }}>{progress}%</span>
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-5">
        {goal.description && (
          <div className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{goal.description}</p>
          </div>
        )}

        {subGoals.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>التقدم:</span>
            {[0, 25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => updateProgress(p)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                style={{ background: goal.progress === p ? gc : "#F3F4F6", color: goal.progress === p ? "#fff" : "#6B7280" }}>{p}%</button>
            ))}
          </div>
        )}

        {/* ═══ Add buttons ═══ */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAddType(showAddType === "subgoal" ? null : "subgoal")} className="px-3 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>+ هدف فرعي</button>
          <button onClick={() => setShowAddType(showAddType === "newproject" ? null : "newproject")} className="px-3 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>+ مشروع جديد</button>
          <button onClick={() => setShowAddType(showAddType === "project" ? null : "project")} className="px-3 py-2 rounded-xl text-[10px] font-bold border" style={{ borderColor: "#2D6B9E", color: "#2D6B9E" }}>ربط مشروع موجود</button>
          <button onClick={() => setShowAddType(showAddType === "newtask" ? null : "newtask")} className="px-3 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "#3D8C5A" }}>+ مهمة جديدة</button>
          <button onClick={() => setShowAddType(showAddType === "task" ? null : "task")} className="px-3 py-2 rounded-xl text-[10px] font-bold border" style={{ borderColor: "#3D8C5A", color: "#3D8C5A" }}>ربط مهمة موجودة</button>
        </div>

        {/* ═══ Add forms ═══ */}
        {showAddType && (
          <div className="p-5 rounded-2xl border-2 fade-up space-y-3" style={{ background: "var(--card)", borderColor: showAddType.includes("project") ? "#2D6B9E40" : showAddType.includes("task") ? "#3D8C5A40" : "#D4AF3740" }}>
            {showAddType === "subgoal" && (
              <>
                <p className="text-xs font-bold" style={{ color: "#D4AF37" }}>هدف فرعي جديد</p>
                <input value={addVal} onChange={e => setAddVal(e.target.value)} placeholder="عنوان الهدف *" autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="وصف (اختياري)"
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={inputStyle} />
                <div className="flex gap-2">
                  <button onClick={addSubGoal} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#D4AF37" }}>إضافة</button>
                  <button onClick={resetForm} className="px-3 py-2 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
                </div>
              </>
            )}
            {showAddType === "newproject" && (
              <>
                <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>إنشاء مشروع وربطه</p>
                <input value={addVal} onChange={e => setAddVal(e.target.value)} placeholder="اسم المشروع *" autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="وصف (اختياري)"
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={inputStyle} />
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={inputStyle} />
                <div className="flex gap-2">
                  <button onClick={createAndLinkProject} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>إنشاء وربط</button>
                  <button onClick={resetForm} className="px-3 py-2 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
                </div>
              </>
            )}
            {showAddType === "project" && (
              <>
                <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>ربط مشروع موجود</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {allProjects.filter(p => !goal.projects.includes(p.id)).map(p => (
                    <button key={p.id} onClick={() => linkProject(p.id)}
                      className="w-full text-right px-3 py-2.5 rounded-xl text-xs hover:bg-blue-50 transition border"
                      style={{ borderColor: "var(--card-border)", color: "var(--text)" }}>📦 {p.title}</button>
                  ))}
                  {allProjects.filter(p => !goal.projects.includes(p.id)).length === 0 && <p className="text-[10px] text-center py-3" style={{ color: "var(--muted)" }}>لا توجد مشاريع لربطها</p>}
                </div>
                <button onClick={resetForm} className="text-xs text-[#6B7280]">إلغاء</button>
              </>
            )}
            {showAddType === "newtask" && (
              <>
                <p className="text-xs font-bold" style={{ color: "#3D8C5A" }}>إنشاء مهمة وربطها</p>
                <input value={addVal} onChange={e => setAddVal(e.target.value)} placeholder="عنوان المهمة *" autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="وصف (اختياري)"
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={inputStyle} />
                <div className="flex gap-2 items-center">
                  <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none" style={inputStyle} />
                  <div className="flex gap-1">
                    {[{v:2,l:"منخفضة"},{v:3,l:"متوسطة"},{v:4,l:"عالية"}].map(p => (
                      <button key={p.v} onClick={() => setAddPriority(p.v)} className="px-2 py-1.5 rounded-lg text-[9px] font-bold"
                        style={{ background: addPriority === p.v ? "#3D8C5A" : "#F3F4F6", color: addPriority === p.v ? "#fff" : "#6B7280" }}>{p.l}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createAndLinkTask} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#3D8C5A" }}>إنشاء وربط</button>
                  <button onClick={resetForm} className="px-3 py-2 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
                </div>
              </>
            )}
            {showAddType === "task" && (
              <>
                <p className="text-xs font-bold" style={{ color: "#3D8C5A" }}>ربط مهمة موجودة</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {allTasks.filter(t => t.status !== "Completed" && !goal.tasks.includes(t.id)).map(t => (
                    <button key={t.id} onClick={() => linkTask(t.id)}
                      className="w-full text-right px-3 py-2.5 rounded-xl text-xs hover:bg-green-50 transition border"
                      style={{ borderColor: "var(--card-border)", color: "var(--text)" }}>✅ {t.title}</button>
                  ))}
                  {allTasks.filter(t => t.status !== "Completed" && !goal.tasks.includes(t.id)).length === 0 && <p className="text-[10px] text-center py-3" style={{ color: "var(--muted)" }}>لا توجد مهام لربطها</p>}
                </div>
                <button onClick={resetForm} className="text-xs text-[#6B7280]">إلغاء</button>
              </>
            )}
          </div>
        )}

        {/* ═══ Sub-goals ═══ */}
        {subGoals.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>🎯 الأهداف الفرعية ({subGoals.length})</p>
            <div className="space-y-3">
              {subGoals.map(sg => {
                const sgp = calcGoalProgress(sg.id, goals);
                const sgc = sgp >= 100 ? "#3D8C5A" : sgp >= 50 ? "#2D6B9E" : "#D4AF37";
                return (
                  <Link key={sg.id} href={`/jobs/${jobId}/goals/${sg.id}`}
                    className="group block rounded-2xl p-4 border transition-all hover:shadow-md hover:border-[#D4AF37]"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">🎯</span>
                      <p className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{sg.title}</p>
                      <span className="text-sm font-black" style={{ color: sgc }}>{sgp}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: sgc + "15" }}>
                      <div className="h-full rounded-full" style={{ width: `${sgp}%`, background: sgc }} />
                    </div>
                    <p className="text-[10px] mt-2 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color: "#D4AF37" }}>فتح ←</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Projects ═══ */}
        {projects.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>📦 المشاريع المرتبطة ({projects.length})</p>
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} className="rounded-2xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📦</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{p.title}</p>
                      {p.description && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{p.description}</p>}
                      {p.targetDate && <p className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>⏰ {new Date(p.targetDate).toLocaleDateString("ar-SA")}</p>}
                    </div>
                    {p.progressPercent !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "#2D6B9E15" }}>
                          <div className="h-full rounded-full" style={{ width: `${p.progressPercent}%`, background: "#2D6B9E" }} />
                        </div>
                        <span className="text-[9px] font-bold" style={{ color: "#2D6B9E" }}>{p.progressPercent}%</span>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => deleteProject(p.id)} className="text-[9px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition">حذف</button>
                      <button onClick={() => unlinkProject(p.id)} className="text-[9px] px-2 py-1 rounded-lg text-[#6B7280] hover:bg-gray-100 transition">فك الربط</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Tasks ═══ */}
        {tasks.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>✅ المهام المرتبطة ({tasks.length})</p>
            <div className="space-y-2">
              {tasks.map(t => {
                const done = t.status === "Completed";
                const isEditing = editTaskId === t.id;
                return (
                  <div key={t.id} className="rounded-2xl p-4 border" style={{ background: done ? "#3D8C5A06" : "var(--card)", borderColor: "var(--card-border)" }}>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="العنوان"
                          className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none" style={inputStyle} autoFocus />
                        <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="وصف (اختياري)"
                          className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={inputStyle} />
                        <div className="flex gap-2">
                          <button onClick={saveEditTask} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#3D8C5A" }}>حفظ</button>
                          <button onClick={() => setEditTaskId(null)} className="px-3 py-1.5 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => done ? reopenTask(t.id) : completeTask(t.id)}
                          className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                          style={{ borderColor: done ? "#3D8C5A" : "#E5E7EB", background: done ? "#3D8C5A" : "transparent" }}>
                          {done && <span className="text-white text-[8px]">✓</span>}
                        </button>
                        <div className="flex-1">
                          <p className="text-sm" style={{ color: done ? "var(--muted)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>{t.title}</p>
                          {t.dueDate && <p className="text-[9px]" style={{ color: "var(--muted)" }}>⏰ {new Date(t.dueDate).toLocaleDateString("ar-SA")}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditTaskId(t.id); setEditTitle(t.title); setEditDesc(t.description ?? ""); }}
                            className="text-[9px] px-2 py-1 rounded-lg text-[#6B7280] hover:bg-gray-100 transition">تعديل</button>
                          <button onClick={() => deleteTask(t.id)} className="text-[9px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition">حذف</button>
                          <button onClick={() => unlinkTask(t.id)} className="text-[9px] px-2 py-1 rounded-lg text-[#6B7280] hover:bg-gray-100 transition">فك</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {subGoals.length === 0 && projects.length === 0 && tasks.length === 0 && !showAddType && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "var(--muted)" }}>أضف أهدافاً فرعية أو أنشئ مشاريع ومهام</p>
          </div>
        )}
      </div>
    </main>
  );
}
