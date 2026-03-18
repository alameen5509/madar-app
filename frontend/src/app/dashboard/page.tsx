"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getTasks, getSalahToday, updateTaskStatus, api,
  type SmartTask, type SalahTimesResponse,
} from "@/lib/api";

// ─── Arabic digits ────────────────────────────────────────────────────────────

const AR = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
function toAr(n: number, pad = 2): string {
  return String(n).padStart(pad, "0").split("").map(d => AR[+d]).join("");
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function toMin(hhmm: string): number { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function nowMin(): number { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function fmt(secs: number): string {
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

// ─── Prayer logic ─────────────────────────────────────────────────────────────

interface Prayer { name: string; adhan: number; start: number; time: string; }

function buildPrayers(s: SalahTimesResponse): Prayer[] {
  return [
    { name: "الفجر",  adhan: toMin(s.fajr),    start: toMin(s.fajr)    + 40, time: s.fajr },
    { name: "الشروق", adhan: toMin(s.shuruq),   start: toMin(s.shuruq)  + 15, time: s.shuruq },
    { name: "الظهر",  adhan: toMin(s.dhuhr),   start: toMin(s.dhuhr)   + 40, time: s.dhuhr },
    { name: "العصر",  adhan: toMin(s.asr),     start: toMin(s.asr)     + 40, time: s.asr },
    { name: "المغرب", adhan: toMin(s.maghrib), start: toMin(s.maghrib) + 40, time: s.maghrib },
    { name: "العشاء", adhan: toMin(s.isha),    start: toMin(s.isha)    + 40, time: s.isha },
  ];
}

function getDayEnd(prayers: Prayer[]): number {
  if (!prayers.length) return 22 * 60;
  return prayers[prayers.length - 1].start;
}

function getPeriod(prayers: Prayer[], now: number) {
  const end = getDayEnd(prayers);
  if (!prayers.length || now < prayers[0].start || now >= end) return null;
  for (let i = 0; i < prayers.length; i++) {
    const blockEnd = i + 1 < prayers.length ? prayers[i + 1].adhan : end;
    if (now >= prayers[i].start && now < blockEnd) {
      return {
        name: prayers[i].name,
        nextName: i + 1 < prayers.length ? prayers[i + 1].name : "نهاية اليوم",
        minsLeft: blockEnd - now,
      };
    }
  }
  return null;
}

function isInAdhanWindow(prayers: Prayer[], now: number): boolean {
  return prayers.some((p) => now >= p.adhan && now < p.start);
}

// ─── Task types ───────────────────────────────────────────────────────────────

interface TaskItem {
  id: string;
  title: string;
  circle: string;
  circleColor: string;
  circleIcon: string;
  priority: number;
  priorityLabel: "عالية" | "متوسطة" | "منخفضة";
  done: boolean;
  cognitiveLoad: string;
  estimatedMin: number;
  context: string;
  isUrgent: boolean;
}

const P_COLORS: Record<string, string> = {
  "عالية":  "bg-red-100 text-red-700",
  "متوسطة": "bg-yellow-100 text-yellow-700",
  "منخفضة": "bg-green-100 text-green-700",
};

const TASK_CONTEXTS = [
  { key: "Anywhere", label: "أي مكان", icon: "🌐" },
  { key: "Office",   label: "مكتب",   icon: "🏢" },
  { key: "Home",     label: "منزل",   icon: "🏠" },
  { key: "Phone",    label: "اتصال",  icon: "📞" },
  { key: "Online",   label: "أونلاين", icon: "💻" },
  { key: "Car",      label: "مشوار",  icon: "🚗" },
] as const;

function toTaskItem(t: SmartTask): TaskItem {
  const p = t.userPriority;
  return {
    id: t.id,
    title: t.title,
    circle: t.lifeCircle?.name ?? "",
    circleColor: t.lifeCircle?.color ?? "#5E5495",
    circleIcon: t.lifeCircle?.icon ?? "◎",
    priority: p,
    priorityLabel: p >= 4 ? "عالية" : p === 3 ? "متوسطة" : "منخفضة",
    done: t.status === "Completed",
    cognitiveLoad: t.cognitiveLoad ?? "Medium",
    estimatedMin: t.estimatedDurationMinutes ?? 0,
    context: (t.contextNote ?? "").match(/ctx:(\w+)/)?.[1] ?? "Anywhere",
    isUrgent: (t.contextNote ?? "").includes("urgent"),
  };
}

// ─── Focus Session Constants ──────────────────────────────────────────────────

const FOCUS_SEC     = 25 * 60;
const FOCUS_LOW_SEC = 15 * 60;
const SHORT_SEC     =  5 * 60;
const LONG_SEC      = 25 * 60;

type Mode = "idle" | "focus" | "break_short" | "break_long" | "prayer";
type Mood = "good" | "low" | null;

function isLongBreak(n: number): boolean { return n === 1 || n % 3 === 0; }

const BREAK_MSGS = [
  "استرح قليلاً، لقد أنجزت عملاً رائعاً",
  "خذ نفساً عميقاً، جسمك يستحق الراحة",
  "فترة الراحة تزيد إنتاجيتك، استمتع بها",
  "ماء، تمدد، تنفس — ثم عد أقوى",
  "الراحة جزء من العمل، لا تتجاوزها",
];

// ─── Celebration Effect ───────────────────────────────────────────────────────

function CelebrationEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="text-center animate-bounce">
        <p className="text-5xl mb-1">🎉</p>
        <p className="text-[#D4AF37] font-black text-lg">أحسنت!</p>
      </div>
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="absolute w-2 h-2 rounded-full"
            style={{
              background: ["#D4AF37","#2C2C54","#3D8C5A","#DC2626","#0F3460"][i%5],
              left: `${10 + (i * 6)}%`, top: "-5%",
              animation: `cfall ${1.5 + (i % 3) * 0.3}s ease-in forwards`,
              animationDelay: `${(i % 5) * 0.1}s`,
            }}/>
        ))}
      </div>
      <style>{`@keyframes cfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

// ─── Analog Clock SVG ─────────────────────────────────────────────────────────

function AnalogClock({ hours, minutes, seconds }: { hours: number; minutes: number; seconds: number }) {
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;
  const numerals = ["١٢", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠", "١١"];

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" style={{ filter: "drop-shadow(0 4px 20px rgba(212,175,55,0.15))" }}>
      <circle cx="100" cy="100" r="96" fill="none" stroke="url(#goldGrad)" strokeWidth="2" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="url(#goldGrad)" strokeWidth="0.5" opacity="0.4" />
      <circle cx="100" cy="100" r="90" fill="var(--card)" />
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#E8C96A" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
        <linearGradient id="hourHandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2A2542" />
          <stop offset="100%" stopColor="#5E5495" />
        </linearGradient>
        <linearGradient id="minuteHandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3D3468" />
          <stop offset="100%" stopColor="#7B6FC0" />
        </linearGradient>
        <pattern id="clockPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="translate(100,100)">
          <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="var(--gold)" strokeWidth="0.3" opacity="0.08" />
        </pattern>
      </defs>
      <circle cx="100" cy="100" r="88" fill="url(#clockPattern)" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="var(--gold)" strokeWidth="0.3" opacity="0.2" />
      {Array.from({ length: 60 }).map((_, i) => {
        const angle = (i * 6 * Math.PI) / 180;
        const isHour = i % 5 === 0;
        const r1 = isHour ? 80 : 84;
        return (
          <line key={i}
            x1={100 + r1 * Math.sin(angle)} y1={100 - r1 * Math.cos(angle)}
            x2={100 + 88 * Math.sin(angle)} y2={100 - 88 * Math.cos(angle)}
            stroke={isHour ? "var(--gold)" : "var(--text-secondary)"} strokeWidth={isHour ? 2 : 0.5} opacity={isHour ? 0.8 : 0.3}
          />
        );
      })}
      {numerals.map((num, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        return (
          <text key={i} x={100 + 73 * Math.sin(angle)} y={100 - 73 * Math.cos(angle)}
            textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="11" fontWeight="700"
            fontFamily="var(--font-main, 'IBM Plex Sans Arabic', sans-serif)">
            {num}
          </text>
        );
      })}
      <line x1="100" y1="100" x2={100 + 45 * Math.sin((hourAngle * Math.PI) / 180)} y2={100 - 45 * Math.cos((hourAngle * Math.PI) / 180)}
        stroke="url(#hourHandGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="100" y1="100" x2={100 + 60 * Math.sin((minuteAngle * Math.PI) / 180)} y2={100 - 60 * Math.cos((minuteAngle * Math.PI) / 180)}
        stroke="url(#minuteHandGrad)" strokeWidth="2.5" strokeLinecap="round" />
      <line
        x1={100 - 12 * Math.sin((secondAngle * Math.PI) / 180)} y1={100 + 12 * Math.cos((secondAngle * Math.PI) / 180)}
        x2={100 + 65 * Math.sin((secondAngle * Math.PI) / 180)} y2={100 - 65 * Math.cos((secondAngle * Math.PI) / 180)}
        stroke="#D4AF37" strokeWidth="1" strokeLinecap="round" />
      <circle cx="100" cy="100" r="4" fill="url(#goldGrad)" />
      <circle cx="100" cy="100" r="2" fill="var(--card)" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DASHBOARD PAGE ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  // ── Clock ──
  const [now, setNow] = useState(new Date());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Prayers ──
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [prayersReady, setPrayersReady] = useState(false);

  // ── Focus Session ──
  const [mode, setMode] = useState<Mode>("idle");
  const [timeLeft, setTimeLeft] = useState(FOCUS_SEC);
  const [sessionCount, setSessionCount] = useState(0);
  const [prayerOverlay, setPrayerOverlay] = useState<string | null>(null);
  const [breakMsg] = useState(() => BREAK_MSGS[Math.floor(Math.random() * BREAK_MSGS.length)]);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const [taskPaused, setTaskPaused] = useState(false);
  const taskStartRef = useRef<number>(0);
  const [mood, setMood] = useState<Mood>(null);
  const [showMoodPanel, setShowMoodPanel] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDeferMenu, setShowDeferMenu] = useState(false);

  // ── Tasks ──
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // ── Local summary ──
  const [summary, setSummary] = useState({ habDone: 0, habTotal: 0, quranDone: false, focusMins: 0 });

  // ── Refs ──
  const modeRef = useRef<Mode>("idle");
  const sessRef = useRef(0);
  const lastAdhanMin = useRef(-1);
  modeRef.current = mode;
  sessRef.current = sessionCount;
  const [nowMinState, setNowMinState] = useState(nowMin);

  // ── Clock tick ──
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // ── Fetch prayers ──
  useEffect(() => {
    getSalahToday()
      .then((s) => { setPrayers(buildPrayers(s)); setPrayersReady(true); })
      .catch(() => setPrayersReady(true));
  }, []);

  // ── Fetch tasks ──
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await getTasks();
      const items = data
        .filter(t => t.status !== "Cancelled" && t.status !== "Deferred")
        .sort((a, b) => {
          // Urgent first, then by priority desc
          const aUrg = (a.contextNote ?? "").includes("urgent") ? 1 : 0;
          const bUrg = (b.contextNote ?? "").includes("urgent") ? 1 : 0;
          if (aUrg !== bUrg) return bUrg - aUrg;
          if (a.status === "Completed" !== (b.status === "Completed")) return a.status === "Completed" ? 1 : -1;
          return b.userPriority - a.userPriority;
        })
        .map(toTaskItem);
      setTasks(items);
    } catch { /* silent */ }
    setTasksLoading(false);
  }, []);

  // ── Load summary ──
  const loadSummary = useCallback(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toDateString();
    const todayISO = new Date().toISOString().slice(0, 10);
    let habDone = 0, habTotal = 0, quranDone = false, focusMins = 0;
    try { const h = JSON.parse(localStorage.getItem("madar_habits") ?? "[]"); const ld = localStorage.getItem("madar_habits_date"); const active = h.filter((x: { isIdea: boolean }) => !x.isIdea); habTotal = active.length; habDone = active.filter((x: { todayDone: boolean }) => ld === today && x.todayDone).length; } catch {}
    try { const q = JSON.parse(localStorage.getItem("madar_quran2") ?? "{}"); quranDone = q.lastDate === today && q.todayDone; } catch {}
    try { const log = JSON.parse(localStorage.getItem("madar_focus_log") ?? "[]"); focusMins = log.filter((e: { date: string }) => e.date === todayISO).reduce((s: number, e: { durationMin: number }) => s + e.durationMin, 0); } catch {}
    setSummary({ habDone, habTotal, quranDone, focusMins });
  }, []);

  // ── Initial load + auto-refresh ──
  useEffect(() => {
    fetchTasks();
    loadSummary();
    const refresh = setInterval(() => { fetchTasks(); loadSummary(); }, 60_000);
    const onUpdate = () => { fetchTasks(); loadSummary(); };
    window.addEventListener("storage", loadSummary);
    window.addEventListener("madar-update", onUpdate);
    return () => { clearInterval(refresh); window.removeEventListener("storage", loadSummary); window.removeEventListener("madar-update", onUpdate); };
  }, [fetchTasks, loadSummary]);

  // ── Adhan detection ──
  useEffect(() => {
    const id = setInterval(() => {
      const n = nowMin();
      setNowMinState(n);
      if (!prayersReady || !prayers.length) return;
      const hit = prayers.find((p) => p.adhan === n);
      if (hit && lastAdhanMin.current !== n) {
        lastAdhanMin.current = n;
        if (modeRef.current === "focus") {
          const nn = sessRef.current + 1;
          setSessionCount(nn);
          sessRef.current = nn;
        }
        setPrayerOverlay(hit.name);
        setMode("prayer");
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [prayersReady, prayers]);

  // ── Countdown ──
  useEffect(() => {
    if (mode !== "focus" && mode !== "break_short" && mode !== "break_long") return;
    if (timeLeft === 0) {
      if (mode === "focus") {
        const n = sessionCount + 1;
        setSessionCount(n);
        const long = isLongBreak(n);
        setMode(long ? "break_long" : "break_short");
        setTimeLeft(long ? LONG_SEC : SHORT_SEC);
        try {
          const today = new Date().toISOString().slice(0, 10);
          const log = JSON.parse(localStorage.getItem("madar_focus_log") ?? "[]");
          log.push({ date: today, taskId: focusTaskId ?? null, durationMin: mood === "low" ? 15 : 25, ts: Date.now() });
          const cutoff = Date.now() - 90 * 86400000;
          localStorage.setItem("madar_focus_log", JSON.stringify(log.filter((e: { ts: number }) => e.ts > cutoff)));
          loadSummary();
        } catch {}
      } else {
        setMode("idle");
        setTimeLeft(FOCUS_SEC);
        setFocusTaskId(null);
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, timeLeft, sessionCount, focusTaskId, mood, loadSummary]);

  // ── Task timer tick ──
  useEffect(() => {
    if (mode !== "focus" || taskPaused || !focusTaskId) return;
    const t = setInterval(() => setTaskElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode, taskPaused, focusTaskId]);

  // ── Derived ──
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const periodInfo = getPeriod(prayers, nowMinState);
  const inWorkTime = periodInfo !== null;
  const inAdhan = isInAdhanWindow(prayers, nowMinState);
  const pendingTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);
  const doneCount = doneTasks.length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const dotsInCycle = sessionCount % 3 === 0 ? (sessionCount === 0 ? 0 : 3) : sessionCount % 3;
  const cycleNum = sessionCount === 0 ? 1 : Math.ceil(sessionCount / 3);
  const focusTask = focusTaskId ? tasks.find((t) => t.id === focusTaskId) ?? null : null;

  const hijriDate = now.toLocaleDateString("ar-SA-u-ca-islamic", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const gregorianDate = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const greeting = hours < 5 ? "طاب ليلك" : hours < 12 ? "صباح الخير" : hours < 17 ? "مساء النور" : "مساء الخير";

  // ── Default task duration ──
  function getDefaultDuration(context: string): number {
    const map: Record<string, number> = { Office: 45, Home: 30, Phone: 15, Online: 30, Car: 20, Anywhere: 5 };
    return (map[context] ?? 5) * 60;
  }

  // ── Focus actions ──
  function startFocus(taskId?: string) {
    const duration = mood === "low" ? FOCUS_LOW_SEC : FOCUS_SEC;
    setFocusTaskId(taskId ?? null);
    setMode("focus");
    setTimeLeft(duration);
    if (taskId) {
      const saved = Number(localStorage.getItem(`madar_task_time_${taskId}`) ?? "0");
      setTaskElapsed(saved);
      setTaskPaused(false);
      taskStartRef.current = Date.now();
    } else {
      setTaskElapsed(0);
      setTaskPaused(false);
    }
  }

  function stopFocus() {
    if (focusTaskId) localStorage.setItem(`madar_task_time_${focusTaskId}`, String(taskElapsed));
    setMode("idle");
    setTimeLeft(FOCUS_SEC);
    setFocusTaskId(null);
    setTaskElapsed(0);
    setTaskPaused(false);
    setShowDeferMenu(false);
  }

  function skipBreak() {
    setMode("idle");
    setTimeLeft(FOCUS_SEC);
    setFocusTaskId(null);
  }

  function dismissPrayer() {
    if (focusTaskId) localStorage.setItem(`madar_task_time_${focusTaskId}`, String(taskElapsed));
    setPrayerOverlay(null);
    setMode("idle");
    setTimeLeft(FOCUS_SEC);
    setFocusTaskId(null);
    setTaskElapsed(0);
    setTaskPaused(false);
  }

  async function toggleTask(task: TaskItem) {
    if (!task.done) {
      setShowCelebration(true);
      localStorage.removeItem(`madar_task_time_${task.id}`);
    }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
    try {
      await updateTaskStatus(task.id, task.done ? "Todo" : "Completed");
      window.dispatchEvent(new Event("madar-update"));
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: task.done } : t));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── FOCUS OVERLAY (full-screen) ──
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "focus") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #2A2542 0%, #5E5495 100%)" }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden>
          <defs>
            <pattern id="focus-bg" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <polygon points="30,4 54,17 54,43 30,56 6,43 6,17" fill="none" stroke="white" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#focus-bg)" />
        </svg>

        {showCelebration && <CelebrationEffect onDone={() => setShowCelebration(false)} />}

        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md px-6">

          {/* Period info */}
          {periodInfo && (
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>فترة {periodInfo.name}</span>
              <span>• 🕌 {periodInfo.nextName} بعد {Math.floor(periodInfo.minsLeft / 60) > 0 ? `${Math.floor(periodInfo.minsLeft / 60)} س ` : ""}{periodInfo.minsLeft % 60} د</span>
            </div>
          )}

          {/* Session dots */}
          <div className="flex items-center gap-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i}
                className={`rounded-full transition-all duration-300 ${i <= dotsInCycle ? "w-3 h-3 animate-pulse" : "w-2.5 h-2.5"}`}
                style={{ background: i <= dotsInCycle ? "#C9A84C" : "rgba(255,255,255,0.15)" }}
              />
            ))}
          </div>

          {/* Two Timers */}
          <div className="flex items-end gap-8 w-full justify-center">
            <div className="text-center">
              <p className="text-white/30 text-[10px] mb-1 tracking-wider">الجلسة</p>
              <p className="text-6xl font-black tabular-nums leading-none select-none"
                style={{ color: "#C9A84C", letterSpacing: "0.05em" }}>
                {fmt(timeLeft)}
              </p>
              <p className="text-white/40 text-[10px] mt-1">
                جلسة #{sessionCount + 1}{mood === "low" ? " مخففة" : ""}
              </p>
            </div>
            {focusTask && (
              <div className="text-center">
                <p className="text-white/30 text-[10px] mb-1 tracking-wider">المهمة {taskPaused ? "(متوقفة)" : ""}</p>
                <p className="text-4xl font-black tabular-nums leading-none select-none"
                  style={{ color: taskPaused ? "rgba(255,255,255,0.3)" : "#8FD49B", letterSpacing: "0.05em" }}>
                  {fmt(taskElapsed)}
                </p>
                <button onClick={() => setTaskPaused(!taskPaused)}
                  className="text-[10px] mt-1.5 px-3 py-1 rounded-full transition"
                  style={{ background: taskPaused ? "#3D8C5A30" : "rgba(255,255,255,0.08)", color: taskPaused ? "#8FD49B" : "rgba(255,255,255,0.4)" }}>
                  {taskPaused ? "▶ استئناف المهمة" : "⏸ إيقاف مؤقت"}
                </button>
              </div>
            )}
          </div>

          {/* Current task card */}
          {focusTask && (
            <div className="w-full bg-white/10 rounded-xl px-5 py-4 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/40 text-[10px] tracking-wider">المهمة الحالية</p>
                {(() => {
                  const est = getDefaultDuration(focusTask.context);
                  const pct = Math.min(100, Math.round((taskElapsed / est) * 100));
                  return <span className="text-[10px]" style={{ color: pct >= 100 ? "#DC2626" : "#8FD49B" }}>{pct}% من الوقت المقدر</span>;
                })()}
              </div>
              <p className="text-white font-semibold text-base">{focusTask.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-white/30">{focusTask.circle}</span>
                {focusTask.context !== "Anywhere" && (
                  <span className="text-[10px] text-white/30">{TASK_CONTEXTS.find(c=>c.key===focusTask.context)?.icon} {TASK_CONTEXTS.find(c=>c.key===focusTask.context)?.label}</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${P_COLORS[focusTask.priorityLabel]}`}>
                  {focusTask.priorityLabel}
                </span>
              </div>
              <div className="mt-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, Math.round((taskElapsed / getDefaultDuration(focusTask.context)) * 100))}%`,
                  background: taskElapsed >= getDefaultDuration(focusTask.context) ? "#DC2626" : "#8FD49B",
                }} />
              </div>
            </div>
          )}

          {!focusTask && (
            <div className="w-full bg-white/10 rounded-xl px-5 py-4 border border-white/10 text-center">
              <p className="text-white/40 text-sm">تركيز حر — بدون مهمة محددة</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2 w-full">
              {focusTask && (
                <button onClick={() => {
                  toggleTask(focusTask);
                  localStorage.removeItem(`madar_task_time_${focusTask.id}`);
                  const nextTask = pendingTasks.filter(t => t.id !== focusTask.id)[0];
                  if (nextTask && timeLeft > 0) {
                    setFocusTaskId(nextTask.id);
                    const saved = Number(localStorage.getItem(`madar_task_time_${nextTask.id}`) ?? "0");
                    setTaskElapsed(saved);
                    setTaskPaused(false);
                    fetchTasks();
                  } else {
                    stopFocus();
                  }
                }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)", color: "#1A1830" }}>
                  أنجزتها ✓
                </button>
              )}
              {focusTask && (
                <button onClick={() => setShowDeferMenu(true)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-amber-300 border border-amber-400/30 hover:bg-amber-400/10 transition">
                  تأجيل ⏳
                </button>
              )}
              <button onClick={stopFocus}
                className="px-5 py-3 rounded-xl text-sm font-bold text-white/50 border border-white/15 hover:bg-white/10 transition">
                إيقاف
              </button>
            </div>

            {/* Defer menu */}
            {showDeferMenu && focusTask && (
              <div className="w-full bg-white/10 rounded-xl p-4 border border-white/10 space-y-2 fade-up">
                <p className="text-white/60 text-xs text-center mb-2">تأجيل &quot;{focusTask.title}&quot; إلى:</p>
                {[
                  { label: "بعد هذه المهمة مباشرة", status: null },
                  { label: "الفترة القادمة", status: "Deferred" },
                  { label: "غداً", status: "Scheduled" },
                  { label: "الأسبوع القادم", status: "Deferred" },
                  { label: "تعليق المهمة", status: "Deferred" },
                  { label: "إلغاء المهمة", status: "Cancelled", color: "#DC2626" },
                ].map((opt, i) => (
                  <button key={i} onClick={async () => {
                    if (opt.status) await api.patch(`/api/tasks/${focusTask.id}/status`, { status: opt.status }).catch(() => {});
                    localStorage.setItem(`madar_task_time_${focusTask.id}`, String(taskElapsed));
                    const currentIdx = pendingTasks.findIndex(t => t.id === focusTask.id);
                    const nextTask = pendingTasks[currentIdx + 1] ?? pendingTasks[0];
                    if (nextTask && nextTask.id !== focusTask.id) {
                      setFocusTaskId(nextTask.id);
                      const saved = Number(localStorage.getItem(`madar_task_time_${nextTask.id}`) ?? "0");
                      setTaskElapsed(saved);
                      setTaskPaused(false);
                    } else {
                      stopFocus();
                    }
                    setShowDeferMenu(false);
                    if (opt.status) fetchTasks();
                  }}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition hover:bg-white/10 text-right px-4"
                    style={{ color: opt.color ?? "white", border: `1px solid ${opt.color ? opt.color + "40" : "rgba(255,255,255,0.1)"}` }}>
                    {opt.label}
                  </button>
                ))}
                <button onClick={() => setShowDeferMenu(false)}
                  className="w-full py-2 text-xs text-white/30 hover:text-white/50">إلغاء</button>
              </div>
            )}
          </div>

          {/* Session count */}
          {sessionCount > 0 && (
            <p className="text-white/30 text-xs">{sessionCount} جلسة مكتملة — دورة {cycleNum}</p>
          )}

          {/* Upcoming tasks */}
          {pendingTasks.filter(t => t.id !== focusTaskId).length > 0 && (
            <div className="w-full mt-2 pt-3 border-t border-white/10">
              <p className="text-white/30 text-[10px] mb-2 text-center">المهام القادمة:</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {pendingTasks.filter(t => t.id !== focusTaskId).slice(0, 4).map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition"
                    onClick={() => {
                      if (focusTaskId) localStorage.setItem(`madar_task_time_${focusTaskId}`, String(taskElapsed));
                      setFocusTaskId(t.id);
                      setTaskElapsed(Number(localStorage.getItem(`madar_task_time_${t.id}`) ?? "0"));
                      setTaskPaused(false);
                    }}>
                    <span className="text-white/20 text-[10px] w-3">{i + 1}</span>
                    <span className="text-white/50 text-xs flex-1 truncate">{t.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[t.priorityLabel]}`}>{t.priorityLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── BREAK OVERLAY ──
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "break_short" || mode === "break_long") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-7" style={{ background: "#0F3460" }}>
        <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" aria-hidden>
          <defs>
            <pattern id="break-bg" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <polygon points="30,4 54,17 54,43 30,56 6,43 6,17" fill="none" stroke="white" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#break-bg)" />
        </svg>
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-white/40 text-sm mb-1 tracking-widest">
              {mode === "break_long" ? "راحة طويلة • ٢٥ دقيقة" : "راحة قصيرة • ٥ دقائق"}
            </p>
            <p className="text-8xl font-black tabular-nums leading-none" style={{ color: "#C9A84C" }}>
              {fmt(timeLeft)}
            </p>
          </div>
          <p className="text-white/60 text-base text-center px-10 max-w-xs leading-relaxed">{breakMsg}</p>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full"
                style={{ background: i <= dotsInCycle ? "#C9A84C" : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
          <button onClick={skipBreak}
            className="mt-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white/50 border border-white/15 hover:border-white/30 hover:text-white/80 transition">
            تخطي الراحة
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── PRAYER OVERLAY ──
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "prayer" && prayerOverlay) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8"
        style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #2A2542 100%)" }}>
        <div className="text-center">
          <p className="text-6xl mb-4">🕌</p>
          <p className="text-white/40 text-sm tracking-widest mb-2">حان وقت</p>
          <p className="text-4xl font-black text-[#C9A84C]">{prayerOverlay}</p>
        </div>
        <p className="text-white/50 text-base text-center px-8 max-w-sm leading-relaxed" style={{ fontFamily: "var(--font-amiri, Amiri, serif)" }}>
          ﴿ حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَىٰ وَقُومُوا لِلَّهِ قَانِتِينَ ﴾
        </p>
        <button onClick={dismissPrayer}
          className="px-10 py-3 rounded-xl text-sm font-bold text-white/60 border border-white/15 hover:bg-white/10 transition">
          صلّيت — متابعة
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── MAIN PAGE ──
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {showCelebration && <CelebrationEffect onDone={() => setShowCelebration(false)} />}

      {/* ── Hero: Clock + Date ── */}
      <section className="relative overflow-hidden" style={{
        background: "linear-gradient(180deg, #1A1A2E 0%, #2A2542 50%, var(--bg) 100%)",
        paddingBottom: 40,
      }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden>
          <defs>
            <pattern id="hero-geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <polygon points="30,2 56,16 56,44 30,58 4,44 4,16" fill="none" stroke="white" strokeWidth="0.5" />
              <polygon points="30,10 50,21 50,43 30,54 10,43 10,21" fill="none" stroke="white" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-geo)" />
        </svg>

        <div className="relative z-10 pt-8 pb-4 px-8">
          {/* Greeting */}
          <div className="text-center mb-6">
            <p className="text-white/50 text-xs mb-1">{greeting}</p>
            <p className="shimmer-text text-xl font-bold" style={{ fontFamily: "var(--font-amiri, Amiri, serif)" }}>
              بسم الله الرحمن الرحيم
            </p>
          </div>

          {/* Clock row */}
          <div className="flex items-center justify-center gap-10">
            {/* Analog Clock */}
            <div className="w-56 h-56 flex-shrink-0">
              <AnalogClock hours={hours} minutes={minutes} seconds={seconds} />
            </div>

            {/* Digital Time + Info */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="font-black tabular-nums tracking-tight"
                  style={{
                    fontSize: 72, lineHeight: 1,
                    background: "linear-gradient(180deg, #FFFFFF 0%, #D4AF37 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    fontFamily: "var(--font-main, 'IBM Plex Sans Arabic', sans-serif)",
                  }}>
                  {toAr(hours)}:{toAr(minutes)}
                </span>
                <span className="font-bold tabular-nums" style={{ fontSize: 28, color: "#D4AF37", fontFamily: "var(--font-main)" }}>
                  {toAr(seconds)}
                </span>
              </div>

              {periodInfo && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: "rgba(212,175,55,0.12)" }}>
                  <span className="w-2 h-2 rounded-full bg-[#3D8C5A] animate-pulse" />
                  <span className="text-[#D4AF37] font-semibold" style={{ fontSize: 13 }}>
                    فترة {periodInfo.name} • {periodInfo.nextName} بعد {periodInfo.minsLeft} د
                  </span>
                </div>
              )}

              <div className="text-center">
                <p className="text-white/80 font-semibold" style={{ fontSize: 14 }}>{hijriDate}</p>
                <p className="text-white/40" style={{ fontSize: 12 }}>{gregorianDate}</p>
              </div>

              {/* Progress ring */}
              <div className="flex items-center gap-3 mt-1">
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#D4AF37" strokeWidth="2.5"
                      strokeDasharray={`${progressPct} ${100 - progressPct}`} strokeLinecap="round" className="transition-all duration-700" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-white font-bold" style={{ fontSize: 11 }}>
                    {progressPct}٪
                  </span>
                </div>
                <div>
                  <p className="text-white/60" style={{ fontSize: 11 }}>إنجاز اليوم</p>
                  <p className="text-white font-bold" style={{ fontSize: 13 }}>{doneCount} من {totalCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Prayer Times Strip ── */}
      {prayersReady && prayers.length > 0 && (
        <section className="px-6 -mt-4">
          <div className="rounded-2xl p-4 shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {prayers.map((p) => {
                const now2 = nowMinState;
                const passed = now2 > p.adhan;
                const isNext = !passed && !prayers.some(pp => pp.adhan < p.adhan && now2 <= pp.adhan);
                const nextPrayer = prayers.find(pp => now2 <= pp.adhan);
                const isActualNext = nextPrayer?.name === p.name;
                return (
                  <div key={p.name} className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all ${
                    isActualNext ? "bg-gradient-to-b from-[#D4AF37]/15 to-[#D4AF37]/5 ring-1 ring-[#D4AF37]/30" : passed ? "opacity-40" : ""
                  }`}>
                    <span className="font-bold" style={{ fontSize: 13, color: isActualNext ? "var(--gold)" : passed ? "var(--muted)" : "var(--text)" }}>
                      {p.name}
                    </span>
                    <span className="tabular-nums font-semibold" style={{ fontSize: 12, color: isActualNext ? "var(--gold)" : "var(--text-secondary)", direction: "ltr" }}>
                      {p.time}
                    </span>
                    {isActualNext && (
                      <span className="text-[#D4AF37] font-bold mt-0.5" style={{ fontSize: 11 }}>
                        بعد {p.adhan - now2} د
                      </span>
                    )}
                    {passed && <span style={{ fontSize: 11, color: "var(--muted)" }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="px-6 py-6 space-y-5">

        {/* ── Focus Session Panel ── */}
        <section className="rounded-2xl overflow-hidden shadow-lg" style={{
          background: "linear-gradient(160deg, #2A2542, #3D3468)",
        }}>
          <div className="px-5 py-6 flex flex-col items-center gap-4">
            {/* Mood button */}
            <div className="flex items-center gap-3 w-full justify-between">
              <button onClick={() => setShowMoodPanel(!showMoodPanel)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                style={{
                  background: mood === "low" ? "#FEF3C7" : mood === "good" ? "#D1FAE5" : "rgba(255,255,255,0.08)",
                  borderColor: mood === "low" ? "#F59E0B" : mood === "good" ? "#10B981" : "rgba(255,255,255,0.1)",
                  color: mood === "low" ? "#92400E" : mood === "good" ? "#065F46" : "rgba(255,255,255,0.5)",
                }}>
                {mood === "low" ? "😔 نفسية منخفضة" : mood === "good" ? "😊 بخير" : "🧠 حالتك؟"}
              </button>
              {sessionCount > 0 && (
                <span className="text-white/30 text-xs">{sessionCount} جلسة — دورة {cycleNum}</span>
              )}
              {summary.focusMins > 0 && (
                <span className="text-white/30 text-xs">◑ {summary.focusMins}د تركيز</span>
              )}
            </div>

            {/* Mood panel */}
            {showMoodPanel && (
              <div className="w-full flex gap-2 fade-up">
                <button onClick={() => { setMood("good"); setShowMoodPanel(false); }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-green-400/30 text-green-300 hover:bg-green-400/10 transition">
                  😊 بخير
                </button>
                <button onClick={() => { setMood("low"); setShowMoodPanel(false); }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 transition">
                  😔 نفسية منخفضة
                </button>
                <button onClick={() => { setMood(null); setShowMoodPanel(false); }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-white/10 text-white/40 hover:bg-white/5 transition">
                  إلغاء
                </button>
              </div>
            )}

            {/* Session dots */}
            <div className="flex items-center gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i}
                  className={`rounded-full transition-all duration-300 ${i <= dotsInCycle ? "w-3 h-3" : "w-2.5 h-2.5"}`}
                  style={{ background: i <= dotsInCycle ? "#C9A84C" : "rgba(255,255,255,0.15)" }}
                />
              ))}
            </div>

            {/* Timer preview */}
            <p className="text-5xl font-black tabular-nums leading-none select-none text-white" style={{ letterSpacing: "0.05em" }}>
              {fmt(mood === "low" ? FOCUS_LOW_SEC : FOCUS_SEC)}
            </p>

            <p className="text-sm text-white/50">
              {inWorkTime
                ? mood === "low" ? "جلسة مخففة — ١٥ دقيقة" : "جاهز للتركيز؟"
                : "انتهى وقت العمل"}
            </p>

            {/* Next task suggestion */}
            {pendingTasks.length > 0 ? (() => {
              const skipCount = typeof window !== "undefined" ? Number(sessionStorage.getItem("madar_skip") ?? "0") : 0;
              const nextTask = pendingTasks[skipCount % pendingTasks.length];
              return (
                <div className="w-full space-y-3">
                  <p className="text-xs text-center text-white/30">المهمة التالية:</p>
                  <div className="w-full px-5 py-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${P_COLORS[nextTask.priorityLabel]}`}>{nextTask.priorityLabel}</span>
                      <span className="flex-1 text-base font-semibold text-white">{nextTask.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      {nextTask.circleColor && (
                        <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${nextTask.circleColor}15`, color: nextTask.circleColor }}>{nextTask.circle}</span>
                      )}
                      {nextTask.context !== "Anywhere" && (
                        <span>{TASK_CONTEXTS.find(c=>c.key===nextTask.context)?.icon} {TASK_CONTEXTS.find(c=>c.key===nextTask.context)?.label}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => startFocus(nextTask.id)}
                      disabled={!inWorkTime || inAdhan}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
                      ابدأ التركيز
                    </button>
                    <button onClick={() => { sessionStorage.setItem("madar_skip", String(skipCount + 1)); setSessionCount(s => s); }}
                      className="px-5 py-3 rounded-xl text-sm font-semibold border border-white/15 transition hover:bg-white/5 text-white/40">
                      تخطي ←
                    </button>
                  </div>
                  <button onClick={() => startFocus()}
                    disabled={!inWorkTime || inAdhan}
                    className="text-xs transition disabled:opacity-40 w-full text-center text-white/30">
                    أو تركيز حر بدون مهمة
                  </button>
                </div>
              );
            })() : (
              <button onClick={() => startFocus()}
                disabled={!inWorkTime || inAdhan}
                className="px-10 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
                ابدأ جلسة تركيز
              </button>
            )}
          </div>
        </section>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-4 gap-3">
          <a href="/tasks" className="rounded-xl p-3 text-center transition hover:scale-[1.02]" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <p className="text-2xl mb-0.5">◻</p>
            <p className="font-black" style={{ fontSize: 18, color: pendingTasks.length > 0 ? "var(--gold)" : "#3D8C5A" }}>{pendingTasks.length}</p>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>مهام معلّقة</p>
          </a>
          <a href="/habits" className="rounded-xl p-3 text-center transition hover:scale-[1.02]" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <p className="text-2xl mb-0.5">↻</p>
            <p className="font-black" style={{ fontSize: 18, color: summary.habDone === summary.habTotal && summary.habTotal > 0 ? "#3D8C5A" : "#5E5495" }}>
              {summary.habDone}/{summary.habTotal}
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>العادات</p>
          </a>
          <a href="/quran" className="rounded-xl p-3 text-center transition hover:scale-[1.02]" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <p className="text-2xl mb-0.5">☽</p>
            <p className="font-black" style={{ fontSize: 18, color: summary.quranDone ? "#3D8C5A" : "var(--gold)" }}>{summary.quranDone ? "✓" : "—"}</p>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>الورد</p>
          </a>
          <a href="/tasks" className="rounded-xl p-3 text-center transition hover:scale-[1.02]" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <p className="text-2xl mb-0.5">◑</p>
            <p className="font-black" style={{ fontSize: 18, color: "#5E5495" }}>{summary.focusMins > 0 ? `${summary.focusMins}د` : "—"}</p>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>تركيز</p>
          </a>
        </div>

        {/* ── Today's Tasks ── */}
        <section>
          <GeometricDivider label="أعمال اليوم" />

          {tasksLoading && (
            <div className="mt-3 space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse" style={{ background: "var(--card)" }}>
                  <div className="w-6 h-6 rounded-full" style={{ background: "var(--card-border)" }} />
                  <div className="flex-1 h-4 rounded" style={{ background: "var(--card-border)" }} />
                </div>
              ))}
            </div>
          )}

          {!tasksLoading && tasks.length === 0 && (
            <div className="mt-3 text-center py-10 rounded-2xl" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <p className="text-3xl mb-2">✓</p>
              <p className="font-bold" style={{ color: "#3D8C5A", fontSize: 16 }}>لا توجد مهام</p>
            </div>
          )}

          {!tasksLoading && pendingTasks.length > 0 && (
            <div className="mt-3 space-y-2">
              {pendingTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow-md group"
                  style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                  <button onClick={() => toggleTask(t)}
                    className="w-6 h-6 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all hover:scale-110"
                    style={{
                      borderColor: t.priority >= 4 ? "#DC2626" : t.priority === 3 ? "#D4AF37" : "#3D8C5A",
                      background: "transparent",
                    }} />
                  {t.circle && (
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${t.circleColor}18`, fontSize: 14 }}>{t.circleIcon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: "var(--text)", fontSize: 15 }}>{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.circle && <span style={{ fontSize: 11, color: t.circleColor }}>{t.circle}</span>}
                      {t.estimatedMin > 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.estimatedMin}د</span>}
                      {t.context !== "Anywhere" && (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{TASK_CONTEXTS.find(c=>c.key===t.context)?.icon} {TASK_CONTEXTS.find(c=>c.key===t.context)?.label}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${P_COLORS[t.priorityLabel]}`}>{t.priorityLabel}</span>
                  <button onClick={() => startFocus(t.id)}
                    disabled={!inWorkTime || inAdhan}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1 rounded-lg font-semibold transition-all disabled:opacity-0"
                    style={{ fontSize: 12, background: "linear-gradient(135deg, #D4AF37, #E8C96A)", color: "#1A1A2E" }}>
                    ابدأ
                  </button>
                </div>
              ))}
            </div>
          )}

          {!tasksLoading && doneTasks.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold mb-2" style={{ color: "var(--muted)", fontSize: 13 }}>مكتملة ({doneCount})</p>
              <div className="space-y-1.5">
                {doneTasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl opacity-50"
                    style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                    <button onClick={() => toggleTask(t)}
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "#3D8C5A" }}>
                      <span className="text-white" style={{ fontSize: 10 }}>✓</span>
                    </button>
                    <p className="flex-1 line-through truncate" style={{ color: "var(--muted)", fontSize: 14 }}>{t.title}</p>
                  </div>
                ))}
                {doneTasks.length > 5 && (
                  <p className="text-center" style={{ fontSize: 12, color: "var(--muted)" }}>+{doneTasks.length - 5} مهام أخرى</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Progress bar ── */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: "var(--muted)" }}>تقدم اليوم</span>
            <span className="font-bold" style={{ color: "#5E5495" }}>{progressPct}%</span>
          </div>
          <div className="rounded-full h-3 overflow-hidden" style={{ background: "var(--card-border)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #5E5495, #C9A84C)" }} />
          </div>
        </div>

        {/* ── Quick Navigation ── */}
        <section>
          <GeometricDivider label="وصول سريع" />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
            {[
              { href: "/tasks", icon: "◻", label: "المهام" },
              { href: "/circles", icon: "◎", label: "الأدوار" },
              { href: "/projects", icon: "▣", label: "المشاريع" },
              { href: "/habits", icon: "↻", label: "العادات" },
              { href: "/finance", icon: "◇", label: "المالية" },
              { href: "/quran", icon: "☽", label: "الختمة" },
            ].map((l) => (
              <a key={l.href} href={l.href}
                className="rounded-xl py-3 text-center transition hover:scale-[1.02]"
                style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                <p className="text-xl mb-0.5">{l.icon}</p>
                <p className="font-medium" style={{ fontSize: 13, color: "var(--text)" }}>{l.label}</p>
              </a>
            ))}
          </div>
        </section>

        <div className="pb-4 mt-4">
          <GeometricDivider />
          <p className="text-center mt-2" style={{ fontSize: 12, color: "var(--muted)" }}>مدار — نظام إدارة الحياة الذكي</p>
        </div>
      </div>
    </main>
  );
}
