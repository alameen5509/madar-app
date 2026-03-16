"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GeometricDivider, EightPointedStar } from "@/components/IslamicPattern";
import {
  getCircles, createCircle,
  type LifeCircle, type CircleGoal, type CreateCirclePayload,
} from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { value: "Business", label: "الأعمال" },
];

const TIER_LABELS: Record<string, string> = {
  Base: "أساسية", First: "الأولى", Second: "الثانية", Business: "الأعمال",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  Active:    { label: "نشط",    cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  Paused:    { label: "موقوف",  cls: "bg-yellow-50  text-yellow-700  border-yellow-100"  },
  Completed: { label: "مكتمل", cls: "bg-blue-50    text-blue-700    border-blue-100"    },
  Archived:  { label: "مؤرشف", cls: "bg-gray-50    text-gray-500    border-gray-100"    },
};

// ─── SVG Progress Ring ────────────────────────────────────────────────────────

function ProgressRing({
  percent, color, size = 100, strokeWidth = 7,
}: { percent: number; color: string; size?: number; strokeWidth?: number }) {
  const r      = (size - strokeWidth * 2) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={`${color}20`} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.9s ease" }} />
    </svg>
  );
}

// ─── Circle Card ──────────────────────────────────────────────────────────────

function CircleCard({ circle, isSelected, onClick }: {
  circle: LifeCircle; isSelected: boolean; onClick: () => void;
}) {
  const color = circle.colorHex ?? "#5E5495";
  const icon  = circle.iconKey  ?? "⭕";

  return (
    <button
      onClick={onClick}
      className="w-full text-center rounded-2xl p-5 transition-all duration-200 hover:shadow-lg focus:outline-none"
      style={{
        background: isSelected ? `${color}12` : "#ffffff",
        border:     isSelected ? `2px solid ${color}60` : "1px solid #E2D5B0",
        boxShadow:  isSelected ? `0 4px 24px ${color}28` : undefined,
      }}
    >
      {/* Progress ring + icon */}
      <div className="relative mx-auto" style={{ width: 100, height: 100 }}>
        <ProgressRing percent={circle.progressPercent} color={color} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
            style={{ background: `${color}18` }}>
            {icon}
          </div>
        </div>
        {/* Percent badge */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-black px-1.5 py-0.5 rounded-full text-white"
          style={{ background: color }}>
          {circle.progressPercent}٪
        </div>
      </div>

      {/* Name & tier */}
      <p className="mt-4 font-bold text-sm" style={{ color }}>{circle.name}</p>
      <p className="text-[10px] text-[#7C7A8E] mt-0.5">{TIER_LABELS[circle.tier] ?? circle.tier}</p>

      {/* Stats */}
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
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

// ─── Goal Card (inside panel) ─────────────────────────────────────────────────

function GoalCard({ goal, color }: { goal: CircleGoal; color: string }) {
  const meta = STATUS_META[goal.status] ?? STATUS_META.Active;
  return (
    <div className="bg-white rounded-xl p-4 border border-[#E2D5B0] hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
              {meta.label}
            </span>
            {goal.targetDate && (
              <span className="text-[#7C7A8E] text-[10px]">
                📅 {new Date(goal.targetDate).toLocaleDateString("ar-SA", { month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <h4 className="text-[#1A1830] font-semibold text-sm leading-snug">{goal.title}</h4>
          {goal.description && (
            <p className="text-[#7C7A8E] text-xs mt-1 leading-relaxed line-clamp-2">{goal.description}</p>
          )}
        </div>
        <span className="font-bold text-base flex-shrink-0" style={{ color }}>{goal.progressPercent}٪</span>
      </div>
      <div className="bg-[#F8F6F0] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${goal.progressPercent}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      </div>
    </div>
  );
}

// ─── Goals Panel ─────────────────────────────────────────────────────────────

function GoalsPanel({ circle, onClose }: { circle: LifeCircle; onClose: () => void }) {
  const color = circle.colorHex ?? "#5E5495";
  return (
    <div className="fade-up rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: `${color}30`, background: `${color}06` }}>

      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${color}20` }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
            style={{ background: `${color}20` }}>
            {circle.iconKey ?? "⭕"}
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color }}>{circle.name}</h3>
            <p className="text-[#7C7A8E] text-xs">
              {circle.goalCount} أهداف نشطة · {circle.progressPercent}٪ إنجاز
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-black/5 transition text-sm"
          aria-label="إغلاق">✕</button>
      </div>

      {/* Goals grid */}
      <div className="p-5">
        {circle.goals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[#7C7A8E] text-sm">لا توجد أهداف في هذه الدائرة بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {circle.goals.map((g) => <GoalCard key={g.id} goal={g} color={color} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Circle Dialog ────────────────────────────────────────────────────────

const EMPTY_FORM: CreateCirclePayload = {
  name: "", description: "", iconKey: "⭕", colorHex: "#5E5495",
  tier: "First", isShariaPriority: false,
};

function NewCircleDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (c: LifeCircle) => void;
}) {
  const [form, setForm]       = useState<CreateCirclePayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const nameRef               = useRef<HTMLInputElement>(null);

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
    setLoading(true);
    setError("");
    try {
      const circle = await createCircle(form);
      onCreated(circle);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الإنشاء، حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  }

  const color = form.colorHex ?? "#5E5495";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1830]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-up">

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-[#E2D5B0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ background: `${color}18` }}>
              {form.iconKey}
            </div>
            <h2 className="font-bold text-[#1A1830]">دائرة حياة جديدة</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-[#F8F6F0] transition text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">
              اسم الدائرة <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="مثال: النفس، الأسرة، العمل…"
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
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="ما الذي تمثله هذه الدائرة في حياتك؟"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm resize-none bg-[#FDFAF6]
                         focus:outline-none focus:border-[#5E5495] transition"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">اللون</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => set("colorHex", c)}
                  className="w-8 h-8 rounded-full flex-shrink-0 transition-all duration-150"
                  style={{
                    background: c,
                    boxShadow:  form.colorHex === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                    transform:  form.colorHex === c ? "scale(1.15)" : undefined,
                  }}
                  aria-label={c} />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">الأيقونة</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((ic) => (
                <button key={ic} type="button" onClick={() => set("iconKey", ic)}
                  className="w-9 h-9 rounded-lg text-lg transition-all"
                  style={{
                    background: form.iconKey === ic ? `${color}18` : "#F8F6F0",
                    border:     `1.5px solid ${form.iconKey === ic ? color : "transparent"}`,
                  }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Tier */}
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">المستوى</label>
            <div className="flex gap-2 flex-wrap">
              {TIER_OPTIONS.map((t) => (
                <button key={t.value} type="button" onClick={() => set("tier", t.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: form.tier === t.value ? color : "#F8F6F0",
                    color:      form.tier === t.value ? "#fff" : "#7C7A8E",
                    border:     `1px solid ${form.tier === t.value ? color : "#E2D5B0"}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sharia toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => set("isShariaPriority", !form.isShariaPriority)}
              className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
              style={{ background: form.isShariaPriority ? "#4A8C3D" : "#E2D5B0" }}>
              <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
                style={{ right: form.isShariaPriority ? "0.125rem" : "1.375rem" }} />
            </div>
            <span className="text-sm text-[#1A1830]">🌙 أولوية شرعية / أسرية</span>
          </label>

          {error && (
            <p className="text-red-400 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#7C7A8E]
                         bg-[#F8F6F0] border border-[#E2D5B0] hover:bg-[#F0EDE4] transition">
              إلغاء
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
              {loading ? "جارٍ الإنشاء…" : "إنشاء الدائرة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const [circles, setCircles]       = useState<LifeCircle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCircles(await getCircles());
    } catch {
      setError("تعذّر تحميل الدوائر. تحقق من اتصالك أو سجّل دخولك من جديد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCircles(); }, [fetchCircles]);

  function handleCircleClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleCreated(circle: LifeCircle) {
    setCircles((prev) => [...prev, circle]);
    setSelectedId(circle.id);
  }

  const selectedCircle = circles.find((c) => c.id === selectedId) ?? null;
  const totalGoals  = circles.reduce((s, c) => s + c.goalCount, 0);
  const avgProgress = circles.length === 0 ? 0
    : Math.round(circles.reduce((s, c) => s + c.progressPercent, 0) / circles.length);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">دوائر الحياة</h2>
            {!loading && !error && (
              <p className="text-[#7C7A8E] text-xs">
                {circles.length} دائرة · {totalGoals} هدف نشط · متوسط الإنجاز {avgProgress}٪
              </p>
            )}
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            <span className="text-base leading-none">+</span>
            <span>دائرة جديدة</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Summary banner */}
        {!loading && !error && circles.length > 0 && (
          <div className="fade-up rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #2A2542 0%, #3D3468 60%, #5E5495 100%)" }}>
            <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" aria-hidden>
              <defs>
                <pattern id="circles-bg" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="white" strokeWidth="0.6" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#circles-bg)" />
            </svg>
            <div className="relative z-10 flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}>
                <EightPointedStar size={26} color="#2A2542" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">
                  التوازن العام:{" "}
                  <span className="text-[#E8C96A] font-bold">{avgProgress}٪</span>
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  عبر {circles.length} دوائر و{totalGoals} هدف نشط
                </p>
              </div>
              {/* Mini rings */}
              <div className="hidden md:flex items-center gap-2">
                {circles.slice(0, 5).map((c) => (
                  <div key={c.id} className="relative" style={{ width: 36, height: 36 }}>
                    <ProgressRing percent={c.progressPercent} color={c.colorHex ?? "#5E5495"} size={36} strokeWidth={4} />
                    <div className="absolute inset-0 flex items-center justify-center text-xs">
                      {c.iconKey ?? "⭕"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Circles grid */}
        <section>
          <GeometricDivider label="دوائري" />
          <div className="mt-4">

            {loading && <CirclesSkeleton />}

            {!loading && error && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={fetchCircles} className="text-[#C9A84C] text-sm font-medium hover:underline">
                  إعادة المحاولة
                </button>
              </div>
            )}

            {!loading && !error && circles.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
                  style={{ background: "#F0EDF8" }}>⭕</div>
                <p className="text-[#1A1830] font-semibold mb-1">لا توجد دوائر بعد</p>
                <p className="text-[#7C7A8E] text-sm mb-5">أنشئ دائرتك الأولى لتبدأ رحلة التوازن</p>
                <button onClick={() => setShowDialog(true)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
                  + إنشاء أول دائرة
                </button>
              </div>
            )}

            {!loading && !error && circles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {circles.map((c) => (
                  <CircleCard
                    key={c.id}
                    circle={c}
                    isSelected={selectedId === c.id}
                    onClick={() => handleCircleClick(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Goals panel */}
        {selectedCircle && (
          <section>
            <GeometricDivider label={`أهداف دائرة ${selectedCircle.name}`} />
            <div className="mt-4">
              <GoalsPanel circle={selectedCircle} onClose={() => setSelectedId(null)} />
            </div>
          </section>
        )}

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {/* Dialog */}
      {showDialog && (
        <NewCircleDialog
          onClose={() => setShowDialog(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}
