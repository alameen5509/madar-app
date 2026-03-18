"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { GeometricDivider, EightPointedStar } from "@/components/IslamicPattern";
import {
  getCircles, createCircle, updateCircle, deleteCircle, getCircleTasks,
  type LifeCircle, type CircleGoal, type CreateCirclePayload, type CircleTask,
} from "@/lib/api";
import EditTaskDialogShared from "@/components/EditTaskDialog";

/* ─── Constants ───────────────────────────────────────────────────────────── */

const COLOR_PALETTE = [
  "#5E5495", "#C9A84C", "#3D8C8C", "#8C4A3D",
  "#2D6B9E", "#4A8C3D", "#8C3D6B", "#6B3D8C",
  "#E8631A", "#1A7DE8", "#3D9970", "#C0392B",
];

const ICON_OPTIONS = [
  "🌿", "🏡", "🤝", "💼", "📚", "💪",
  "🎯", "🌙", "⭐", "💡", "🌱", "🔮",
  "🏋️", "✈️", "🎓", "💰", "🙏", "❤️",
  "🧠", "🎨", "🌍", "⚡", "🔥", "🎵",
];

const TIER_OPTIONS = [
  { value: "Base",     label: "أساسية"  },
  { value: "First",    label: "الأولى"  },
  { value: "Second",   label: "الثانية" },
  { value: "Third",    label: "الثالثة" },
  { value: "Fourth",   label: "الرابعة" },
  { value: "Fifth",    label: "الخامسة" },
  { value: "Business", label: "الأعمال" },
];

