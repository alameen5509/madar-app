"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider, EightPointedStar } from "@/components/IslamicPattern";
import {
  getCircles, createCircle, deleteCircle, updateCircle,
  type LifeCircle, type CreateCirclePayload,
} from "@/lib/api";

/* ─── Constants ─────────────────────────────────────────────────────── */

const COLOR_PALETTE = ["#5E5495", "#C9A84C", "#3D8C8C", "#8C4A3D", "#2D6B9E", "#4A8C3D", "#8C3D6B", "#E8631A", "#1A7DE8", "#3D9970"];
const ICON_OPTIONS = ["🌿", "🏡", "🤝", "💼", "📚", "💪", "🎯", "🌙", "⭐", "💡", "🌱", "🏋️", "✈️", "🎓", "💰", "🙏", "❤️", "🧠", "🎨", "⚡"];

function ProgressRing({ percent, color, size = 90 }: { percent: number; color: string; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}15`} strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function CirclesPage() {
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🎯");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [newDesc, setNewDesc] = useState("");

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    try { const data = await getCircles(); setCircles(data); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCircles(); }, [fetchCircles]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createCircle({ name: newName.trim(), iconKey: newIcon, colorHex: newColor, description: newDesc.trim() || undefined, tier: "First" } as CreateCirclePayload);
      setNewName(""); setNewDesc(""); setShowNew(false);
      fetchCircles();
    } catch {}
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذه الدائرة؟")) return;
    try { await deleteCircle(id); fetchCircles(); } catch {}
  }

  // فصل: الدوائر الحقيقية (ليست Base)
  const realCircles = circles.filter(c => c.tier !== "Base");
  const avgProgress = realCircles.length === 0 ? 0 : Math.round(realCircles.reduce((s, c) => s + c.progressPercent, 0) / realCircles.length);
  const totalTasks = realCircles.reduce((s, c) => s + c.taskCount, 0);
  const totalGoals = realCircles.reduce((s, c) => s + c.goalCount, 0);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">دوائر الحياة</h2>
            {!loading && <p className="text-[#7C7A8E] text-xs">{realCircles.length} دائرة · {totalGoals} هدف · {totalTasks} مهمة</p>}
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
            + دائرة جديدة
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* ملخص التوازن */}
        {!loading && realCircles.length > 0 && (
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #2A2542 0%, #5E5495 100%)" }}>
            <div className="relative z-10 flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <ProgressRing percent={avgProgress} color="#E8C96A" size={80} />
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">{avgProgress}%</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-base">التوازن العام</p>
                <p className="text-white/50 text-xs mt-1">{realCircles.length} دائرة · {totalGoals} هدف · {totalTasks} مهمة</p>
              </div>
            </div>
          </div>
        )}

        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && realCircles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">⭕</p>
            <p className="font-semibold" style={{ color: "var(--text)" }}>لا توجد دوائر بعد</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>كل دائرة = جانب من حياتك (صحة، عمل، عائلة..)</p>
          </div>
        )}

        {/* بطاقات الدوائر */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {realCircles.map(c => {
            const color = c.colorHex ?? "#5E5495";
            const icon = c.iconKey ?? "⭕";
            const pendingTasks = c.taskCount - Math.round(c.taskCount * c.progressPercent / 100);
            return (
              <Link key={c.id} href={`/circles/${c.id}`}
                className="rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:border-[#D4AF37] group"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    {/* أيقونة + progress ring */}
                    <div className="relative flex-shrink-0">
                      <ProgressRing percent={c.progressPercent} color={color} size={64} />
                      <span className="absolute inset-0 flex items-center justify-center text-2xl">{icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate" style={{ color: "var(--text)" }}>{c.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {c.goalCount} هدف · {c.taskCount} مهمة
                      </p>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="text-xl font-black" style={{ color }}>{c.progressPercent}%</p>
                      {pendingTasks > 0 && (
                        <p className="text-[10px]" style={{ color: "var(--muted)" }}>{pendingTasks} معلقة</p>
                      )}
                    </div>
                  </div>

                  {/* شريط التقدم */}
                  <div className="rounded-full h-2 overflow-hidden" style={{ background: `${color}15` }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${c.progressPercent}%`, background: color }} />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-2.5 flex items-center justify-between border-t" style={{ borderColor: "var(--card-border)", background: `${color}05` }}>
                  <span className="text-[10px] font-medium group-hover:underline" style={{ color }}>فتح الدائرة ←</span>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(c.id); }}
                    className="text-[10px] text-[#9CA3AF] hover:text-red-500 transition">✕</button>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {/* نموذج إضافة دائرة */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md fade-up"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
              <h3 className="font-bold" style={{ color: "var(--text)" }}>دائرة حياة جديدة</h3>
              <button onClick={() => setShowNew(false)} style={{ color: "var(--muted)" }}>✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم الدائرة (مثال: الصحة، العمل، العائلة)"
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="الرؤية والهدف العام (اختياري)" rows={2}
                className="w-full px-4 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>الأيقونة</p>
                <div className="flex gap-1.5 flex-wrap">
                  {ICON_OPTIONS.map(i => (
                    <button key={i} onClick={() => setNewIcon(i)}
                      className="w-9 h-9 rounded-lg text-lg transition"
                      style={{ background: newIcon === i ? `${newColor}20` : "var(--bg)", border: newIcon === i ? `2px solid ${newColor}` : "1px solid var(--card-border)" }}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>اللون</p>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PALETTE.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className="w-8 h-8 rounded-full transition"
                      style={{ background: c, border: newColor === c ? "3px solid var(--text)" : "2px solid transparent", transform: newColor === c ? "scale(1.2)" : "scale(1)" }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${newColor}, #C9A84C)` }}>إنشاء الدائرة</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
