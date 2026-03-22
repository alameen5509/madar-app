"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

interface Skill { name: string; level: number; target: number; plan?: string; fromJob?: boolean; }

function normalize(s: string | Skill): Skill {
  if (typeof s === "string") return { name: s, level: 5, target: 10, fromJob: false };
  return s;
}

function Stars({ count, max = 10, color, onSet }: { count: number; max?: number; color: string; onSet?: (n: number) => void }) {
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: max }, (_, i) => (
        <button key={i} onClick={() => onSet?.(i + 1)}
          className="text-[10px] transition-transform hover:scale-125"
          style={{ color: i < count ? color : "#E5E7EB", cursor: onSet ? "pointer" : "default" }}>
          ★
        </button>
      ))}
    </div>
  );
}

function RadarChart({ skills }: { skills: Skill[] }) {
  if (skills.length < 3) return null;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const n = skills.length;
  const angleStep = (2 * Math.PI) / n;

  function getPoint(i: number, val: number): [number, number] {
    const angle = -Math.PI / 2 + i * angleStep;
    const ratio = val / 10;
    return [cx + r * ratio * Math.cos(angle), cy + r * ratio * Math.sin(angle)];
  }

  // Grid rings
  const rings = [2, 4, 6, 8, 10];
  const gridLines = rings.map(ring => {
    const pts = skills.map((_, i) => getPoint(i, ring));
    return pts.map(p => `${p[0]},${p[1]}`).join(" ");
  });

  // Current polygon
  const currentPts = skills.map((s, i) => getPoint(i, s.level));
  const currentPath = currentPts.map(p => `${p[0]},${p[1]}`).join(" ");

  // Target polygon
  const targetPts = skills.map((s, i) => getPoint(i, s.target));
  const targetPath = targetPts.map(p => `${p[0]},${p[1]}`).join(" ");

  // Axis lines + labels
  const axes = skills.map((s, i) => {
    const [ex, ey] = getPoint(i, 10);
    const [lx, ly] = getPoint(i, 11.5);
    return { x1: cx, y1: cy, x2: ex, y2: ey, lx, ly, name: s.name };
  });

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid */}
        {gridLines.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
        ))}
        {/* Axes */}
        {axes.map((a, i) => (
          <g key={i}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#E5E7EB" strokeWidth="0.5" />
            <text x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle"
              fontSize="7" fill="#6B7280" fontWeight="600">{a.name}</text>
          </g>
        ))}
        {/* Target polygon */}
        <polygon points={targetPath} fill="#D4AF3710" stroke="#D4AF37" strokeWidth="1" strokeDasharray="3 2" />
        {/* Current polygon */}
        <polygon points={currentPath} fill="#2D6B9E20" stroke="#2D6B9E" strokeWidth="1.5" />
        {/* Current dots */}
        {currentPts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r="3" fill="#2D6B9E" />
        ))}
      </svg>
    </div>
  );
}

