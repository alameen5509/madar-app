"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getGoals, getGoalTasks, createTask, api,
  type Goal, type SmartTask,
} from "@/lib/api";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */

type SessionMode = "tech" | "waiting";
type IdeaType = "task" | "idea" | "note" | "question";

interface Idea {
  id: string;
  text: string;
  type: IdeaType;
  time: Date;
}

interface SessionLog {
  techCompleted: string[];
  nonTechCompleted: string[];
  ideas: Idea[];
  startTime: Date;
  endTime?: Date;
  techProjectTitle: string;
  nonTechProjectTitle: string;
}

const IDEA_TYPES: { key: IdeaType; label: string; icon: string; color: string }[] = [
  { key: "task", label: "مهمة", icon: "✅", color: "#3D8C5A" },
  { key: "idea", label: "فكرة", icon: "💡", color: "#F59E0B" },
  { key: "note", label: "ملاحظة", icon: "📝", color: "#3B82F6" },
  { key: "question", label: "سؤال", icon: "❓", color: "#8B5CF6" },
];

const CHECK_INTERVALS = [
  { min: 5, label: "5 دقائق" },
  { min: 10, label: "10 دقائق" },
  { min: 15, label: "15 دقيقة" },
  { min: 20, label: "20 دقيقة" },
];

