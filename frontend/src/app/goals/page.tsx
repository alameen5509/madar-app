"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getGoals, createGoal, type Goal, type CreateGoalPayload } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GoalSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2D5B0] animate-pulse">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="w-16 h-5 rounded-full bg-[#E2D5B0]" />
                <div className="w-24 h-5 rounded bg-[#E2D5B0]" />
              </div>
              <div className="w-3/4 h-4 rounded bg-[#E2D5B0]" />
            </div>
            <div className="w-10 h-7 rounded bg-[#E2D5B0]" />
          </div>
          <div className="h-2 rounded-full bg-[#E2D5B0]" />
        </div>
      ))}
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: Goal }) {
  const color = goal.lifeCircle?.color ?? "#5E5495";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2D5B0] hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {goal.lifeCircle && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${color}18`, color }}
              >
                {goal.lifeCircle.name}
              </span>
            )}
            <span className="text-[#7C7A8E] text-xs">📅 {formatDate(goal.targetDate)}</span>
            {goal.status !== "Active" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {{ Paused: "موقوف", Completed: "مكتمل", Archived: "مؤرشف" }[goal.status] ?? goal.status}
              </span>
            )}
          </div>
          <h3 className="text-[#1A1830] font-semibold text-sm">{goal.title}</h3>
          {goal.description && (
            <p className="text-[#7C7A8E] text-xs mt-1 leading-relaxed">{goal.description}</p>
          )}
        </div>
        <span className="font-bold text-lg flex-shrink-0" style={{ color }}>
          {goal.progressPercent}٪
        </span>
      </div>
      <div className="mt-3 bg-[#F8F6F0] rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${goal.progressPercent}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>
    </div>
  );
}

// ─── New Goal Dialog ──────────────────────────────────────────────────────────

const WEIGHT_OPTIONS = [
  { value: 5, label: "بالغ الأهمية" },
  { value: 4, label: "مهم جداً"    },
  { value: 3, label: "متوسط"       },
  { value: 2, label: "منخفض"       },
  { value: 1, label: "اختياري"     },
];

function NewGoalDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: Goal) => void;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priorityWeight, setWeight] = useState<number>(3);
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
    if (!title.trim()) { setError("عنوان الهدف مطلوب"); return; }
    setLoading(true);
    setError("");
    try {
      const goal = await createGoal({
        title: title.trim(),
        description: description.trim() || undefined,
        targetDate: targetDate || undefined,
        priorityWeight,
      });
      onCreated(goal);
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
          <h2 className="font-bold text-[#1A1830]">هدف جديد</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-[#F8F6F0] transition text-sm"
          >✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              عنوان الهدف <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تعلم لغة برمجية جديدة…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6]
                         focus:outline-none focus:border-[#5E5495] transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              وصف مختصر <span className="text-[#7C7A8E] font-normal">(اختياري)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="ما الذي تريد تحقيقه من هذا الهدف؟"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm resize-none bg-[#FDFAF6]
                         focus:outline-none focus:border-[#5E5495] transition"
            />
          </div>

          {/* Priority Weight */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">وزن الأولوية</label>
            <div className="flex gap-2 flex-wrap">
              {WEIGHT_OPTIONS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setWeight(w.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: priorityWeight === w.value ? "#5E5495" : "#F8F6F0",
                    color:      priorityWeight === w.value ? "#fff"     : "#7C7A8E",
                    border:     `1px solid ${priorityWeight === w.value ? "#5E5495" : "#E2D5B0"}`,
                  }}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              تاريخ الاستهداف <span className="text-[#7C7A8E] font-normal">(اختياري)</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
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
              {loading ? "جارٍ الإنشاء…" : "إنشاء الهدف"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals]           = useState<Goal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setGoals(await getGoals());
    } catch {
      setError("تعذّر تحميل الأهداف. تحقق من اتصالك أو سجّل دخولك من جديد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  function handleCreated(goal: Goal) {
    setGoals((prev) => [goal, ...prev]);
  }

  const active    = goals.filter((g) => g.status === "Active").length;
  const completed = goals.filter((g) => g.status === "Completed").length;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">الأهداف</h2>
            {!loading && !error && (
              <p className="text-[#7C7A8E] text-xs">{active} نشط · {completed} مكتمل</p>
            )}
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            <span>+</span><span>هدف جديد</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        <section>
          <GeometricDivider label="أهدافي" />
          <div className="mt-4">

            {loading && <GoalSkeleton />}

            {!loading && error && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={fetchGoals} className="text-[#C9A84C] text-sm font-medium hover:underline">
                  إعادة المحاولة
                </button>
              </div>
            )}

            {!loading && !error && goals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#7C7A8E] text-sm mb-3">لا توجد أهداف حتى الآن</p>
                <button
                  onClick={() => setShowDialog(true)}
                  className="text-[#5E5495] text-sm font-medium hover:underline"
                >
                  + أضف أول هدف
                </button>
              </div>
            )}

            {!loading && !error && goals.length > 0 && (
              <div className="space-y-3">
                {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
              </div>
            )}
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {showDialog && (
        <NewGoalDialog
          onClose={() => setShowDialog(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}