export default function SkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [showAdd, setShowAdd] = useState(false);
  const [fName, setFName] = useState("");
  const [fLevel, setFLevel] = useState(5);
  const [fTarget, setFTarget] = useState(10);
  const [fPlan, setFPlan] = useState("");
  const [fFromJob, setFFromJob] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const skills: Skill[] = meta.skills.map(normalize);

  function save(updated: Skill[]) {
    setMeta({ ...meta, skills: updated });
  }

  function add() {
    if (!fName.trim()) return;
    save([...skills, { name: fName.trim(), level: fLevel, target: fTarget, plan: fPlan.trim() || undefined, fromJob: fFromJob }]);
    setFName(""); setFLevel(5); setFTarget(10); setFPlan(""); setFFromJob(false); setShowAdd(false);
  }

  function updateLevel(i: number, level: number) {
    const arr = [...skills]; arr[i] = { ...arr[i], level }; save(arr);
  }

  function updateTarget(i: number, target: number) {
    const arr = [...skills]; arr[i] = { ...arr[i], target }; save(arr);
  }

  function remove(i: number) {
    const arr = [...skills]; arr.splice(i, 1); save(arr);
  }

  function savePlan(i: number, plan: string) {
    const arr = [...skills]; arr[i] = { ...arr[i], plan: plan.trim() || undefined }; save(arr); setEditIdx(null);
  }

  const fromJobSkills = skills.filter(s => s.fromJob);
  const avgLevel = skills.length > 0 ? Math.round(skills.reduce((s, sk) => s + sk.level, 0) / skills.length * 10) / 10 : 0;
  const mastered = skills.filter(s => s.level >= s.target).length;

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>المهارات</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{skills.length} مهارة · متوسط {avgLevel}/10 · {mastered} متقنة</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + مهارة جديدة
          </button>
        </div>

        {/* Radar chart */}
        {skills.length >= 3 && (
          <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs font-bold mb-3 text-center" style={{ color: "var(--muted)" }}>
              <span style={{ color: "#2D6B9E" }}>● الحالي</span> · <span style={{ color: "#D4AF37" }}>◻ المستهدف</span>
            </p>
            <RadarChart skills={skills} />
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="rounded-2xl p-5 border-2 space-y-3 fade-up" style={{ borderColor: "#2D6B9E40", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>مهارة جديدة</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={add} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>إضافة</button>
              </div>
            </div>
            <input value={fName} onChange={e => setFName(e.target.value)} placeholder="اسم المهارة *"
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>المستوى الحالي: <b style={{ color: "#2D6B9E" }}>{fLevel}/10</b></p>
                <Stars count={fLevel} color="#2D6B9E" onSet={setFLevel} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>المستهدف: <b style={{ color: "#D4AF37" }}>{fTarget}/10</b></p>
                <Stars count={fTarget} color="#D4AF37" onSet={setFTarget} />
              </div>
            </div>
            <input value={fPlan} onChange={e => setFPlan(e.target.value)} placeholder="خطة التطوير (اختياري)"
              className="w-full px-4 py-2 rounded-xl border text-xs focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={fFromJob} onChange={() => setFFromJob(!fFromJob)} className="accent-[#3D8C5A]" />
              <span className="text-xs" style={{ color: "var(--text)" }}>مكتسبة من هذه الوظيفة</span>
            </label>
          </div>
        )}

        {/* Summary */}
        {skills.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>إجمالي</p>
              <p className="text-xl font-black" style={{ color: "#2D6B9E" }}>{skills.length}</p>
            </div>
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>متقنة</p>
              <p className="text-xl font-black" style={{ color: "#3D8C5A" }}>{mastered}</p>
            </div>
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>من الوظيفة</p>
              <p className="text-xl font-black" style={{ color: "#D4AF37" }}>{fromJobSkills.length}</p>
            </div>
          </div>
        )}

        {/* Skills grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {skills.map((s, i) => {
            const pct = Math.round((s.level / s.target) * 100);
            const color = pct >= 100 ? "#3D8C5A" : pct >= 60 ? "#2D6B9E" : "#D4AF37";
            return (
              <div key={i} className="rounded-2xl p-4 border transition-all hover:shadow-sm"
                style={{ background: "var(--card)", borderColor: s.fromJob ? "#3D8C5A30" : "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{s.name}</p>
                    {s.fromJob && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>من الوظيفة</span>}
                  </div>
                  <button onClick={() => remove(i)} className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
                </div>

                {/* Current level */}
                <div className="mb-1">
                  <p className="text-[9px] mb-0.5" style={{ color: "var(--muted)" }}>الحالي: <b style={{ color: "#2D6B9E" }}>{s.level}/10</b></p>
                  <Stars count={s.level} color="#2D6B9E" onSet={n => updateLevel(i, n)} />
                </div>

                {/* Target level */}
                <div className="mb-2">
                  <p className="text-[9px] mb-0.5" style={{ color: "var(--muted)" }}>المستهدف: <b style={{ color: "#D4AF37" }}>{s.target}/10</b></p>
                  <Stars count={s.target} color="#D4AF37" onSet={n => updateTarget(i, n)} />
                </div>

                {/* Gap bar */}
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: `${color}15` }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                </div>

                {/* Plan */}
                {editIdx === i ? (
                  <div className="flex gap-1 mt-1">
                    <input defaultValue={s.plan ?? ""} onKeyDown={e => { if (e.key === "Enter") savePlan(i, (e.target as HTMLInputElement).value); }}
                      placeholder="خطة التطوير…"
                      className="flex-1 px-2 py-1 rounded-lg border text-[10px] focus:outline-none"
                      style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
                    <button onClick={() => setEditIdx(null)} className="text-[9px] text-[#6B7280]">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setEditIdx(i)} className="text-[10px] hover:underline w-full text-right"
                    style={{ color: s.plan ? "var(--text)" : "var(--muted)" }}>
                    {s.plan ? `📋 ${s.plan}` : "+ خطة تطوير"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {skills.length === 0 && !showAdd && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">💡</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد مهارات</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>أضف المهارات المطلوبة لهذه الوظيفة</p>
          </div>
        )}
      </div>
    </JobPageShell>
  );
}
