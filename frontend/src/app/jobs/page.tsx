"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getCircles, createCircle, updateCircle, getCircleTasks, createGoal, createTask,
  type LifeCircle, type CircleGoal, type CircleTask, type CreateCirclePayload,
} from "@/lib/api";
import EditTaskDialogShared from "@/components/EditTaskDialog";

/* ─── Status ──────────────────────────────────────────────────────────────── */

const STATUS_META: Record<string, { label: string; cls: string }> = {
  Active:    { label: "نشط",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Paused:    { label: "متوقف",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  Completed: { label: "مكتمل", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  Archived:  { label: "مؤرشف", cls: "bg-gray-50 text-gray-500 border-gray-200" },
};

/* ─── Editable Name ───────────────────────────────────────────────────────── */

function EditableName({ value, color, onSave, className = "" }: {
  value: string; color: string; onSave: (v: string) => void; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setText(value); }, [value]);

  function commit() {
    const v = text.trim();
    if (v && v !== value) onSave(v);
    else setText(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setText(value); setEditing(false); } }}
        onClick={(e) => e.stopPropagation()}
        className={`font-bold bg-transparent border-b-2 outline-none ${className}`}
        style={{ color, borderColor: color }} />
    );
  }

  return (
    <span className={`font-bold cursor-pointer hover:opacity-70 transition group inline-flex items-center gap-1 ${className}`}
      style={{ color }} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
      {value} <span className="opacity-0 group-hover:opacity-50 text-[10px]">✏️</span>
    </span>
  );
}

/* ─── Tasks Panel ─────────────────────────────────────────────────────────── */

