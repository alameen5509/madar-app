"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { calcGoalProgress, type JobDim, type JobGoalData } from "@/components/JobTree";
import { NewTaskDialog } from "@/app/tasks/page";

interface ProjectInfo { id: string; title: string; description?: string; status?: string; targetDate?: string; progressPercent?: number; isTech?: boolean; }
interface TaskInfo { id: string; title: string; status: string; description?: string; dueDate?: string; userPriority?: number; }

export default function GoalPage({ params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: jobId, goalId } = use(params);
  const [dims, setDims] = useState<JobDim[]>([]);
  const [goals, setGoals] = useState<JobGoalData[]>([]);
  const [jobName, setJobName] = useState("");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);

  // Forms
  const [showAdd, setShowAdd] = useState<null | "subgoal" | "newproject" | "linkproject" | "newtask" | "linktask">(null);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDate, setFDate] = useState("");
  const [fPriority, setFPriority] = useState(3);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [etTitle, setEtTitle] = useState("");
  const [etDesc, setEtDesc] = useState("");
  const [etDate, setEtDate] = useState("");
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [epTitle, setEpTitle] = useState("");
  const [epDesc, setEpDesc] = useState("");
  const [epDate, setEpDate] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, g, c] = await Promise.all([
        api.get(`/api/job-dimensions/${jobId}`),
        api.get(`/api/job-goals/${jobId}`),
        api.get("/api/circles"),
      ]);
      setDims(d.data); setGoals(g.data);
      const job = (c.data as { id: string; name: string }[]).find(x => x.id === jobId);
      if (job) setJobName(job.name);
    } catch {}
    // Load all projects (Goals in circles system) and tasks
    try { const { data } = await api.get("/api/goals"); setAllProjects(data ?? []); } catch {}
    try { const { data } = await api.get("/api/tasks"); setAllTasks(data ?? []); } catch {}
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const goal = goals.find(g => g.id === goalId);
  const subGoals = goals.filter(g => g.parentGoalId === goalId);
  const progress = calcGoalProgress(goalId, goals);

  // Resolve linked items
  useEffect(() => {
    if (!goal) return;
    setProjects(goal.projects.map(pid => allProjects.find((p: ProjectInfo) => p.id === pid) ?? { id: pid, title: "...", status: "Active" }));
    setTasks(goal.tasks.map(tid => allTasks.find((t: TaskInfo) => t.id === tid) ?? { id: tid, title: "...", status: "Pending" }));
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

  function resetForm() { setFTitle(""); setFDesc(""); setFDate(""); setFPriority(3); setShowAdd(null); }

  // ─── Actions ───
  async function addSubGoal() {
    if (!fTitle.trim()) return;
    await api.post(`/api/job-goals/${goalId}/subgoal`, { title: fTitle.trim(), description: fDesc.trim() || undefined }).catch(() => {});
    resetForm(); load();
  }

  async function createProject() {
    if (!fTitle.trim()) return;
    try {
      const { data } = await api.post("/api/goals", {
        title: fTitle.trim(), description: fDesc.trim() || undefined,
        targetDate: fDate || undefined,
      });
      if (data?.id) {
        await api.post(`/api/job-goals/${goalId}/link-project`, { id: data.id });
      }
    } catch (err) { console.error("createProject failed:", err); alert("فشل إنشاء المشروع"); }
    resetForm(); load();
  }

  async function createTask() {
    if (!fTitle.trim()) return;
    try {
      const { data } = await api.post("/api/tasks", {
        title: fTitle.trim(), description: fDesc.trim() || undefined,
        dueDate: fDate || undefined, userPriority: fPriority,
      });
      await api.post(`/api/job-goals/${goalId}/link-task`, { id: data.id });
    } catch {}
    resetForm(); load();
  }

  async function linkProject(pid: string) { await api.post(`/api/job-goals/${goalId}/link-project`, { id: pid }).catch(() => {}); setShowAdd(null); load(); }
  async function linkTask(tid: string) { await api.post(`/api/job-goals/${goalId}/link-task`, { id: tid }).catch(() => {}); setShowAdd(null); load(); }
  async function unlinkProject(pid: string) { await api.delete(`/api/job-goals/${goalId}/projects/${pid}`).catch(() => {}); load(); }
  async function unlinkTask(tid: string) { await api.delete(`/api/job-goals/${goalId}/tasks/${tid}`).catch(() => {}); load(); }

  async function toggleTask(tid: string, done: boolean) {
    await api.post(`/api/tasks/${tid}/update`, { status: done ? "Pending" : "Completed" }).catch(() => {});
    load();
  }
  async function deleteTask(tid: string) {
    if (!confirm("حذف المهمة نهائياً؟")) return;
    await api.delete(`/api/tasks/${tid}`).catch(() => {}); load();
  }
  async function saveEditTask() {
    if (!editingTask) return;
    await api.post(`/api/tasks/${editingTask}/update`, {
      title: etTitle.trim(), description: etDesc.trim() || undefined,
      dueDate: etDate || undefined,
    }).catch(() => {});
    setEditingTask(null); load();
  }
  async function deleteProject(pid: string) {
    if (!confirm("حذف المشروع نهائياً؟")) return;
    await api.delete(`/api/goals/${pid}`).catch(() => {}); load();
  }
  async function saveEditProject() {
    if (!editingProject) return;
    await api.put(`/api/goals/${editingProject}`, {
      title: epTitle.trim(), description: epDesc.trim() || undefined,
      targetDate: epDate || undefined,
    }).catch(() => {});
    setEditingProject(null); load();
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
  const IS = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" } as const;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* Header */}
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

        {/* Add buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAdd(showAdd === "subgoal" ? null : "subgoal")} className="px-3 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>+ هدف فرعي</button>
          <button onClick={() => setShowAdd(showAdd === "newproject" ? null : "newproject")} className="px-3 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>+ مشروع جديد</button>
          <button onClick={() => setShowAdd(showAdd === "linkproject" ? null : "linkproject")} className="px-3 py-2 rounded-xl text-[10px] font-bold border" style={{ borderColor: "#2D6B9E", color: "#2D6B9E" }}>ربط مشروع</button>
          <button onClick={() => setShowAdd(showAdd === "newtask" ? null : "newtask")} className="px-3 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "#3D8C5A" }}>+ مهمة</button>
          <button onClick={() => setShowAdd(showAdd === "linktask" ? null : "linktask")} className="px-3 py-2 rounded-xl text-[10px] font-bold border" style={{ borderColor: "#3D8C5A", color: "#3D8C5A" }}>ربط مهمة</button>
        </div>

        {/* Forms */}
        {showAdd === "subgoal" && (
          <div className="p-5 rounded-2xl border-2 fade-up space-y-3" style={{ background: "var(--card)", borderColor: "#D4AF3740" }}>
            <p className="text-xs font-bold" style={{ color: "#D4AF37" }}>هدف فرعي جديد</p>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="العنوان *" autoFocus className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="وصف (اختياري)" className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            <div className="flex gap-2"><button onClick={addSubGoal} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#D4AF37" }}>إضافة</button><button onClick={resetForm} className="px-3 py-2 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button></div>
          </div>
        )}
        {showAdd === "newproject" && (
          <div className="p-5 rounded-2xl border-2 fade-up space-y-3" style={{ background: "var(--card)", borderColor: "#2D6B9E40" }}>
            <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>مشروع جديد</p>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="اسم المشروع *" autoFocus className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="وصف (اختياري)" className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            <div className="flex gap-2"><button onClick={createProject} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>إنشاء وربط</button><button onClick={resetForm} className="px-3 py-2 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button></div>
          </div>
        )}
        {showAdd === "linkproject" && (
          <div className="p-5 rounded-2xl border-2 fade-up space-y-2" style={{ background: "var(--card)", borderColor: "#2D6B9E40" }}>
            <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>ربط مشروع موجود</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {allProjects.filter((p: ProjectInfo) => !goal.projects.includes(p.id)).map((p: ProjectInfo) => (
                <button key={p.id} onClick={() => linkProject(p.id)} className="w-full text-right px-3 py-2.5 rounded-xl text-xs hover:bg-blue-50 transition border" style={{ borderColor: "var(--card-border)", color: "var(--text)" }}>📦 {p.title}</button>
              ))}
              {allProjects.filter((p: ProjectInfo) => !goal.projects.includes(p.id)).length === 0 && <p className="text-[10px] text-center py-3" style={{ color: "var(--muted)" }}>لا توجد مشاريع</p>}
            </div>
            <button onClick={resetForm} className="text-xs text-[#6B7280]">إلغاء</button>
          </div>
        )}
        {showAdd === "newtask" && (
          <NewTaskDialog goals={[]} onClose={() => setShowAdd(null)}
            onCreated={async (t) => {
              // Link the new task to this goal
              try { await api.post(`/api/job-goals/${goalId}/link-task`, { id: t.id }); } catch {}
              load();
            }} />
        )}
        {showAdd === "linktask" && (
          <div className="p-5 rounded-2xl border-2 fade-up space-y-2" style={{ background: "var(--card)", borderColor: "#3D8C5A40" }}>
            <p className="text-xs font-bold" style={{ color: "#3D8C5A" }}>ربط مهمة موجودة</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {allTasks.filter((t: TaskInfo) => t.status !== "Completed" && !goal.tasks.includes(t.id)).map((t: TaskInfo) => (
                <button key={t.id} onClick={() => linkTask(t.id)} className="w-full text-right px-3 py-2.5 rounded-xl text-xs hover:bg-green-50 transition border" style={{ borderColor: "var(--card-border)", color: "var(--text)" }}>✅ {t.title}</button>
              ))}
              {allTasks.filter((t: TaskInfo) => t.status !== "Completed" && !goal.tasks.includes(t.id)).length === 0 && <p className="text-[10px] text-center py-3" style={{ color: "var(--muted)" }}>لا توجد مهام</p>}
            </div>
            <button onClick={resetForm} className="text-xs text-[#6B7280]">إلغاء</button>
          </div>
        )}

        {/* ═══ Sub-goals ═══ */}
        {subGoals.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>🎯 الأهداف الفرعية ({subGoals.length})</p>
            <div className="space-y-3">{subGoals.map(sg => {
              const sgp = calcGoalProgress(sg.id, goals);
              const sgc = sgp >= 100 ? "#3D8C5A" : sgp >= 50 ? "#2D6B9E" : "#D4AF37";
              return (
                <Link key={sg.id} href={`/jobs/${jobId}/goals/${sg.id}`} className="group block rounded-2xl p-4 border transition-all hover:shadow-md hover:border-[#D4AF37]" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-3 mb-2"><span className="text-lg">🎯</span><p className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{sg.title}</p><span className="text-sm font-black" style={{ color: sgc }}>{sgp}%</span></div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: sgc + "15" }}><div className="h-full rounded-full" style={{ width: `${sgp}%`, background: sgc }} /></div>
                  <p className="text-[10px] mt-2 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color: "#D4AF37" }}>فتح ←</p>
                </Link>
              );
            })}</div>
          </div>
        )}

        {/* ═══ Projects — full control ═══ */}
        {projects.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>📦 المشاريع ({projects.length})</p>
            <div className="space-y-2">{projects.map(p => (
              <div key={p.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                {editingProject === p.id ? (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-1"><p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>تعديل المشروع</p>
                      <div className="flex gap-2"><button onClick={() => setEditingProject(null)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button><button onClick={saveEditProject} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>حفظ</button></div>
                    </div>
                    <input value={epTitle} onChange={e => setEpTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none" style={IS} />
                    <input value={epDesc} onChange={e => setEpDesc(e.target.value)} placeholder="وصف" className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
                    <input type="date" value={epDate} onChange={e => setEpDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/projects?id=${p.id}`} className="text-lg hover:scale-110 transition">📦</Link>
                      <div className="flex-1">
                        <Link href={`/projects?id=${p.id}`} className="text-sm font-bold hover:underline" style={{ color: "var(--text)" }}>{p.title}</Link>
                        {p.description && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{p.description}</p>}
                        {p.targetDate && <p className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>⏰ {new Date(p.targetDate).toLocaleDateString("ar-SA")}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Link href={`/projects?id=${p.id}`} className="text-[9px] px-2 py-1.5 rounded-lg font-bold hover:bg-blue-50 transition" style={{ color: "#5E5495" }}>فتح ←</Link>
                        <button onClick={() => { setEditingProject(p.id); setEpTitle(p.title); setEpDesc(p.description ?? ""); setEpDate(p.targetDate?.slice(0, 10) ?? ""); }}
                          className="text-[9px] px-2 py-1 rounded-lg text-[#2D6B9E] hover:bg-blue-50 transition">تعديل</button>
                        <button onClick={() => unlinkProject(p.id)} className="text-[9px] px-2 py-1 rounded-lg text-[#6B7280] hover:bg-gray-100 transition">فك</button>
                        <button onClick={() => deleteProject(p.id)} className="text-[9px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition">حذف</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}</div>
          </div>
        )}

        {/* ═══ Tasks — full control ═══ */}
        {tasks.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>✅ المهام ({tasks.length})</p>
            <div className="space-y-2">{tasks.map(t => {
              const done = t.status === "Completed";
              return (
                <div key={t.id} className="rounded-2xl border overflow-hidden" style={{ background: done ? "#3D8C5A06" : "var(--card)", borderColor: "var(--card-border)" }}>
                  {editingTask === t.id ? (
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between mb-1"><p className="text-xs font-bold" style={{ color: "#3D8C5A" }}>تعديل المهمة</p>
                        <div className="flex gap-2"><button onClick={() => setEditingTask(null)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button><button onClick={saveEditTask} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#3D8C5A" }}>حفظ</button></div>
                      </div>
                      <input value={etTitle} onChange={e => setEtTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none" style={IS} />
                      <input value={etDesc} onChange={e => setEtDesc(e.target.value)} placeholder="وصف" className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
                      <input type="date" value={etDate} onChange={e => setEtDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
                    </div>
                  ) : (
                    <div className="p-4 flex items-center gap-3">
                      <button onClick={() => toggleTask(t.id, done)}
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                        style={{ borderColor: done ? "#3D8C5A" : "#E5E7EB", background: done ? "#3D8C5A" : "transparent" }}>
                        {done && <span className="text-white text-[8px]">✓</span>}
                      </button>
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: done ? "var(--muted)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>{t.title}</p>
                        {t.description && <p className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>{t.description}</p>}
                        {t.dueDate && <p className="text-[9px]" style={{ color: "var(--muted)" }}>⏰ {new Date(t.dueDate).toLocaleDateString("ar-SA")}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setEditingTask(t.id); setEtTitle(t.title); setEtDesc(t.description ?? ""); setEtDate(t.dueDate?.slice(0, 10) ?? ""); }}
                          className="text-[9px] px-2 py-1 rounded-lg text-[#3D8C5A] hover:bg-green-50 transition">تعديل</button>
                        <button onClick={() => unlinkTask(t.id)} className="text-[9px] px-2 py-1 rounded-lg text-[#6B7280] hover:bg-gray-100 transition">فك</button>
                        <button onClick={() => deleteTask(t.id)} className="text-[9px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition">حذف</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}</div>
          </div>
        )}

        {subGoals.length === 0 && projects.length === 0 && tasks.length === 0 && !showAdd && (
          <div className="text-center py-8"><p className="text-xs" style={{ color: "var(--muted)" }}>أضف أهدافاً فرعية أو أنشئ مشاريع ومهام</p></div>
        )}
      </div>
    </main>
  );
}
