"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getTasks, createTask, getSalahToday, getGoals, acceptRejectTask, api,
  type SmartTask, type CreateTaskPayload, type SalahTimesResponse, type Goal,
} from "@/lib/api";

/* ─── Hijri / Gregorian Date ──────────────────────────────────────────────── */

function getHijriDate(): string {
  return new Date().toLocaleDateString("ar-SA-u-ca-islamic", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function getGregorianDate(): string {
  return new Date().toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
}

/* ─── Time Helpers ────────────────────────────────────────────────────────── */

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function fmt(secs: number): string {
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

/* ─── Prayer Logic ────────────────────────────────────────────────────────── */

interface Prayer { name: string; adhan: number; start: number; }

function buildPrayers(s: SalahTimesResponse): Prayer[] {
  return [
    { name: "الفجر",  adhan: toMin(s.fajr),    start: toMin(s.fajr)    + 40 },
    { name: "الضحى",  adhan: 10 * 60,           start: 10 * 60 + 15 },
    { name: "الظهر",  adhan: toMin(s.dhuhr),   start: toMin(s.dhuhr)   + 40 },
    { name: "العصر",  adhan: toMin(s.asr),     start: toMin(s.asr)     + 40 },
    { name: "المغرب", adhan: toMin(s.maghrib), start: toMin(s.maghrib) + 40 },
    { name: "العشاء", adhan: toMin(s.isha),    start: toMin(s.isha)    + 40 },
  ];
}

/** نهاية اليوم = بعد العشاء بـ 40 دقيقة (وقت الصلاة) ما لم يفعّل العمل الليلي */
function getDayEnd(prayers: Prayer[], nightWorkMins?: number): number {
  if (!prayers.length) return 22 * 60;
  const ishaStart = prayers[prayers.length - 1].start;
  return nightWorkMins ? ishaStart + nightWorkMins : ishaStart;
}

function getPeriod(prayers: Prayer[], now: number, dayEnd?: number) {
  const end = dayEnd ?? (prayers.length ? getDayEnd(prayers) : 22 * 60);
  if (!prayers.length || now < prayers[0].start || now >= end) return null;
  for (let i = 0; i < prayers.length; i++) {
    const blockEnd = i + 1 < prayers.length ? prayers[i + 1].adhan : end;
    if (now >= prayers[i].start && now < blockEnd) {
      return {
        name:     prayers[i].name,
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

/* ─── Task Helpers ────────────────────────────────────────────────────────── */

function priorityLabel(p: number): "عالية" | "متوسطة" | "منخفضة" {
  if (p >= 4) return "عالية";
  if (p === 3) return "متوسطة";
  return "منخفضة";
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

interface TaskRow {
  id: string;
  title: string;
  circle: string;
  circleColor?: string;
  circleOrder: number;
  priority: "عالية" | "متوسطة" | "منخفضة";
  done: boolean;
  isInbox: boolean;
  isWork: boolean;
  isRecurring: boolean;
  recurrenceRule?: string;
  description?: string;
  isUrgent: boolean;
  waitingFor?: string;
  dueDate?: string;
  hasSubtasks: boolean;
  context: string;
  createdAt?: string;
}

function toRow(t: SmartTask, circleOrderMap?: Map<string, number>): TaskRow {
  return {
    id:       t.id,
    title:    t.title,
    circle:   t.lifeCircle?.name ?? "—",
    circleColor: t.lifeCircle?.color,
    circleOrder: circleOrderMap?.get(t.lifeCircle?.id ?? "") ?? 99,
    priority: priorityLabel(t.userPriority),
    done:     t.status === "Completed",
    isInbox:  t.status === "Inbox",
    isWork:   !!(t.contextNote?.includes("work")),
    isRecurring: t.isRecurring ?? false,
    recurrenceRule: t.recurrenceRule,
    description: t.description,
    isUrgent: (t.contextNote ?? "").includes("urgent"),
    waitingFor: (t.contextNote ?? "").match(/waiting:([^|]+)/)?.[1],
    dueDate:  t.dueDate,
    hasSubtasks: false,
    context: (t.contextNote ?? "").match(/ctx:(\w+)/)?.[1] ?? "Anywhere",
    createdAt: t.createdAt,
  };
}

/** المهمة متأخرة إذا مضى 24 ساعة على إنشائها ولم تكتمل */
function isOverdue(t: TaskRow): boolean {
  if (t.done || t.isInbox) return false;
  // إذا فيه تاريخ استحقاق وتجاوزناه
  if (t.dueDate && new Date(t.dueDate) < new Date()) return true;
  // أو مضى 24 ساعة على الإنشاء
  if (t.createdAt) {
    const created = new Date(t.createdAt).getTime();
    const now = Date.now();
    if (now - created > 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

/** الجمعة = 5, السبت = 6 */
function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 5 || day === 6;
}

/* ─── Session Constants ───────────────────────────────────────────────────── */

const FOCUS_SEC     = 25 * 60;
const FOCUS_LOW_SEC = 15 * 60;   // جلسة مخففة عند النفسية السيئة
const SHORT_SEC     =  5 * 60;
const LONG_SEC      = 25 * 60;

type Mode = "idle" | "focus" | "break_short" | "break_long" | "prayer";

function isLongBreak(n: number): boolean {
  return n === 1 || n % 3 === 0;
}

const BREAK_MSGS = [
  "استرح قليلاً، لقد أنجزت عملاً رائعاً",
  "خذ نفساً عميقاً، جسمك يستحق الراحة",
  "فترة الراحة تزيد إنتاجيتك، استمتع بها",
  "ماء، تمدد، تنفس — ثم عد أقوى",
  "الراحة جزء من العمل، لا تتجاوزها",
];

const LOW_MOOD_MSGS = [
  "لا بأس، كلنا نمر بأوقات صعبة. خذ وقتك",
  "أنت أقوى مما تظن. افعل ما تستطيع اليوم",
  "حتى الخطوة الصغيرة تُحسب. لا تقسُ على نفسك",
  "استغفر الله واسترح، غداً يوم جديد بإذن الله",
  "ذكّر نفسك: الإنجاز ليس مقياس قيمتك",
];

/* ─── Mood Types ──────────────────────────────────────────────────────────── */

type Mood = "good" | "low" | null;

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

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

/* ─── New Task Dialog ─────────────────────────────────────────────────────── */

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

export function NewTaskDialog({
  onClose,
  onCreated,
  goals,
  defaultGoalId,
}: {
  onClose: () => void;
  onCreated: (t: TaskRow) => void;
  goals: { id: string; title: string }[];
  defaultGoalId?: string;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [userPriority, setPriority] = useState<number>(3);
  const [cognitiveLoad, setLoad]    = useState<CreateTaskPayload["cognitiveLoad"]>("Medium");
  const [taskContext, setTaskContext] = useState("Anywhere");
  const [dueDate, setDueDate]       = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [goalId, setGoalId]         = useState(defaultGoalId ?? "");
  const [circleId, setCircleId]     = useState("");
  const [circles, setCircles]       = useState<{id: string; name: string; iconKey?: string; tier: string}[]>([]);
  const [hasCost, setHasCost]       = useState(false);
  const [cost, setCost]             = useState("");
  const [isRecurring, setRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"daily"|"weekly"|"monthly"|"yearly"|"custom">("daily");
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"minute"|"hour"|"day"|"week"|"month">("day");
  const [isWorkTask, setIsWorkTask] = useState(true);
  const [isUrgent, setIsUrgent]     = useState(false);
  const [waitingFor, setWaitingFor] = useState("");
  const [assignTo, setAssignTo]     = useState("");
  const [platformUsers, setPUsers]  = useState<{id: string; fullName: string; email: string}[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const titleRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    import("@/lib/api").then(m => m.api.get("/api/users")).then(r => setPUsers(r.data)).catch(() => {});
    import("@/lib/api").then(m => m.getCircles()).then(c => setCircles(c.map(x => ({ id: x.id, name: x.name, iconKey: x.iconKey, tier: x.tier })))).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("عنوان المهمة مطلوب"); return; }
    setLoading(true);
    setError("");
    try {
      const rule = isRecurring
        ? recurrenceType === "custom" ? `${customInterval}-${customUnit}` : recurrenceType
        : undefined;
      const desc = [description.trim(), hasCost && cost ? `💰 التكلفة: ${cost} ريال` : ""].filter(Boolean).join("\n") || undefined;
      const task = await createTask({
        title: title.trim(),
        description: desc,
        userPriority,
        cognitiveLoad,
        dueDate: dueDate || undefined,
        goalId: goalId || undefined,
        lifeCircleId: circleId || undefined,
        isRecurring: isRecurring || undefined,
        recurrenceRule: rule,
        isWorkTask: isWorkTask || undefined,
        isUrgent: isUrgent || undefined,
        waitingFor: waitingFor.trim() || undefined,
        taskContext: taskContext !== "Anywhere" ? taskContext : undefined,
        assignedToEmail: assignTo || undefined,
      });
      onCreated(toRow(task));
      onClose();
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? JSON.stringify((err as { response?: { data?: unknown } }).response?.data)
        : String(err);
      setError("خطأ: " + msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1830]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-up">
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-[#E2D5B0]">
          <h2 className="font-bold text-[#1A1830]">مهمة جديدة</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#7C7A8E] hover:bg-[#F8F6F0] transition text-sm">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">عنوان المهمة <span className="text-red-500">*</span></label>
            <input ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مراجعة تقرير الأسبوع…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">تفاصيل <span className="text-[#7C7A8E] font-normal">(اختياري)</span></label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)}
              placeholder="أضف تفاصيل إضافية…" rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm resize-none bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">الأولوية</label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: userPriority === p.value ? "#5E5495" : "#F8F6F0",
                    color:      userPriority === p.value ? "#fff"     : "#7C7A8E",
                    border:     `1px solid ${userPriority === p.value ? "#5E5495" : "#E2D5B0"}`,
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">مستوى التركيز</label>
            <div className="flex gap-2 flex-wrap">
              {LOAD_OPTIONS.map((l) => (
                <button key={l.value} type="button" onClick={() => setLoad(l.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: cognitiveLoad === l.value ? "#C9A84C" : "#F8F6F0",
                    color:      cognitiveLoad === l.value ? "#fff"     : "#7C7A8E",
                    border:     `1px solid ${cognitiveLoad === l.value ? "#C9A84C" : "#E2D5B0"}`,
                  }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-2">بيئة المهمة</label>
            <div className="flex gap-1.5 flex-wrap">
              {TASK_CONTEXTS.map((c) => (
                <button key={c.key} type="button" onClick={() => setTaskContext(c.key)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: taskContext === c.key ? "#5E5495" : "#F8F6F0",
                    color: taskContext === c.key ? "#fff" : "#7C7A8E",
                    border: `1px solid ${taskContext === c.key ? "#5E5495" : "#E2D5B0"}`,
                  }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            {/* Circle / Job selector */}
            {!goalId && (
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">الدائرة / الوظيفة</label>
                <select value={circleId} onChange={(e) => setCircleId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition">
                  <option value="">اختر الدائرة أو الوظيفة</option>
                  {circles.map((c) => <option key={c.id} value={c.id}>{c.iconKey ?? ""} {c.name} ({c.tier === "Business" ? "وظيفة" : "دور"})</option>)}
                </select>
              </div>
            )}
            {/* Link to project */}
            {goals.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">ربط بمشروع <span className="text-[#7C7A8E] font-normal">(اختياري — يرث دائرة المشروع)</span></label>
                <select value={goalId} onChange={(e) => { setGoalId(e.target.value); if (e.target.value) setCircleId(""); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition">
                  <option value="">مهمة مستقلة</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
            )}
            {/* Assign to user */}
            <div className="mt-3">
              <label className="block text-sm font-semibold text-[#1A1830] mb-1.5">إسناد لشخص <span className="text-[#7C7A8E] font-normal">(اختياري)</span></label>
              <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition">
                <option value="">أنا (بدون إسناد)</option>
                {platformUsers.map((u) => <option key={u.id} value={u.email}>{u.fullName}</option>)}
              </select>
            </div>
            <label className="block text-sm font-semibold text-[#1A1830] mb-1.5 mt-3">تاريخ الاستحقاق <span className="text-[#7C7A8E] font-normal">(اختياري)</span></label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
          </div>
          {/* Recurrence */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
              <div onClick={() => setRecurring(!isRecurring)}
                className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                style={{ background: isRecurring ? "#5E5495" : "#E2D5B0" }}>
                <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ right: isRecurring ? "0.125rem" : "1.25rem" }} />
              </div>
              <span className="text-sm font-semibold text-[#1A1830]">تكرار المهمة</span>
            </label>
            {isRecurring && (
              <div className="space-y-2 pr-4">
                <div className="flex gap-2 flex-wrap">
                  {([["daily","يومي"],["weekly","أسبوعي"],["monthly","شهري"],["yearly","سنوي"],["custom","مخصص"]] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setRecurrenceType(v)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: recurrenceType === v ? "#5E5495" : "#F8F6F0", color: recurrenceType === v ? "#fff" : "#7C7A8E", border: `1px solid ${recurrenceType === v ? "#5E5495" : "#E2D5B0"}` }}>
                      {l}
                    </button>
                  ))}
                </div>
                {recurrenceType === "custom" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#7C7A8E]">كل</span>
                    <input type="number" min={1} max={365} value={customInterval} onChange={(e) => setCustomInterval(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 rounded-lg border border-[#E2D5B0] text-sm text-center bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495]" />
                    <div className="flex gap-1 flex-wrap">
                      {([["minute","دقيقة"],["hour","ساعة"],["day","يوم"],["week","أسبوع"],["month","شهر"]] as const).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setCustomUnit(v)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                          style={{ background: customUnit === v ? "#C9A84C" : "#F8F6F0", color: customUnit === v ? "#fff" : "#7C7A8E" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cost toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
              <div onClick={() => setHasCost(!hasCost)}
                className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                style={{ background: hasCost ? "#D4AF37" : "#E2D5B0" }}>
                <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ right: hasCost ? "0.125rem" : "1.25rem" }} />
              </div>
              <span className="text-sm font-semibold text-[#1A1830]">💰 مهمة مالية</span>
            </label>
            {hasCost && (() => {
              let totalBal = 0;
              try { const accts = JSON.parse(localStorage.getItem("mfin_accts") ?? "[]"); totalBal = accts.reduce((s: number, a: { balance: number }) => s + a.balance, 0); } catch {}
              const costNum = Number(cost) || 0;
              const insufficient = costNum > 0 && costNum > totalBal;
              return (
                <div className="space-y-2">
                  <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)}
                    placeholder="المبلغ بالريال"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E2D5B0] text-sm bg-[#FDFAF6] focus:outline-none focus:border-[#5E5495] transition" />
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-[#6B7280]">💳 الرصيد الحالي: <b className="text-[#2C2C54]">{totalBal.toLocaleString()} ريال</b></span>
                    {insufficient && <span className="text-[10px] text-red-500 font-semibold">⚠ الرصيد غير كافٍ</span>}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Work task toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => setIsWorkTask(!isWorkTask)}
              className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
              style={{ background: isWorkTask ? "#2D6B9E" : "#E2D5B0" }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ right: isWorkTask ? "0.125rem" : "1.25rem" }} />
            </div>
            <span className="text-sm text-[#1A1830]">مهمة عمل <span className="text-[#7C7A8E] text-xs">(لا تظهر الجمعة والسبت)</span></span>
          </label>

          {/* Urgent */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => setIsUrgent(!isUrgent)}
              className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
              style={{ background: isUrgent ? "#DC2626" : "#E2D5B0" }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ right: isUrgent ? "0.125rem" : "1.25rem" }} />
            </div>
            <span className="text-sm text-[#1A1830]">🔴 مهمة ملحة <span className="text-[#7C7A8E] text-xs">(أشخاص ينتظرون)</span></span>
          </label>
          {isUrgent && (
            <input value={waitingFor} onChange={(e) => setWaitingFor(e.target.value)}
              placeholder="من ينتظر؟ (مثال: المدير، العميل أحمد…)"
              className="w-full px-4 py-2.5 rounded-xl border border-red-200 text-sm bg-red-50 focus:outline-none focus:border-red-400 transition" />
          )}

          {error && <p className="text-red-400 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#7C7A8E] bg-[#F8F6F0] border border-[#E2D5B0] hover:bg-[#F0EDE4] transition">
              إلغاء
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
              {loading ? "جارٍ الإضافة…" : "إضافة المهمة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Assign Task Dialog ───────────────────────────────────────────────────── */

function AssignTaskDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail]   = useState("");
  const [title, setTitle]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError]   = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !title.trim()) { setError("البريد والعنوان مطلوبان"); return; }
    setLoading(true); setError(""); setResult("");
    try {
      const { assignTask: assignFn } = await import("@/lib/api");
      const res = await assignFn(email.trim(), title.trim());
      setResult(res.message);
      setTitle("");
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "فشل الإرسال")
        : "فشل الإرسال";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1A2E]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md fade-up">
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-gray-200">
          <h2 className="font-bold text-[#16213E]">إرسال مهمة لشخص</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-gray-100 text-sm">✕</button>
        </div>
        <form onSubmit={submit} className="px-7 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#16213E] mb-1.5">بريد المستلم</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#D4AF37]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#16213E] mb-1.5">عنوان المهمة</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مراجعة الملف…"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#D4AF37]" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {result && <p className="text-green-600 text-sm bg-green-50 rounded-lg px-4 py-2">{result}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#6B7280] bg-gray-100">إغلاق</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              {loading ? "جارٍ الإرسال…" : "إرسال المهمة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Quick Finance Dialog ─────────────────────────────────────────────────── */

function QuickFinanceDialog({ onClose }: { onClose: () => void }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [showCalc, setShowCalcLocal] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);

  function calcPress(val: string) {
    if (val === "C") { setCalcDisplay("0"); setCalcPrev(null); setCalcOp(null); return; }
    if (val === "=") {
      if (calcPrev !== null && calcOp) {
        const cur = Number(calcDisplay);
        let result = calcPrev;
        if (calcOp === "+") result = calcPrev + cur;
        if (calcOp === "-") result = calcPrev - cur;
        if (calcOp === "×") result = calcPrev * cur;
        if (calcOp === "÷" && cur !== 0) result = calcPrev / cur;
        const r = String(Math.round(result * 100) / 100);
        setCalcDisplay(r);
        setCalcPrev(null); setCalcOp(null);
      }
      return;
    }
    if (["+", "-", "×", "÷"].includes(val)) {
      setCalcPrev(Number(calcDisplay)); setCalcOp(val); setCalcDisplay("0"); return;
    }
    setCalcDisplay(calcDisplay === "0" ? val : calcDisplay + val);
  }

  function useCalcResult() {
    setAmount(calcDisplay);
    setShowCalcLocal(false);
  }

  function save() {
    if (!amount) return;
    const txs = JSON.parse(localStorage.getItem("madar_fin_tx") ?? "[]");
    const wallets = JSON.parse(localStorage.getItem("madar_fin_wallets") ?? "[]");
    const wid = wallets[0]?.id ?? "w1";
    txs.unshift({
      id: Date.now().toString(), title: desc.trim() || (type === "expense" ? "مصروف" : "دخل"),
      amount: Number(amount), type, category: "أخرى", expenseClass: "essential",
      walletId: wid, date: new Date().toISOString().slice(0, 10),
    });
    localStorage.setItem("madar_fin_tx", JSON.stringify(txs));
    if (wallets.length > 0) {
      wallets[0].balance += type === "income" ? Number(amount) : -Number(amount);
      localStorage.setItem("madar_fin_wallets", JSON.stringify(wallets));
    }
    onClose();
  }

  const CALC_BTNS = ["7","8","9","÷","4","5","6","×","1","2","3","-","0",".","=","+"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-up p-5 space-y-3">
        <h3 className="font-bold text-[#16213E] text-center">إدخال سريع</h3>
        <div className="flex gap-2">
          <button onClick={() => setType("expense")} className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: type === "expense" ? "#DC2626" : "#F3F4F6", color: type === "expense" ? "#fff" : "#6B7280" }}>مصروف</button>
          <button onClick={() => setType("income")} className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: type === "income" ? "#3D8C5A" : "#F3F4F6", color: type === "income" ? "#fff" : "#6B7280" }}>دخل</button>
        </div>
        <div className="flex gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ" autoFocus
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-lg text-center font-bold focus:outline-none focus:border-[#D4AF37]" />
          <button onClick={() => setShowCalcLocal(!showCalc)}
            className="px-3 py-3 rounded-xl text-lg border border-gray-200 hover:bg-gray-50 transition"
            style={{ background: showCalc ? "#D4AF37" : "white", color: showCalc ? "#fff" : "#6B7280" }}>
            🧮
          </button>
        </div>
        {/* Inline Calculator */}
        {showCalc && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-2xl font-black text-[#16213E] tabular-nums">{calcDisplay}</p>
              {calcOp && calcPrev !== null && <p className="text-xs text-[#6B7280]">{calcPrev} {calcOp}</p>}
            </div>
            <div className="grid grid-cols-4 gap-1">
              <button onClick={() => calcPress("C")} className="col-span-4 py-2 rounded-lg text-xs font-bold bg-red-100 text-red-600">مسح</button>
              {CALC_BTNS.map((b) => (
                <button key={b} onClick={() => calcPress(b)}
                  className="py-2.5 rounded-lg text-sm font-bold transition hover:bg-gray-200"
                  style={{ background: ["+","-","×","÷"].includes(b) ? "#D4AF3715" : b === "=" ? "#2C2C54" : "#fff", color: b === "=" ? "#fff" : "#16213E" }}>
                  {b}
                </button>
              ))}
            </div>
            <button onClick={useCalcResult}
              className="w-full py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              استخدم الناتج ({calcDisplay})
            </button>
          </div>
        )}
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="الوصف (اختياري)"
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
        <button onClick={save} className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: type === "expense" ? "#DC2626" : "#3D8C5A" }}>حفظ</button>
      </div>
    </div>
  );
}


/* ─── Day Planner Dialog ──────────────────────────────────────────────────── */

function DayPlannerDialog({ onClose, prayers, tasks, blockedPeriods, onBlockToggle }: {
  onClose: () => void;
  prayers: Prayer[];
  tasks: TaskRow[];
  blockedPeriods: string[];
  onBlockToggle: (name: string) => void;
}) {
  // مدة العادات من الإعدادات
  const habitDuration = (() => {
    try { return JSON.parse(localStorage.getItem("madar_settings") ?? "{}").habitDuration ?? 30; } catch { return 30; }
  })();

  // فصل العادات عن المهام العادية
  const allPending = tasks.filter((t) => !t.done && !t.isInbox);
  const habitTasks = allPending.filter(t => t.context === "habit");
  const pending = allPending.filter(t => t.context !== "habit").sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    const typeOrder = (t: TaskRow) => t.isRecurring ? 0 : t.isWork ? 2 : 1;
    return typeOrder(a) - typeOrder(b);
  });

  const periods = prayers.length >= 2 ? prayers.slice(0, -1).map((p, i) => {
    const next = prayers[i + 1];
    const duration = next.adhan - p.start;
    return { name: p.name, startMin: p.start, endMin: next.adhan, duration, blocked: blockedPeriods.includes(p.name) };
  }).filter(p => p.duration > 0) : [];

  // إضافة فترة ما بعد العشاء + ما بعد منتصف الليل (موقوفة افتراضياً)
  const ishaEnd = prayers.length > 0 ? prayers[prayers.length - 1].start : 21 * 60;
  const extraPeriods = [
    { name: "بعد العشاء", startMin: ishaEnd, endMin: 24 * 60, duration: 24 * 60 - ishaEnd, blocked: !blockedPeriods.includes("بعد العشاء_open") },
    { name: "بعد منتصف الليل", startMin: 0, endMin: 2 * 60, duration: 2 * 60, blocked: !blockedPeriods.includes("بعد منتصف الليل_open") },
  ].filter(p => p.duration > 0);
  const allPeriods = [...periods, ...extraPeriods];

  const availablePeriods = allPeriods.filter(p => !p.blocked);
  const totalSlots = availablePeriods.reduce((s, p) => s + Math.floor(p.duration / 30), 0);

  // بيئة العمل لكل فترة
  const [periodContexts, setPeriodContexts] = useState<Record<string, string>>({});

  // Auto-distribute tasks — العادات في أول فترة، ثم بقية المهام
  const autoPlan = (() => {
    const remaining = [...pending];
    const now = nowMin();
    const result: { period: string; tasks: TaskRow[]; startMin: number; endMin: number; blocked: boolean; habitSlot: boolean }[] = [];

    // Sort periods: current/future first, then past
    const sortedPeriods = [...allPeriods].sort((a, b) => {
      const aIsPast = a.endMin <= now;
      const bIsPast = b.endMin <= now;
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
      return a.startMin - b.startMin;
    });

    // Find first available period for habits
    const firstAvailable = sortedPeriods.find(p => !p.blocked);
    const habitPeriodName = firstAvailable?.name ?? "";

    const periodTasks = new Map<string, TaskRow[]>();
    const periodHabitSlot = new Map<string, boolean>();
    for (const period of sortedPeriods) {
      if (period.blocked) { periodTasks.set(period.name, []); periodHabitSlot.set(period.name, false); continue; }

      // العادات تذهب لأول فترة متاحة
      const isHabitPeriod = period.name === habitPeriodName && habitTasks.length > 0;
      const habitSlotsMins = isHabitPeriod ? habitDuration : 0;
      const availableMins = period.duration - habitSlotsMins;
      const slots = Math.max(0, Math.floor(availableMins / 30));
      periodHabitSlot.set(period.name, isHabitPeriod);

      const pCtx = periodContexts[period.name];
      const pt: TaskRow[] = [];
      // أضف العادات أولاً في هذه الفترة
      if (isHabitPeriod) {
        pt.push(...habitTasks);
      }
      for (let s = 0; s < slots && remaining.length > 0; s++) {
        let idx = pCtx ? remaining.findIndex(t => t.context === pCtx) : -1;
        if (idx < 0) idx = 0;
        pt.push(remaining.splice(idx, 1)[0]);
      }
      periodTasks.set(period.name, pt);
    }

    // Build result in original order
    for (const period of allPeriods) {
      result.push({
        period: period.name,
        tasks: periodTasks.get(period.name) ?? [],
        startMin: period.startMin,
        endMin: period.endMin,
        blocked: period.blocked,
        habitSlot: periodHabitSlot.get(period.name) ?? false,
      });
    }
    return result;
  })();

  // Stateful plan for drag & drop
  const [plan, setPlan] = useState(autoPlan);
  const [dragTask, setDragTask] = useState<{ taskId: string; fromPeriod: string } | null>(null);

  // Re-compute when blockedPeriods change
  useEffect(() => { setPlan(autoPlan); }, [blockedPeriods.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDrop(toPeriod: string) {
    if (!dragTask || dragTask.fromPeriod === toPeriod) { setDragTask(null); return; }
    setPlan(prev => {
      const next = prev.map(p => ({ ...p, tasks: [...p.tasks] }));
      const from = next.find(p => p.period === dragTask.fromPeriod);
      const to = next.find(p => p.period === toPeriod);
      if (!from || !to) return prev;
      const taskIndex = from.tasks.findIndex(t => t.id === dragTask.taskId);
      if (taskIndex < 0) return prev;
      const [task] = from.tasks.splice(taskIndex, 1);
      to.tasks.push(task);
      return next;
    });
    setDragTask(null);
  }

  let taskIdx = plan.reduce((s, p) => s + p.tasks.length, 0);

  function fmtTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "م" : "ص"}`;
  }

  const ctxIcon = (c: string) => TASK_CONTEXTS.find(x => x.key === c)?.icon ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(17,17,24,0.85)" }} onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-up"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-7 pt-7 pb-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>📋 تخطيط اليوم</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {pending.length} مهمة · {availablePeriods.length} فترة · {totalSlots} فرصة عمل
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <div className="px-7 py-5 space-y-4">
          {/* Legend */}
          <div className="flex gap-3 flex-wrap text-[10px]" style={{ color: "var(--muted)" }}>
            <span>🔄 عادات (أول فترة · {(() => { try { return JSON.parse(localStorage.getItem("madar_settings") ?? "{}").habitDuration ?? 30; } catch { return 30; } })()}د)</span>
            <span>◎ أدوار</span><span>💼 وظائف</span><span>🔴 ملحة أولاً</span>
          </div>

          {prayers.length === 0 && <p className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>لم يتم تحميل مواقيت الصلاة</p>}
          {plan.map((p) => (
            <div key={p.period} className="rounded-xl overflow-hidden transition-all"
              onDragOver={(e) => { if (!p.blocked) { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; } }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = p.blocked ? "var(--card-border)" : "var(--gold, #D4AF37)30"; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = p.blocked ? "var(--card-border)" : "var(--gold, #D4AF37)30"; handleDrop(p.period); }}
              style={{
                border: `2px solid ${p.blocked ? "var(--card-border)" : "var(--gold, #D4AF37)30"}`,
                opacity: p.blocked ? 0.5 : 1,
              }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "var(--bg)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>🕌 {p.period}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{fmtTime(p.startMin)} — {fmtTime(p.endMin)}</span>
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>({p.endMin - p.startMin} د)</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* بيئة الفترة */}
                  {!p.blocked && (
                    <select value={periodContexts[p.period] ?? ""}
                      onChange={(e) => setPeriodContexts(prev => ({ ...prev, [p.period]: e.target.value }))}
                      className="text-[10px] px-1.5 py-0.5 rounded-lg border focus:outline-none"
                      style={{ background: "var(--bg)", color: "var(--muted)", borderColor: "var(--card-border)" }}>
                      <option value="">كل البيئات</option>
                      {TASK_CONTEXTS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  )}
                  <button onClick={() => {
                    // الفترات الخاصة تعمل بالعكس (موقوفة افتراضياً)
                    if (p.period === "بعد العشاء" || p.period === "بعد منتصف الليل") {
                      onBlockToggle(p.period + "_open");
                    } else { onBlockToggle(p.period); }
                  }}
                    className="text-[10px] px-2.5 py-1 rounded-lg transition font-semibold"
                    style={{ background: p.blocked ? "#DC262615" : "var(--bg)", color: p.blocked ? "#DC2626" : "var(--muted)", border: `1px solid ${p.blocked ? "#DC262630" : "var(--card-border)"}` }}>
                    {p.blocked ? "🔴 موقوفة" : "إيقاف"}
                  </button>
                </div>
              </div>
              {p.blocked ? (
                <div className="px-4 py-3 text-center"><p className="text-xs" style={{ color: "var(--muted)" }}>فترة راحة — المهام وُزّعت على الفترات الأخرى</p></div>
              ) : p.tasks.length === 0 ? (
                <div className="px-4 py-3 text-center"><p className="text-xs" style={{ color: "var(--muted)" }}>لا مهام</p></div>
              ) : (
                <div className="px-4 py-2 space-y-1">
                  {p.habitSlot && (
                    <div className="flex items-center gap-2 py-2 rounded-lg px-2 mb-1" style={{ background: "#2ABFBF10", borderRight: "3px solid #2ABFBF" }}>
                      <span className="text-[10px]">🔄</span>
                      <span className="text-sm font-semibold flex-1" style={{ color: "#2ABFBF" }}>العادات اليومية</span>
                      <span className="text-[10px] font-semibold" style={{ color: "#2ABFBF" }}>~{habitDuration} د</span>
                    </div>
                  )}
                  {p.tasks.filter(t => t.context !== "habit").map((t, i) => (
                    <div key={t.id} draggable
                      onDragStart={() => setDragTask({ taskId: t.id, fromPeriod: p.period })}
                      className="flex items-center gap-2 py-2 rounded-lg px-2 transition cursor-grab active:cursor-grabbing hover:opacity-80"
                      style={{ background: i % 2 === 0 ? "transparent" : "var(--bg)" }}>
                      <span className="text-[10px] w-4" style={{ color: "var(--muted)" }}>{i + 1}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[t.priority]}`}>{t.priority}</span>
                      {t.isRecurring && <span className="text-[10px]">🔄</span>}
                      {t.isWork && <span className="text-[10px]">💼</span>}
                      {t.context !== "Anywhere" && t.context !== "habit" && <span className="text-[10px]">{ctxIcon(t.context)}</span>}
                      <span className="text-sm flex-1 truncate" style={{ color: "var(--text)" }}>{t.title}</span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>~30 د</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {taskIdx < pending.length && (
            <div className="rounded-xl p-4" style={{ background: "#FEF3C7", border: "1px solid #F59E0B30" }}>
              <p className="text-amber-800 text-sm font-semibold">{pending.length - taskIdx} مهمة لم تتسع لها الفترات</p>
              <p className="text-amber-600 text-xs">حاول تقليل فترات الراحة أو إنهاء بعض المهام</p>
            </div>
          )}
          <p className="text-[10px] text-center" style={{ color: "var(--muted)" }}>العادات في أول فترة ({habitDuration}د) · بقية المهام ~30 دقيقة</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Batch Task Dialog ────────────────────────────────────────────────────── */

function BatchTaskDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (tasks: TaskRow[]) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setError("أدخل مهمة واحدة على الأقل"); return; }
    setLoading(true); setError("");
    const created: TaskRow[] = [];
    for (const line of lines) {
      try {
        const task = await createTask({ title: line });
        created.push(toRow(task));
      } catch { /* skip failed */ }
    }
    if (created.length === 0) { setError("فشل إنشاء المهام"); setLoading(false); return; }
    onCreated(created);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1A1A2E]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg fade-up">
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-gray-200">
          <h2 className="font-bold text-[#16213E]">إدخال مهام متعددة</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-gray-100 transition text-sm">✕</button>
        </div>
        <div className="px-7 py-6 space-y-4">
          <p className="text-xs text-[#6B7280]">اكتب كل مهمة في سطر منفصل:</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={"مراجعة التقرير الشهري\nالرد على البريد\nاجتماع فريق العمل\nتحديث الملفات"}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 resize-none focus:outline-none focus:border-[#D4AF37] transition font-medium leading-relaxed" />
          <p className="text-[11px] text-[#9CA3AF]">{text.split("\n").filter((l) => l.trim()).length} مهمة</p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#6B7280] bg-gray-100 border border-gray-200">إلغاء</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              {loading ? "جارٍ الإضافة…" : "إضافة الكل"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Task Dialog (تعديل المهمة) ─────────────────────────────────────── */

function EditTaskDialog({ task, onClose, onSaved }: {
  task: TaskRow; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");
  const [context, setContext] = useState(task.context);
  const [priority, setPriority] = useState<number>(task.priority === "عالية" ? 4 : task.priority === "متوسطة" ? 3 : 2);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [isWork, setIsWork] = useState(task.isWork);
  const [isUrgent, setIsUrgent] = useState(task.isUrgent);
  const [isRecurring, setIsRecurring] = useState(task.isRecurring);
  const [assignEmail, setAssignEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim()) return;
    setLoading(true); setError("");
    try {
      // إذا فيه تعيين لشخص، حوّل المهمة
      if (assignEmail.trim()) {
        const { assignTask } = await import("@/lib/api");
        await assignTask(assignEmail.trim(), title.trim());
        await api.patch(`/api/tasks/${task.id}/status`, { status: "Cancelled" });
      } else {
        await api.patch(`/api/tasks/${task.id}/status`, { status: "Cancelled" });
        await api.post("/api/tasks", {
          title: title.trim(),
          description: desc.trim() || undefined,
          userPriority: priority,
          dueDate: dueDate || undefined,
          taskContext: context !== "Anywhere" ? context : undefined,
          isWorkTask: isWork || undefined,
          isUrgent: isUrgent || undefined,
          isRecurring: isRecurring || undefined,
        });
      }
      onSaved();
      onClose();
    } catch { setError("فشل الحفظ"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md fade-up"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)" }}>✏️ تعديل المهمة</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>العنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>التفاصيل</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          </div>
          {/* الأولوية */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>الأولوية</label>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{ background: priority === p.value ? "#5E5495" : "var(--bg)", color: priority === p.value ? "#fff" : "var(--muted)", border: `1px solid ${priority === p.value ? "#5E5495" : "var(--card-border)"}` }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {/* بيئة المهمة */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>بيئة المهمة</label>
            <div className="flex gap-1.5 flex-wrap">
              {TASK_CONTEXTS.map((c) => (
                <button key={c.key} onClick={() => setContext(c.key)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition"
                  style={{ background: context === c.key ? "#5E5495" : "var(--bg)", color: context === c.key ? "#fff" : "var(--muted)", border: `1px solid ${context === c.key ? "#5E5495" : "var(--card-border)"}` }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          {/* تاريخ الاستحقاق */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>تاريخ الاستحقاق</label>
            <input type="date" value={dueDate ? dueDate.slice(0, 10) : ""} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          </div>
          {/* خيارات */}
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isWork} onChange={() => setIsWork(!isWork)} className="accent-[#5E5495]" />
              <span className="text-xs" style={{ color: "var(--text)" }}>💼 مهمة عمل</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isUrgent} onChange={() => setIsUrgent(!isUrgent)} className="accent-red-500" />
              <span className="text-xs" style={{ color: "var(--text)" }}>🔴 ملحة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} className="accent-purple-500" />
              <span className="text-xs" style={{ color: "var(--text)" }}>🔄 مكررة</span>
            </label>
          </div>
          {/* الدائرة */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--muted)" }}>الدائرة:</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: task.circleColor ? `${task.circleColor}15` : "var(--bg)", color: task.circleColor ?? "var(--text)" }}>
              {task.circle}
            </span>
          </div>
          {/* تعيين لشخص (اختياري) */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>تعيين لشخص <span className="text-[10px] font-normal" style={{ color: "var(--muted)" }}>(اختياري)</span></label>
            <input type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="البريد الإلكتروني للشخص"
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
            {assignEmail && <p className="text-[10px] mt-1" style={{ color: "#D4AF37" }}>سيتم إرسال المهمة للشخص وإلغاؤها من قائمتك</p>}
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={save} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
              {loading ? "جارٍ الحفظ…" : assignEmail ? "تعيين وحفظ" : "حفظ التعديلات"}
            </button>
          </div>
          <button onClick={async () => {
            if (!confirm("حذف هذه المهمة نهائياً؟")) return;
            try { await api.patch(`/api/tasks/${task.id}/status`, { status: "Cancelled" }); onSaved(); onClose(); } catch {}
          }}
            className="w-full py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-50 transition" style={{ border: "1px solid #FCA5A530" }}>
            🗑️ حذف المهمة
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Transfer Task Dialog (تحويل مهمة لمستخدم) ──────────────────────────── */

function TransferTaskDialog({ taskId, taskTitle, onClose, onDone }: {
  taskId: string; taskTitle: string; onClose: () => void; onDone: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/users").then((r) => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? users.filter((u) => u.fullName.includes(search) || u.email.includes(search))
    : users;

  async function transfer(user: { id: string; fullName: string; email: string }) {
    setSending(true); setError(""); setResult("");
    try {
      const { transferTask: transferFn } = await import("@/lib/api");
      const res = await transferFn(taskId, user.email);
      setResult(res.message || `تم تحويل المهمة إلى ${user.fullName}`);
      setTimeout(() => { onDone(); onClose(); }, 1500);
    } catch {
      setError("فشل التحويل");
    } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden fade-up"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <div>
            <h3 className="font-bold" style={{ color: "var(--text)" }}>📨 تحويل المهمة</h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>"{taskTitle}"</p>
          </div>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد…" autoFocus
            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />

          <div className="max-h-60 overflow-y-auto space-y-1">
            {loading && <p className="text-center text-sm py-4 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>لا يوجد مستخدمون {search ? "مطابقون" : ""}</p>
            )}
            {filtered.map((u) => (
              <button key={u.id} onClick={() => transfer(u)} disabled={sending}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50"
                style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                  {u.fullName.charAt(0)}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{u.fullName}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>{u.email}</p>
                </div>
                <span className="text-xs font-bold" style={{ color: "var(--gold)" }}>تحويل ←</span>
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          {result && <p className="text-green-600 text-xs text-center bg-green-50 rounded-lg px-3 py-2">{result}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Day Planner (مدمج في الصفحة) ─────────────────────────────────── */

function InlineDayPlanner({ prayers, tasks, blockedPeriods, onBlockToggle }: {
  prayers: Prayer[]; tasks: TaskRow[]; blockedPeriods: string[]; onBlockToggle: (name: string) => void;
}) {
  const habitDuration = (() => {
    try { return JSON.parse(localStorage.getItem("madar_settings") ?? "{}").habitDuration ?? 30; } catch { return 30; }
  })();

  const allPending = tasks.filter((t) => !t.done && !t.isInbox);
  const habitTasks = allPending.filter(t => t.context === "habit");
  const pending = allPending.filter(t => t.context !== "habit").sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    const typeOrder = (t: TaskRow) => t.isRecurring ? 0 : t.isWork ? 2 : 1;
    if (typeOrder(a) !== typeOrder(b)) return typeOrder(a) - typeOrder(b);
    return a.circleOrder - b.circleOrder;
  });

  const periods = prayers.length >= 2 ? prayers.slice(0, -1).map((p, i) => {
    const next = prayers[i + 1];
    return { name: p.name, startMin: p.start, endMin: next.adhan, duration: next.adhan - p.start, blocked: blockedPeriods.includes(p.name) };
  }).filter(p => p.duration > 0) : [];

  const ishaEnd = prayers.length > 0 ? prayers[prayers.length - 1].start : 21 * 60;
  const allPeriods = [
    ...periods,
    { name: "بعد العشاء", startMin: ishaEnd, endMin: 24 * 60, duration: 24 * 60 - ishaEnd, blocked: !blockedPeriods.includes("بعد العشاء_open") },
    { name: "بعد منتصف الليل", startMin: 0, endMin: 2 * 60, duration: 120, blocked: !blockedPeriods.includes("بعد منتصف الليل_open") },
  ];

  const now = nowMin();
  // بيئة كل فترة (يمكن تخصيصها)
  const [periodContexts, setPeriodContexts] = useState<Record<string, string>>({});

  // ترتيب الفترات: الحالية/المستقبلية أولاً
  const sortedPeriods = [...allPeriods].sort((a, b) => {
    const aIsPast = a.endMin <= now;
    const bIsPast = b.endMin <= now;
    if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
    return a.startMin - b.startMin;
  });

  const firstAvailable = sortedPeriods.find(p => !p.blocked);
  const habitPeriodName = firstAvailable?.name ?? "";

  // توزيع: فترات مستقبلية فقط، مع مراعاة البيئة
  const remaining = [...pending];
  const periodTasksMap = new Map<string, TaskRow[]>();
  const periodHabitMap = new Map<string, boolean>();

  for (const period of sortedPeriods) {
    if (period.blocked) { periodTasksMap.set(period.name, []); periodHabitMap.set(period.name, false); continue; }

    const isPast = period.endMin <= now;
    const isHabitPeriod = period.name === habitPeriodName && habitTasks.length > 0;
    const habitMins = isHabitPeriod ? habitDuration : 0;
    const slots = Math.max(0, Math.floor((period.duration - habitMins) / 30));
    periodHabitMap.set(period.name, isHabitPeriod);

    const pt: TaskRow[] = [];
    if (isHabitPeriod) pt.push(...habitTasks);

    if (!isPast) {
      const pCtx = periodContexts[period.name];
      for (let s = 0; s < slots && remaining.length > 0; s++) {
        let idx = pCtx ? remaining.findIndex(t => t.context === pCtx) : -1;
        if (idx < 0) idx = 0;
        pt.push(remaining.splice(idx, 1)[0]);
      }
    }
    periodTasksMap.set(period.name, pt);
  }

  // Stateful plan for drag & drop
  const initialPlan = allPeriods.map(p => ({
    ...p, tasks: periodTasksMap.get(p.name) ?? [], habitSlot: periodHabitMap.get(p.name) ?? false,
  }));
  const [plan, setPlan] = useState(initialPlan);
  const [dragTask, setDragTask] = useState<{ taskId: string; fromPeriod: string } | null>(null);

  // Re-compute when blockedPeriods/contexts change
  useEffect(() => { setPlan(initialPlan); }, [blockedPeriods.join(","), JSON.stringify(periodContexts)]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDrop(toPeriod: string) {
    if (!dragTask || dragTask.fromPeriod === toPeriod) { setDragTask(null); return; }
    setPlan(prev => {
      const next = prev.map(p => ({ ...p, tasks: [...p.tasks] }));
      const from = next.find(p => p.name === dragTask.fromPeriod);
      const to = next.find(p => p.name === toPeriod);
      if (!from || !to) return prev;
      const taskIndex = from.tasks.findIndex(t => t.id === dragTask.taskId);
      if (taskIndex < 0) return prev;
      const [task] = from.tasks.splice(taskIndex, 1);
      to.tasks.push(task);
      return next;
    });
    setDragTask(null);
  }

  const ctxIcon = (c: string) => TASK_CONTEXTS.find(x => x.key === c)?.icon ?? "";

  function fmtTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "م" : "ص"}`;
  }

  if (prayers.length === 0) return <p className="text-center text-sm py-4" style={{ color: "var(--muted)" }}>جارٍ تحميل مواقيت الصلاة...</p>;

  return (
    <div className="space-y-3 mt-3">
      <div className="flex gap-2 flex-wrap text-[11px]" style={{ color: "var(--muted)" }}>
        <span>{pending.length} مهمة</span><span>•</span><span>الفترات الماضية فارغة</span><span>•</span><span>اسحب المهام بين الفترات</span>
      </div>
      {plan.map((p) => {
        const isPast = p.endMin <= now && p.name !== "بعد منتصف الليل";
        return (
        <div key={p.name} className="rounded-xl overflow-hidden"
          onDragOver={(e) => { if (!p.blocked && !isPast) { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold, #D4AF37)"; } }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = p.blocked ? "var(--card-border)" : "var(--gold, #D4AF37)25"; }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold, #D4AF37)25"; handleDrop(p.name); }}
          style={{ border: `1px solid ${p.blocked ? "var(--card-border)" : "var(--gold, #D4AF37)25"}`, opacity: p.blocked || isPast ? 0.4 : 1 }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ background: "var(--bg)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: isPast ? "var(--muted)" : "var(--gold)" }}>🕌 {p.name}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{fmtTime(p.startMin)} — {fmtTime(p.endMin)}</span>
              {isPast && <span className="text-[9px] text-[#9CA3AF]">(انتهت)</span>}
            </div>
            <div className="flex items-center gap-1">
              {!p.blocked && !isPast && (
                <select value={periodContexts[p.name] ?? ""}
                  onChange={(e) => setPeriodContexts(prev => ({ ...prev, [p.name]: e.target.value }))}
                  className="text-[10px] px-1.5 py-0.5 rounded-lg border focus:outline-none"
                  style={{ background: "var(--bg)", color: "var(--muted)", borderColor: "var(--card-border)" }}>
                  <option value="">كل البيئات</option>
                  {TASK_CONTEXTS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              )}
              <button onClick={() => {
                if (p.name === "بعد العشاء" || p.name === "بعد منتصف الليل") onBlockToggle(p.name + "_open");
                else onBlockToggle(p.name);
              }}
                className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                style={{ background: p.blocked ? "#DC262610" : "var(--bg)", color: p.blocked ? "#DC2626" : "var(--muted)", border: `1px solid ${p.blocked ? "#DC262620" : "var(--card-border)"}` }}>
                {p.blocked ? "موقوفة" : "إيقاف"}
              </button>
            </div>
          </div>
          {!p.blocked && p.tasks.length > 0 && (
            <div className="px-4 py-1.5 space-y-0.5">
              {p.habitSlot && (
                <div className="flex items-center gap-2 py-1.5 px-1 rounded" style={{ background: "#2ABFBF10", borderRight: "3px solid #2ABFBF" }}>
                  <span className="text-[10px]">🔄</span>
                  <span className="text-sm font-semibold flex-1" style={{ color: "#2ABFBF" }}>العادات اليومية</span>
                  <span className="text-[10px] font-semibold" style={{ color: "#2ABFBF" }}>~{habitDuration} د</span>
                </div>
              )}
              {p.tasks.filter(t => t.context !== "habit").map((t, i) => (
                <div key={t.id} draggable
                  onDragStart={() => setDragTask({ taskId: t.id, fromPeriod: p.name })}
                  className="flex items-center gap-2 py-1.5 px-1 rounded cursor-grab active:cursor-grabbing hover:opacity-80 transition"
                  style={{ background: i % 2 === 0 ? "transparent" : "var(--bg)" }}>
                  <span className="text-[10px] w-4" style={{ color: "var(--muted)" }}>{i + 1}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[t.priority]}`}>{t.priority}</span>
                  {t.isRecurring && <span className="text-[10px]">🔄</span>}
                  {t.isWork && <span className="text-[10px]">💼</span>}
                  {t.context !== "Anywhere" && t.context !== "habit" && <span className="text-[10px]">{ctxIcon(t.context)}</span>}
                  <span className="text-sm flex-1 truncate" style={{ color: "var(--text)" }}>{t.title}</span>
                </div>
              ))}
            </div>
          )}
          {!p.blocked && !isPast && p.tasks.length === 0 && (
            <p className="px-4 py-2 text-xs" style={{ color: "var(--muted)" }}>—</p>
          )}
        </div>
        );
      })}
      {remaining.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: "#FEF3C7", border: "1px solid #F59E0B30" }}>
          <p className="text-amber-800 text-sm font-semibold">{remaining.length} مهمة لم تتسع</p>
        </div>
      )}
    </div>
  );
}

/* ─── Celebration Effect ───────────────────────────────────────────────────── */

function CelebrationEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

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

/* ─── PWA Install Button ───────────────────────────────────────────────────── */

function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    (deferredPrompt as BeforeInstallPromptEvent).prompt();
    const result = await (deferredPrompt as BeforeInstallPromptEvent).userChoice;
    if (result.outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }

  if (isInstalled || !deferredPrompt) return null;

  return (
    <button onClick={handleInstall}
      className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
      style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
      📲 تثبيت مدار كتطبيق على جوالك
    </button>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* ─── Today Summary Widget ─────────────────────────────────────────────────── */

function TodaySummary() {
  const [habits, setHabitsLocal] = useState<{ total: number; done: number }>({ total: 0, done: 0 });
  const [dues, setDues] = useState<number>(0);

  useEffect(() => {
    function load() {
      try {
        const h = JSON.parse(localStorage.getItem("madar_habits") ?? "[]");
        const lastDate = localStorage.getItem("madar_habits_date");
        const today = new Date().toDateString();
        const active = h.filter((x: { isIdea: boolean }) => !x.isIdea);
        const done = active.filter((x: { todayDone: boolean }) => lastDate === today && x.todayDone).length;
        setHabitsLocal({ total: active.length, done });
      } catch {}
      try {
        const d = JSON.parse(localStorage.getItem("mfin_dues") ?? "[]");
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const pending = d.filter((x: { isActive: boolean; dueDay: number; lastConfirmedDate?: string }) =>
          x.isActive && now.getDate() >= x.dueDay && !x.lastConfirmedDate?.startsWith(monthStr)
        ).length;
        setDues(pending);
      } catch {}
    }
    load();
    window.addEventListener("madar-update", load);
    window.addEventListener("storage", load);
    return () => { window.removeEventListener("madar-update", load); window.removeEventListener("storage", load); };
  }, []);

  const habPct = habits.total > 0 ? Math.round((habits.done / habits.total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <a href="/habits" className="bg-white rounded-xl p-3 border border-[#E2D5B0] shadow-sm hover:shadow-md transition text-center">
        <p className="text-[10px] text-[#7C7A8E]">العادات</p>
        <p className="text-lg font-black" style={{ color: habPct === 100 ? "#3D8C5A" : "#5E5495" }}>{habits.done}/{habits.total}</p>
        <div className="bg-[#F0EDE4] rounded-full h-1.5 mt-1 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${habPct}%`, background: habPct === 100 ? "#3D8C5A" : "#5E5495" }} />
        </div>
      </a>
      <a href="/finance" className="bg-white rounded-xl p-3 border border-[#E2D5B0] shadow-sm hover:shadow-md transition text-center">
        <p className="text-[10px] text-[#7C7A8E]">مستحقات</p>
        <p className="text-lg font-black" style={{ color: dues === 0 ? "#3D8C5A" : "#DC2626" }}>{dues === 0 ? "✓" : dues}</p>
        <p className="text-[9px] text-[#9CA3AF]">{dues === 0 ? "لا مستحقات" : "تنتظر تأكيد"}</p>
      </a>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ─── Page ─────────────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function TasksPage() {
  /* ── Dates ── */
  const hijriDate     = getHijriDate();

  /* ── Dhikr reminder ── */
  useEffect(() => {
    const ADHKAR = [
      "سبحان الله وبحمده، سبحان الله العظيم",
      "لا إله إلا الله وحده لا شريك له",
      "لا حول ولا قوة إلا بالله",
      "أستغفر الله العظيم وأتوب إليه",
      "اللهم صلِّ وسلم على نبينا محمد",
      "سبحان الله والحمد لله ولا إله إلا الله والله أكبر",
      "حسبي الله لا إله إلا هو عليه توكلت",
    ];
    function playDhikrSound() {
      try {
        const dataUrl = localStorage.getItem("madar_dhikr_sound");
        if (dataUrl) {
          const audio = new Audio(dataUrl);
          audio.volume = 0.7;
          audio.play().catch(() => {});
        }
      } catch {}
    }
    function showDhikr() {
      // read settings for enabled/interval
      try {
        const s = JSON.parse(localStorage.getItem("madar_settings") ?? "{}");
        if (s.dhikrReminder === false) return;
      } catch {}

      const dhikr = ADHKAR[Math.floor(Math.random() * ADHKAR.length)];

      // Play custom sound if uploaded
      playDhikrSound();

      // Show notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("🕌 اذكر الله", {
          body: `${dhikr}\n\n﴿ وَالذَّاكِرِينَ اللَّهَ كَثِيرًا وَالذَّاكِرَاتِ ﴾`,
          icon: "/favicon.ico",
        });
      }
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    // Read interval from settings (default 60 min)
    let intervalMins = 60;
    try {
      const s = JSON.parse(localStorage.getItem("madar_settings") ?? "{}");
      intervalMins = s.dhikrInterval ?? 60;
    } catch {}
    const id = setInterval(showDhikr, intervalMins * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const gregorianDate = getGregorianDate();

  /* ── Prayers ── */
  const [prayers, setPrayers]            = useState<Prayer[]>([]);
  const [prayersReady, setPrayersReady]  = useState(false);

  /* ── Session ── */
  const [mode, setMode]                  = useState<Mode>("idle");
  const [timeLeft, setTimeLeft]          = useState(FOCUS_SEC);
  const [sessionCount, setSessionCount]  = useState(0);
  const [prayerOverlay, setPrayerOverlay] = useState<string | null>(null);
  const [breakMsg]                       = useState(() => BREAK_MSGS[Math.floor(Math.random() * BREAK_MSGS.length)]);
  const [focusTaskId, setFocusTaskId]    = useState<string | null>(null);

  /* ── Task Timer (تراكمي — منفصل عن الجلسة) ── */
  const [taskElapsed, setTaskElapsed]    = useState(0); // ثوان مضت على المهمة الحالية
  const [taskPaused, setTaskPaused]      = useState(false); // إيقاف مؤقت للمهمة
  const taskStartRef                     = useRef<number>(0); // وقت بداية المهمة

  /* ── Mood ── */
  const [mood, setMood]                  = useState<Mood>(null);
  const [showMoodPanel, setShowMoodPanel] = useState(false);

  /* ── Focus task picker + custom durations ── */
  const [showFocusTaskPicker, setShowFocusTaskPicker] = useState(false);
  const [customDurations, setCustomDurations] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("madar_task_durations") ?? "{}"); } catch { return {}; }
  });
  const [editDurationTaskId, setEditDurationTaskId] = useState<string | null>(null);
  function setTaskDuration(taskId: string, mins: number) {
    const updated = { ...customDurations, [taskId]: mins };
    setCustomDurations(updated);
    localStorage.setItem("madar_task_durations", JSON.stringify(updated));
    setEditDurationTaskId(null);
  }
  const [lowMoodMsg]                     = useState(() => LOW_MOOD_MSGS[Math.floor(Math.random() * LOW_MOOD_MSGS.length)]);

  /* ── Night work ── */
  const [nightWorkEnabled, setNightWorkEnabled] = useState(false);
  const [nightWorkMins, setNightWorkMins]       = useState(60);

  /* ── Celebration ── */
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDeferMenu, setShowDeferMenu] = useState(false);

  /* refs */
  const modeRef      = useRef<Mode>("idle");
  const sessRef      = useRef(0);
  const lastAdhanMin = useRef(-1);
  modeRef.current    = mode;
  sessRef.current    = sessionCount;

  /* ── Period display ── */
  const [nowMinState, setNowMinState] = useState(nowMin);

  /* ── Tasks ── */
  const [tasks, setTasks]       = useState<TaskRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [subTasks, setSubTasks] = useState<Record<string, { id: string; title: string; status: string; userPriority: number }[]>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [defaultGoalId, setDefaultGoalId] = useState<string | undefined>(undefined);
  const [showBatch, setShowBatch]   = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showQuickFinance, setShowQuickFinance] = useState(false);
  const [goalsList, setGoalsList] = useState<{ id: string; title: string }[]>([]);
  const [showPlanner, setShowPlanner] = useState(false);
  const [blockedPeriods, setBlockedPeriods] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<"all"|"pending"|"done"|"urgent"|"recurring"|"work">("pending");
  const [transferTask, setTransferTask] = useState<{ id: string; title: string } | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  function toggleSelect(id: string) {
    setSelectedTasks(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  const [bulkConfirm, setBulkConfirm] = useState<{ action: "complete" | "delete" | "defer"; count: number } | null>(null);

  function requestBulkAction(action: "complete" | "delete" | "defer") {
    const count = selectedTasks.size;
    if (count === 0) return;
    setBulkConfirm({ action, count });
  }

  async function executeBulkAction() {
    if (!bulkConfirm) return;
    const { action } = bulkConfirm;
    const ids = Array.from(selectedTasks);
    setBulkConfirm(null);

    await Promise.allSettled(ids.map(async (id) => {
      if (id.startsWith("habit_")) {
        if (action === "complete") {
          await api.patch(`/api/habits/${id.replace("habit_", "")}/toggle`);
        } else if (action === "delete") {
          await api.delete(`/api/habits/${id.replace("habit_", "")}`);
        }
      } else {
        if (action === "delete") {
          // حذف فعلي: إلغاء أولاً ثم حذف — يعمل بغض النظر عن الحالة
          await api.patch(`/api/tasks/${id}/status`, { status: "Cancelled" }).catch(() => {});
        } else {
          const status = action === "complete" ? "Completed" : "Deferred";
          await api.patch(`/api/tasks/${id}/status`, { status });
        }
      }
    }));

    // إزالة المحذوفة فوراً من الواجهة
    if (action === "delete") {
      setTasks(prev => prev.filter(t => !selectedTasks.has(t.id)));
    } else {
      setTasks(prev => prev.map(t => {
        if (!selectedTasks.has(t.id)) return t;
        if (action === "complete") return { ...t, done: true };
        return t;
      }));
    }
    setSelectedTasks(new Set());
    setBulkMode(false);
    setTimeout(() => fetchTasks(), 500);
  }

  /* load salah */
  useEffect(() => {
    getSalahToday()
      .then((s) => { setPrayers(buildPrayers(s)); setPrayersReady(true); })
      .catch(() => setPrayersReady(true));
  }, []);

  /* load tasks + habits as tasks */
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rawTasks, circles, habitsRes] = await Promise.all([
        getTasks(),
        import("@/lib/api").then(m => m.getCircles()),
        import("@/lib/api").then(m => m.api.get("/api/habits")).then(r => r.data as { id: string; title: string; icon: string; category: string; isIdea: boolean; streak: number; lastCompletedDate?: string; todayDone: boolean }[]).catch(() => [] as { id: string; title: string; icon: string; category: string; isIdea: boolean; streak: number; lastCompletedDate?: string; todayDone: boolean }[]),
      ]);
      const orderMap = new Map(circles.map((c) => [c.id, c.displayOrder]));
      const rows = rawTasks.map((t) => toRow(t, orderMap));

      // Add habits as task-like rows
      const activeHabits = (habitsRes ?? []).filter((h) => !h.isIdea);
      for (const h of activeHabits) {
        rows.push({
          id: `habit_${h.id}`,
          title: `${h.icon || "🔄"} ${h.title}`,
          circle: "عادات يومية",
          circleColor: "#2ABFBF",
          circleOrder: -1, // عادات أولاً
          priority: "متوسطة",
          done: h.todayDone,
          isInbox: false,
          isWork: false,
          isRecurring: true,
          recurrenceRule: "يومي",
          description: h.streak > 0 ? `🔥 سلسلة: ${h.streak} يوم` : undefined,
          isUrgent: false,
          waitingFor: undefined,
          dueDate: undefined,
          hasSubtasks: false,
          context: "habit",
        });
      }

      rows.sort((a, b) => {
        if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.circleOrder - b.circleOrder;
      });
      setTasks(rows);
    }
    catch { setError("تعذّر تحميل المهام."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Auto-open task dialog if coming from projects page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addTask") === "1") {
      const gid = params.get("goalId") ?? undefined;
      setDefaultGoalId(gid);
      setShowDialog(true);
      // Clean URL
      window.history.replaceState({}, "", "/tasks");
    }
  }, []);

  /* load goals for linking */
  useEffect(() => {
    getGoals().then((g) => setGoalsList(g.map((x) => ({ id: x.id, title: x.title })))).catch(() => {});
  }, []);

  /* adhan detection */
  useEffect(() => {
    const id = setInterval(() => {
      const now = nowMin();
      setNowMinState(now);
      if (!prayersReady || !prayers.length) return;
      const hit = prayers.find((p) => p.adhan === now);
      if (hit && lastAdhanMin.current !== now) {
        lastAdhanMin.current = now;
        if (modeRef.current === "focus") {
          const n = sessRef.current + 1;
          setSessionCount(n);
          sessRef.current = n;
        }
        setPrayerOverlay(hit.name);
        setMode("prayer");
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [prayersReady, prayers]);

  /* countdown */
  useEffect(() => {
    if (mode !== "focus" && mode !== "break_short" && mode !== "break_long") return;
    if (timeLeft === 0) {
      if (mode === "focus") {
        const n = sessionCount + 1;
        setSessionCount(n);
        const long = isLongBreak(n);
        setMode(long ? "break_long" : "break_short");
        setTimeLeft(long ? LONG_SEC : SHORT_SEC);
        // Track session duration for reports
        try {
          const today = new Date().toISOString().slice(0, 10);
          const log = JSON.parse(localStorage.getItem("madar_focus_log") ?? "[]");
          log.push({ date: today, taskId: focusTaskId ?? null, durationMin: mood === "low" ? 15 : 25, ts: Date.now() });
          // Keep last 90 days
          const cutoff = Date.now() - 90 * 86400000;
          localStorage.setItem("madar_focus_log", JSON.stringify(log.filter((e: { ts: number }) => e.ts > cutoff)));
        } catch {}
      } else {
        // انتهت الراحة — أكمل على نفس المهمة تلقائياً
        const duration = mood === "low" ? FOCUS_LOW_SEC : FOCUS_SEC;
        setMode("focus");
        setTimeLeft(duration);
        // focusTaskId يبقى كما هو — نكمل نفس المهمة
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, timeLeft, sessionCount]);

  /* ── Derived ── */
  const dayEnd       = getDayEnd(prayers, nightWorkEnabled ? nightWorkMins : undefined);
  const periodInfo   = getPeriod(prayers, nowMinState, dayEnd);
  const inWorkTime   = periodInfo !== null;
  const inAdhan      = isInAdhanWindow(prayers, nowMinState);
  const weekend      = isWeekend();
  const baseTasks    = weekend ? tasks.filter((t) => !t.isWork) : tasks;
  const visibleTasks = taskFilter === "all" ? baseTasks
    : taskFilter === "pending" ? baseTasks.filter((t) => !t.done)
    : taskFilter === "done" ? baseTasks.filter((t) => t.done)
    : taskFilter === "urgent" ? baseTasks.filter((t) => t.isUrgent)
    : taskFilter === "recurring" ? baseTasks.filter((t) => t.isRecurring)
    : taskFilter === "work" ? baseTasks.filter((t) => t.isWork)
    : baseTasks;
  const done         = visibleTasks.filter((t) => t.done).length;
  const total        = visibleTasks.length;
  const pct          = total === 0 ? 0 : Math.round((done / total) * 100);
  const dotsInCycle  = sessionCount % 3 === 0 ? (sessionCount === 0 ? 0 : 3) : sessionCount % 3;
  const cycleNum     = sessionCount === 0 ? 1 : Math.ceil(sessionCount / 3);
  const focusTask    = focusTaskId ? tasks.find((t) => t.id === focusTaskId) : null;
  const pendingTasks = visibleTasks.filter((t) => !t.done);

  /* ── Task timer tick ── */
  useEffect(() => {
    if (mode !== "focus" || taskPaused || !focusTaskId) return;
    const t = setInterval(() => setTaskElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode, taskPaused, focusTaskId]);

  /* ── Default task duration by context ── */
  function getDefaultDuration(context: string, taskId?: string): number {
    // أولاً: مدة مخصصة للمهمة
    if (taskId && customDurations[taskId]) return customDurations[taskId] * 60;
    if (context === "habit") {
      try { return (JSON.parse(localStorage.getItem("madar_settings") ?? "{}").habitDuration ?? 30) * 60; } catch { return 30 * 60; }
    }
    const map: Record<string, number> = { Office: 45, Home: 30, Phone: 15, Online: 30, Car: 20, Anywhere: 5 };
    return (map[context] ?? 5) * 60;
  }

  /* ── Actions ── */
  function startFocus(taskId?: string) {
    const duration = mood === "low" ? FOCUS_LOW_SEC : FOCUS_SEC;
    setFocusTaskId(taskId ?? null);
    setMode("focus");
    setTimeLeft(duration);
    // Task timer
    if (taskId) {
      // Load accumulated time from localStorage
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
    // Save accumulated task time
    if (focusTaskId) {
      localStorage.setItem(`madar_task_time_${focusTaskId}`, String(taskElapsed));
    }
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

  function handleSetMood(m: Mood) {
    setMood(m);
    setShowMoodPanel(false);
  }

  async function toggle(id: string, currentDone: boolean) {
    if (!currentDone) {
      setShowCelebration(true);
      localStorage.removeItem(`madar_task_time_${id}`);
    }
    // Handle habits
    if (id.startsWith("habit_")) {
      const habitId = id.replace("habit_", "");
      setTasks((p) => p.map((t) => t.id === id ? { ...t, done: !t.done } : t));
      try {
        const res = await api.patch(`/api/habits/${habitId}/toggle`);
        // تحديث الحالة من الاستجابة الفعلية
        const data = res.data as { todayDone?: boolean; streak?: number };
        setTasks((p) => p.map((t) => t.id === id ? { ...t, done: data.todayDone ?? !currentDone, description: data.streak && data.streak > 0 ? `🔥 سلسلة: ${data.streak} يوم` : undefined } : t));
        window.dispatchEvent(new Event("madar-update"));
      } catch {
        setTasks((p) => p.map((t) => t.id === id ? { ...t, done: currentDone } : t));
      }
      return;
    }
    setTasks((p) => p.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    try {
      await api.patch(`/api/tasks/${id}/status`, { status: currentDone ? "Todo" : "Completed" });
      window.dispatchEvent(new Event("madar-update"));
    } catch {
      setTasks((p) => p.map((t) => t.id === id ? { ...t, done: currentDone } : t));
    }
  }

  async function toggleExpand(id: string) {
    if (expandedTask === id) { setExpandedTask(null); return; }
    setExpandedTask(id);
    if (!subTasks[id]) {
      try {
        const subs = await import("@/lib/api").then(m => m.getSubTasks(id));
        setSubTasks(prev => ({ ...prev, [id]: subs }));
      } catch { setSubTasks(prev => ({ ...prev, [id]: [] })); }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* ── Focus Overlay (full-screen) ── */
  /* ══════════════════════════════════════════════════════════════════════════ */
  if (mode === "focus") {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #2A2542 0%, #5E5495 100%)" }}
      >
        {/* pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden>
          <defs>
            <pattern id="focus-bg" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <polygon points="30,4 54,17 54,43 30,56 6,43 6,17" fill="none" stroke="white" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#focus-bg)" />
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md px-6">

          {/* Period info + next prayer */}
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
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i <= dotsInCycle ? "w-3 h-3 animate-pulse" : "w-2.5 h-2.5"
                }`}
                style={{ background: i <= dotsInCycle ? "#C9A84C" : "rgba(255,255,255,0.15)" }}
              />
            ))}
          </div>

          {/* Two Timers */}
          <div className="flex items-end gap-8 w-full justify-center">
            {/* Session timer (countdown) */}
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

            {/* Task timer (count up) — only if task selected */}
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

          {/* Current task */}
          {focusTask && (() => {
            const est = getDefaultDuration(focusTask.context, focusTask.id);
            const estMins = Math.round(est / 60);
            const pct = Math.min(100, Math.round((taskElapsed / est) * 100));
            return (
            <div className="w-full bg-white/10 rounded-xl px-5 py-4 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/40 text-[10px] tracking-wider">المهمة الحالية</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: pct >= 100 ? "#DC2626" : "#8FD49B" }}>{pct}% من {estMins}د</span>
                  <button onClick={() => setEditDurationTaskId(editDurationTaskId === focusTask.id ? null : focusTask.id)}
                    className="text-[9px] px-1.5 py-0.5 rounded-full border border-white/20 text-white/40 hover:text-white/70 transition">
                    ⏱ تعديل
                  </button>
                </div>
              </div>
              <p className="text-white font-semibold text-base">{focusTask.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-white/30">{focusTask.circle}</span>
                {focusTask.context !== "Anywhere" && focusTask.context !== "habit" && (
                  <span className="text-[10px] text-white/30">{TASK_CONTEXTS.find(c=>c.key===focusTask.context)?.icon} {TASK_CONTEXTS.find(c=>c.key===focusTask.context)?.label}</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${P_COLORS[focusTask.priority]}`}>
                  {focusTask.priority}
                </span>
              </div>
              {/* Duration quick-select (1-25 min) */}
              {editDurationTaskId === focusTask.id && (
                <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 fade-up">
                  <p className="text-white/40 text-[10px] mb-2 text-center">الوقت المقدر (دقائق):</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {Array.from({ length: 25 }, (_, i) => i + 1).map(m => (
                      <button key={m} onClick={() => setTaskDuration(focusTask.id, m)}
                        className="w-8 h-8 rounded-lg text-xs font-bold transition"
                        style={{
                          background: estMins === m ? "#C9A84C" : "rgba(255,255,255,0.08)",
                          color: estMins === m ? "#1A1830" : "rgba(255,255,255,0.5)",
                          border: estMins === m ? "2px solid #C9A84C" : "1px solid rgba(255,255,255,0.1)",
                        }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Progress bar */}
              <div className="mt-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${pct}%`,
                  background: pct >= 100 ? "#DC2626" : "#8FD49B",
                }} />
              </div>
            </div>
            );
          })()}

          {!focusTask && (
            <div className="w-full bg-white/10 rounded-xl px-5 py-4 border border-white/10 text-center">
              <p className="text-white/40 text-sm">تركيز حر — بدون مهمة محددة</p>
              <button onClick={() => setShowFocusTaskPicker(true)}
                className="mt-2 text-xs px-4 py-1.5 rounded-lg font-semibold transition"
                style={{ background: "#C9A84C30", color: "#C9A84C", border: "1px solid #C9A84C40" }}>
                + اختر مهمة
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2 w-full">
              {focusTask && (
                <button onClick={() => {
                  const wasWork = focusTask.isWork;
                  toggle(focusTask.id, false);
                  localStorage.removeItem(`madar_task_time_${focusTask.id}`);
                  // اختر المهمة التالية من نفس النوع (تقنية بدل تقنية)
                  const sameType = pendingTasks.filter(t => t.id !== focusTask.id && t.isWork === wasWork);
                  const nextTask = sameType[0] ?? pendingTasks.filter(t => t.id !== focusTask.id)[0];
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
                <button onClick={() => {
                  // تبديل لمهمة من النوع الآخر (تقنية ↔ شخصية)
                  localStorage.setItem(`madar_task_time_${focusTask.id}`, String(taskElapsed));
                  const otherType = pendingTasks.filter(t => t.id !== focusTask.id && t.isWork !== focusTask.isWork);
                  const switchTo = otherType[0];
                  if (switchTo) {
                    setFocusTaskId(switchTo.id);
                    const saved = Number(localStorage.getItem(`madar_task_time_${switchTo.id}`) ?? "0");
                    setTaskElapsed(saved);
                  }
                }}
                  disabled={!pendingTasks.some(t => t.id !== focusTask.id && t.isWork !== focusTask.isWork)}
                  className="py-3 px-4 rounded-xl text-sm font-bold border transition hover:opacity-90 disabled:opacity-30"
                  style={{ borderColor: "#2ABFBF40", color: "#2ABFBF" }}>
                  ↔ تبديل
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

            {/* Defer menu — ينتقل للمهمة التالية بدون إيقاف التركيز */}
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
                    // Save task time
                    localStorage.setItem(`madar_task_time_${focusTask.id}`, String(taskElapsed));
                    // Move to next task
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

          {/* المهام القادمة + إضافة مهمة */}
          <div className="w-full mt-2 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/30 text-[10px]">المهام القادمة:</p>
              <button onClick={() => setShowFocusTaskPicker(!showFocusTaskPicker)}
                className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition"
                style={{ background: "#C9A84C20", color: "#C9A84C", border: "1px solid #C9A84C30" }}>
                {showFocusTaskPicker ? "✕ إغلاق" : "+ إضافة مهمة"}
              </button>
            </div>

            {/* Task picker */}
            {showFocusTaskPicker && (
              <div className="mb-3 max-h-48 overflow-y-auto space-y-1 p-2 bg-white/5 rounded-xl border border-white/10 fade-up">
                <p className="text-white/40 text-[10px] text-center mb-1">اختر مهمة:</p>
                {pendingTasks.filter(t => t.id !== focusTaskId).map(t => {
                  const dur = Math.round(getDefaultDuration(t.context, t.id) / 60);
                  return (
                    <div key={t.id} onClick={() => {
                      if (focusTaskId) localStorage.setItem(`madar_task_time_${focusTaskId}`, String(taskElapsed));
                      setFocusTaskId(t.id);
                      setTaskElapsed(Number(localStorage.getItem(`madar_task_time_${t.id}`) ?? "0"));
                      setTaskPaused(false);
                      setShowFocusTaskPicker(false);
                    }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition">
                      {t.context === "habit" && <span className="text-[10px]" style={{ color: "#2ABFBF" }}>🔄</span>}
                      <span className="text-white/70 text-xs flex-1 truncate">{t.title}</span>
                      <span className="text-[9px] text-white/30">{dur}د</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[t.priority]}`}>{t.priority}</span>
                    </div>
                  );
                })}
                {pendingTasks.filter(t => t.id !== focusTaskId).length === 0 && (
                  <p className="text-white/30 text-[10px] text-center py-2">لا توجد مهام معلقة</p>
                )}
              </div>
            )}

            {/* Current queue */}
            {pendingTasks.filter(t => t.id !== focusTaskId).length > 0 && !showFocusTaskPicker && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pendingTasks.filter(t => t.id !== focusTaskId).slice(0, 5).map((t, i) => {
                  const dur = Math.round(getDefaultDuration(t.context, t.id) / 60);
                  return (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition"
                      onClick={() => { if (focusTaskId) localStorage.setItem(`madar_task_time_${focusTaskId}`, String(taskElapsed)); setFocusTaskId(t.id); setTaskElapsed(Number(localStorage.getItem(`madar_task_time_${t.id}`) ?? "0")); setTaskPaused(false); }}>
                      <span className="text-white/20 text-[10px] w-3">{i + 1}</span>
                      {t.context === "habit" && <span className="text-[9px]" style={{ color: "#2ABFBF" }}>🔄</span>}
                      <span className="text-white/50 text-xs flex-1 truncate">{t.title}</span>
                      <span className="text-[9px] text-white/25">{dur}د</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[t.priority]}`}>{t.priority}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* ── Break Overlay ── */
  /* ══════════════════════════════════════════════════════════════════════════ */
  if (mode === "break_short" || mode === "break_long") {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-7"
        style={{ background: "#0F3460" }}
      >
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

          <p className="text-white/60 text-base text-center px-10 max-w-xs leading-relaxed">
            {breakMsg}
          </p>

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

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* ── Main Page ── */
  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Celebration overlay — auto-dismiss after 2s */}
      {showCelebration && <CelebrationEffect onDone={() => setShowCelebration(false)} />}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#5E5495] text-xs font-semibold mb-0.5">{hijriDate}</p>
            <p className="text-[#7C7A8E] text-[11px]">{gregorianDate}</p>
            <h2 className="text-[#16213E] font-bold text-lg mt-1">أعمال اليوم</h2>
            <p className="text-[#7C7A8E] text-xs">
              {loading ? "جارٍ التحميل…" : `${done} من ${total} مكتملة`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}
            >
              <span>+</span><span>مهمة</span>
            </button>
            <button onClick={() => setShowBatch(true)}
              className="px-3 py-2 rounded-lg text-sm font-semibold transition border border-gray-200 text-[#6B7280] hover:bg-gray-50">
              متعدد
            </button>
            <button onClick={() => setShowQuickFinance(true)}
              className="px-3 py-2 rounded-lg text-sm font-semibold transition border border-gray-200 text-[#6B7280] hover:bg-gray-50">
              💰
            </button>            <button
              onClick={() => setShowMoodPanel(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition-all border"
              style={{
                background: mood === "low" ? "#FEF3C7" : mood === "good" ? "#D1FAE5" : "#F8F6F0",
                borderColor: mood === "low" ? "#F59E0B" : mood === "good" ? "#10B981" : "#E2D5B0",
                color: mood === "low" ? "#92400E" : mood === "good" ? "#065F46" : "#7C7A8E",
              }}
            >
              {mood === "low" ? "😔" : mood === "good" ? "😊" : "🧠"}
            </button>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">

        {/* Prayer times table */}
        {prayersReady && prayers.length > 0 && (
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--text)" }}>🕌 مواقيت الصلاة</p>
              {(() => {
                const now = nowMinState;
                const next = prayers.find((p) => p.adhan > now);
                if (next) {
                  const mins = next.adhan - now;
                  const hrs = Math.floor(mins / 60);
                  const rm = mins % 60;
                  const timeStr = hrs > 0 ? `${hrs} ساعة ${rm > 0 ? `و ${rm} دقيقة` : ""}` : `${rm} دقيقة`;
                  return <p className="text-[10px] font-semibold" style={{ color: "var(--gold)" }}>⏱️ {next.name} بعد {timeStr}</p>;
                }
                return <p className="text-[10px]" style={{ color: "var(--muted)" }}>انتهت صلوات اليوم</p>;
              })()}
            </div>
            <div className="grid grid-cols-6" style={{ direction: "rtl" }}>
              {(() => {
                const now = nowMinState;
                const nextIdx = prayers.findIndex((p) => p.adhan > now);
                return prayers.map((p, i) => {
                  const passed = now > p.adhan;
                  const isNext = i === nextIdx;
                  const h = Math.floor(p.adhan / 60);
                  const m = p.adhan % 60;
                  const timeStr = `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "م" : "ص"}`;
                  return (
                    <div key={p.name} className="text-center py-3" style={{ background: isNext ? "var(--gold, #D4AF37)10" : "transparent", borderLeft: "1px solid var(--card-border)" }}>
                      <p className="text-[10px] font-bold" style={{ color: passed ? "var(--muted)" : isNext ? "var(--gold)" : "var(--text)" }}>{p.name}</p>
                      <p className="text-xs font-black tabular-nums" style={{ color: passed ? "var(--muted)" : isNext ? "var(--gold)" : "var(--primary)" }}>{timeStr}</p>
                      {passed && <p className="text-[8px]" style={{ color: "var(--muted)" }}>✓</p>}
                      {isNext && <p className="text-[8px]" style={{ color: "var(--gold)" }}>التالية</p>}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Weekend banner */}
        {weekend && (
          <div className="rounded-2xl p-4 border border-blue-200 bg-blue-50">
            <p className="text-blue-800 text-sm font-semibold">يوم إجازة — مهام العمل مخفية 💼</p>
            <p className="text-blue-600 text-[11px] mt-1">تظهر فقط المهام الشخصية. مهام العمل ({tasks.filter(t => t.isWork).length}) مخفية تلقائياً</p>
          </div>
        )}

        {/* Low mood banner */}
        {mood === "low" && (
          <div className="rounded-2xl p-5 border border-amber-200 bg-amber-50">
            <p className="text-amber-800 text-sm font-semibold mb-1">وضع النفسية المنخفضة مفعّل</p>
            <p className="text-amber-700 text-xs leading-relaxed">{lowMoodMsg}</p>
            <p className="text-amber-600 text-[11px] mt-2">الجلسات مخففة: ١٥ دقيقة بدل ٢٥</p>
          </div>
        )}

        {/* ── Focus Start Widget ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm bg-white border border-[#E2D5B0]">
          {/* Period bar */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#F0EDE4]">
            <div className="flex items-center gap-2">
              {!prayersReady ? (
                <div className="w-36 h-3 rounded bg-[#E2D5B0] animate-pulse" />
              ) : inAdhan ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-600">وقت الصلاة — توقف إجباري</span>
                </>
              ) : inWorkTime ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold text-[#5E5495]">فترة {periodInfo!.name}</span>
                  <span className="text-xs text-[#7C7A8E]">• {periodInfo!.minsLeft} د حتى {periodInfo!.nextName}</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#7C7A8E]" />
                  <span className="text-xs text-[#7C7A8E]">بعد العشاء — انتهى وقت العمل</span>
                  {!nightWorkEnabled && (
                    <button onClick={() => { setNightWorkEnabled(true); }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition mr-1">
                      تفعيل العمل الليلي
                    </button>
                  )}
                  {nightWorkEnabled && (
                    <div className="flex items-center gap-1 mr-1">
                      <select value={nightWorkMins} onChange={(e) => setNightWorkMins(Number(e.target.value))}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700 focus:outline-none">
                        <option value={30}>٣٠ د</option>
                        <option value={60}>ساعة</option>
                        <option value={90}>٩٠ د</option>
                        <option value={120}>ساعتين</option>
                      </select>
                      <button onClick={() => setNightWorkEnabled(false)}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 hover:bg-red-100">✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
            {sessionCount > 0 && (
              <span className="text-xs font-medium text-[#7C7A8E]">
                {sessionCount} جلسة — دورة {cycleNum}
              </span>
            )}
          </div>

          {/* Session dots + Timer preview + Start */}
          <div className="px-5 py-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i}
                  className={`rounded-full transition-all duration-300 ${i <= dotsInCycle ? "w-3 h-3" : "w-2.5 h-2.5"}`}
                  style={{ background: i <= dotsInCycle ? "#C9A84C" : "#E2D5B0" }}
                />
              ))}
            </div>

            <p className="text-5xl font-black tabular-nums leading-none select-none text-[#1A1830]" style={{ letterSpacing: "0.05em" }}>
              {fmt(mood === "low" ? FOCUS_LOW_SEC : FOCUS_SEC)}
            </p>

            <p className="text-sm text-[#7C7A8E]">
              {inWorkTime
                ? mood === "low" ? "جلسة مخففة — ١٥ دقيقة" : "جاهز للتركيز؟"
                : nightWorkEnabled ? `عمل ليلي — ${nightWorkMins} دقيقة بعد العشاء` : "انتهى وقت العمل — بعد صلاة العشاء"}
            </p>

            {/* زر واحد لبدء جلسة التركيز */}
            <button onClick={() => startFocus()}
              disabled={!inWorkTime || inAdhan}
              className="px-12 py-4 rounded-xl text-base font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
              ابدأ جلسة تركيز
            </button>
            {pendingTasks.length > 0 && (
              <p className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
                {pendingTasks.length} مهمة بانتظارك — اختر مهمتك من داخل الجلسة
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#7C7A8E]">تقدم اليوم</span>
            <span className="font-bold text-[#5E5495]">{pct}%</span>
          </div>
          <div className="bg-[#F8F6F0] rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #5E5495, #C9A84C)" }} />
          </div>
        </div>

        {/* PWA Install Prompt */}
        <InstallPWAButton />

        {/* Today Summary — habits + quran + dues */}
        <TodaySummary />

        {/* Overdue / Due Soon warning */}
        {(() => {
          const now = new Date();
          const tomorrow = new Date(now.getTime() + 86400000);
          const overdue = baseTasks.filter(t => isOverdue(t));
          const dueSoon = baseTasks.filter(t => !t.done && !isOverdue(t) && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= tomorrow);
          if (overdue.length === 0 && dueSoon.length === 0) return null;
          return (
            <div className="rounded-xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              {overdue.length > 0 && (
                <div className="mb-2">
                  <p className="text-red-700 text-sm font-bold mb-1">⚠ {overdue.length} مهمة متأخرة</p>
                  {overdue.slice(0, 3).map(t => (
                    <p key={t.id} className="text-red-600 text-xs mr-4">• {t.title}</p>
                  ))}
                </div>
              )}
              {dueSoon.length > 0 && (
                <div>
                  <p className="text-amber-700 text-sm font-bold mb-1">⏰ {dueSoon.length} مهمة تستحق اليوم/غداً</p>
                  {dueSoon.slice(0, 3).map(t => (
                    <p key={t.id} className="text-amber-600 text-xs mr-4">• {t.title}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* تنبيه قبل الصلاة */}
        {prayersReady && prayers.length > 0 && (() => {
          const now = nowMinState;
          const next = prayers.find((p) => p.adhan > now);
          if (!next) return null;
          const minsLeft = next.adhan - now;
          if (minsLeft > 15) return null;
          const msgs = [
            "استعد لصلاة " + next.name + " — باقي " + minsLeft + " دقيقة",
            "هل أنت متوضئ؟ 🤲",
            minsLeft <= 5 ? "أكمل ما بيدك واستعد للصلاة" : "لا تبدأ مهام جديدة",
          ];
          return (
            <div className="rounded-xl p-4 animate-pulse" style={{ background: "linear-gradient(135deg, #0a2a0a, #1a3a1a)", border: "1px solid #3D8C5A40" }}>
              <p className="text-sm font-bold mb-1" style={{ color: "#D4AF37" }}>🕌 صلاة {next.name} بعد {minsLeft} دقيقة</p>
              {msgs.map((m, i) => <p key={i} className="text-xs" style={{ color: "#8FD49B" }}>{m}</p>)}
            </div>
          );
        })()}

        {/* Inbox - pending tasks from others */}
        {visibleTasks.filter((t) => t.isInbox).length > 0 && (
          <section>
            <GeometricDivider label="مهام واردة — تحتاج موافقتك" />
            <div className="mt-3 space-y-2">
              {visibleTasks.filter((t) => t.isInbox).map((t) => (
                <div key={t.id} className="bg-amber-50 rounded-xl px-5 py-4 border border-amber-200">
                  <p className="font-medium text-sm text-[#16213E] mb-1">{t.title}</p>
                  {t.description && <p className="text-[#6B7280] text-xs mb-3">{t.description}</p>}
                  <div className="flex gap-2">
                    <button onClick={async () => { await acceptRejectTask(t.id, true); fetchTasks(); }}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#3D8C5A] hover:opacity-90">
                      ✓ قبول
                    </button>
                    <button onClick={async () => { await acceptRejectTask(t.id, false); fetchTasks(); }}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100">
                      ✕ رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick add task with Enter */}
        <div className="bg-white rounded-xl border border-[#E2D5B0] shadow-sm overflow-hidden">
          <input
            type="text"
            placeholder="اكتب مهمة واضغط Enter…"
            className="w-full px-5 py-3.5 text-sm focus:outline-none bg-transparent"
            style={{ color: "var(--text)" }}
            onKeyDown={async (e) => {
              if (e.key !== "Enter") return;
              const input = e.currentTarget;
              const title = input.value.trim();
              if (!title) return;
              input.value = "";
              try {
                const task = await createTask({ title });
                setTasks((p) => [toRow(task), ...p]);
                setShowCelebration(true);
              } catch {}
            }}
          />
        </div>

        {/* Task List */}
        <section>
          <GeometricDivider label="قائمة المهام" />
          {/* Filters */}
          <div className="flex gap-1.5 mt-3 mb-2 flex-wrap">
            {([
              { key: "all",       label: "الكل",     count: baseTasks.length },
              { key: "pending",   label: "معلقة",    count: baseTasks.filter(t=>!t.done).length },
              { key: "done",      label: "مكتملة",   count: baseTasks.filter(t=>t.done).length },
              { key: "urgent",    label: "🔴 ملحة",  count: baseTasks.filter(t=>t.isUrgent).length },
              { key: "recurring", label: "🔄 مكررة", count: baseTasks.filter(t=>t.isRecurring).length },
              { key: "work",      label: "💼 عمل",   count: baseTasks.filter(t=>t.isWork).length },
            ] as const).map((f) => (
              <button key={f.key} onClick={() => setTaskFilter(f.key)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
                style={{
                  background: taskFilter === f.key ? "#5E5495" : "var(--card, #fff)",
                  color: taskFilter === f.key ? "#fff" : "var(--muted, #6B7280)",
                  border: `1px solid ${taskFilter === f.key ? "#5E5495" : "var(--card-border, #E2D5B0)"}`,
                }}>
                {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
              </button>
            ))}
            <button onClick={() => { setBulkMode(!bulkMode); setSelectedTasks(new Set()); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
              style={{ background: bulkMode ? "#DC2626" : "var(--card)", color: bulkMode ? "#fff" : "var(--muted)", border: `1px solid ${bulkMode ? "#DC2626" : "var(--card-border)"}` }}>
              {bulkMode ? "✕ إلغاء" : "☑ تحديد"}
            </button>
          </div>

          {/* Bulk action bar */}
          {bulkMode && selectedTasks.size > 0 && (
            <div className="flex items-center gap-2 mt-2 p-3 rounded-xl bg-white border border-[#E2D5B0] shadow-sm">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{selectedTasks.size} محدد</span>
              <div className="flex-1" />
              <button onClick={() => requestBulkAction("complete")} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#3D8C5A]">إكمال ✓</button>
              <button onClick={() => requestBulkAction("defer")} className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">تأجيل</button>
              <button onClick={() => requestBulkAction("delete")} className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 border border-red-200">حذف</button>
            </div>
          )}

          <div className="scroll-card mt-3 rounded-2xl overflow-hidden shadow-sm min-h-[120px]">

            {loading && <TaskSkeleton />}

            {!loading && error && (
              <div className="text-center py-10 px-5">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={fetchTasks} className="text-[#C9A84C] text-sm font-medium hover:underline">إعادة المحاولة</button>
              </div>
            )}

            {!loading && !error && visibleTasks.length === 0 && (
              <div className="text-center py-10 px-5">
                <p className="text-[#7C7A8E] text-sm mb-3">لا توجد مهام حتى الآن</p>
                <button onClick={() => setShowDialog(true)} className="text-[#5E5495] text-sm font-medium hover:underline">+ أضف أول مهمة</button>
              </div>
            )}

            {!loading && !error && visibleTasks.length > 0 && (() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
              const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

              // تصنيف المهام حسب اليوم
              function getTaskDay(t: TaskRow): string {
                if (t.context === "habit") return todayStr; // العادات دائماً اليوم
                if (t.dueDate) {
                  const d = t.dueDate.slice(0, 10);
                  if (d <= todayStr) return todayStr; // المستحقة اليوم أو قبل
                  return d;
                }
                if (t.createdAt) return t.createdAt.slice(0, 10);
                return todayStr;
              }

              const groups = new Map<string, TaskRow[]>();
              visibleTasks.forEach(t => {
                const day = getTaskDay(t);
                groups.set(day, [...(groups.get(day) ?? []), t]);
              });

              // ترتيب: اليوم أولاً ثم الأقرب
              const sortedDays = Array.from(groups.entries()).sort((a, b) => {
                if (a[0] === todayStr && b[0] !== todayStr) return -1;
                if (b[0] === todayStr && a[0] !== todayStr) return 1;
                return a[0].localeCompare(b[0]);
              });

              function dayLabel(d: string): string {
                if (d === todayStr) return "اليوم";
                if (d === yesterdayStr) return "أمس";
                if (d === tomorrowStr) return "غداً";
                if (d < todayStr) return "سابقة";
                return new Date(d).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "short" });
              }

              return (
              <div className="px-5 py-3 space-y-1">
                {sortedDays.map(([day, dayTasks]) => (
                  <details key={day} open={day === todayStr || day === tomorrowStr || sortedDays.length <= 2}>
                    <summary className="flex items-center justify-between py-2 px-2 rounded-lg cursor-pointer hover:bg-[#C9A84C]/5 transition sticky top-0 z-10"
                      style={{ background: "var(--card)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: day === todayStr ? "var(--gold, #D4AF37)" : day < todayStr ? "var(--muted)" : "#5E5495" }}>{dayLabel(day)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100" style={{ color: "var(--muted)" }}>{dayTasks.filter(x => !x.done).length}/{dayTasks.length}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>{day !== todayStr ? day : ""}</span>
                    </summary>
                {dayTasks.map((t) => (
                  <div key={t.id}>
                    <div
                      onClick={() => bulkMode ? toggleSelect(t.id) : toggle(t.id, t.done)}
                      className={`flex items-center gap-3 py-3 border-b border-[#e2d5b0]/60 last:border-0
                                  cursor-pointer hover:bg-[#C9A84C]/5 rounded-lg px-2 transition-all
                                  ${t.done ? "opacity-50" : ""} ${selectedTasks.has(t.id) ? "bg-[#5E5495]/10 border-[#5E5495]/30" : ""}`}>
                      {bulkMode ? (
                        <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${selectedTasks.has(t.id) ? "bg-[#5E5495] border-[#5E5495]" : "border-[#C9A84C] bg-transparent"}`}>
                          {selectedTasks.has(t.id) && <span className="text-white text-[10px]">✓</span>}
                        </div>
                      ) : (
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all
                                      ${t.done
                                        ? t.context === "habit" ? "bg-[#2ABFBF] border-[#2ABFBF]" : "bg-[#5E5495] border-[#5E5495]"
                                        : t.context === "habit" ? "border-[#2ABFBF] bg-transparent" : "border-[#C9A84C] bg-transparent"}`}>
                        {t.done && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      )}
                      {t.context !== "habit" && (
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                          className="text-[10px] text-[#7C7A8E] hover:text-[#5E5495] transition flex-shrink-0"
                          title="مهام فرعية">
                          {expandedTask === t.id ? "▼" : "▶"}
                        </button>
                      )}
                      <p className={`flex-1 text-sm ${t.done ? "line-through text-[#7C7A8E]" : "text-[#1A1830] font-medium"}`}>
                        {t.title}
                      </p>
                      {t.context === "habit" && !t.done && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#2ABFBF15", color: "#2ABFBF", border: "1px solid #2ABFBF30" }}>عادة</span>
                      )}
                      {t.context === "habit" && t.description && (
                        <span className="text-[10px] text-orange-500 font-bold flex-shrink-0">{t.description}</span>
                      )}
                      {t.isUrgent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 flex-shrink-0" title={t.waitingFor ? `ينتظر: ${t.waitingFor}` : "ملحة"}>🔴 {t.waitingFor ?? "ملحة"}</span>}
                      {t.isRecurring && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex-shrink-0">🔄</span>}
                      {t.isWork && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">💼</span>}
                      {isOverdue(t) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 bg-red-50 text-red-600 border border-red-200">
                          ⏰ متأخرة
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isOverdue(t) ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-50 text-[#9CA3AF]"
                        }`}>
                          📅 {new Date(t.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {/* بيئة المهمة */}
                      {t.context && t.context !== "Anywhere" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-50 text-[#6B7280] border border-gray-200 flex-shrink-0">
                          {TASK_CONTEXTS.find(c => c.key === t.context)?.icon ?? "🌐"} {TASK_CONTEXTS.find(c => c.key === t.context)?.label ?? t.context}
                        </span>
                      )}
                      {/* واتساب — فقط لمهام الاتصال */}
                      {(t.context === "Phone" || t.context === "Anywhere") && (
                        <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(t.title)}`, "_blank"); }}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 flex-shrink-0 hover:bg-green-100 transition" title="أرسل واتساب">
                          📱
                        </button>
                      )}
                      {/* خريطة — فقط لمهام المشاوير */}
                      {t.context === "Car" && (
                        <button onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/${encodeURIComponent(t.title)}`, "_blank"); }}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0 hover:bg-blue-100 transition" title="اذهب الآن">
                          📍
                        </button>
                      )}
                      {/* تحويل */}
                      <button onClick={(e) => { e.stopPropagation(); setTransferTask({ id: t.id, title: t.title }); }}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex-shrink-0 hover:bg-purple-100 transition" title="حوّل لشخص">
                        📨
                      </button>
                      {/* تعديل */}
                      <button onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-[#6B7280] border border-gray-200 flex-shrink-0 hover:bg-gray-100 transition" title="تعديل">
                        ✏️
                      </button>
                      {t.circleColor ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium"
                          style={{ background: `${t.circleColor}15`, color: t.circleColor, border: `1px solid ${t.circleColor}30` }}>
                          {t.circle}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#7C7A8E] flex-shrink-0">{t.circle}</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${P_COLORS[t.priority]}`}>
                        {t.priority}
                      </span>
                    </div>
                    {/* Subtasks */}
                    {expandedTask === t.id && (
                      <div className="pr-10 pb-2 space-y-1">
                        {!subTasks[t.id] ? (
                          <p className="text-[10px] text-[#7C7A8E] py-1 animate-pulse">جارٍ التحميل...</p>
                        ) : subTasks[t.id].length === 0 ? (
                          <p className="text-[10px] text-[#9CA3AF] py-1">لا توجد مهام فرعية</p>
                        ) : (
                          subTasks[t.id].map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-[#F8F6F0] border border-[#E2D5B0]/50">
                              <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border flex items-center justify-center
                                ${sub.status === "Completed" ? "bg-[#5E5495] border-[#5E5495]" : "border-[#C9A84C] bg-transparent"}`}>
                                {sub.status === "Completed" && <span className="text-white text-[8px]">✓</span>}
                              </div>
                              <span className={`text-xs flex-1 ${sub.status === "Completed" ? "line-through text-[#9CA3AF]" : "text-[#1A1830]"}`}>{sub.title}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[priorityLabel(sub.userPriority)]}`}>
                                {priorityLabel(sub.userPriority)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
                  </details>
                ))}
              </div>
              );
            })()}
          </div>
        </section>

        {/* ── تخطيط اليوم — مدمج في أسفل الصفحة ── */}
        <GeometricDivider label="📋 تخطيط اليوم" />
        <InlineDayPlanner prayers={prayers} tasks={visibleTasks} blockedPeriods={blockedPeriods} onBlockToggle={(name) => setBlockedPeriods((p) => p.includes(name) ? p.filter((x) => x !== name) : [...p, name])} />

        {/* ── المهام المستقبلية ── */}
        {(() => {
          const today = new Date(); today.setHours(0,0,0,0);
          const future = baseTasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) > today)
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
          if (future.length === 0) return null;
          return (
            <section>
              <GeometricDivider label="📅 المهام المستقبلية" />
              <div className="mt-3 space-y-1.5">
                {future.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:opacity-80"
                    style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                    draggable onDragStart={(e) => e.dataTransfer.setData("taskId", t.id)}>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#D4AF3715", color: "var(--gold)" }}>
                      📅 {new Date(t.dueDate!).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-sm flex-1 truncate" style={{ color: "var(--text)" }}>{t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${P_COLORS[t.priority]}`}>{t.priority}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{t.circle}</span>
                  </div>
                ))}
                {future.length > 10 && <p className="text-xs text-center" style={{ color: "var(--muted)" }}>+{future.length - 10} مهمة أخرى</p>}
              </div>
            </section>
          );
        })()}

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {/* ── Prayer Overlay ── */}
      {prayerOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: "rgba(10, 8, 30, 0.96)", backdropFilter: "blur(10px)" }}>
          <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" aria-hidden>
            <defs>
              <pattern id="prayer-bg" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <polygon points="40,4 72,22 72,58 40,76 8,58 8,22" fill="none" stroke="white" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#prayer-bg)" />
          </svg>
          <div className="relative z-10 flex flex-col items-center gap-5">
            <div className="text-7xl" style={{ filter: "drop-shadow(0 0 30px rgba(201,168,76,0.4))" }}>🕌</div>
            <div className="text-center">
              <p className="text-white/40 text-sm mb-1 tracking-widest">حان وقت</p>
              <p className="text-white text-3xl font-bold">صلاة {prayerOverlay}</p>
            </div>
            <p className="text-white/30 text-sm">تم احتساب جلستك الحالية ✓</p>
            <button onClick={dismissPrayer}
              className="mt-3 px-10 py-3 rounded-xl text-sm font-bold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)", color: "#1A1830" }}>
              سأصلي الآن ✓
            </button>
          </div>
        </div>
      )}

      {/* ── Mood Panel ── */}
      {showMoodPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[#1A1830]/60 backdrop-blur-sm" onClick={() => setShowMoodPanel(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-up">
            <div className="px-7 pt-7 pb-4 border-b border-[#E2D5B0]">
              <h2 className="font-bold text-[#1A1830] text-center">كيف حالتك النفسية؟</h2>
              <p className="text-[#7C7A8E] text-xs text-center mt-1">هذا يساعدنا نعدّل الجلسات لك</p>
            </div>
            <div className="px-7 py-6 space-y-3">
              <button onClick={() => handleSetMood("good")}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all hover:border-green-400"
                style={{ borderColor: mood === "good" ? "#10B981" : "#E2D5B0", background: mood === "good" ? "#D1FAE5" : "white" }}>
                <span className="text-3xl">😊</span>
                <div className="text-right">
                  <p className="font-semibold text-[#1A1830] text-sm">بخير والحمد لله</p>
                  <p className="text-[#7C7A8E] text-xs">جلسات عادية — ٢٥ دقيقة</p>
                </div>
              </button>
              <button onClick={() => handleSetMood("low")}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all hover:border-amber-400"
                style={{ borderColor: mood === "low" ? "#F59E0B" : "#E2D5B0", background: mood === "low" ? "#FEF3C7" : "white" }}>
                <span className="text-3xl">😔</span>
                <div className="text-right">
                  <p className="font-semibold text-[#1A1830] text-sm">نفسيتي تعبانة</p>
                  <p className="text-[#7C7A8E] text-xs">جلسات مخففة — ١٥ دقيقة مع دعم</p>
                </div>
              </button>
              <button onClick={() => handleSetMood(null)}
                className="w-full py-2.5 rounded-xl text-sm text-[#7C7A8E] hover:bg-[#F8F6F0] transition">
                مسح الاختيار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Dialog */}
      {showDialog && (
        <NewTaskDialog
          onClose={() => { setShowDialog(false); setDefaultGoalId(undefined); }}
          onCreated={(t) => setTasks((p) => [t, ...p])}
          goals={goalsList}
          defaultGoalId={defaultGoalId}
        />
      )}

      {showQuickFinance && <QuickFinanceDialog onClose={() => setShowQuickFinance(false)} />}
      {showAssign && <AssignTaskDialog onClose={() => setShowAssign(false)} />}

      {/* ── Bulk Confirm Modal ── */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBulkConfirm(null)} />
          <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-sm fade-up"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="px-6 pt-6 pb-4 text-center">
              <p className="text-3xl mb-3">{bulkConfirm.action === "delete" ? "🗑️" : bulkConfirm.action === "complete" ? "✅" : "⏳"}</p>
              <p className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>
                {bulkConfirm.action === "delete" ? "حذف" : bulkConfirm.action === "complete" ? "إكمال" : "تأجيل"} {bulkConfirm.count} مهمة؟
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {bulkConfirm.action === "delete" ? "سيتم حذف المهام المحددة نهائياً" : bulkConfirm.action === "complete" ? "سيتم تعليم المهام المحددة كمكتملة" : "سيتم تأجيل المهام المحددة"}
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setBulkConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
              <button onClick={executeBulkAction}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: bulkConfirm.action === "delete" ? "#DC2626" : bulkConfirm.action === "complete" ? "#3D8C5A" : "#D4AF37" }}>
                {bulkConfirm.action === "delete" ? "حذف" : bulkConfirm.action === "complete" ? "إكمال" : "تأجيل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <EditTaskDialog task={editingTask} onClose={() => setEditingTask(null)} onSaved={fetchTasks} />
      )}

      {transferTask && (
        <TransferTaskDialog
          taskId={transferTask.id}
          taskTitle={transferTask.title}
          onClose={() => setTransferTask(null)}
          onDone={fetchTasks}
        />
      )}

      {showPlanner && (
        <DayPlannerDialog
          onClose={() => setShowPlanner(false)}
          prayers={prayers}
          tasks={visibleTasks}
          blockedPeriods={blockedPeriods}
          onBlockToggle={(name) => setBlockedPeriods((p) => p.includes(name) ? p.filter((x) => x !== name) : [...p, name])}
        />
      )}

      {showBatch && (
        <BatchTaskDialog
          onClose={() => setShowBatch(false)}
          onCreated={(newTasks) => setTasks((p) => [...newTasks, ...p])}
        />
      )}
    </main>
  );
}
