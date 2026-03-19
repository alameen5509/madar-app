"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getGoals, getCircles, createGoal, updateGoal, deleteGoal, getGoalTasks,
  createTask, api,
  type Goal, type LifeCircle, type SmartTask,
} from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

function getProjectScore(desc?: string): number | null {
  if (!desc) return null;
  const m = desc.match(/\[rating:(\{.*?\})\]/);
  if (!m) return null;
  try { return JSON.parse(m[1]).score ?? null; } catch { return null; }
}

function scoreColor(s: number): string {
  if (s > 45) return "#DC2626";
  if (s > 30) return "#D4AF37";
  if (s > 15) return "#3D8C5A";
  return "#6B7280";
}

const STAGES = [
  { key: "Archived",  label: "أفكار",   color: "#8C6B3D", icon: "💡" },
  { key: "Paused",    label: "تخطيط",   color: "#5E5495", icon: "📋" },
  { key: "Active",    label: "تنفيذ",   color: "#2D6B9E", icon: "🚀" },
  { key: "Completed", label: "مكتمل",   color: "#3D8C5A", icon: "✅" },
];

const STATUS_LABEL: Record<string, string> = {
  Active: "نشط", Paused: "تخطيط", Completed: "مكتمل", Archived: "فكرة",
};

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  Inbox: { label: "وارد", color: "#6B7280" },
  Todo: { label: "مخطط", color: "#3B82F6" },
  InProgress: { label: "جاري", color: "#F59E0B" },
  Completed: { label: "مكتمل", color: "#3D8C5A" },
  Deferred: { label: "مؤجل", color: "#8B5CF6" },
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function ProjectsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [g, c] = await Promise.all([getGoals(), getCircles()]);
      setGoals(g);
      setCircles(c);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError("انتهت الجلسة — سجّل الدخول مرة أخرى");
      } else {
        setError("تعذّر تحميل المشاريع — تحقق من الاتصال");
      }
      console.error("Goals fetch error:", err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { api.get("/api/users").then(r => setUsers(r.data)).catch(() => {}); }, []);

  /* ── Drag & Drop (Kanban) ── */
  async function handleDrop(goalId: string, newStatus: string) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal || goal.status === newStatus) return;
    // Optimistic
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: newStatus as Goal["status"] } : g));
    try {
      await updateGoal(goalId, { status: newStatus });
    } catch { fetchData(); }
  }

  const circleMap = new Map(circles.map(c => [c.id, c]));

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-6 py-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold" style={{ color: "var(--text)", fontSize: 22 }}>إدارة المشاريع</h2>
            {!loading && <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{goals.length} مشروع</p>}
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--card-border)" }}>
              {(["kanban", "list"] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className="px-4 py-2 text-sm font-semibold transition"
                  style={{ background: viewMode === m ? "#2C2C54" : "var(--bg)", color: viewMode === m ? "#fff" : "var(--muted)" }}>
                  {m === "kanban" ? "كانبان" : "قائمة"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNew(true)}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              + مشروع جديد
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-5">
        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {error && (
          <div className="text-center py-8">
            <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>
            <button onClick={fetchData} className="text-sm px-4 py-2 rounded-lg hover:opacity-80" style={{ background: "#D4AF3720", color: "#D4AF37" }}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Kanban View */}
        {!loading && viewMode === "kanban" && (
          <div className="grid grid-cols-4 gap-4">
            {STAGES.map(stage => {
              const stageGoals = goals.filter(g => g.status === stage.key);
              return (
                <div key={stage.key}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={e => { e.preventDefault(); handleDrop(e.dataTransfer.getData("text/plain"), stage.key); }}
                  className="rounded-2xl border p-3 min-h-[300px]"
                  style={{ background: `${stage.color}08`, borderColor: `${stage.color}30` }}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span>{stage.icon}</span>
                      <span className="font-bold text-sm" style={{ color: stage.color }}>{stage.label}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${stage.color}20`, color: stage.color }}>
                      {stageGoals.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stageGoals.map(g => {
                      const circle = g.lifeCircle ? circleMap.get(g.lifeCircle.id) : undefined;
                      return (
                        <div key={g.id} draggable
                          onDragStart={e => { e.dataTransfer.setData("text/plain", g.id); e.dataTransfer.effectAllowed = "move"; }}
                          onClick={() => setSelected(g)}
                          className="rounded-xl border p-3 cursor-pointer hover:shadow-md transition-all"
                          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {(() => { const s = getProjectScore(g.description); return s !== null ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black" style={{ background: scoreColor(s) + "18", color: scoreColor(s) }}>{s}</span>
                            ) : null; })()}
                            {g.description?.includes("[tech]") && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#2D6B9E20", color: "#2D6B9E" }}>💻</span>}
                            <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{g.title}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {circle && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${circle.colorHex ?? "#666"}15`, color: circle.colorHex ?? "var(--muted)" }}>
                                {circle.name}
                              </span>
                            )}
                            {g.targetDate && (
                              <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                                {new Date(g.targetDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                              </span>
                            )}
                            {g.progressPercent > 0 && (
                              <span className="text-[10px] font-bold" style={{ color: stage.color }}>{g.progressPercent}%</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {stageGoals.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed py-8 text-center" style={{ borderColor: `${stage.color}30` }}>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>اسحب مشروعاً هنا</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {!loading && viewMode === "list" && (
          <div className="space-y-2">
            {goals.map(g => {
              const circle = g.lifeCircle ? circleMap.get(g.lifeCircle.id) : undefined;
              const stageInfo = STAGES.find(s => s.key === g.status);
              return (
                <div key={g.id} onClick={() => setSelected(g)}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl border cursor-pointer hover:border-[#D4AF37] transition"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <span className="text-lg">{stageInfo?.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {(() => { const s = getProjectScore(g.description); return s !== null ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black" style={{ background: scoreColor(s) + "18", color: scoreColor(s) }}>{s}</span>
                      ) : null; })()}
                      <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{g.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {circle && <span className="text-[10px]" style={{ color: circle.colorHex ?? "var(--muted)" }}>{circle.name}</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: `${stageInfo?.color ?? "#666"}15`, color: stageInfo?.color }}>
                        {STATUS_LABEL[g.status]}
                      </span>
                    </div>
                  </div>
                  {g.targetDate && <span className="text-xs" style={{ color: "var(--muted)" }}>{new Date(g.targetDate).toLocaleDateString("ar-SA")}</span>}
                  <span className="text-sm font-bold" style={{ color: stageInfo?.color }}>{g.progressPercent}%</span>
                </div>
              );
            })}
          </div>
        )}

        {!loading && goals.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📁</p>
            <p className="font-bold text-lg mb-2" style={{ color: "var(--text)" }}>لا توجد مشاريع</p>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>أنشئ مشروعك الأول وابدأ بتتبع أعمالك</p>
            <button onClick={() => setShowNew(true)}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              + مشروع جديد
            </button>
          </div>
        )}

        <div className="pb-4 mt-6"><GeometricDivider /></div>
      </div>

      {/* New Project Dialog */}
      {showNew && (
        <NewProjectDialog circles={circles} onClose={() => setShowNew(false)} onCreated={fetchData} />
      )}

      {/* Project Detail Panel */}
      {selected && (
        <ProjectDetail
          goal={selected}
          circle={selected.lifeCircle ? circleMap.get(selected.lifeCircle.id) : undefined}
          circles={circles}
          users={users}
          onClose={() => setSelected(null)}
          onRefresh={() => { fetchData(); setSelected(null); }}
        />
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   NEW PROJECT DIALOG
   ═══════════════════════════════════════════════════════════════════════ */

function NewProjectDialog({ circles, onClose, onCreated }: {
  circles: LifeCircle[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [circleId, setCircleId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isTech, setIsTech] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creating, setCreating] = useState(false);
  // Rating: 4 criteria × 5 points = score out of 60
  const [rImportance, setRImportance] = useState(0);
  const [rUrgency, setRUrgency] = useState(0);
  const [rImpact, setRImpact] = useState(0);
  const [rEffort, setREffort] = useState(0);
  const score = (rImportance + rUrgency + rImpact + rEffort) * 3; // 0-60
  const rated = rImportance > 0 && rUrgency > 0 && rImpact > 0 && rEffort > 0;

  async function handleCreate() {
    if (!title.trim() || !rated) return;
    setCreating(true);
    try {
      const ratingTag = `[rating:${JSON.stringify({im:rImportance,ur:rUrgency,ip:rImpact,ef:rEffort,score})}]`;
      const fullDesc = [desc.trim(), isTech ? "[tech]" : "", ratingTag].filter(Boolean).join(" ");
      await createGoal({
        title: title.trim(),
        description: fullDesc,
        targetDate: targetDate || undefined,
        lifeCircleId: circleId || undefined,
        priorityWeight: Math.round(score / 12),
      });
      // Save as template if user wants
      if (typeof window !== "undefined" && title.trim()) {
        const templates = JSON.parse(localStorage.getItem("madar_project_templates") ?? "[]");
        // Don't auto-save, templates are saved manually
      }
      onCreated();
      onClose();
    } catch {} finally { setCreating(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>مشروع جديد</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Templates */}
          <div>
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition"
              style={{ borderColor: "var(--card-border)", color: "#D4AF37" }}>
              {showTemplates ? "✕ إغلاق القوالب" : "📋 استخدام قالب"}
            </button>
            {showTemplates && (() => {
              const templates: {name: string; desc: string; isTech: boolean}[] = JSON.parse(
                typeof window !== "undefined" ? localStorage.getItem("madar_project_templates") ?? "[]" : "[]"
              );
              return templates.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {templates.map((t, i) => (
                    <button key={i} onClick={() => { setTitle(t.name); setDesc(t.desc); setIsTech(t.isTech); setShowTemplates(false); }}
                      className="w-full text-right px-3 py-2 rounded-lg text-sm border transition hover:border-[#D4AF37]"
                      style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                      {t.isTech ? "💻" : "📁"} {t.name}
                    </button>
                  ))}
                </div>
              ) : <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>لا توجد قوالب — أنشئ مشروعاً واحفظه كقالب</p>;
            })()}
          </div>

          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم المشروع *" autoFocus
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="وصف (اختياري)" rows={2}
            className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={inputStyle} />
          <select value={circleId} onChange={e => setCircleId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle}>
            <option value="">اختر الدور / الوظيفة</option>
            {circles.map(c => <option key={c.id} value={c.id}>{c.iconKey ?? ""} {c.name} ({c.tier === "Business" ? "وظيفة" : "دور"})</option>)}
          </select>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />

          {/* Tech toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <div onClick={() => setIsTech(!isTech)}
                className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                style={{ background: isTech ? "#2D6B9E" : "var(--card-border)" }}>
                <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ right: isTech ? "0.125rem" : "1.25rem" }} />
              </div>
              <span className="text-sm" style={{ color: "var(--text)" }}>💻 مشروع تقني</span>
            </label>
          </div>

          {/* Rating — mandatory */}
          <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: rated ? "#3D8C5A40" : "#DC262640", background: rated ? "#3D8C5A08" : "#DC262608" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "var(--text)" }}>تقييم المشروع <span style={{ color: "#DC2626" }}>*</span></span>
              <span className="text-lg font-black" style={{ color: score > 45 ? "#DC2626" : score > 30 ? "#D4AF37" : score > 15 ? "#3D8C5A" : "var(--muted)" }}>
                {score}/60
              </span>
            </div>
            {[
              { label: "الأهمية", value: rImportance, set: setRImportance, icon: "⭐" },
              { label: "الاستعجال", value: rUrgency, set: setRUrgency, icon: "⏰" },
              { label: "التأثير", value: rImpact, set: setRImpact, icon: "💥" },
              { label: "الجهد المطلوب", value: rEffort, set: setREffort, icon: "💪" },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-xs w-24 text-right" style={{ color: "var(--text)" }}>{r.icon} {r.label}</span>
                <div className="flex gap-1 flex-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => r.set(n)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: r.value >= n ? (n >= 4 ? "#DC2626" : n >= 3 ? "#D4AF37" : "#3D8C5A") : "var(--bg)",
                        color: r.value >= n ? "#fff" : "var(--muted)",
                        border: `1px solid ${r.value >= n ? "transparent" : "var(--card-border)"}`,
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!rated && <p className="text-[10px] text-center" style={{ color: "#DC2626" }}>يجب تقييم جميع المعايير لإنشاء المشروع</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={creating || !title.trim() || !rated}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              {creating ? "جارٍ الإنشاء..." : "إنشاء المشروع"}
            </button>
            <button onClick={() => {
              if (!title.trim()) return;
              const templates = JSON.parse(localStorage.getItem("madar_project_templates") ?? "[]");
              templates.push({ name: title.trim(), desc: desc.trim(), isTech });
              localStorage.setItem("madar_project_templates", JSON.stringify(templates));
              alert("تم حفظ القالب ✓");
            }}
              disabled={!title.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: "#D4AF37", color: "#D4AF37" }}>
              حفظ كقالب
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECT DETAIL PANEL
   ═══════════════════════════════════════════════════════════════════════ */

function ProjectDetail({ goal, circle, circles, users, onClose, onRefresh }: {
  goal: Goal;
  circle?: LifeCircle;
  circles: LifeCircle[];
  users: { id: string; fullName: string; email: string }[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showChangeCircle, setShowChangeCircle] = useState(false);
  const [editCircle, setEditCircle] = useState(goal.lifeCircle?.id ?? "");
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editDesc, setEditDesc] = useState(goal.description ?? "");
  const [editDate, setEditDate] = useState(goal.targetDate?.split("T")[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New task form
  const [nt, setNt] = useState({ title: "", desc: "", priority: 3, dueDate: "", cost: "", assignee: "", context: "Anywhere", isUrgent: false, isWork: true });

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoadingTasks(true);
    try { const t = await getGoalTasks(goal.id); setTasks(t); }
    catch {} finally { setLoadingTasks(false); }
  }

  async function handleAddTask() {
    if (!nt.title.trim()) return;
    const costVal = parseFloat(nt.cost);
    try {
      await createTask({
        title: nt.title.trim(),
        description: nt.desc.trim() || undefined,
        userPriority: nt.priority,
        dueDate: nt.dueDate || undefined,
        goalId: goal.id,
        lifeCircleId: goal.lifeCircle?.id,
        cost: !isNaN(costVal) && costVal > 0 ? costVal : undefined,
        costCurrency: "SAR",
        isWorkTask: nt.isWork || undefined,
        isUrgent: nt.isUrgent || undefined,
        taskContext: nt.context !== "Anywhere" ? nt.context : undefined,
      });
      setNt({ title: "", desc: "", priority: 3, dueDate: "", cost: "", assignee: "", context: "Anywhere", isUrgent: false, isWork: true });
      setShowAddTask(false);
      loadTasks();
      onRefresh(); // refresh project list too
    } catch {}
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const next = currentStatus === "Todo" ? "InProgress" : currentStatus === "InProgress" ? "Completed" : "Todo";
    try { await api.patch(`/api/tasks/${taskId}/status`, { status: next }); loadTasks(); } catch {}
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await updateGoal(goal.id, { title: editTitle.trim(), description: editDesc.trim() || undefined, targetDate: editDate || undefined });
      setShowEdit(false);
      onRefresh();
    } catch {} finally { setSaving(false); }
  }

  async function handleChangeCircle() {
    if (!editCircle) return;
    setSaving(true);
    try { await updateGoal(goal.id, { lifeCircleId: editCircle }); setShowChangeCircle(false); onRefresh(); }
    catch {} finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`حذف مشروع "${goal.title}"؟`)) return;
    setDeleting(true);
    try { await deleteGoal(goal.id); onRefresh(); } catch { alert("فشل الحذف"); } finally { setDeleting(false); }
  }

  async function handleChangeStatus(status: string) {
    try { await updateGoal(goal.id, { status }); onRefresh(); } catch {}
  }

  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  const completedTasks = tasks.filter(t => t.status === "Completed");
  const totalCost = tasks.reduce((s, t) => s + (t.cost ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--bg)", border: "1px solid var(--card-border)", animation: "fadeUp .3s ease-out" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b px-6 py-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-bold mb-1" style={{ color: "var(--text)", fontSize: 20 }}>{goal.title}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status selector */}
                <select value={goal.status} onChange={e => handleChangeStatus(e.target.value)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                </select>
                {/* Circle */}
                {!showChangeCircle ? (
                  <button onClick={() => setShowChangeCircle(true)} className="text-xs px-2 py-1 rounded-lg border"
                    style={{ borderColor: circle?.colorHex ?? "var(--card-border)", color: circle?.colorHex ?? "var(--muted)" }}>
                    {circle?.name ?? "بدون دور"} ✎
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <select value={editCircle} onChange={e => setEditCircle(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border focus:outline-none"
                      style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
                      <option value="">اختر</option>
                      {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={handleChangeCircle} className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: "#3D8C5A" }}>حفظ</button>
                    <button onClick={() => setShowChangeCircle(false)} className="text-xs" style={{ color: "var(--muted)" }}>✕</button>
                  </div>
                )}
                {goal.targetDate && (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    📅 {new Date(goal.targetDate).toLocaleDateString("ar-SA")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <button onClick={onClose} className="text-lg px-2 rounded-lg" style={{ color: "var(--muted)" }}>✕</button>
              <button onClick={() => setShowEdit(true)} className="text-xs px-3 py-1 rounded-lg font-semibold" style={{ background: "#2D6B9E20", color: "#2D6B9E" }}>✎ تعديل</button>
              <button onClick={handleDelete} disabled={deleting} className="text-xs px-3 py-1 rounded-lg font-semibold" style={{ background: "#DC262620", color: "#DC2626" }}>
                {deleting ? "..." : "🗑 حذف"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 text-center border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>المهام</p>
              <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{tasks.length}</p>
            </div>
            <div className="rounded-xl p-3 text-center border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>مكتملة</p>
              <p className="text-xl font-bold" style={{ color: "#3D8C5A" }}>{completedTasks.length}</p>
            </div>
            <div className="rounded-xl p-3 text-center border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>التكلفة</p>
              <p className="text-xl font-bold" style={{ color: "#D4AF37" }}>{totalCost > 0 ? `${totalCost.toLocaleString()} ر.س` : "—"}</p>
            </div>
          </div>

          {/* Progress */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                <div className="h-full rounded-full bg-[#3D8C5A] transition-all" style={{ width: `${goal.progressPercent}%` }} />
              </div>
              <span className="text-sm font-bold" style={{ color: "#3D8C5A" }}>{goal.progressPercent}%</span>
            </div>
          )}

          {/* Add Task */}
          <a href={`/tasks?addTask=1&goalId=${goal.id}`}
            className="block w-full py-3 rounded-xl text-sm font-bold text-white text-center"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            + إضافة مهمة (نموذج كامل)
          </a>

          {/* Tasks */}
          {loadingTasks && <p className="text-center py-4 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ تحميل المهام...</p>}

          {pendingTasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <button onClick={() => toggleTaskStatus(t.id, t.status)}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: TASK_STATUS[t.status]?.color ?? "#6B7280" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.title}</p>
                {t.description && <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.description}</p>}
              </div>
              {t.cost && t.cost > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#D4AF3715", color: "#D4AF37" }}>{t.cost.toLocaleString()} ر.س</span>}
              <span className="text-xs font-semibold" style={{ color: TASK_STATUS[t.status]?.color }}>{TASK_STATUS[t.status]?.label}</span>
              {t.dueDate && <span className="text-[10px]" style={{ color: new Date(t.dueDate) < new Date() ? "#DC2626" : "var(--muted)" }}>
                {new Date(t.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
              </span>}
            </div>
          ))}

          {completedTasks.length > 0 && (
            <p className="text-xs text-center py-2" style={{ color: "var(--muted)" }}>+ {completedTasks.length} مهمة مكتملة</p>
          )}

          {!loadingTasks && tasks.length === 0 && (
            <div className="py-8 text-center rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-sm" style={{ color: "var(--muted)" }}>لا توجد مهام — أضف مهمة وستظهر هنا وفي أعمال اليوم</p>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        {showEdit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)} />
            <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div className="px-6 pt-6 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>تعديل المشروع</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={inputStyle} />
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                    {saving ? "جارٍ الحفظ..." : "حفظ"}
                  </button>
                  <button onClick={() => setShowEdit(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

const inputStyle = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" };