const TIER_LABELS: Record<string, string> = {
  Base: "أساسية", First: "الأولى", Second: "الثانية",
  Third: "الثالثة", Fourth: "الرابعة", Fifth: "الخامسة",
  Business: "الأعمال",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  Active:    { label: "نشط",    cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  Paused:    { label: "موقوف",  cls: "bg-yellow-50  text-yellow-700  border-yellow-100"  },
  Completed: { label: "مكتمل", cls: "bg-blue-50    text-blue-700    border-blue-100"    },
  Archived:  { label: "مؤرشف", cls: "bg-gray-50    text-gray-500    border-gray-100"    },
};

const TASK_STATUS_COLORS: Record<string, string> = {
  Completed: "bg-[#5E5495] border-[#5E5495]",
  Todo:      "border-[#C9A84C] bg-transparent",
  InProgress: "border-[#2D6B9E] bg-[#2D6B9E]/20",
  Inbox:     "border-[#E2D5B0] bg-transparent",
};

/* ─── Progress Ring ───────────────────────────────────────────────────────── */

function ProgressRing({ percent, color, size = 100, strokeWidth = 7 }: {
  percent: number; color: string; size?: number; strokeWidth?: number;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}20`} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.9s ease" }} />
    </svg>
  );
}

/* ─── Editable Name ───────────────────────────────────────────────────────── */

function EditableName({ value, color, onSave }: {
  value: string; color: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

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
        className="font-bold text-sm bg-transparent border-b-2 outline-none text-center w-full"
        style={{ color, borderColor: color }} />
    );
  }

  return (
    <span className="font-bold text-sm cursor-pointer hover:opacity-70 transition group inline-flex items-center gap-1" style={{ color }}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
      {value} <span className="opacity-0 group-hover:opacity-50 text-[10px]">✏️</span>
    </span>
  );
}

/* ─── Circle Card ─────────────────────────────────────────────────────────── */

function CircleCard({ circle, isSelected, onClick, onRename }: {
  circle: LifeCircle; isSelected: boolean; onClick: () => void; onRename: (name: string) => void;
}) {
  const color = circle.colorHex ?? "#5E5495";
  const icon = circle.iconKey ?? "⭕";

  return (
    <div
      onClick={onClick}
      className="w-full text-center rounded-2xl p-5 transition-all duration-200 hover:shadow-lg cursor-pointer"
      style={{
        background: isSelected ? `${color}12` : "#ffffff",
        border: isSelected ? `2px solid ${color}60` : "1px solid #E2D5B0",
        boxShadow: isSelected ? `0 4px 24px ${color}28` : undefined,
      }}
    >
      <div className="relative mx-auto" style={{ width: 100, height: 100 }}>
        <ProgressRing percent={circle.progressPercent} color={color} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ background: `${color}18` }}>
            {icon}
          </div>
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-black px-1.5 py-0.5 rounded-full text-white"
          style={{ background: color }}>
          {circle.progressPercent}%
        </div>
      </div>

      <EditableName value={circle.name} color={color} onSave={onRename} />
      <p className="text-[10px] text-[#7C7A8E] mt-0.5">{TIER_LABELS[circle.tier] ?? circle.tier}</p>

      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-[11px] text-[#7C7A8E]">{circle.goalCount} أهداف</span>
        <span className="text-[#E2D5B0]">·</span>
        <span className="text-[11px] text-[#7C7A8E]">{circle.taskCount} مهمة</span>
      </div>

      {circle.isShariaPriority && (
        <div className="mt-2 flex justify-center">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            🌙 أولوية شرعية
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function CirclesSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2D5B0] animate-pulse">
          <div className="w-[100px] h-[100px] rounded-full bg-[#E2D5B0] mx-auto" />
          <div className="h-4 rounded bg-[#E2D5B0] mt-4 mx-4" />
          <div className="h-3 rounded bg-[#E2D5B0] mt-2 mx-8" />
        </div>
      ))}
    </div>
  );
}

/* ─── Goal Card ───────────────────────────────────────────────────────────── */

function GoalCard({ goal, color }: { goal: CircleGoal; color: string }) {
  const meta = STATUS_META[goal.status] ?? STATUS_META.Active;
  return (
    <div className="bg-white rounded-xl p-4 border border-[#E2D5B0] hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>{meta.label}</span>
            {goal.targetDate && (
              <span className="text-[#7C7A8E] text-[10px]">
                📅 {new Date(goal.targetDate).toLocaleDateString("ar-SA", { month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <h4 className="text-[#1A1830] font-semibold text-sm leading-snug">{goal.title}</h4>
          {goal.description && <p className="text-[#7C7A8E] text-xs mt-1 line-clamp-2">{goal.description}</p>}
        </div>
        <span className="font-bold text-base flex-shrink-0" style={{ color }}>{goal.progressPercent}%</span>
      </div>
      <div className="bg-[#F8F6F0] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${goal.progressPercent}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      </div>
    </div>
  );
}

/* ─── Tasks Panel for a Circle ────────────────────────────────────────────── */

function CircleTasksPanel({ circleId, color }: { circleId: string; color: string }) {
  const [tasks, setTasks] = useState<CircleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<CircleTask | null>(null);

  function reload() { getCircleTasks(circleId).then(setTasks).catch(() => {}); }

  useEffect(() => {
    setLoading(true);
    getCircleTasks(circleId).then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <div className="py-4 text-center text-[#7C7A8E] text-xs animate-pulse">جارٍ تحميل المهام...</div>;
  if (tasks.length === 0) return <div className="py-4 text-center text-[#7C7A8E] text-xs">لا توجد مهام مباشرة في هذه الدائرة</div>;

  return (
    <>
      <div className="space-y-1.5">
        {tasks.map((t) => {
          const done = t.status === "Completed";
          return (
            <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${done ? "opacity-50" : ""}`}>
              <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center ${TASK_STATUS_COLORS[t.status] ?? TASK_STATUS_COLORS.Inbox}`}>
                {done && <span className="text-white text-[8px]">✓</span>}
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
          task={{ id: editTask.id, title: editTask.title, priority: editTask.userPriority >= 4 ? "عالية" : editTask.userPriority === 3 ? "متوسطة" : "منخفضة", circle: "", circleColor: color, isWork: false, isUrgent: false, isRecurring: false, dueDate: editTask.dueDate, context: "Anywhere" }}
          onClose={() => setEditTask(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}

/* ─── Detail Panel (Goals + Tasks) ────────────────────────────────────────── */

function DetailPanel({ circle, onClose }: { circle: LifeCircle; onClose: () => void }) {
  const color = circle.colorHex ?? "#5E5495";
  const [tab, setTab] = useState<"goals" | "tasks">("goals");

  return (
    <div className="fade-up rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: `${color}30`, background: `${color}06` }}>

      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${color}20` }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl" style={{ background: `${color}20` }}>
            {circle.iconKey ?? "⭕"}
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color }}>{circle.name}</h3>
            <p className="text-[#7C7A8E] text-xs">{circle.description}</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-black/5 transition text-sm">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: `${color}15` }}>
        <button onClick={() => setTab("goals")}
          className="flex-1 py-3 text-sm font-semibold transition"
          style={{ color: tab === "goals" ? color : "#7C7A8E", borderBottom: tab === "goals" ? `2px solid ${color}` : "2px solid transparent" }}>
          المشاريع / الأهداف ({circle.goals.length})
        </button>
        <button onClick={() => setTab("tasks")}
          className="flex-1 py-3 text-sm font-semibold transition"
          style={{ color: tab === "tasks" ? color : "#7C7A8E", borderBottom: tab === "tasks" ? `2px solid ${color}` : "2px solid transparent" }}>
          المهام المباشرة
        </button>
      </div>

      <div className="p-5">
        {tab === "goals" && (
          circle.goals.length === 0 ? (
            <div className="text-center py-8"><p className="text-[#7C7A8E] text-sm">لا توجد أهداف في هذه الدائرة بعد</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {circle.goals.map((g) => <GoalCard key={g.id} goal={g} color={color} />)}
            </div>
          )
        )}
        {tab === "tasks" && <CircleTasksPanel circleId={circle.id} color={color} />}
      </div>
    </div>
  );
}

