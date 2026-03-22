"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { calcGoalProgress, type JobDim, type JobGoalData } from "@/components/JobTree";

interface ProjectInfo { id: string; title: string; status?: string; progressPercent?: number; }
interface TaskInfo { id: string; title: string; status: string; }

export default function GoalPage({ params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: jobId, goalId } = use(params);
  const [dims, setDims] = useState<JobDim[]>([]);
  const [goals, setGoals] = useState<JobGoalData[]>([]);
  const [jobName, setJobName] = useState("");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [showAddType, setShowAddType] = useState<null | "subgoal" | "project" | "task">(null);
  const [addVal, setAddVal] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);

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

    // Load linked projects and tasks
    try {
      const { data: ps } = await api.get("/api/goals");
      setAllProjects((ps as ProjectInfo[]) ?? []);
    } catch {}
    try {
      const { data: ts } = await api.get("/api/tasks");
      setAllTasks((ts as TaskInfo[]) ?? []);
    } catch {}
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const goal = goals.find(g => g.id === goalId);
  const subGoals = goals.filter(g => g.parentGoalId === goalId);
  const progress = calcGoalProgress(goalId, goals);

  // Resolve linked items
  useEffect(() => {
    if (!goal) return;
    setProjects(goal.projects.map(pid => allProjects.find(p => p.id === pid) ?? { id: pid, title: pid.slice(0, 8) + "…" }));
    setTasks(goal.tasks.map(tid => allTasks.find(t => t.id === tid) ?? { id: tid, title: tid.slice(0, 8) + "…", status: "Pending" }));
  }, [goal, allProjects, allTasks]);

  // Build breadcrumb: dim chain + goal chain
  const dimChain: JobDim[] = [];
  const goalChain: JobGoalData[] = [];
  if (goal) {
    let curDim = dims.find(d => d.id === goal.dimensionId);
    while (curDim) {
      dimChain.unshift(curDim);
      const pid = curDim.parentDimensionId;
      curDim = pid ? dims.find(d => d.id === pid) : undefined;
    }
    for (let cg: JobGoalData | undefined = goal; cg; cg = cg.parentGoalId ? goals.find(g => g.id === cg!.parentGoalId) : undefined) {
      goalChain.unshift(cg);
    }
  }

  async function addSubGoal() {
    if (!addVal.trim()) return;
    await api.post(`/api/job-goals/${goalId}/subgoal`, { title: addVal.trim(), description: addDesc.trim() || undefined }).catch(() => {});
    setAddVal(""); setAddDesc(""); setShowAddType(null); load();
  }

  async function linkProject(pid: string) {
    await api.post(`/api/job-goals/${goalId}/link-project`, { id: pid }).catch(() => {});
    load();
  }

  async function linkTask(tid: string) {
    await api.post(`/api/job-goals/${goalId}/link-task`, { id: tid }).catch(() => {});
    load();
  }

  async function unlinkProject(pid: string) {
    await api.delete(`/api/job-goals/${goalId}/projects/${pid}`).catch(() => {});
    load();
  }

  async function unlinkTask(tid: string) {
    await api.delete(`/api/job-goals/${goalId}/tasks/${tid}`).catch(() => {});
    load();
  }

  async function completeTask(tid: string) {
    await api.post(`/api/tasks/${tid}/update`, { status: "Completed" }).catch(() => {});
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, status: "Completed" } : t));
  }

  async function updateProgress(p: number) {
    await api.put(`/api/job-goals/${goalId}`, { progress: p }).catch(() => {});
    load();
  }

  if (!goal) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  const gc = progress >= 100 ? "#3D8C5A" : progress >= 50 ? "#2D6B9E" : "#D4AF37";
  const priorityLabel = goal.priority >= 4 ? "عالية" : goal.priority >= 2 ? "متوسطة" : "منخفضة";
  const priorityColor = goal.priority >= 4 ? "#DC2626" : goal.priority >= 2 ? "#D4AF37" : "#3D8C5A";

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        {/* Breadcrumb */}
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
              {i < goalChain.length - 1 ? (
                <Link href={`/jobs/${jobId}/goals/${g.id}`} className="hover:underline" style={{ color: "var(--muted)" }}>{g.title}</Link>
              ) : (
                <span className="font-semibold" style={{ color: "#D4AF37" }}>{g.title}</span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: "#D4AF3715" }}>🎯</div>
          <div className="flex-1">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{goal.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: priorityColor + "15", color: priorityColor }}>{priorityLabel}</span>
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
        {/* Description */}
        {goal.description && (
          <div className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{goal.description}</p>
          </div>
        )}

        {/* Manual progress (if no sub-goals) */}
        {subGoals.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>التقدم:</span>
            {[0, 25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => updateProgress(p)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                style={{ background: goal.progress === p ? gc : "#F3F4F6", color: goal.progress === p ? "#fff" : "#6B7280" }}>{p}%</button>
            ))}
          </div>
        )}

        {/* Add buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddType(showAddType === "subgoal" ? null : "subgoal")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#D4AF37" }}>+ هدف فرعي</button>
          <button onClick={() => setShowAddType(showAddType === "project" ? null : "project")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ مشروع</button>
          <button onClick={() => setShowAddType(showAddType === "task" ? null : "task")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#3D8C5A" }}>+ مهمة</button>
        </div>

        {/* Add form */}
        {showAddType && (
          <div className="p-4 rounded-xl border fade-up space-y-2" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            {showAddType === "subgoal" && (
              <>
                <input value={addVal} onChange={e => setAddVal(e.target.value)} placeholder="عنوان الهدف الفرعي *"
                  onKeyDown={e => { if (e.key === "Enter") addSubGoal(); }}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
                <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="وصف (اختياري)"
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                <div className="flex gap-2">
                  <button onClick={addSubGoal} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#D4AF37" }}>إضافة</button>
                  <button onClick={() => { setShowAddType(null); setAddVal(""); setAddDesc(""); }} className="px-3 py-2 rounded-xl text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
                </div>
              </>
            )}
            {showAddType === "project" && (
              <>
                <p className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>اختر مشروعاً لربطه:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allProjects.filter(p => !goal.projects.includes(p.id)).map(p => (
                    <button key={p.id} onClick={() => { linkProject(p.id); setShowAddType(null); }}
                      className="w-full text-right px-3 py-2 rounded-lg text-xs hover:bg-gray-50 transition border"
                      style={{ borderColor: "var(--card-border)", color: "var(--text)" }}>📦 {p.title}</button>
                  ))}
                  {allProjects.length === 0 && <p className="text-[10px] text-center py-2" style={{ color: "var(--muted)" }}>لا توجد مشاريع</p>}
                </div>
                <button onClick={() => setShowAddType(null)} className="text-xs text-[#6B7280]">إلغاء</button>
              </>
            )}
            {showAddType === "task" && (
              <>
                <p className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>اختر مهمة لربطها:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allTasks.filter(t => t.status !== "Completed" && !goal.tasks.includes(t.id)).map(t => (
                    <button key={t.id} onClick={() => { linkTask(t.id); setShowAddType(null); }}
                      className="w-full text-right px-3 py-2 rounded-lg text-xs hover:bg-gray-50 transition border"
                      style={{ borderColor: "var(--card-border)", color: "var(--text)" }}>✅ {t.title}</button>
                  ))}
                  {allTasks.length === 0 && <p className="text-[10px] text-center py-2" style={{ color: "var(--muted)" }}>لا توجد مهام</p>}
                </div>
                <button onClick={() => setShowAddType(null)} className="text-xs text-[#6B7280]">إلغاء</button>
              </>
            )}
          </div>
        )}

        {/* Sub-goals */}
        {subGoals.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>🎯 الأهداف الفرعية ({subGoals.length})</p>
            <div className="space-y-3">
              {subGoals.map(sg => {
                const sgp = calcGoalProgress(sg.id, goals);
                const sgc = sgp >= 100 ? "#3D8C5A" : sgp >= 50 ? "#2D6B9E" : "#D4AF37";
                const subs = goals.filter(g => g.parentGoalId === sg.id);
                return (
                  <Link key={sg.id} href={`/jobs/${jobId}/goals/${sg.id}`}
                    className="group block rounded-2xl p-4 border transition-all hover:shadow-md hover:border-[#D4AF37]"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">🎯</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{sg.title}</p>
                        <p className="text-[9px]" style={{ color: "var(--muted)" }}>
                          {subs.length} فرعي · {sg.projects.length} مشروع · {sg.tasks.length} مهمة
                        </p>
                      </div>
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

        {/* Linked projects */}
        {projects.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>📦 المشاريع المرتبطة ({projects.length})</p>
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-3 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <span className="text-lg">📦</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{p.title}</p>
                    {p.progressPercent !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#2D6B9E15" }}>
                          <div className="h-full rounded-full" style={{ width: `${p.progressPercent}%`, background: "#2D6B9E" }} />
                        </div>
                        <span className="text-[9px] font-bold" style={{ color: "#2D6B9E" }}>{p.progressPercent}%</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => unlinkProject(p.id)} className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked tasks */}
        {tasks.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>✅ المهام المرتبطة ({tasks.length})</p>
            <div className="space-y-2">
              {tasks.map(t => {
                const done = t.status === "Completed";
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                    style={{ background: done ? "#3D8C5A08" : "var(--card)", borderColor: "var(--card-border)" }}>
                    <button onClick={() => !done && completeTask(t.id)}
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                      style={{ borderColor: done ? "#3D8C5A" : "#E5E7EB", background: done ? "#3D8C5A" : "transparent" }}>
                      {done && <span className="text-white text-[8px]">✓</span>}
                    </button>
                    <span className="text-sm flex-1" style={{ color: done ? "var(--muted)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>{t.title}</span>
                    <button onClick={() => unlinkTask(t.id)} className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {subGoals.length === 0 && projects.length === 0 && tasks.length === 0 && !showAddType && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "var(--muted)" }}>أضف أهدافاً فرعية أو اربط مشاريع ومهام</p>
          </div>
        )}
      </div>
    </main>
  );
}
