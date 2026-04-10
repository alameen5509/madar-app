"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getGoals, getCircles, createGoal, updateGoal, deleteGoal, getGoalTasks,
  createTask, api,
  type Goal, type LifeCircle, type SmartTask,
} from "@/lib/api";

async function setFocusApi(goalId: string, focusType: string | null): Promise<{ id: string; focusType: string | null }> {
  const { data } = await api.post(`/api/goals/${goalId}/focus`, { focusType });
  return data;
}

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

const STATUSES = [
  { key: "Draft",     label: "مسودة",    color: "#6B7280", icon: "📝" },
  { key: "Active",    label: "قائم",     color: "#3D8C5A", icon: "🟢" },
  { key: "Critical",  label: "حرجة",    color: "#DC2626", icon: "⚠️" },
  { key: "Suspended", label: "معلق",    color: "#F59E0B", icon: "⏸️" },
  { key: "Completed", label: "مكتمل",   color: "#2D6B9E", icon: "✅" },
] as const;

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));

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

function scoreLabelAr(s: number): string {
  if (s > 45) return "حرج";
  if (s > 30) return "مرتفع";
  if (s > 15) return "متوسط";
  return "منخفض";
}

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  Inbox: { label: "وارد", color: "#6B7280" },
  Todo: { label: "مخطط", color: "#3B82F6" },
  InProgress: { label: "جاري", color: "#F59E0B" },
  Completed: { label: "مكتمل", color: "#3D8C5A" },
  Deferred: { label: "مؤجل", color: "#8B5CF6" },
};

interface ProjectPrefs {
  pinned: string[];
  tags: Record<string, string[]>;
  progressMode: Record<string, "auto" | "manual">;
  manualProgress: Record<string, number>;
  people: Record<string, { name: string; role: string }[]>;
  linkedWork: Record<string, string>;
}

const DEFAULT_PREFS: ProjectPrefs = { pinned: [], tags: {}, progressMode: {}, manualProgress: {}, people: {}, linkedWork: {} };

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function ProjectsPageWrapper() {
  return <Suspense><ProjectsPageInner /></Suspense>;
}