/* ─── New Circle Dialog ───────────────────────────────────────────────────── */

const EMPTY_FORM: CreateCirclePayload = {
  name: "", description: "", iconKey: "⭕", colorHex: "#5E5495",
  tier: "First", isShariaPriority: false,
};

function NewCircleDialog({ onClose, onCreated, parentId }: {
  onClose: () => void; onCreated: (c: LifeCircle) => void; parentId?: string;
}) {
  const [form, setForm] = useState<CreateCirclePayload>({ ...EMPTY_FORM, parentCircleId: parentId });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function set<K extends keyof CreateCirclePayload>(key: K, val: CreateCirclePayload[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("اسم الدائرة مطلوب"); return; }
    setLoading(true); setError("");
    try { const circle = await createCircle(form); onCreated(circle); onClose(); }
    catch { setError("حدث خطأ أثناء الإنشاء"); }
    finally { setLoading(false); }
  }

  const color = form.colorHex ?? "#5E5495";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1830]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-up">
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-[#E2D5B0]">
          <h2 className="font-bold text-[#1A1830]">{parentId ? "دور فرعي جديد" : "دائرة حياة جديدة"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-[#F8F6F0] transition text-sm">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">الاسم <span className="text-red-500">*</span></label>
            <input ref={nameRef} type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder={parentId ? "مثال: أب، زوج، معلم…" : "مثال: النفس، الأسرة، العمل…"}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">وصف <span className="text-[#7C7A8E] font-normal">(اختياري)</span></label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm resize-none bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">اللون</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => set("colorHex", c)}
                  className="w-8 h-8 rounded-full flex-shrink-0 transition-all"
                  style={{ background: c, boxShadow: form.colorHex === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined, transform: form.colorHex === c ? "scale(1.15)" : undefined }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">الأيقونة</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((ic) => (
                <button key={ic} type="button" onClick={() => set("iconKey", ic)}
                  className="w-9 h-9 rounded-lg text-lg transition-all"
                  style={{ background: form.iconKey === ic ? `${color}18` : "#F8F6F0", border: `1.5px solid ${form.iconKey === ic ? color : "transparent"}` }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          {!parentId && (
            <div>
              <label className="block text-sm font-semibold text-[#1A1830] mb-2">المستوى</label>
              <div className="flex gap-2 flex-wrap">
                {TIER_OPTIONS.map((t) => (
                  <button key={t.value} type="button" onClick={() => set("tier", t.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: form.tier === t.value ? color : "#F8F6F0", color: form.tier === t.value ? "#fff" : "#7C7A8E", border: `1px solid ${form.tier === t.value ? color : "#E2D5B0"}` }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#7C7A8E] bg-[#F8F6F0] border border-[#E2D5B0] hover:bg-[#F0EDE4] transition">إلغاء</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
              {loading ? "جارٍ الإنشاء…" : "إنشاء"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function CirclesPage() {
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogParent, setDialogParent] = useState<string | undefined>(undefined);

  const fetchCircles = useCallback(async () => {
    setLoading(true); setError("");
    try { setCircles(await getCircles()); }
    catch { setError("تعذّر تحميل الدوائر."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCircles(); }, [fetchCircles]);

  async function handleRename(id: string, name: string) {
    setCircles((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
    try { await updateCircle(id, { name }); }
    catch { fetchCircles(); }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل تريد حذف هذا الدور؟ سيتم نقل المهام للدور الأول.")) return;
    try { await deleteCircle(id); setCircles((p) => p.filter((c) => c.id !== id)); setSelectedId(null); setExpandedId(null); }
    catch { alert("فشل الحذف"); }
  }

  function handleCreated(circle: LifeCircle) {
    setCircles((prev) => [...prev, circle]);
    setSelectedId(circle.id);
  }

  function openNewSubCircle(parentId: string) {
    setDialogParent(parentId);
    setShowDialog(true);
  }

  function openNewCircle() {
    setDialogParent(undefined);
    setShowDialog(true);
  }

  // Hierarchy: top-level circles and their sub-circles
  const topCircles = circles.filter((c) => !c.parentCircleId && c.tier !== "Business");
  const getSubCircles = (parentId: string) => circles.filter((c) => c.parentCircleId === parentId);

  const selectedCircle = circles.find((c) => c.id === selectedId) ?? null;
  const totalGoals = circles.reduce((s, c) => s + c.goalCount, 0);
  const avgProgress = circles.length === 0 ? 0
    : Math.round(circles.reduce((s, c) => s + c.progressPercent, 0) / circles.length);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">دوائر الحياة</h2>
            {!loading && !error && (
              <p className="text-[#7C7A8E] text-xs">{circles.length} دائرة · {totalGoals} هدف · متوسط الإنجاز {avgProgress}%</p>
            )}
          </div>
          <button onClick={openNewCircle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
            <span>+</span><span>دائرة جديدة</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Summary */}
        {!loading && !error && circles.length > 0 && (
          <div className="fade-up rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #2A2542 0%, #3D3468 60%, #5E5495 100%)" }}>
            <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" aria-hidden>
              <defs><pattern id="circles-bg" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="white" strokeWidth="0.6" />
              </pattern></defs>
              <rect width="100%" height="100%" fill="url(#circles-bg)" />
            </svg>
            <div className="relative z-10 flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}>
                <EightPointedStar size={26} color="#2A2542" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">التوازن العام: <span className="text-[#E8C96A] font-bold">{avgProgress}%</span></p>
                <p className="text-white/50 text-xs mt-0.5">اضغط على الدائرة لعرض الأدوار الفرعية · اضغط على الاسم لتعديله</p>
              </div>
            </div>
          </div>
        )}

        {loading && <CirclesSkeleton />}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchCircles} className="text-[#C9A84C] text-sm font-medium hover:underline">إعادة المحاولة</button>
          </div>
        )}

        {!loading && !error && circles.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl" style={{ background: "#F0EDF8" }}>⭕</div>
            <p className="text-[#1A1830] font-semibold mb-1">لا توجد دوائر بعد</p>
            <button onClick={openNewCircle} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white mt-4"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>+ إنشاء أول دائرة</button>
          </div>
        )}

        {/* Accordion circles list */}
        {!loading && !error && topCircles.length > 0 && (
          <div className="space-y-2">
            {topCircles.map((parent) => {
              const subs = getSubCircles(parent.id);
              const color = parent.colorHex ?? "#5E5495";
              const icon = parent.iconKey ?? "⭕";
              const isOpen = expandedId === parent.id;

              return (
                <div key={parent.id} className="rounded-2xl border overflow-hidden transition-all"
                  style={{ borderColor: isOpen ? `${color}40` : "#E2D5B0", background: isOpen ? `${color}04` : "white" }}>

                  {/* Parent row */}
                  <button onClick={() => setExpandedId(isOpen ? null : parent.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-black/[0.02] transition">
                    {/* Icon */}
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${color}15` }}>
                      {icon}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <EditableName value={parent.name} color={color} onSave={(n) => handleRename(parent.id, n)} />
                      <p className="text-[11px] text-[#7C7A8E] mt-0.5">
                        {TIER_LABELS[parent.tier] ?? parent.tier} · {parent.goalCount} أهداف · {parent.taskCount} مهمة
                      </p>
                    </div>
                    {/* Progress */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-20 bg-[#F0EDE4] rounded-full h-2 overflow-hidden hidden sm:block">
                        <div className="h-full rounded-full" style={{ width: `${parent.progressPercent}%`, background: color }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-left" style={{ color }}>{parent.progressPercent}%</span>
                      {/* Chevron */}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(parent.id); }}
                        className="text-[#9CA3AF] hover:text-red-500 text-xs transition" title="حذف">✕</button>
                      <span className="text-[#7C7A8E] text-sm transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}>
                        ◂
                      </span>
                    </div>
                  </button>

                  {/* Expanded: sub-circles + details */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${color}15` }}>
                      {/* Sub-circles as nested list */}
                      <div className="px-5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold" style={{ color }}>الأدوار الفرعية</p>
                          <button onClick={(e) => { e.stopPropagation(); openNewSubCircle(parent.id); }}
                            className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition hover:opacity-80"
                            style={{ background: `${color}12`, color }}>
                            + دور جديد
                          </button>
                        </div>

                        {subs.length === 0 ? (
                          <p className="text-[#7C7A8E] text-xs py-2 pr-6">لا توجد أدوار فرعية بعد</p>
                        ) : (
                          <div className="space-y-1">
                            {subs.map((sub) => {
                              const subColor = sub.colorHex ?? color;
                              const subIcon = sub.iconKey ?? "·";
                              const subOpen = selectedId === sub.id;

                              return (
                                <div key={sub.id}>
                                  {/* Sub-circle row */}
                                  <button onClick={() => setSelectedId(subOpen ? null : sub.id)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-right transition hover:bg-white/60"
                                    style={{ background: subOpen ? `${subColor}10` : "transparent" }}>
                                    <span className="text-base">{subIcon}</span>
                                    <EditableName value={sub.name} color={subColor} onSave={(n) => handleRename(sub.id, n)} />
                                    <span className="flex-1" />
                                    <span className="text-[10px] text-[#7C7A8E]">{sub.goalCount} أهداف · {sub.taskCount} مهمة</span>
                                    <span className="text-xs font-bold" style={{ color: subColor }}>{sub.progressPercent}%</span>
                                    <Link href={`/circles/${sub.id}`} onClick={(e) => e.stopPropagation()}
                                      className="text-[10px] px-2 py-0.5 rounded-full border font-medium hover:opacity-80 transition"
                                      style={{ borderColor: subColor, color: subColor }}>فتح ←</Link>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(sub.id); }}
                                      className="text-[10px] text-[#9CA3AF] hover:text-red-500 transition" title="حذف">✕</button>
                                    <span className="text-[#7C7A8E] text-[10px] transition-transform" style={{ transform: subOpen ? "rotate(90deg)" : "rotate(0)" }}>◂</span>
                                  </button>

                                  {/* Sub-circle details (goals + tasks) */}
                                  {subOpen && (
                                    <div className="mr-8 mt-1 mb-2 rounded-xl border p-4" style={{ borderColor: `${subColor}20`, background: `${subColor}04` }}>
                                      <DetailPanel circle={sub} onClose={() => setSelectedId(null)} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Parent circle goals/tasks */}
                      <div className="px-5 pb-4">
                        <DetailPanel circle={parent} onClose={() => setExpandedId(null)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {showDialog && (
        <NewCircleDialog
          parentId={dialogParent}
          onClose={() => setShowDialog(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}