function TasksPanel({ circleId }: { circleId: string }) {
  const [tasks, setTasks] = useState<CircleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<CircleTask | null>(null);

  function reload() { getCircleTasks(circleId).then(setTasks).catch(() => {}); }

  useEffect(() => {
    setLoading(true);
    getCircleTasks(circleId).then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <div className="py-3 text-center text-[#7C7A8E] text-xs animate-pulse">جارٍ التحميل...</div>;
  if (tasks.length === 0) return <p className="py-3 text-[#7C7A8E] text-xs text-center">لا توجد مهام</p>;

  return (
    <>
      <div className="space-y-1">
        {tasks.map((t) => {
          const done = t.status === "Completed";
          return (
            <div key={t.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${done ? "opacity-40" : ""}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done ? "bg-[#5E5495] border-[#5E5495]" : "border-[#C9A84C]"}`}>
                {done && <span className="text-white text-[7px]">✓</span>}
              </div>
              <span className={`flex-1 text-sm ${done ? "line-through text-[#7C7A8E]" : "text-[#1A1830]"}`}>{t.title}</span>
              {t.dueDate && <span className="text-[10px] text-[#7C7A8E]">{new Date(t.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
              <button onClick={() => setEditTask(t)} className="text-[10px] text-[#7C7A8E] hover:text-[#D4AF37]" title="تعديل">✏️</button>
            </div>
          );
        })}
      </div>
      {editTask && (
        <EditTaskDialogShared
          task={{ id: editTask.id, title: editTask.title, priority: editTask.userPriority >= 4 ? "عالية" : editTask.userPriority === 3 ? "متوسطة" : "منخفضة", circle: "", isWork: false, isUrgent: false, isRecurring: false, dueDate: editTask.dueDate, context: "Anywhere" }}
          onClose={() => setEditTask(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}

/* ─── Quick Add Inline ────────────────────────────────────────────────────── */

function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  async function submit() {
    if (!title.trim()) return;
    setLoading(true);
    try { await onAdd(title.trim()); setTitle(""); setOpen(false); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-[#5E5495] hover:underline">+ إضافة</button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        className="flex-1 px-3 py-1.5 rounded-lg border border-[#E2D5B0] text-sm bg-white focus:outline-none focus:border-[#5E5495]" />
      <button onClick={submit} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-[#5E5495] hover:opacity-90 disabled:opacity-50">
        {loading ? "..." : "أضف"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[#7C7A8E]">✕</button>
    </div>
  );
}

/* ─── New Job Dialog ──────────────────────────────────────────────────────── */

function NewJobDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (c: LifeCircle) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("اسم الوظيفة مطلوب"); return; }
    setLoading(true); setError("");
    try {
      const job = await createCircle({
        name: name.trim(), description: desc.trim() || undefined,
        iconKey: "💼", colorHex: "#2D6B9E", tier: "Business",
      });
      onCreated(job); onClose();
    } catch { setError("حدث خطأ"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1830]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md fade-up">
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-[#E2D5B0]">
          <h2 className="font-bold text-[#1A1830]">وظيفة جديدة</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-[#F8F6F0] transition text-sm">✕</button>
        </div>
        <form onSubmit={submit} className="px-7 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">اسم الوظيفة <span className="text-red-500">*</span></label>
            <input ref={ref} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مهندس برمجيات، مدير مشاريع…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">وصف <span className="text-[#7C7A8E] font-normal">(اختياري)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              placeholder="وصف مختصر للوظيفة أو الشركة…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm resize-none bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#7C7A8E] bg-[#F8F6F0] border border-[#E2D5B0]">إلغاء</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2D6B9E, #5E5495)" }}>
              {loading ? "جارٍ الإنشاء…" : "إنشاء"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function JobsPage() {
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try { setCircles(await getCircles()); }
    catch { setError("تعذّر تحميل البيانات."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Jobs = Business tier circles
  const jobs = circles.filter((c) => c.tier === "Business");

  async function handleRename(id: string, name: string) {
    setCircles((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
    try { await updateCircle(id, { name }); } catch { fetchData(); }
  }

  async function addProject(jobId: string, title: string) {
    await createGoal({ title, lifeCircleId: jobId });
    fetchData();
  }

  async function addTask(jobId: string, title: string) {
    await createTask({ title, lifeCircleId: jobId });
    fetchData();
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">الوظائف</h2>
            <p className="text-[#7C7A8E] text-xs">{jobs.length} وظيفة</p>
          </div>
          <button onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #5E5495)" }}>
            <span>+</span><span>وظيفة جديدة</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-3">

        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2D5B0] animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#E2D5B0]" />
                  <div className="flex-1 space-y-2"><div className="h-4 rounded bg-[#E2D5B0] w-1/3" /><div className="h-3 rounded bg-[#E2D5B0] w-1/2" /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="text-[#C9A84C] text-sm hover:underline">إعادة المحاولة</button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl" style={{ background: "#E8F0FE" }}>💼</div>
            <p className="text-[#1A1830] font-semibold mb-1">لا توجد وظائف</p>
            <p className="text-[#7C7A8E] text-sm mb-4">أضف وظائفك لتنظيم مشاريعك ومهامك المهنية</p>
            <button onClick={() => setShowDialog(true)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #2D6B9E, #5E5495)" }}>+ أضف وظيفة</button>
          </div>
        )}

        {/* Jobs accordion */}
        {!loading && !error && jobs.map((job) => {
          const color = job.colorHex ?? "#2D6B9E";
          const isOpen = expandedJob === job.id;

          return (
            <div key={job.id} className="rounded-2xl border overflow-hidden transition-all"
              style={{ borderColor: isOpen ? `${color}40` : "#E2D5B0", background: isOpen ? `${color}04` : "white" }}>

              {/* Job row */}
              <button onClick={() => setExpandedJob(isOpen ? null : job.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-black/[0.02] transition">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: `${color}15` }}>
                  {job.iconKey ?? "💼"}
                </div>
                <div className="flex-1 min-w-0">
                  <EditableName value={job.name} color={color} onSave={(n) => handleRename(job.id, n)} className="text-base" />
                  {job.description && <p className="text-[11px] text-[#7C7A8E] mt-0.5 truncate">{job.description}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[11px] text-[#7C7A8E]">{job.goalCount} مشروع · {job.taskCount} مهمة</span>
                  <div className="w-16 bg-[#F0EDE4] rounded-full h-2 overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full" style={{ width: `${job.progressPercent}%`, background: color }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color }}>{job.progressPercent}%</span>
                  <span className="text-[#7C7A8E] text-sm transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}>◂</span>
                </div>
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-4" style={{ borderTop: `1px solid ${color}15` }}>

                  {/* Projects section */}
                  <div className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold" style={{ color }}>المشاريع</p>
                      <QuickAdd placeholder="اسم المشروع…" onAdd={(t) => addProject(job.id, t)} />
                    </div>

                    {job.goals.length === 0 ? (
                      <p className="text-[#7C7A8E] text-xs py-2">لا توجد مشاريع بعد</p>
                    ) : (
                      <div className="space-y-1.5">
                        {job.goals.map((goal) => {
                          const meta = STATUS_META[goal.status] ?? STATUS_META.Active;
                          const pOpen = expandedProject === goal.id;
                          return (
                            <div key={goal.id}>
                              <button onClick={() => setExpandedProject(pOpen ? null : goal.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition hover:bg-white/80"
                                style={{ background: pOpen ? "white" : "transparent", border: pOpen ? "1px solid #E2D5B0" : "1px solid transparent" }}>
                                <span className="text-base">📁</span>
                                <span className="flex-1 text-sm font-medium text-[#1A1830]">{goal.title}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>{meta.label}</span>
                                <span className="text-xs font-bold" style={{ color }}>{goal.progressPercent}%</span>
                                <span className="text-[#7C7A8E] text-[10px] transition-transform" style={{ transform: pOpen ? "rotate(90deg)" : "rotate(0)" }}>◂</span>
                              </button>
                              {pOpen && goal.description && (
                                <div className="mr-10 mt-1 mb-2 px-4 py-2 rounded-lg bg-white border border-[#E2D5B0]">
                                  <p className="text-[#7C7A8E] text-xs">{goal.description}</p>
                                  <div className="mt-2 bg-[#F8F6F0] rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${goal.progressPercent}%`, background: color }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tasks section */}
                  <div style={{ borderTop: `1px solid ${color}10` }} className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold" style={{ color }}>المهام المستقلة</p>
                      <QuickAdd placeholder="اسم المهمة…" onAdd={(t) => addTask(job.id, t)} />
                    </div>
                    <TasksPanel circleId={job.id} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {showDialog && <NewJobDialog onClose={() => setShowDialog(false)} onCreated={(j) => { setCircles((p) => [...p, j]); setExpandedJob(j.id); }} />}
    </main>
  );
}
