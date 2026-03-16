"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getTasks, createTask, api, type SmartTask, type CreateTaskPayload } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityLabel(p: number): "عالية" | "متوسطة" | "منخفضة" {
  if (p >= 4) return "عالية";
  if (p === 3) return "متوسطة";
  return "منخفضة";
}

const PRIORITY_COLORS: Record<string, string> = {
  "عالية":  "bg-red-100 text-red-700",
  "متوسطة": "bg-yellow-100 text-yellow-700",
  "منخفضة": "bg-green-100 text-green-700",
};

const LOAD_LABELS: Record<string, string> = {
  Low: "خفيف", Medium: "متوسط", High: "مرتفع", Deep: "عميق",
};

interface TaskRow {
  id: string;
  title: string;
  circle: string;
  priority: "عالية" | "متوسطة" | "منخفضة";
  done: boolean;
}

function toRow(t: SmartTask): TaskRow {
  return {
    id:       t.id,
    title:    t.title,
    circle:   t.lifeCircle?.name ?? "—",
    priority: priorityLabel(t.userPriority),
    done:     t.status === "Completed",
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TaskSkeleton() {
  return (
    <div className="px-5 py-3 space-y-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
          <div className="w-5 h-5 rounded-full bg-[#E2D5B0] flex-shrink-0" />
          <div className="flex-1 h-4 rounded-lg bg-[#E2D5B0]" />
          <div className="w-12 h-3 rounded bg-[#E2D5B0]" />
          <div className="w-14 h-5 rounded-full bg-[#E2D5B0]" />
        </div>
      ))}
    </div>
  );
}

// ─── New Task Dialog ───────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 5, label: "عالية جداً" },
  { value: 4, label: "عالية" },
  { value: 3, label: "متوسطة" },
  { value: 2, label: "منخفضة" },
  { value: 1, label: "منخفضة جداً" },
];

const LOAD_OPTIONS: { value: CreateTaskPayload["cognitiveLoad"]; label: string }[] = [
  { value: "Low",    label: "خفيف"  },
  { value: "Medium", label: "متوسط" },
  { value: "High",   label: "مرتفع" },
  { value: "Deep",   label: "عميق"  },
];

function NewTaskDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: TaskRow) => void;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [userPriority, setPriority] = useState<number>(3);
  const [cognitiveLoad, setLoad]    = useState<CreateTaskPayload["cognitiveLoad"]>("Medium");
  const [dueDate, setDueDate]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const titleRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("عنوان المهمة مطلوب"); return; }
    setLoading(true);
    setError("");
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        userPriority,
        cognitiveLoad,
        dueDate: dueDate || undefined,
      });
      onCreated(toRow(task));
      onClose();
    } catch {
      setError("حدث خطأ أثناء الإنشاء، حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1830]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-up">

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-[#E2D5B0]">
          <h2 className="font-bold text-[#1A1830]">مهمة جديدة</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-[#F8F6F0] transition text-sm"
          >✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              عنوان المهمة <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مراجعة تقرير الأسبوع…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6]
                         focus:outline-none focus:border-[#5E5495] transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              تفاصيل <span className="text-[#7C7A8E] font-normal">(اختياري)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="أضف تفاصيل إضافية عن المهمة…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm resize-none bg-[#FDFAF6]
                         focus:outline-none focus:border-[#5E5495] transition"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">الأولوية</label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: userPriority === p.value ? "#5E5495" : "#F8F6F0",
                    color:      userPriority === p.value ? "#fff"     : "#7C7A8E",
                    border:     `1px solid ${userPriority === p.value ? "#5E5495" : "#E2D5B0"}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cognitive Load */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">الحمل الإدراكي</label>
            <div className="flex gap-2 flex-wrap">
              {LOAD_OPTIONS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLoad(l.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: cognitiveLoad === l.value ? "#C9A84C" : "#F8F6F0",
                    color:      cognitiveLoad === l.value ? "#fff"     : "#7C7A8E",
                    border:     `1px solid ${cognitiveLoad === l.value ? "#C9A84C" : "#E2D5B0"}`,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              تاريخ الاستحقاق <span className="text-[#7C7A8E] font-normal">(اختياري)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6]
                         focus:outline-none focus:border-[#5E5495] transition"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#7C7A8E]
                         bg-[#F8F6F0] border border-[#E2D5B0] hover:bg-[#F0EDE4] transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
            >
              {loading ? "جارٍ الإضافة…" : "إضافة المهمة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks]         = useState<TaskRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getTasks();
      setTasks(data.map(toRow));
    } catch {
      setError("تعذّر تحميل المهام. تحقق من اتصالك أو سجّل دخولك من جديد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function toggle(id: string, currentDone: boolean) {
    const newStatus = currentDone ? "Todo" : "Completed";
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    try {
      await api.patch(`/api/tasks/${id}/status`, { status: newStatus });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: currentDone } : t));
    }
  }

  function handleCreated(task: TaskRow) {
    setTasks((prev) => [task, ...prev]);
  }

  const done  = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">المهام</h2>
            <p className="text-[#7C7A8E] text-xs">
              {loading ? "جارٍ التحميل…" : `${done} من ${total} مكتملة`}
            </p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            <span>+</span><span>مهمة جديدة</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-4">

        {/* Progress bar */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#7C7A8E]">تقدم اليوم</span>
            <span className="font-bold text-[#5E5495]">{pct}٪</span>
          </div>
          <div className="bg-[#F8F6F0] rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #5E5495, #C9A84C)" }}
            />
          </div>
        </div>

        <section>
          <GeometricDivider label="قائمة المهام" />
          <div className="scroll-card mt-3 rounded-2xl overflow-hidden shadow-sm min-h-[120px]">

            {loading && <TaskSkeleton />}

            {!loading && error && (
              <div className="text-center py-10 px-5">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={fetchTasks} className="text-[#C9A84C] text-sm font-medium hover:underline">
                  إعادة المحاولة
                </button>
              </div>
            )}

            {!loading && !error && tasks.length === 0 && (
              <div className="text-center py-10 px-5">
                <p className="text-[#7C7A8E] text-sm mb-3">لا توجد مهام حتى الآن</p>
                <button
                  onClick={() => setShowDialog(true)}
                  className="text-[#5E5495] text-sm font-medium hover:underline"
                >
                  + أضف أول مهمة
                </button>
              </div>
            )}

            {!loading && !error && tasks.length > 0 && (
              <div className="px-5 py-3 space-y-1">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => toggle(t.id, t.done)}
                    className={`flex items-center gap-3 py-3 border-b border-[#e2d5b0]/60 last:border-0
                                cursor-pointer hover:bg-[#C9A84C]/5 rounded-lg px-2 transition-all
                                ${t.done ? "opacity-50" : ""}`}
                  >
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center
                                    justify-center transition-all
                                    ${t.done ? "bg-[#5E5495] border-[#5E5495]" : "border-[#C9A84C] bg-transparent"}`}>
                      {t.done && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <p className={`flex-1 text-sm ${t.done ? "line-through text-[#7C7A8E]" : "text-[#1A1830] font-medium"}`}>
                      {t.title}
                    </p>
                    <span className="text-[10px] text-[#7C7A8E] flex-shrink-0">{t.circle}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0
                                    ${PRIORITY_COLORS[t.priority]}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {showDialog && (
        <NewTaskDialog
          onClose={() => setShowDialog(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}
