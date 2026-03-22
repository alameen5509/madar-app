"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider, EightPointedStar } from "@/components/IslamicPattern";
import {
  getCircles, createCircle, deleteCircle, updateCircle,
  type LifeCircle, type CreateCirclePayload,
} from "@/lib/api";

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

/** تنظيف اسم الدائرة من البادئات والـ JSON */
function cleanName(name: string): string {
  return name
    .replace(/^الدائرة\s*(الأولى|الثانية|الثالثة|الرابعة|الخامسة)?\s*[-:—]?\s*/i, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\[.*?\]/g, "")
    .trim() || name;
}

/** تنظيف الوصف من JSON */
function cleanDesc(desc?: string): string {
  if (!desc) return "";
  return desc.replace(/\{[^}]*\}/g, "").replace(/\[.*?\]/g, "").trim();
}

export default function CirclesPage() {
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🎯");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [newDesc, setNewDesc] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    try { const data = await getCircles(); setCircles(data); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCircles(); }, [fetchCircles]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const order = realCircles.length;
    try {
      await createCircle({ name: newName.trim(), iconKey: newIcon, colorHex: newColor, description: newDesc.trim() || undefined, tier: "First", displayOrder: order } as CreateCirclePayload);
      setNewName(""); setNewDesc(""); setShowNew(false);
      fetchCircles();
    } catch {}
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("حذف هذه الدائرة؟")) return;
    try { await deleteCircle(id); fetchCircles(); } catch {}
  }

  async function savePriorityOrder(ordered: LifeCircle[]) {
    // تحديث الترتيب محلياً ثم في السيرفر
    setCircles(prev => {
      const map = new Map(ordered.map((c, i) => [c.id, i]));
      return [...prev].sort((a, b) => (map.get(a.id) ?? 99) - (map.get(b.id) ?? 99));
    });
    // حفظ في السيرفر
    for (let i = 0; i < ordered.length; i++) {
      updateCircle(ordered[i].id, { displayOrder: i } as Partial<LifeCircle>).catch(() => {});
    }
  }

  // الدوائر الحقيقية مرتبة حسب الأولوية
  const realCircles = circles.filter(c => c.tier !== "Base").sort((a, b) => a.displayOrder - b.displayOrder);
  const top3 = realCircles.slice(0, 3);
  const rest = realCircles.slice(3);
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
          <div className="flex gap-2">
            {realCircles.length > 1 && (
              <button onClick={() => setShowPriority(!showPriority)}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition"
                style={{ background: showPriority ? "#D4AF37" : "var(--card)", color: showPriority ? "#fff" : "var(--muted)", border: `1px solid ${showPriority ? "#D4AF37" : "var(--card-border)"}` }}>
                ⚡ الأولويات
              </button>
            )}
            <button onClick={() => setShowNew(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
              + دائرة
            </button>
          </div>
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
                <p className="text-white/50 text-xs mt-1">{realCircles.length} دائرة · ما تضعه في الأعلى يستحق وقتك أكثر</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ وضع الأولويات — drag & drop ═══ */}
        {showPriority && (
          <div className="rounded-2xl border p-5 space-y-2" style={{ background: "var(--card)", borderColor: "#D4AF3740" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>⚡ ترتيب الأولويات</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>اسحب الدوائر لإعادة ترتيبها — الأعلى = الأهم</p>
              </div>
              <button onClick={() => setShowPriority(false)} className="text-xs px-3 py-1 rounded-lg"
                style={{ background: "#D4AF37", color: "#fff" }}>تم</button>
            </div>
            {realCircles.map((c, idx) => {
              const color = c.colorHex ?? "#5E5495";
              const icon = c.iconKey ?? "⭕";
              return (
                <div key={c.id} draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx === null || dragIdx === idx) return;
                    const ordered = [...realCircles];
                    const [moved] = ordered.splice(dragIdx, 1);
                    ordered.splice(idx, 0, moved);
                    savePriorityOrder(ordered);
                    setDragIdx(null);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-grab active:cursor-grabbing transition hover:shadow-md"
                  style={{ background: dragIdx === idx ? `${color}10` : "var(--bg)", border: `1px solid ${dragIdx === idx ? color : "var(--card-border)"}` }}>
                  <span className="text-sm font-black w-6 text-center" style={{ color: idx < 3 ? "#D4AF37" : "var(--muted)" }}>{idx + 1}</span>
                  <span className="text-lg">{icon}</span>
                  <span className="flex-1 text-sm font-semibold" style={{ color: "var(--text)" }}>{cleanName(c.name)}</span>
                  <span className="text-xs font-bold" style={{ color }}>{c.progressPercent}%</span>
                  <span className="text-[#9CA3AF] text-xs">⠿</span>
                </div>
              );
            })}
          </div>
        )}

        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && realCircles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">⭕</p>
            <p className="font-semibold" style={{ color: "var(--text)" }}>لا توجد دوائر بعد</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>كل دائرة = جانب من حياتك (صحة، عمل، عائلة..)</p>
            <button onClick={() => setShowNew(true)} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>+ إنشاء أول دائرة</button>
          </div>
        )}

        {/* ═══ أعلى 3 دوائر — بطاقات كبيرة ═══ */}
        {!loading && top3.length > 0 && !showPriority && (
          <>
            <GeometricDivider label="الأولويات" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((c, idx) => {
                const color = c.colorHex ?? "#5E5495";
                const icon = c.iconKey ?? "⭕";
                const pending = c.taskCount - Math.round(c.taskCount * c.progressPercent / 100);
                const desc = cleanDesc(c.description);
                return (
                  <Link key={c.id} href={`/circles/${c.id}`}
                    className="rounded-2xl border overflow-hidden transition-all hover:shadow-lg group"
                    style={{ background: "var(--card)", borderColor: `${color}30` }}>
                    {/* رأس البطاقة ملون */}
                    <div className="p-4 text-center relative" style={{ background: `linear-gradient(135deg, ${color}, ${color}90)` }}>
                      <span className="absolute top-2 right-2 text-xs font-black px-2 py-0.5 rounded-full bg-white/20 text-white">#{idx + 1}</span>
                      <div className="relative inline-block mb-2">
                        <ProgressRing percent={c.progressPercent} color="#fff" size={72} />
                        <span className="absolute inset-0 flex items-center justify-center text-3xl">{icon}</span>
                      </div>
                      <h3 className="text-white font-bold text-base">{cleanName(c.name)}</h3>
                      <p className="text-white/60 text-xs">{c.progressPercent}% إنجاز</p>
                    </div>
                    <div className="p-4 space-y-2">
                      {desc && <p className="text-[10px] leading-relaxed" style={{ color: "var(--muted)" }}>{desc.slice(0, 80)}{desc.length > 80 ? "..." : ""}</p>}
                      <div className="flex justify-between text-[10px]" style={{ color: "var(--muted)" }}>
                        <span>{c.goalCount} هدف</span>
                        <span>{c.taskCount} مهمة</span>
                        {pending > 0 && <span style={{ color: "#D4AF37" }}>{pending} معلقة</span>}
                      </div>
                      <div className="rounded-full h-1.5 overflow-hidden" style={{ background: `${color}15` }}>
                        <div className="h-full rounded-full" style={{ width: `${c.progressPercent}%`, background: color }} />
                      </div>
                      <p className="text-[10px] font-medium text-center group-hover:underline" style={{ color }}>فتح الدائرة ←</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ باقي الدوائر — بطاقات أصغر ═══ */}
        {!loading && rest.length > 0 && !showPriority && (
          <>
            <GeometricDivider label="دوائر أخرى" />
            <div className="space-y-2">
              {rest.map((c, idx) => {
                const color = c.colorHex ?? "#5E5495";
                const icon = c.iconKey ?? "⭕";
                return (
                  <Link key={c.id} href={`/circles/${c.id}`}
                    className="flex items-center gap-4 px-5 py-3 rounded-xl border transition-all hover:shadow-md hover:border-[#D4AF37]"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--muted)" }}>#{idx + 4}</span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${color}15` }}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{cleanName(c.name)}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{c.goalCount} هدف · {c.taskCount} مهمة</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 rounded-full h-1.5 overflow-hidden" style={{ background: `${color}15` }}>
                        <div className="h-full rounded-full" style={{ width: `${c.progressPercent}%`, background: color }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color }}>{c.progressPercent}%</span>
                    </div>
                    <button onClick={(e) => handleDelete(c.id, e)} className="text-[#9CA3AF] hover:text-red-500 text-xs">✕</button>
                  </Link>
                );
              })}
            </div>
          </>
        )}

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
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                <button onClick={handleCreate} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${newColor}, #C9A84C)` }}>إنشاء</button>
              </div>
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
                    <button key={i} onClick={() => setNewIcon(i)} className="w-9 h-9 rounded-lg text-lg transition"
                      style={{ background: newIcon === i ? `${newColor}20` : "var(--bg)", border: newIcon === i ? `2px solid ${newColor}` : "1px solid var(--card-border)" }}>{i}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>اللون</p>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PALETTE.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} className="w-8 h-8 rounded-full transition"
                      style={{ background: c, border: newColor === c ? "3px solid var(--text)" : "2px solid transparent", transform: newColor === c ? "scale(1.2)" : "scale(1)" }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
