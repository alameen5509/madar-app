"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getGoals, getCircles, createGoal, updateGoal, deleteGoal, getGoalTasks,
  createTask, api,
  type Goal, type LifeCircle, type SmartTask,
} from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

const STATUSES = [
  { key: "Draft",     label: "مسودة",  color: "#6B7280", icon: "📝" },
  { key: "Active",    label: "قائم",   color: "#3D8C5A", icon: "🟢" },
  { key: "Critical",  label: "حرجة",  color: "#DC2626", icon: "⚠️" },
  { key: "Completed", label: "مكتمل", color: "#2D6B9E", icon: "✅" },
] as const;

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));

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

export default function ProjectsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [works, setWorks] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [prefs, setPrefs] = useState<ProjectPrefs>(DEFAULT_PREFS);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

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
      const aCrit = a.status === "Critical" ? -2 : 0;
      const bCrit = b.status === "Critical" ? -2 : 0;
      const aPin = prefs.pinned.includes(a.id) ? -1 : 0;
      const bPin = prefs.pinned.includes(b.id) ? -1 : 0;
      return (aCrit + aPin) - (bCrit + bPin);
    });
  }

  // Filter by tag
  const filteredGoals = tagFilter
    ? goals.filter(g => (prefs.tags[g.id] ?? []).includes(tagFilter))
    : goals;

  const critical = sortedGoals(filteredGoals.filter(g => g.status === "Critical"));
  const active = sortedGoals(filteredGoals.filter(g => g.status === "Active"));
  const completed = filteredGoals.filter(g => g.status === "Completed");
  const drafts = filteredGoals.filter(g => g.status === "Draft" || g.status === "Archived" || g.status === "Paused");

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
            {!loading && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs" style={{ color: "var(--muted)" }}>{stats.total} مشروع</span>
                {stats.critical > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: "#DC262615", color: "#DC2626" }}>⚠️ {stats.critical} حرجة</span>}
              </div>
            )}
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
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{goal.title}</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${status.color}15`, color: status.color }}>
              {status.icon} {status.label}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {circle && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${circle.colorHex ?? "#666"}15`, color: circle.colorHex }}>{circle.name}</span>}
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
  const [circleId, setCircleId] = useState("");
  const [workId, setWorkId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState("Active");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await createGoal({
        title: title.trim(),
        description: desc.trim() || undefined,
        targetDate: targetDate || undefined,
        lifeCircleId: circleId || undefined,
      });
      // Save metadata via preferences
      const { data: prefData } = await api.get("/api/users/me/preferences").catch(() => ({ data: {} }));
      const pp = prefData?.projectPrefs ?? DEFAULT_PREFS;
      // Find the newly created goal to get its ID
      const allGoals = await getGoals();
      const newGoal = allGoals.find(g => g.title === title.trim());
      if (newGoal) {
        if (tags.trim()) pp.tags = { ...pp.tags, [newGoal.id]: tags.split(",").map(t => t.trim()).filter(Boolean) };
        if (workId) pp.linkedWork = { ...pp.linkedWork, [newGoal.id]: workId };
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

          {/* Link to work (optional) */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>ربط بـ <span className="font-normal" style={{ color: "var(--muted)" }}>(اختياري)</span></label>
            <select value={workId} onChange={e => setWorkId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle}>
              <option value="">بدون ربط</option>
              {works.map(w => <option key={w.id} value={w.id}>{w.type === "job" ? "💼" : "🏢"} {w.name}</option>)}
            </select>
          </div>

          {/* Circle (optional) */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الدور <span className="font-normal" style={{ color: "var(--muted)" }}>(اختياري)</span></label>
            <select value={circleId} onChange={e => setCircleId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={inputStyle}>
              <option value="">بدون ربط</option>
              {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="تاريخ البداية" type="date" value={startDate} onChange={setStartDate} />
            <Input label="تاريخ الانتهاء" type="date" value={targetDate} onChange={setTargetDate} />
          </div>

          <Input label="وسوم (مفصولة بفاصلة)" value={tags} onChange={setTags} placeholder="تقني, عاجل, تسويق" />
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
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editDesc, setEditDesc] = useState(goal.description ?? "");
  const [editDate, setEditDate] = useState(goal.targetDate?.split("T")[0] ?? "");
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
  }, [goal.id]);

  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  const completedTasks = tasks.filter(t => t.status === "Completed");
  const autoProgress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const progress = progressMode === "auto" ? autoProgress : manualProg;
  const status = STATUS_MAP[goal.status] ?? STATUS_MAP.Active;

  async function handleChangeStatus(s: string) {
    try { await updateGoal(goal.id, { status: s }); onRefresh(); } catch {}
  }

  async function handleSaveEdit() {
    setSaving(true);
    try { await updateGoal(goal.id, { title: editTitle.trim(), description: editDesc.trim() || undefined, targetDate: editDate || undefined }); setShowEdit(false); onRefresh(); }
    catch {} finally { setSaving(false); }
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
                {circle && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${circle.colorHex ?? "#666"}15`, color: circle.colorHex }}>{circle.name}</span>}
                {linkedWork && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>{linkedWork.type === "job" ? "💼" : "🏢"} {linkedWork.name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
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
              <a href={`/tasks?addTask=1&goalId=${goal.id}`} className="text-[10px] font-bold px-3 py-1 rounded-lg text-white" style={{ background: "#D4AF37" }}>+ مهمة</a>
            </div>
            {loadingTasks && <p className="text-center py-4 animate-pulse text-xs" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}
            <div className="space-y-1.5">
              {pendingTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <button onClick={() => toggleTaskStatus(t.id, t.status)}
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{ borderColor: TASK_STATUS[t.status]?.color ?? "#6B7280" }} />
                  <span className="text-xs flex-1" style={{ color: "var(--text)" }}>{t.title}</span>
                  <span className="text-[10px] font-semibold" style={{ color: TASK_STATUS[t.status]?.color }}>{TASK_STATUS[t.status]?.label}</span>
                </div>
              ))}
            </div>
            {completedTasks.length > 0 && <p className="text-[10px] text-center mt-2" style={{ color: "var(--muted)" }}>+ {completedTasks.length} مكتملة</p>}
          </div>
        </div>

        {/* Edit Dialog */}
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
              <div className="px-6 py-5 space-y-4">
                <Input label="الاسم" value={editTitle} onChange={setEditTitle} />
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الوصف</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={inputStyle} />
                </div>
                <Input label="تاريخ الانتهاء" type="date" value={editDate} onChange={setEditDate} />
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