const TASK_STATUS_MAP: Record<string, { label: string; color: string }> = {
  Inbox: { label: "وارد", color: "#6B7280" },
  Todo: { label: "مخطط", color: "#3B82F6" },
  InProgress: { label: "جاري", color: "#F59E0B" },
  Completed: { label: "مكتمل", color: "#3D8C5A" },
  Deferred: { label: "مؤجل", color: "#8B5CF6" },
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function FocusSessionPage() {
  // Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [techTasks, setTechTasks] = useState<SmartTask[]>([]);
  const [nonTechTasks, setNonTechTasks] = useState<SmartTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Session state
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<SessionMode>("tech");
  const [checkInterval, setCheckInterval] = useState(10);
  const [elapsed, setElapsed] = useState(0);
  const [waitingElapsed, setWaitingElapsed] = useState(0);
  const [showCheckAlert, setShowCheckAlert] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Ideas
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [showIdeaInput, setShowIdeaInput] = useState(false);
  const [ideaText, setIdeaText] = useState("");
  const [ideaType, setIdeaType] = useState<IdeaType>("idea");

  // Completed tracking
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Session log
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);

  // Summary: convert ideas to tasks
  const [convertingIdeas, setConvertingIdeas] = useState<Set<string>>(new Set());

  const startTimeRef = useRef<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const techFocus = goals.find(g => g.focusType === "Tech");
  const nonTechFocus = goals.find(g => g.focusType === "NonTech");

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const g = await getGoals();
      setGoals(g);
      const tf = g.find(x => x.focusType === "Tech");
      const ntf = g.find(x => x.focusType === "NonTech");
      if (tf) {
        const tasks = await getGoalTasks(tf.id);
        setTechTasks(tasks);
      }
      if (ntf) {
        const tasks = await getGoalTasks(ntf.id);
        setNonTechTasks(tasks);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Main timer
  useEffect(() => {
    if (!started || sessionEnded) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, sessionEnded]);

  // Waiting mode timer + check alerts
  useEffect(() => {
    if (mode !== "waiting" || !started || sessionEnded) {
      if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
      setWaitingElapsed(0);
      return;
    }
    setWaitingElapsed(0);
    waitingTimerRef.current = setInterval(() => {
      setWaitingElapsed(e => {
        const next = e + 1;
        if (next > 0 && next % (checkInterval * 60) === 0) {
          setShowCheckAlert(true);
          try { audioRef.current?.play(); } catch {}
        }
        return next;
      });
    }, 1000);
    return () => { if (waitingTimerRef.current) clearInterval(waitingTimerRef.current); };
  }, [mode, started, sessionEnded, checkInterval]);

  function startSession() {
    startTimeRef.current = new Date();
    setStarted(true);
    setMode("tech");
    setElapsed(0);
    setCompletedIds(new Set());
    setIdeas([]);
  }

  function endSession() {
    setSessionEnded(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);

    const log: SessionLog = {
      techCompleted: techTasks.filter(t => completedIds.has(t.id)).map(t => t.title),
      nonTechCompleted: nonTechTasks.filter(t => completedIds.has(t.id)).map(t => t.title),
      ideas,
      startTime: startTimeRef.current,
      endTime: new Date(),
      techProjectTitle: techFocus?.title ?? "",
      nonTechProjectTitle: nonTechFocus?.title ?? "",
    };
    setSessionLog(log);
  }

  async function toggleTaskDone(taskId: string, currentStatus: string) {
    const next = currentStatus === "Completed" ? "Todo" : "Completed";
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: next });
      const updateList = (list: SmartTask[]) =>
        list.map(t => t.id === taskId ? { ...t, status: next as SmartTask["status"] } : t);
      setTechTasks(updateList);
      setNonTechTasks(updateList);
      if (next === "Completed") setCompletedIds(prev => new Set(prev).add(taskId));
      else setCompletedIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    } catch {}
  }

  function addIdea() {
    if (!ideaText.trim()) return;
    setIdeas(prev => [...prev, { id: crypto.randomUUID(), text: ideaText.trim(), type: ideaType, time: new Date() }]);
    setIdeaText("");
    setShowIdeaInput(false);
  }

  async function convertIdeaToTask(idea: Idea) {
    if (!techFocus) return;
    setConvertingIdeas(prev => new Set(prev).add(idea.id));
    try {
      await createTask({
        title: `[${IDEA_TYPES.find(t => t.key === idea.type)?.icon ?? ""}] ${idea.text}`,
        goalId: techFocus.id,
        lifeCircleId: techFocus.lifeCircle?.id,
      });
    } catch {}
    setConvertingIdeas(prev => { const s = new Set(prev); s.delete(idea.id); return s; });
  }

  function fmtTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  }

  // ─── LOADING ─────────────────────────
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center" dir="rtl" style={{ background: "var(--bg)" }}>
        <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
      </main>
    );
  }

  // ─── NO FOCUS SET ─────────────────────
  if (!techFocus && !nonTechFocus) {
    return (
      <main className="flex-1 flex items-center justify-center" dir="rtl" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-4">
          <p className="text-4xl">🎯</p>
          <p className="font-bold" style={{ color: "var(--text)" }}>لم تختر مشاريع للتركيز</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>ارجع لصفحة المشاريع واختر مشروع تقني وغير تقني أولاً</p>
          <Link href="/projects" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            العودة للمشاريع
          </Link>
        </div>
      </main>
    );
  }

  // ─── SESSION SUMMARY ──────────────────
  if (sessionEnded && sessionLog) {
    return <SessionSummary log={sessionLog} onConvert={convertIdeaToTask} converting={convertingIdeas} />;
  }

  // ─── PRE-SESSION (Setup) ──────────────
  if (!started) {
    return (
      <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="text-center">
            <p className="text-4xl mb-3">🎯</p>
            <h1 className="font-bold text-xl mb-1" style={{ color: "var(--text)" }}>جلسة تركيز ذكية</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>ركّز على المشروع التقني واستثمر وقت الانتظار</p>
          </div>

          {/* Selected projects */}
          <div className="space-y-3">
            {techFocus && (
              <div className="rounded-xl border p-4" style={{ borderColor: "#3B82F640", background: "#3B82F606" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span>💻</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#3B82F615", color: "#3B82F6" }}>تقني</span>
                </div>
                <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{techFocus.title}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{techTasks.filter(t => t.status !== "Completed").length} مهمة متبقية</p>
              </div>
            )}
            {nonTechFocus && (
              <div className="rounded-xl border p-4" style={{ borderColor: "#D4AF3740", background: "#D4AF3706" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span>🌿</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#D4AF3715", color: "#D4AF37" }}>غير تقني</span>
                </div>
                <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{nonTechFocus.title}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{nonTechTasks.filter(t => t.status !== "Completed").length} مهمة متبقية</p>
              </div>
            )}
          </div>

          {/* Check interval */}
          <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>تنبيه فحص المشروع التقني كل:</p>
            <div className="flex gap-2 flex-wrap">
              {CHECK_INTERVALS.map(ci => (
                <button key={ci.min} onClick={() => setCheckInterval(ci.min)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: checkInterval === ci.min ? "#3B82F6" : "var(--bg)",
                    color: checkInterval === ci.min ? "#fff" : "var(--muted)",
                    border: `1px solid ${checkInterval === ci.min ? "#3B82F6" : "var(--card-border)"}`,
                  }}>
                  {ci.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startSession}
            className="w-full py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #D4AF37, #F59E0B)" }}>
            🚀 بدء الجلسة
          </button>

          <Link href="/projects" className="block text-center text-xs" style={{ color: "var(--muted)" }}>
            العودة للمشاريع
          </Link>
        </div>
      </main>
    );
  }

  // ─── ACTIVE SESSION ───────────────────
  const activeTechTasks = techTasks.filter(t => t.status !== "Completed" && !completedIds.has(t.id));
  const activeNonTechTasks = nonTechTasks.filter(t => t.status !== "Completed" && !completedIds.has(t.id));

  return (
    <main className="flex-1 overflow-y-auto relative" dir="rtl" style={{ background: "var(--bg)" }}>
      {/* Hidden audio for notification */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG+Jl5iOcWFZa3WDkJaMd2VdaHJ/i5KPgHJpbXV+hoyIf3Zxc3h+goSCfnp4eHt+gIGAfn17e3x9fn9/fn5+fn5+fn5+fn5/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+f39/f39/f39/fw==" />

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 border-b px-4 py-3 pr-14 md:pr-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-lg font-black font-mono" style={{ color: mode === "tech" ? "#3B82F6" : "#D4AF37" }}>{fmtTime(elapsed)}</p>
              <p className="text-[9px]" style={{ color: "var(--muted)" }}>إجمالي الجلسة</p>
            </div>
            {mode === "waiting" && (
              <div className="text-center px-3 py-1 rounded-lg" style={{ background: "#F59E0B10" }}>
                <p className="text-sm font-bold font-mono" style={{ color: "#F59E0B" }}>{fmtTime(waitingElapsed)}</p>
                <p className="text-[9px]" style={{ color: "#F59E0B" }}>وقت الانتظار</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <button onClick={() => { setMode(mode === "tech" ? "waiting" : "tech"); setShowCheckAlert(false); }}
              className="px-3 py-2 rounded-xl text-xs font-bold transition"
              style={{
                background: mode === "tech" ? "#3B82F615" : "#F59E0B15",
                color: mode === "tech" ? "#3B82F6" : "#F59E0B",
                border: `1px solid ${mode === "tech" ? "#3B82F640" : "#F59E0B40"}`,
              }}>
              {mode === "tech" ? "💻 عمل تقني" : "⏳ انتظار"}
            </button>

            <button onClick={endSession}
              className="px-3 py-2 rounded-xl text-xs font-bold transition"
              style={{ background: "#DC262615", color: "#DC2626", border: "1px solid #DC262630" }}>
              إنهاء
            </button>
          </div>
        </div>
      </div>

      {/* ── Check Alert ── */}
      {showCheckAlert && (
        <div className="mx-4 mt-3 rounded-xl border-2 p-4 flex items-center gap-3 animate-pulse"
          style={{ borderColor: "#3B82F6", background: "#3B82F610" }}>
          <span className="text-2xl">💻</span>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: "#3B82F6" }}>تحقق من المشروع التقني!</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>مرّ {checkInterval} دقائق — هل انتهى البرنامج؟</p>
          </div>
          <button onClick={() => { setMode("tech"); setShowCheckAlert(false); }}
            className="px-3 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "#3B82F6" }}>
            العودة للتقني
          </button>
          <button onClick={() => setShowCheckAlert(false)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ color: "var(--muted)" }}>
            لاحقاً
          </button>
        </div>
      )}

      {/* ── Mode Banner ── */}
      <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-2"
        style={{ background: mode === "tech" ? "#3B82F608" : "#F59E0B08", border: `1px solid ${mode === "tech" ? "#3B82F620" : "#F59E0B20"}` }}>
        <span className="text-lg">{mode === "tech" ? "💻" : "⏳"}</span>
        <div className="flex-1">
          <p className="font-bold text-xs" style={{ color: mode === "tech" ? "#3B82F6" : "#F59E0B" }}>
            {mode === "tech" ? `عمل تقني نشط — ${techFocus?.title ?? ""}` : `البرنامج يعمل — اعمل على المهام الأخرى`}
          </p>
          {mode === "waiting" && nonTechFocus && (
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>مشروع: {nonTechFocus.title}</p>
          )}
        </div>
        <button onClick={() => setMode(mode === "tech" ? "waiting" : "tech")}
          className="text-[10px] px-2 py-1 rounded-lg font-semibold"
          style={{ background: mode === "tech" ? "#F59E0B15" : "#3B82F615", color: mode === "tech" ? "#F59E0B" : "#3B82F6" }}>
          {mode === "tech" ? "⏳ تبديل للانتظار" : "💻 العودة للتقني"}
        </button>
      </div>

      {/* ── Tasks List ── */}
      <div className="px-4 py-4 space-y-2">
        <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>
          {mode === "tech" ? "مهام المشروع التقني" : "مهام غير تقنية"}
        </p>
        {(mode === "tech" ? techTasks : nonTechTasks)
          .filter(t => t.status !== "Cancelled")
          .map(task => {
            const isDone = task.status === "Completed" || completedIds.has(task.id);
            const st = TASK_STATUS_MAP[task.status] ?? TASK_STATUS_MAP.Inbox;
            return (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition"
                style={{ background: isDone ? "#3D8C5A06" : "var(--card)", borderColor: isDone ? "#3D8C5A30" : "var(--card-border)", opacity: isDone ? 0.6 : 1 }}>
                <button onClick={() => toggleTaskDone(task.id, isDone ? "Completed" : task.status)}
                  className="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition text-xs"
                  style={{
                    borderColor: isDone ? "#3D8C5A" : "var(--card-border)",
                    background: isDone ? "#3D8C5A" : "transparent",
                    color: isDone ? "#fff" : "transparent",
                  }}>
                  {isDone ? "✓" : ""}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${isDone ? "line-through" : ""}`}
                    style={{ color: isDone ? "var(--muted)" : "var(--text)" }}>
                    {task.title}
                  </p>
                  {task.description && <p className="text-[10px] truncate" style={{ color: "var(--muted)" }}>{task.description}</p>}
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${st.color}15`, color: st.color }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        {(mode === "tech" ? activeTechTasks : activeNonTechTasks).length === 0 && (
          <div className="text-center py-6 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
            <p className="text-xs" style={{ color: "var(--muted)" }}>لا توجد مهام متبقية 🎉</p>
          </div>
        )}
      </div>

      {/* ── Ideas sidebar list ── */}
      {ideas.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-[10px] font-bold mb-2" style={{ color: "#F59E0B" }}>💡 أفكار الجلسة ({ideas.length})</p>
          <div className="space-y-1">
            {ideas.map(idea => {
              const it = IDEA_TYPES.find(t => t.key === idea.type)!;
              return (
                <div key={idea.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text)" }}>
                  <span style={{ color: it.color }}>{it.icon}</span>
                  <span className="flex-1 truncate">{idea.text}</span>
                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>{idea.time.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Floating Idea Button ── */}
      <button onClick={() => setShowIdeaInput(true)}
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition hover:scale-110 z-30"
        style={{ background: "linear-gradient(135deg, #F59E0B, #D4AF37)", color: "#fff" }}>
        💡
      </button>

      {/* ── Idea Input Modal ── */}
      {showIdeaInput && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowIdeaInput(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm" style={{ color: "var(--text)" }}>💡 فكرة سريعة</h4>
              <button onClick={() => setShowIdeaInput(false)} style={{ color: "var(--muted)" }}>✕</button>
            </div>
            <input value={ideaText} onChange={e => setIdeaText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addIdea(); }}
              placeholder="اكتب فكرتك..."
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
            <div className="flex gap-1.5">
              {IDEA_TYPES.map(it => (
                <button key={it.key} onClick={() => setIdeaType(it.key)}
                  className="flex-1 py-2 rounded-lg text-[10px] font-semibold transition"
                  style={{
                    background: ideaType === it.key ? it.color : "var(--bg)",
                    color: ideaType === it.key ? "#fff" : "var(--muted)",
                    border: `1px solid ${ideaType === it.key ? it.color : "var(--card-border)"}`,
                  }}>
                  {it.icon} {it.label}
                </button>
              ))}
            </div>
            <button onClick={addIdea} disabled={!ideaText.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-30"
              style={{ background: "#F59E0B" }}>
              حفظ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SESSION SUMMARY
   ═══════════════════════════════════════════════════════════════════════ */

function SessionSummary({ log, onConvert, converting }: {
  log: SessionLog;
  onConvert: (idea: Idea) => void;
  converting: Set<string>;
}) {
  const duration = log.endTime ? Math.round((log.endTime.getTime() - log.startTime.getTime()) / 60000) : 0;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <p className="text-4xl mb-2">🏆</p>
          <h1 className="font-bold text-xl" style={{ color: "var(--text)" }}>ملخص الجلسة</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {duration} دقيقة من التركيز
          </p>
        </div>

        {/* Tech accomplishments */}
        {log.techProjectTitle && (
          <div className="rounded-xl border p-4" style={{ borderColor: "#3B82F630", background: "#3B82F606" }}>
            <div className="flex items-center gap-2 mb-2">
              <span>💻</span>
              <span className="font-bold text-xs" style={{ color: "#3B82F6" }}>{log.techProjectTitle}</span>
            </div>
            {log.techCompleted.length > 0 ? (
              <div className="space-y-1">
                {log.techCompleted.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#3D8C5A" }}>✓</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>لم تُكمل مهام تقنية</p>
            )}
          </div>
        )}

        {/* Non-tech accomplishments */}
        {log.nonTechProjectTitle && (
          <div className="rounded-xl border p-4" style={{ borderColor: "#D4AF3730", background: "#D4AF3706" }}>
            <div className="flex items-center gap-2 mb-2">
              <span>🌿</span>
              <span className="font-bold text-xs" style={{ color: "#D4AF37" }}>{log.nonTechProjectTitle}</span>
            </div>
            {log.nonTechCompleted.length > 0 ? (
              <div className="space-y-1">
                {log.nonTechCompleted.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#3D8C5A" }}>✓</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>لم تُكمل مهام غير تقنية</p>
            )}
          </div>
        )}

        {/* Ideas review */}
        {log.ideas.length > 0 && (
          <div className="rounded-xl border p-4" style={{ borderColor: "#F59E0B30", background: "#F59E0B06" }}>
            <div className="flex items-center gap-2 mb-3">
              <span>💡</span>
              <span className="font-bold text-xs" style={{ color: "#F59E0B" }}>أفكار الجلسة ({log.ideas.length})</span>
            </div>
            <div className="space-y-2">
              {log.ideas.map(idea => {
                const it = IDEA_TYPES.find(t => t.key === idea.type)!;
                const isConverting = converting.has(idea.id);
                return (
                  <div key={idea.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "var(--card)" }}>
                    <span style={{ color: it.color }}>{it.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: "var(--text)" }}>{idea.text}</p>
                      <p className="text-[9px]" style={{ color: "var(--muted)" }}>{it.label}</p>
                    </div>
                    <button onClick={() => onConvert(idea)} disabled={isConverting}
                      className="text-[10px] px-2 py-1 rounded-lg font-semibold transition disabled:opacity-40"
                      style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>
                      {isConverting ? "..." : "تحويل لمهمة"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Link href="/projects"
          className="block w-full py-3 rounded-xl text-sm font-bold text-white text-center"
          style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
          العودة للمشاريع
        </Link>
      </div>
    </main>
  );
}