function ProjectsPageInner() {
  const searchParams = useSearchParams();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [works, setWorks] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [prefs, setPrefs] = useState<ProjectPrefs>(DEFAULT_PREFS);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "job" | "role" | "manual">("all");
  const [autoSelected, setAutoSelected] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [g, c] = await Promise.all([getGoals(), getCircles()]);
      setGoals(g); setCircles(c);
      api.get("/api/works").then(r => setWorks((r.data ?? []).map((w: { id: string; name: string; type: string }) => ({ id: w.id, name: w.name, type: w.type })))).catch(() => {});
      api.get("/api/users/me/preferences").then(r => {
        if (r.data?.projectPrefs) setPrefs({ ...DEFAULT_PREFS, ...r.data.projectPrefs });
      }).catch(() => {});
    } catch { setError("تعذّر تحميل المشاريع"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-select project from URL ?id=xxx
  useEffect(() => {
    if (autoSelected || goals.length === 0) return;
    const id = searchParams.get("id");
    if (id) {
      const match = goals.find(g => g.id === id);
      if (match) { setSelected(match); setAutoSelected(true); }
    }
  }, [goals, searchParams, autoSelected]);

  function savePrefs(updated: ProjectPrefs) {
    setPrefs(updated);
    api.get("/api/users/me/preferences").then(({ data }) => {
      api.put("/api/users/me/preferences", { ...data, projectPrefs: updated }).catch(() => {});
    }).catch(() => {});
  }

  function togglePin(id: string) {
    const p = prefs.pinned.includes(id) ? prefs.pinned.filter(x => x !== id) : [...prefs.pinned, id];
    savePrefs({ ...prefs, pinned: p });
  }

  // Sorting: Critical → Pinned → rest
  function sortedGoals(list: Goal[]): Goal[] {
    return [...list].sort((a, b) => {
      // Pinned first
      const aPin = prefs.pinned.includes(a.id) ? -1000 : 0;
      const bPin = prefs.pinned.includes(b.id) ? -1000 : 0;
      // Then by score (higher = more urgent = first)
      const aScore = getProjectScore(a.description) ?? 0;
      const bScore = getProjectScore(b.description) ?? 0;
      return (aPin - bPin) || (bScore - aScore);
    });
  }

  // Filter by tag + source
  const filteredGoals = goals.filter(g => {
    if (tagFilter && !(prefs.tags[g.id] ?? []).includes(tagFilter)) return false;
    if (sourceFilter !== "all" && (g.source ?? "manual") !== sourceFilter) return false;
    return true;
  });

  const techFocus = goals.find(g => g.focusType === "Tech");
  const nonTechFocus = goals.find(g => g.focusType === "NonTech");
  const critical = sortedGoals(filteredGoals.filter(g => g.status === "Critical"));
  const active = sortedGoals(filteredGoals.filter(g => g.status === "Active"));
  const suspended = filteredGoals.filter(g => g.status === "Suspended");
  const completed = filteredGoals.filter(g => g.status === "Completed");
  const drafts = filteredGoals.filter(g => g.status === "Draft" || g.status === "Archived" || g.status === "Paused");

  // All non-completed/non-archived goals for dropdown selection
  const selectableGoals = goals.filter(g => g.status !== "Completed" && g.status !== "Archived");

  async function handleSetFocus(goalId: string, focusType: string | null) {
    try {
      const res = await setFocusApi(goalId, focusType);
      setGoals(prev => prev.map(g => {
        if (g.id === res.id) return { ...g, focusType: res.focusType as Goal["focusType"] };
        // If another goal had same focusType, clear it
        if (focusType && g.focusType === focusType && g.id !== res.id) return { ...g, focusType: null };
        return g;
      }));
    } catch {}
  }

  // All tags
  const allTags = [...new Set(Object.values(prefs.tags).flat())];

  // Days until deadline
  function daysLeft(date?: string): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  }

  const circleMap = new Map(circles.map(c => [c.id, c]));
  const stats = { total: goals.length, critical: critical.length, active: active.length, completed: completed.length };

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 sm:py-4 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-bold text-lg sm:text-xl" style={{ color: "var(--text)" }}>إدارة المشاريع</h2>
            {!loading && (<>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs" style={{ color: "var(--muted)" }}>{stats.total} مشروع</span>
                {techFocus && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#3B82F615", color: "#3B82F6" }}>💻 {techFocus.title}</span>}
                {nonTechFocus && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#D4AF3715", color: "#D4AF37" }}>🌿 {nonTechFocus.title}</span>}
                {stats.critical > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: "#DC262615", color: "#DC2626" }}>⚠️ {stats.critical} حرجة</span>}
              </div>
              <div className="flex gap-1.5 mt-2">
                {([
                  { key: "all", label: "الكل", color: "#5E5495", count: goals.length },
                  { key: "job", label: "💼 الأعمال", color: "#2D6B9E", count: goals.filter(g => g.source === "job").length },
                  { key: "role", label: "◎ الأدوار", color: "#C9A84C", count: goals.filter(g => g.source === "role").length },
                  { key: "manual", label: "🎯 يدوية", color: "#3D8C5A", count: goals.filter(g => !g.source || g.source === "manual").length },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setSourceFilter(f.key)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                    style={{ background: sourceFilter === f.key ? f.color + "20" : "var(--bg)", color: sourceFilter === f.key ? f.color : "var(--muted)", border: `1px solid ${sourceFilter === f.key ? f.color + "40" : "var(--card-border)"}` }}>
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </>)}
          </div>
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            + مشروع جديد
          </button>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
            <button onClick={() => setTagFilter(null)}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition flex-shrink-0"
              style={{ background: !tagFilter ? "#5E5495" : "var(--bg)", color: !tagFilter ? "#fff" : "var(--muted)", border: `1px solid ${!tagFilter ? "#5E5495" : "var(--card-border)"}` }}>
              الكل
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition flex-shrink-0"
                style={{ background: tagFilter === tag ? "#D4AF37" : "var(--bg)", color: tagFilter === tag ? "#fff" : "#D4AF37", border: `1px solid ${tagFilter === tag ? "#D4AF37" : "#D4AF3730"}` }}>
                {tag}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4">
        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}
        {error && (
          <div className="text-center py-8">
            <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>
            <button onClick={fetchData} className="text-sm px-4 py-2 rounded-lg" style={{ background: "#D4AF3720", color: "#D4AF37" }}>إعادة المحاولة</button>
          </div>
        )}

        {/* ═══ Collapsible Sections ═══ */}
        {!loading && !error && (
          <div className="space-y-4">
            {/* ═══ التركيز الآن — أعلى شيء ═══ */}
            <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: "#D4AF37", background: "linear-gradient(135deg, #D4AF3706, #2C2C5406)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#D4AF3710" }}>
                <span className="text-sm">🎯</span>
                <span className="font-bold text-sm" style={{ color: "#D4AF37" }}>التركيز الآن</span>
              </div>
              <div className="px-4 pb-4 pt-2 space-y-3">
                {/* ── تركيز تقني ── */}
                <FocusSlot
                  label="تقني" icon="💻" color="#3B82F6"
                  goal={techFocus} goals={selectableGoals} circleMap={circleMap}
                  focusType="Tech"
                  onSelect={(id) => handleSetFocus(id, "Tech")}
                  onClear={() => techFocus && handleSetFocus(techFocus.id, null)}
                  onClick={(g) => setSelected(g)}
                />
                {/* ── تركيز غير تقني ── */}
                <FocusSlot
                  label="غير تقني" icon="🌿" color="#D4AF37"
                  goal={nonTechFocus} goals={selectableGoals} circleMap={circleMap}
                  focusType="NonTech"
                  onSelect={(id) => handleSetFocus(id, "NonTech")}
                  onClear={() => nonTechFocus && handleSetFocus(nonTechFocus.id, null)}
                  onClick={(g) => setSelected(g)}
                />
              </div>
            </div>

            {/* حرجة — مفتوحة دائماً */}
            {critical.length > 0 && (
              <CollapsibleSection icon="⚠️" label="حرجة" count={critical.length} color="#DC2626" defaultOpen isCritical>
                {critical.map(g => <ProjectCard key={g.id} goal={g} circleMap={circleMap} prefs={prefs} onTogglePin={togglePin} onClick={() => setSelected(g)} daysLeft={daysLeft(g.targetDate)} isCritical />)}
              </CollapsibleSection>
            )}

            {/* قائم — مفتوحة افتراضياً */}
            <CollapsibleSection icon="🟢" label="قائم" count={active.length} color="#3D8C5A" defaultOpen>
              {active.length > 0
                ? active.map(g => <ProjectCard key={g.id} goal={g} circleMap={circleMap} prefs={prefs} onTogglePin={togglePin} onClick={() => setSelected(g)} daysLeft={daysLeft(g.targetDate)} />)
                : <EmptySection text="لا توجد مشاريع قائمة" />}
            </CollapsibleSection>

            {/* معلق — مغلقة افتراضياً */}
            {suspended.length > 0 && (
              <CollapsibleSection icon="⏸️" label="معلق" count={suspended.length} color="#F59E0B" defaultOpen={false}>
                {suspended.map(g => {
                  const daysUntil = g.suspendedUntil ? Math.ceil((new Date(g.suspendedUntil).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={g.id} onClick={() => setSelected(g)} className="rounded-xl border p-3 cursor-pointer hover:shadow-sm transition opacity-70"
                      style={{ background: "var(--card)", borderColor: "#F59E0B30" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⏸️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{g.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {g.suspendReason && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{g.suspendReason}</span>}
                            {daysUntil !== null && daysUntil > 0 && <span className="text-[9px] font-bold" style={{ color: "#F59E0B" }}>ينتهي خلال {daysUntil} يوم</span>}
                            {daysUntil !== null && daysUntil <= 0 && <span className="text-[9px] font-bold" style={{ color: "#3D8C5A" }}>انتهى التعليق</span>}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); api.patch(`/api/goals/${g.id}/unsuspend`).then(() => fetchData()).catch(() => {}); }}
                          className="text-[10px] px-2 py-1 rounded-lg font-semibold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>
                          رفع التعليق
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleSection>
            )}

            {/* مسودة — مغلقة افتراضياً */}
            {drafts.length > 0 && (
              <CollapsibleSection icon="📝" label="مسودة" count={drafts.length} color="#6B7280" defaultOpen={false}>
                {drafts.map(g => <ProjectCard key={g.id} goal={g} circleMap={circleMap} prefs={prefs} onTogglePin={togglePin} onClick={() => setSelected(g)} daysLeft={daysLeft(g.targetDate)} isDraft />)}
              </CollapsibleSection>
            )}

            {/* مكتمل — مغلقة افتراضياً */}
            {completed.length > 0 && (
              <CollapsibleSection icon="✅" label="مكتمل" count={completed.length} color="#2D6B9E" defaultOpen={false}>
                {completed.map(g => <ProjectCard key={g.id} goal={g} circleMap={circleMap} prefs={prefs} onTogglePin={togglePin} onClick={() => setSelected(g)} daysLeft={daysLeft(g.targetDate)} isCompleted />)}
              </CollapsibleSection>
            )}
          </div>
        )}

        {!loading && goals.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📁</p>
            <p className="font-bold text-lg mb-2" style={{ color: "var(--text)" }}>لا توجد مشاريع</p>
            <button onClick={() => setShowNew(true)} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>+ مشروع جديد</button>
          </div>
        )}

        <div className="pb-4 mt-4"><GeometricDivider /></div>
      </div>

      {showNew && <NewProjectDialog circles={circles} works={works} onClose={() => setShowNew(false)} onCreated={fetchData} />}

      {selected && (
        <ProjectDetail
          goal={selected} circle={selected.lifeCircle ? circleMap.get(selected.lifeCircle.id) : undefined}
          circles={circles} works={works} prefs={prefs} savePrefs={savePrefs}
          onClose={() => setSelected(null)} onRefresh={() => { fetchData(); setSelected(null); }}
        />
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FOCUS SLOT — خانة اختيار تركيز (تقني / غير تقني)
   ═══════════════════════════════════════════════════════════════════════ */

function FocusSlot({ label, icon, color, goal, goals, circleMap, focusType, onSelect, onClear, onClick }: {
  label: string; icon: string; color: string;
  goal?: Goal; goals: Goal[]; circleMap: Map<string, LifeCircle>;
  focusType: string;
  onSelect: (goalId: string) => void;
  onClear: () => void;
  onClick: (g: Goal) => void;
}) {
  // Exclude the goal already assigned to the OTHER focus slot
  const available = goals.filter(g => !g.focusType || g.focusType === focusType);

  if (goal) {
    const circle = goal.lifeCircle ? circleMap.get(goal.lifeCircle.id) : undefined;
    return (
      <div className="rounded-xl border p-3 flex items-center gap-3 cursor-pointer hover:shadow-sm transition"
        style={{ borderColor: `${color}40`, background: `${color}06` }}
        onClick={() => onClick(goal)}>
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{label}</span>
            <span className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{goal.title}</span>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-[10px] px-2 py-1 rounded-lg font-semibold transition hover:opacity-80 flex-shrink-0"
          style={{ background: `${color}15`, color }}>
          إلغاء
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed p-3 flex items-center gap-3"
      style={{ borderColor: `${color}25` }}>
      <span className="text-lg flex-shrink-0 opacity-40">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
        <select
          value=""
          onChange={e => { if (e.target.value) onSelect(e.target.value); }}
          className="w-full mt-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
          style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }}>
          <option value="">اختر مشروع {label}...</option>
          {available.map(g => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION HEADER (collapsible)
   ═══════════════════════════════════════════════════════════════════════ */

function CollapsibleSection({ icon, label, count, color, defaultOpen, isCritical, children }: {
  icon: string; label: string; count: number; color: string;
  defaultOpen: boolean; isCritical?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${isCritical ? "animate-pulse-subtle" : ""}`}
      style={{ borderColor: isCritical ? "#DC2626" : `${color}30`, borderWidth: isCritical ? 2 : 1 }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 transition-colors"
        style={{ background: `${color}08` }}>
        <span className={`text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color }}>▼</span>
        <span className="text-sm">{icon}</span>
        <span className="font-bold text-sm" style={{ color }}>{label}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{count}</span>
        <div className="flex-1" />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return <div className="py-6 text-center rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}><p className="text-xs" style={{ color: "var(--muted)" }}>{text}</p></div>;
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECT CARD
   ═══════════════════════════════════════════════════════════════════════ */

function ProjectCard({ goal, circleMap, prefs, onTogglePin, onClick, daysLeft, isCritical, isCompleted, isDraft }: {
  goal: Goal; circleMap: Map<string, LifeCircle>; prefs: ProjectPrefs;
  onTogglePin: (id: string) => void; onClick: () => void;
  daysLeft: number | null; isCritical?: boolean; isCompleted?: boolean; isDraft?: boolean;
}) {
  const circle = goal.lifeCircle ? circleMap.get(goal.lifeCircle.id) : undefined;
  const pinned = prefs.pinned.includes(goal.id);
  const tags = prefs.tags[goal.id] ?? [];
  const status = STATUS_MAP[goal.status] ?? STATUS_MAP.Active;
  const deadlineAlert = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
  const overdue = daysLeft !== null && daysLeft < 0;
  const score = getProjectScore(goal.description);

  return (
    <div onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${isCritical ? "animate-pulse-subtle" : ""} ${isCompleted ? "opacity-60" : ""} ${isDraft ? "opacity-50" : ""}`}
      style={{
        background: "var(--card)",
        borderColor: isCritical ? "#DC2626" : "var(--card-border)",
        borderWidth: isCritical ? 2 : 1,
      }}>
      <div className="flex items-start gap-3">
        {/* Pin */}
        <button onClick={(e) => { e.stopPropagation(); onTogglePin(goal.id); }}
          className="text-sm mt-0.5 flex-shrink-0 transition hover:scale-125"
          style={{ color: pinned ? "#D4AF37" : "var(--card-border)" }}>
          📌
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {score !== null && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black" style={{ background: scoreColor(score) + "18", color: scoreColor(score) }}>
                {score}/60 {scoreLabelAr(score)}
              </span>
            )}
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{goal.title}</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${status.color}15`, color: status.color }}>
              {status.icon} {status.label}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#D4AF3715", color: "#D4AF37" }}>{t}</span>)}
            {goal.targetDate && (
              <span className="text-[10px] font-medium" style={{ color: overdue ? "#DC2626" : deadlineAlert ? "#F59E0B" : "var(--muted)" }}>
                {overdue ? `متأخر ${Math.abs(daysLeft!)} يوم` : deadlineAlert ? `⏰ ${daysLeft} أيام` : new Date(goal.targetDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          {/* Progress */}
          {goal.progressPercent > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${goal.progressPercent}%`, background: status.color }} />
              </div>
              <span className="text-[10px] font-bold" style={{ color: status.color }}>{goal.progressPercent}%</span>
            </div>
          )}
        </div>

        {/* Board link */}
        <Link href={`/projects/${goal.id}/board`} onClick={e => e.stopPropagation()}
          className="text-sm flex-shrink-0 hover:scale-110 transition" title="السبورة">
          🎨
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   NEW PROJECT DIALOG
   ═══════════════════════════════════════════════════════════════════════ */

function NewProjectDialog({ circles, works, onClose, onCreated }: {
  circles: LifeCircle[]; works: { id: string; name: string; type: string }[];
  onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [pLinkType, setPLinkType] = useState<"none" | "circle" | "job">("none");
  const [circleId, setCircleId] = useState("");
  const [workId, setWorkId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState("Active");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);
  // Rating
  const [rImportance, setRImportance] = useState(0);
  const [rUrgency, setRUrgency] = useState(0);
  const [rImpact, setRImpact] = useState(0);
  const [rEffort, setREffort] = useState(0);
  const [rManualScore, setRManualScore] = useState("");
  const [rScoreMode, setRScoreMode] = useState<"auto" | "manual">("manual");
  const autoScore = (rImportance + rUrgency + rImpact + rEffort) * 3;
  const score = rScoreMode === "manual" ? (parseInt(rManualScore) || 0) : autoScore;
  const rated = rScoreMode === "manual" ? (parseInt(rManualScore) > 0) : (rImportance > 0 && rUrgency > 0 && rImpact > 0 && rEffort > 0);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const ratingTag = rated ? ` [rating:${JSON.stringify({ im: rImportance, ur: rUrgency, ip: rImpact, ef: rEffort, score, manual: rScoreMode === "manual" })}]` : "";
      await createGoal({
        title: title.trim(),
        description: (desc.trim() + ratingTag).trim() || undefined,
        targetDate: targetDate || undefined,
      });
      // Save metadata via preferences
      const { data: prefData } = await api.get("/api/users/me/preferences").catch(() => ({ data: {} }));
      const pp = prefData?.projectPrefs ?? DEFAULT_PREFS;
      const allGoals = await getGoals();
      const newGoal = allGoals.find(g => g.title === title.trim());
      if (newGoal) {
        if (tags.trim()) pp.tags = { ...pp.tags, [newGoal.id]: tags.split(",").map(t => t.trim()).filter(Boolean) };
        if (status !== "Active") await updateGoal(newGoal.id, { status });
        await api.put("/api/users/me/preferences", { ...prefData, projectPrefs: pp }).catch(() => {});
      }
      onCreated(); onClose();
    } catch {} finally { setCreating(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>مشروع جديد</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={handleCreate} disabled={creating || !title.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              {creating ? "جارٍ الإنشاء..." : "إنشاء"}
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Input label="اسم المشروع *" value={title} onChange={setTitle} autoFocus placeholder="مشروع التطبيق الجديد" />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الوصف</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="وصف اختياري..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={inputStyle} />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الحالة</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.map(s => (
                <button key={s.key} onClick={() => setStatus(s.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{ background: status === s.key ? s.color : "var(--bg)", color: status === s.key ? "#fff" : "var(--muted)", border: `1px solid ${status === s.key ? s.color : "var(--card-border)"}` }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="تاريخ البداية" type="date" value={startDate} onChange={setStartDate} />
            <Input label="تاريخ الانتهاء" type="date" value={targetDate} onChange={setTargetDate} />
          </div>

          <Input label="وسوم (مفصولة بفاصلة)" value={tags} onChange={setTags} placeholder="تقني, عاجل, تسويق" />

          {/* Rating */}
          <div className="rounded-xl border p-3 space-y-2.5" style={{ borderColor: rated ? "#3D8C5A40" : "var(--card-border)", background: rated ? "#3D8C5A06" : "var(--bg)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>تقييم المشروع</span>
              <div className="flex items-center gap-2">
                {rated && (
                  <span className="text-sm font-black px-2 py-0.5 rounded-full" style={{ background: scoreColor(score) + "18", color: scoreColor(score) }}>
                    {score}/60 {scoreLabelAr(score)}
                  </span>
                )}
                <button type="button" onClick={() => setRScoreMode(rScoreMode === "auto" ? "manual" : "auto")}
                  className="text-[10px] px-2 py-1 rounded-lg font-medium transition"
                  style={{ background: "var(--card)", color: "#5E5495", border: "1px solid var(--card-border)" }}>
                  {rScoreMode === "auto" ? "يدوي" : "تفصيلي"}
                </button>
              </div>
            </div>

            {rScoreMode === "manual" ? (
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--text)" }}>الدرجة (0-60):</span>
                <input type="number" min={0} max={60} value={rManualScore}
                  onChange={e => setRManualScore(e.target.value)}
                  placeholder="0"
                  className="w-20 px-3 py-2 rounded-xl border text-sm text-center font-bold focus:outline-none"
                  style={{ ...inputStyle, color: scoreColor(parseInt(rManualScore) || 0) }} />
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ((parseInt(rManualScore) || 0) / 60) * 100)}%`, background: scoreColor(parseInt(rManualScore) || 0) }} />
                </div>
              </div>
            ) : (
            <>
            {[
              { label: "الأهمية", value: rImportance, set: setRImportance, icon: "⭐" },
              { label: "الاستعجال", value: rUrgency, set: setRUrgency, icon: "⏰" },
              { label: "التأثير", value: rImpact, set: setRImpact, icon: "💥" },
              { label: "الجهد المطلوب", value: rEffort, set: setREffort, icon: "💪" },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-[10px] w-20 text-right flex-shrink-0" style={{ color: "var(--text)" }}>{r.icon} {r.label}</span>
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => r.set(n)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{
                        background: r.value >= n ? (n >= 4 ? "#DC2626" : n >= 3 ? "#D4AF37" : "#3D8C5A") : "var(--card)",
                        color: r.value >= n ? "#fff" : "var(--muted)",
                        border: `1px solid ${r.value >= n ? "transparent" : "var(--card-border)"}`,
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECT DETAIL PANEL
   ═══════════════════════════════════════════════════════════════════════ */

function ProjectDetail({ goal, circle, circles, works, prefs, savePrefs, onClose, onRefresh }: {
  goal: Goal; circle?: LifeCircle; circles: LifeCircle[];
  works: { id: string; name: string; type: string }[];
  prefs: ProjectPrefs; savePrefs: (p: ProjectPrefs) => void;
  onClose: () => void; onRefresh: () => void;
}) {
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const bulkMode = selectedTaskIds.size > 0;
  const [nt, setNt] = useState({ title: "", desc: "", priority: 3, dueDate: "", context: "Anywhere", isUrgent: false, isWork: false });
  const [editTitle, setEditTitle] = useState(goal.title);
  // Strip rating tag from description for editing
  const cleanDesc = (goal.description ?? "").replace(/\s*\[rating:\{.*?\}\]/, "");
  const [editDesc, setEditDesc] = useState(cleanDesc);
  const [editDate, setEditDate] = useState(goal.targetDate?.split("T")[0] ?? "");
  const [editWorkId, setEditWorkId] = useState(prefs.linkedWork[goal.id] ?? "");
  const [editCircleId, setEditCircleId] = useState(goal.lifeCircle?.id ?? "");
  const [eLinkType, setELinkType] = useState<"none" | "circle" | "job">(
    prefs.linkedWork[goal.id] ? "job" : goal.lifeCircle?.id ? "circle" : "none"
  );
  // Parse existing rating
  const existingRating = (() => {
    const m = (goal.description ?? "").match(/\[rating:(\{.*?\})\]/);
    if (!m) return { im: 0, ur: 0, ip: 0, ef: 0 };
    try { return JSON.parse(m[1]); } catch { return { im: 0, ur: 0, ip: 0, ef: 0 }; }
  })();
  const [eImportance, setEImportance] = useState<number>(existingRating.im ?? 0);
  const [eUrgency, setEUrgency] = useState<number>(existingRating.ur ?? 0);
  const [eImpact, setEImpact] = useState<number>(existingRating.ip ?? 0);
  const [eEffort, setEEffort] = useState<number>(existingRating.ef ?? 0);
  const [eManualScore, setEManualScore] = useState<string>(existingRating.score?.toString() ?? "");
  const [eScoreMode, setEScoreMode] = useState<"auto" | "manual">(existingRating.manual ? "manual" : "auto");
  const eAutoScore = (eImportance + eUrgency + eImpact + eEffort) * 3;
  const eScore = eScoreMode === "manual" ? (parseInt(eManualScore) || 0) : eAutoScore;
  const eRated = eScoreMode === "manual" ? (parseInt(eManualScore) > 0) : (eImportance > 0 && eUrgency > 0 && eImpact > 0 && eEffort > 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newPerson, setNewPerson] = useState({ name: "", role: "عضو" });

  const tags = prefs.tags[goal.id] ?? [];
  const people = prefs.people[goal.id] ?? [];
  const progressMode = prefs.progressMode[goal.id] ?? "auto";
  const manualProg = prefs.manualProgress[goal.id] ?? 0;
  const linkedWorkId = prefs.linkedWork[goal.id];
  const linkedWork = linkedWorkId ? works.find(w => w.id === linkedWorkId) : undefined;

  useEffect(() => {
    setLoadingTasks(true);
    getGoalTasks(goal.id).then(setTasks).catch(() => {}).finally(() => setLoadingTasks(false));
    // Fetch reminders for these tasks
    api.get("/api/reminders").then(r => setTaskReminders(new Map((r.data ?? []).map((rm: Record<string, string>) => [rm.id, rm])))).catch(() => {});
  }, [goal.id]);

  const [taskReminders, setTaskReminders] = useState<Map<string, Record<string, string>>>(new Map());
  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  const completedTasks = tasks.filter(t => t.status === "Completed");
  const autoProgress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const progress = progressMode === "auto" ? autoProgress : manualProg;
  const status = STATUS_MAP[goal.status] ?? STATUS_MAP.Active;

  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  async function handleChangeStatus(s: string) {
    if (s === "Suspended") { setShowSuspend(true); return; }
    try { await updateGoal(goal.id, { status: s }); onRefresh(); } catch {}
  }

  async function handleSuspend() {
    try {
      await api.patch(`/api/goals/${goal.id}/suspend`, { suspendedUntil: suspendDate || null, reason: suspendReason || null });
      setShowSuspend(false); onRefresh();
    } catch {}
  }

  async function handleUnsuspend() {
    try { await api.patch(`/api/goals/${goal.id}/unsuspend`); onRefresh(); } catch {}
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const ratingTag = eRated ? ` [rating:${JSON.stringify({ im: eImportance, ur: eUrgency, ip: eImpact, ef: eEffort, score: eScore, manual: eScoreMode === "manual" })}]` : "";
      const fullDesc = (editDesc.trim() + ratingTag).trim() || undefined;
      await updateGoal(goal.id, {
        title: editTitle.trim(),
        description: fullDesc,
        targetDate: editDate || undefined,
      });
      setShowEdit(false);
      onRefresh();
    } catch {} finally { setSaving(false); }
  }

  async function handleAddTask() {
    if (!nt.title.trim()) return;
    try {
      await createTask({
        title: nt.title.trim(),
        description: nt.desc.trim() || undefined,
        userPriority: nt.priority,
        dueDate: nt.dueDate || undefined,
        goalId: goal.id,
        isWorkTask: nt.isWork || undefined,
        isUrgent: nt.isUrgent || undefined,
        taskContext: nt.context !== "Anywhere" ? nt.context : undefined,
      });
      setNt({ title: "", desc: "", priority: 3, dueDate: "", context: "Anywhere", isUrgent: false, isWork: false });
      setShowAddTask(false);
      // Refresh tasks in this detail
      getGoalTasks(goal.id).then(setTasks).catch(() => {});
      onRefresh();
    } catch { alert("فشل إضافة المهمة"); }
  }

  async function handleDelete() {
    if (!confirm(`حذف مشروع "${goal.title}"؟`)) return;
    setDeleting(true);
    try { await deleteGoal(goal.id); onRefresh(); } catch { alert("فشل الحذف"); } finally { setDeleting(false); }
  }

  function addTag() {
    if (!newTag.trim()) return;
    const updated = [...tags, newTag.trim()];
    savePrefs({ ...prefs, tags: { ...prefs.tags, [goal.id]: updated } });
    setNewTag("");
  }

  function removeTag(t: string) {
    savePrefs({ ...prefs, tags: { ...prefs.tags, [goal.id]: tags.filter(x => x !== t) } });
  }

  function addPerson() {
    if (!newPerson.name.trim()) return;
    const updated = [...people, { name: newPerson.name.trim(), role: newPerson.role }];
    savePrefs({ ...prefs, people: { ...prefs.people, [goal.id]: updated } });
    setNewPerson({ name: "", role: "عضو" });
  }

  function removePerson(idx: number) {
    savePrefs({ ...prefs, people: { ...prefs.people, [goal.id]: people.filter((_, i) => i !== idx) } });
  }

  function toggleProgressMode() {
    const newMode = progressMode === "auto" ? "manual" : "auto";
    savePrefs({ ...prefs, progressMode: { ...prefs.progressMode, [goal.id]: newMode } });
  }

  function setManualProgress(v: number) {
    savePrefs({ ...prefs, manualProgress: { ...prefs.manualProgress, [goal.id]: v } });
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const next = currentStatus === "Todo" ? "InProgress" : currentStatus === "InProgress" ? "Completed" : "Todo";
    try { await api.patch(`/api/tasks/${taskId}/status`, { status: next });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next as SmartTask["status"] } : t));
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b px-4 sm:px-6 py-3 sm:py-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-bold text-base sm:text-lg" style={{ color: "var(--text)" }}>{goal.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <select value={goal.status} onChange={e => handleChangeStatus(e.target.value)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none"
                  style={{ borderColor: status.color, background: `${status.color}10`, color: status.color }}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {goal.status === "Suspended" && (
                <button onClick={handleUnsuspend} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: "#3D8C5A20", color: "#3D8C5A" }}>▶ رفع التعليق</button>
              )}
              <Link href={`/projects/${goal.id}/board`} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: "#5E549520", color: "#5E5495" }}>🎨</Link>
              <button onClick={() => setShowEdit(true)} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: "#2D6B9E20", color: "#2D6B9E" }}>✎</button>
              <button onClick={handleDelete} disabled={deleting} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: "#DC262620", color: "#DC2626" }}>{deleting ? "…" : "🗑"}</button>
              <button onClick={onClose} className="text-lg px-1" style={{ color: "var(--muted)" }}>✕</button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Progress */}
          <div className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>التقدم</span>
              <div className="flex items-center gap-2">
                <button onClick={toggleProgressMode} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                  {progressMode === "auto" ? "تلقائي" : "يدوي"}
                </button>
                <span className="text-sm font-black" style={{ color: status.color }}>{progress}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: status.color }} />
            </div>
            {progressMode === "manual" && (
              <input type="range" min={0} max={100} value={manualProg} onChange={e => setManualProgress(Number(e.target.value))}
                className="w-full mt-2 accent-[#5E5495]" />
            )}
          </div>

          {/* Tags */}
          <div>
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>الوسوم</span>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {tags.map(t => (
                <span key={t} className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1" style={{ background: "#D4AF3715", color: "#D4AF37" }}>
                  {t} <button onClick={() => removeTag(t)} className="hover:text-red-400">✕</button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="وسم جديد"
                  onKeyDown={e => e.key === "Enter" && addTag()}
                  className="px-2 py-1 rounded-lg text-[10px] w-20 focus:outline-none" style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
                <button onClick={addTag} className="text-[10px] px-1.5 py-1 rounded-lg" style={{ background: "#D4AF37", color: "#fff" }}>+</button>
              </div>
            </div>
          </div>

          {/* People */}
          <div>
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>الأشخاص</span>
            <div className="space-y-1.5 mt-1.5">
              {people.map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg)" }}>
                  <span className="text-sm">👤</span>
                  <span className="text-xs flex-1" style={{ color: "var(--text)" }}>{p.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#5E549515", color: "#5E5495" }}>{p.role}</span>
                  <button onClick={() => removePerson(i)} className="text-[10px] hover:text-red-400" style={{ color: "var(--muted)" }}>✕</button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input value={newPerson.name} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="اسم الشخص"
                  onKeyDown={e => e.key === "Enter" && addPerson()}
                  className="px-2 py-1.5 rounded-lg text-[10px] flex-1 focus:outline-none" style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
                <select value={newPerson.role} onChange={e => setNewPerson({ ...newPerson, role: e.target.value })}
                  className="px-2 py-1.5 rounded-lg text-[10px] focus:outline-none" style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }}>
                  <option value="مدير">مدير</option>
                  <option value="عضو">عضو</option>
                  <option value="مراجع">مراجع</option>
                </select>
                <button onClick={addPerson} className="text-[10px] px-2 py-1.5 rounded-lg text-white" style={{ background: "#5E5495" }}>+</button>
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>المهام ({tasks.length})</span>
              <div className="flex items-center gap-1.5">
                {tasks.length > 0 && (
                  <button onClick={() => {
                    if (bulkMode) setSelectedTaskIds(new Set());
                    else setSelectedTaskIds(new Set(tasks.map(t => t.id)));
                  }}
                    className="text-[10px] px-2 py-1 rounded-lg font-semibold transition"
                    style={{ background: bulkMode ? "#5E549515" : "var(--bg)", color: bulkMode ? "#5E5495" : "var(--muted)", border: `1px solid ${bulkMode ? "#5E5495" : "var(--card-border)"}` }}>
                    {bulkMode ? `✓ ${selectedTaskIds.size} محدد` : "تحديد"}
                  </button>
                )}
                <button onClick={() => setShowAddTask(true)} className="text-[10px] font-bold px-3 py-1 rounded-lg text-white" style={{ background: "#D4AF37" }}>+ مهمة</button>
              </div>
            </div>

            {/* Bulk actions toolbar */}
            {bulkMode && (
              <div className="flex items-center gap-1.5 mb-2 p-2 rounded-lg" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
                <button onClick={async () => {
                  for (const id of selectedTaskIds) await api.patch(`/api/tasks/${id}/status`, { status: "Completed" }).catch(() => {});
                  setTasks(prev => prev.map(t => selectedTaskIds.has(t.id) ? { ...t, status: "Completed" as SmartTask["status"] } : t));
                  setSelectedTaskIds(new Set());
                }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>
                  ✅ إنجاز
                </button>
                <button onClick={async () => {
                  for (const id of selectedTaskIds) await api.patch(`/api/tasks/${id}/status`, { status: "InProgress" }).catch(() => {});
                  setTasks(prev => prev.map(t => selectedTaskIds.has(t.id) ? { ...t, status: "InProgress" as SmartTask["status"] } : t));
                  setSelectedTaskIds(new Set());
                }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: "#F59E0B15", color: "#F59E0B" }}>
                  🔄 جاري
                </button>
                <button onClick={async () => {
                  for (const id of selectedTaskIds) await api.patch(`/api/tasks/${id}/status`, { status: "Deferred" }).catch(() => {});
                  setTasks(prev => prev.map(t => selectedTaskIds.has(t.id) ? { ...t, status: "Deferred" as SmartTask["status"] } : t));
                  setSelectedTaskIds(new Set());
                }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: "#8B5CF615", color: "#8B5CF6" }}>
                  ⏳ تأجيل
                </button>
                <div className="flex-1" />
                <button onClick={async () => {
                  if (!confirm(`حذف ${selectedTaskIds.size} مهمة؟`)) return;
                  for (const id of selectedTaskIds) await api.delete(`/api/tasks/${id}`).catch(() => {});
                  setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
                  setSelectedTaskIds(new Set()); onRefresh();
                }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: "#DC262615", color: "#DC2626" }}>
                  🗑️ حذف
                </button>
                <button onClick={() => setSelectedTaskIds(new Set())}
                  className="text-[10px] px-2 py-1.5 rounded-lg" style={{ color: "var(--muted)" }}>✕</button>
              </div>
            )}

            {loadingTasks && <p className="text-center py-4 animate-pulse text-xs" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}
            <div className="space-y-1.5">
              {[...pendingTasks, ...completedTasks].map(t => {
                const st = TASK_STATUS[t.status] ?? TASK_STATUS.Inbox;
                const isDone = t.status === "Completed";
                const pri = t.userPriority <= 2 ? { l: "عالية", c: "#DC2626" } : t.userPriority <= 3 ? { l: "متوسطة", c: "#D4AF37" } : { l: "منخفضة", c: "#6B7280" };
                const isSelected = selectedTaskIds.has(t.id);
                return (
                  <div key={t.id} className={`rounded-lg border px-3 py-2.5 transition ${isDone ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-[#5E5495]" : ""}`}
                    style={{ background: isSelected ? "#5E549508" : "var(--card)", borderColor: isSelected ? "#5E5495" : "var(--card-border)" }}>
                    <div className="flex items-center gap-2">
                      {/* Checkbox or Complete button */}
                      {bulkMode ? (
                        <button onClick={() => setSelectedTaskIds(prev => {
                          const s = new Set(prev);
                          if (s.has(t.id)) s.delete(t.id); else s.add(t.id);
                          return s;
                        })}
                          className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition text-[9px]"
                          style={{ borderColor: isSelected ? "#5E5495" : "var(--card-border)", background: isSelected ? "#5E5495" : "transparent", color: isSelected ? "#fff" : "transparent" }}>
                          {isSelected ? "✓" : ""}
                        </button>
                      ) : (
                        <button onClick={() => {
                          const next = isDone ? "Todo" : "Completed";
                          api.patch(`/api/tasks/${t.id}/status`, { status: next }).then(() => {
                            setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next as SmartTask["status"] } : x));
                          }).catch(() => {});
                        }}
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition text-[9px]"
                          style={{ borderColor: isDone ? "#3D8C5A" : st.color, background: isDone ? "#3D8C5A" : "transparent", color: isDone ? "#fff" : "transparent" }}>
                          {isDone ? "✓" : ""}
                        </button>
                      )}

                      {/* Title + date + reminder */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isDone ? "line-through" : ""}`} style={{ color: isDone ? "var(--muted)" : "var(--text)" }}>{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${pri.c}15`, color: pri.c }}>{pri.l}</span>
                          {t.dueDate && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{new Date(t.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                        </div>
                        {(() => { const rm = taskReminders.get(t.id); return rm && rm.reminderFrequency && rm.reminderFrequency !== "none" ? (
                          <p className="text-[9px] mt-0.5" style={{ color: "#F59E0B" }}>
                            🔔 {rm.assignedPersonName ? `👤 ${rm.assignedPersonName}` : ""} {rm.assignedPersonRelation ? `(${rm.assignedPersonRelation})` : ""} · {rm.reminderFrequency === "daily" ? "يومي" : rm.reminderFrequency === "weekly" ? "أسبوعي" : rm.reminderFrequency === "monthly" ? "شهري" : "مخصص"}
                            {rm.nextReminderAt && ` · ${new Date(rm.nextReminderAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}`}
                          </p>
                        ) : null; })()}
                      </div>

                      {/* Reminder actions */}
                      {(() => { const rm = taskReminders.get(t.id); return rm && rm.reminderFrequency && rm.reminderFrequency !== "none" && rm.nextReminderAt && new Date(rm.nextReminderAt) <= new Date() ? (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={async (e) => { e.stopPropagation(); try { await api.post(`/api/reminders/${t.id}/done`, {}); api.get("/api/reminders").then(r => setTaskReminders(new Map((r.data ?? []).map((x: Record<string, string>) => [x.id, x])))).catch(() => {}); } catch {} }}
                            className="text-[8px] px-1.5 py-1 rounded-lg font-bold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>تم ✓</button>
                          <button onClick={async (e) => { e.stopPropagation(); try { await api.post(`/api/reminders/${t.id}/snooze`, { hours: 1 }); api.get("/api/reminders").then(r => setTaskReminders(new Map((r.data ?? []).map((x: Record<string, string>) => [x.id, x])))).catch(() => {}); } catch {} }}
                            className="text-[8px] px-1.5 py-1 rounded-lg font-bold" style={{ background: "#F59E0B15", color: "#F59E0B" }}>⏰</button>
                        </div>
                      ) : null; })()}

                      {/* Actions — hidden in bulk mode */}
                      {!bulkMode && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setEditingTaskId(editingTaskId === t.id ? null : t.id)}
                            className="text-[10px] px-1.5 py-1 rounded hover:bg-black/5 transition" title="تعديل">✏️</button>
                          <button onClick={async () => {
                            if (!confirm(`حذف "${t.title}"؟`)) return;
                            try { await api.delete(`/api/tasks/${t.id}`); setTasks(prev => prev.filter(x => x.id !== t.id)); onRefresh(); } catch {}
                          }}
                            className="text-[10px] px-1.5 py-1 rounded hover:bg-black/5 transition" title="حذف">🗑️</button>
                        </div>
                      )}
                    </div>

                    {/* Inline edit form */}
                    {editingTaskId === t.id && !bulkMode && (
                      <TaskInlineEdit task={t} onSave={async (updates) => {
                        try {
                          await api.patch(`/api/tasks/${t.id}`, updates);
                          setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...updates, status: (updates.status as SmartTask["status"]) ?? x.status } : x));
                          setEditingTaskId(null);
                        } catch {}
                      }} onCancel={() => setEditingTaskId(null)} />
                    )}
                  </div>
                );
              })}
            </div>
            {tasks.length === 0 && !loadingTasks && (
              <p className="text-center py-4 text-xs" style={{ color: "var(--muted)" }}>لا توجد مهام</p>
            )}
          </div>
        </div>

        {/* Suspend Dialog */}
        {showSuspend && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSuspend(false)} />
            <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <h4 className="font-bold text-sm" style={{ color: "var(--text)" }}>⏸️ تعليق المشروع</h4>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>سبب التعليق</label>
                <input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="مثال: في انتظار موافقة..."
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>تاريخ العودة المتوقع</label>
                <input type="date" value={suspendDate} onChange={e => setSuspendDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSuspend(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                <button onClick={handleSuspend} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#F59E0B" }}>⏸️ تعليق</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddTask(false)} />
            <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>إضافة مهمة — {goal.title}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddTask(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                  <button onClick={handleAddTask} disabled={!nt.title.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                    style={{ background: "#D4AF37" }}>
                    إضافة
                  </button>
                </div>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>عنوان المهمة *</label>
                  <input value={nt.title} onChange={e => setNt({ ...nt, title: e.target.value })} autoFocus placeholder="مثال: إعداد التقرير..."
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>تفاصيل</label>
                  <textarea value={nt.desc} onChange={e => setNt({ ...nt, desc: e.target.value })} rows={2} placeholder="وصف اختياري..."
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={inputStyle} />
                </div>
                {/* الأولوية */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الأولوية</label>
                  <div className="flex gap-1">
                    {[{ v: 1, l: "منخفضة", c: "#3D8C5A" }, { v: 3, l: "متوسطة", c: "#D4AF37" }, { v: 5, l: "عالية", c: "#DC2626" }].map(p => (
                      <button key={p.v} type="button" onClick={() => setNt({ ...nt, priority: p.v })}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
                        style={{ background: nt.priority === p.v ? p.c : "var(--bg)", color: nt.priority === p.v ? "#fff" : "var(--muted)", border: `1px solid ${nt.priority === p.v ? p.c : "var(--card-border)"}` }}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>تاريخ الاستحقاق</label>
                  <input type="date" value={nt.dueDate} onChange={e => setNt({ ...nt, dueDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
                </div>
                {/* البيئة */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>البيئة</label>
                  <div className="flex gap-1 flex-wrap">
                    {[{ k: "Anywhere", l: "أي مكان", i: "🌐" }, { k: "Office", l: "مكتب", i: "🏢" }, { k: "Home", l: "منزل", i: "🏠" }, { k: "Phone", l: "اتصال", i: "📞" }, { k: "Online", l: "أونلاين", i: "💻" }].map(c => (
                      <button key={c.k} type="button" onClick={() => setNt({ ...nt, context: c.k })}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition"
                        style={{ background: nt.context === c.k ? "#5E5495" : "var(--bg)", color: nt.context === c.k ? "#fff" : "var(--muted)", border: `1px solid ${nt.context === c.k ? "#5E5495" : "var(--card-border)"}` }}>
                        {c.i} {c.l}
                      </button>
                    ))}
                  </div>
                </div>
                {/* خيارات */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={nt.isUrgent} onChange={() => setNt({ ...nt, isUrgent: !nt.isUrgent })} className="accent-red-500" />
                    <span className="text-xs" style={{ color: "var(--text)" }}>🔴 ملحة</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={nt.isWork} onChange={() => setNt({ ...nt, isWork: !nt.isWork })} className="accent-[#5E5495]" />
                    <span className="text-xs" style={{ color: "var(--text)" }}>💼 عمل</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEdit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)} />
            <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="font-bold" style={{ color: "var(--text)" }}>تعديل المشروع</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEdit(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
                  <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40" style={{ background: "#2C2C54" }}>
                    {saving ? "..." : "حفظ"}
                  </button>
                </div>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                <Input label="الاسم" value={editTitle} onChange={setEditTitle} />
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الوصف</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={inputStyle} />
                </div>
                <Input label="تاريخ الانتهاء" type="date" value={editDate} onChange={setEditDate} />

                {/* تقييم */}
                <div className="rounded-xl border p-3 space-y-2.5" style={{ borderColor: eRated ? "#3D8C5A40" : "var(--card-border)", background: eRated ? "#3D8C5A06" : "var(--bg)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "var(--text)" }}>تقييم المشروع</span>
                    <div className="flex items-center gap-2">
                      {eRated && (
                        <span className="text-sm font-black px-2 py-0.5 rounded-full" style={{ background: scoreColor(eScore) + "18", color: scoreColor(eScore) }}>
                          {eScore}/60 {scoreLabelAr(eScore)}
                        </span>
                      )}
                      <button type="button" onClick={() => setEScoreMode(eScoreMode === "auto" ? "manual" : "auto")}
                        className="text-[10px] px-2 py-1 rounded-lg font-medium transition"
                        style={{ background: "var(--card)", color: "#5E5495", border: "1px solid var(--card-border)" }}>
                        {eScoreMode === "auto" ? "يدوي" : "تفصيلي"}
                      </button>
                    </div>
                  </div>

                  {eScoreMode === "manual" ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "var(--text)" }}>الدرجة (0-60):</span>
                      <input type="number" min={0} max={60} value={eManualScore}
                        onChange={e => setEManualScore(e.target.value)}
                        className="w-20 px-3 py-2 rounded-xl border text-sm text-center font-bold focus:outline-none"
                        style={{ ...inputStyle, color: scoreColor(parseInt(eManualScore) || 0) }} />
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ((parseInt(eManualScore) || 0) / 60) * 100)}%`, background: scoreColor(parseInt(eManualScore) || 0) }} />
                      </div>
                    </div>
                  ) : (
                    <>
                  {[
                    { label: "الأهمية", value: eImportance, set: setEImportance, icon: "⭐" },
                    { label: "الاستعجال", value: eUrgency, set: setEUrgency, icon: "⏰" },
                    { label: "التأثير", value: eImpact, set: setEImpact, icon: "💥" },
                    { label: "الجهد", value: eEffort, set: setEEffort, icon: "💪" },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="text-[10px] w-16 text-right flex-shrink-0" style={{ color: "var(--text)" }}>{r.icon} {r.label}</span>
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" onClick={() => r.set(n)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                            style={{
                              background: r.value >= n ? (n >= 4 ? "#DC2626" : n >= 3 ? "#D4AF37" : "#3D8C5A") : "var(--card)",
                              color: r.value >= n ? "#fff" : "var(--muted)",
                              border: `1px solid ${r.value >= n ? "transparent" : "var(--card-border)"}`,
                            }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED
   ═══════════════════════════════════════════════════════════════════════ */

function Input({ label, value, onChange, type = "text", placeholder, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle} />
    </div>
  );
}

const inputStyle = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" };

/* ═══════════════════════════════════════════════════════════════════════
   TASK INLINE EDIT
   ═══════════════════════════════════════════════════════════════════════ */

function TaskInlineEdit({ task, onSave, onCancel }: {
  task: SmartTask;
  onSave: (updates: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate?.split("T")[0] ?? "");
  const [priority, setPriority] = useState(task.userPriority);
  const [status, setStatus] = useState(task.status);

  const statuses = [
    { key: "Todo", label: "مخطط" },
    { key: "InProgress", label: "جاري" },
    { key: "Completed", label: "مكتمل" },
    { key: "Deferred", label: "مؤجل" },
  ];

  return (
    <div className="mt-2 pt-2 border-t space-y-2" style={{ borderColor: "var(--card-border)" }}>
      <input value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none"
        style={inputStyle} placeholder="العنوان" />
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
        className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none"
        style={inputStyle} placeholder="الوصف (اختياري)" />
      <div className="flex gap-2 flex-wrap">
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-[10px] focus:outline-none flex-1"
          style={inputStyle} />
        <select value={priority} onChange={e => setPriority(Number(e.target.value))}
          className="px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none"
          style={inputStyle}>
          <option value={1}>عالية</option>
          <option value={3}>متوسطة</option>
          <option value={5}>منخفضة</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as SmartTask["status"])}
          className="px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none"
          style={inputStyle}>
          {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
          style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
        <button onClick={() => onSave({
          title: title.trim(), description: desc.trim() || undefined,
          dueDate: dueDate || undefined, userPriority: priority, status,
        })}
          disabled={!title.trim()}
          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
          style={{ background: "#D4AF37" }}>حفظ</button>
      </div>
    </div>
  );
}
