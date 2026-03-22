"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ───────────────────────────────────────────────────────────── */

interface Habit {
  id: string;
  title: string;
  icon: string;
  streak: number;
  todayDone: boolean;
  category: "worship" | "health" | "learning" | "social";
  isIdea: boolean;
}

const CATEGORIES = {
  worship:  { label: "عبادة",  color: "#2C2C54" },
  health:   { label: "صحة",   color: "#0F3460" },
  learning: { label: "تعلم",  color: "#D4AF37" },
  social:   { label: "اجتماعي", color: "#3D8C5A" },
};

const ICONS = ["⭐", "📿", "🕌", "📖", "🏃", "💧", "🧠", "🤝", "💪", "🎯", "🌙", "❤️", "🎧", "✍️", "🍎", "🛏️"];

const DEFAULT_HABITS: Habit[] = [
  { id: "1", title: "صلاة الفجر في وقتها", icon: "🕌", streak: 0, todayDone: false, category: "worship", isIdea: true },
  { id: "2", title: "أذكار الصباح", icon: "📿", streak: 0, todayDone: false, category: "worship", isIdea: true },
  { id: "3", title: "أذكار المساء", icon: "🌙", streak: 0, todayDone: false, category: "worship", isIdea: true },
  { id: "4", title: "قراءة ٣٠ دقيقة", icon: "📖", streak: 0, todayDone: false, category: "learning", isIdea: true },
  { id: "5", title: "رياضة ٣٠ دقيقة", icon: "🏃", streak: 0, todayDone: false, category: "health", isIdea: true },
  { id: "6", title: "شرب ٨ أكواب ماء", icon: "💧", streak: 0, todayDone: false, category: "health", isIdea: true },
  { id: "7", title: "صلة رحم", icon: "🤝", streak: 0, todayDone: false, category: "social", isIdea: true },
];

/* ─── Prayer Types ────────────────────────────────────────────────────── */

const PRAYERS = [
  { key: "Fajr",    label: "الفجر",   icon: "🌅" },
  { key: "Duha",    label: "الضحى",   icon: "☀️" },
  { key: "Dhuhr",   label: "الظهر",   icon: "🌤️" },
  { key: "Asr",     label: "العصر",   icon: "🌇" },
  { key: "Maghrib", label: "المغرب",  icon: "🌆" },
  { key: "Isha",    label: "العشاء",  icon: "🌙" },
] as const;

type PrayerKey = typeof PRAYERS[number]["key"];
type PrayerStatus = "None" | "OnTime" | "InMosque" | "Missed";

interface PrayerState { [key: string]: PrayerStatus; }

interface Penalty {
  id: string; date: string; prayer: string;
  penaltyType: string; penaltyDetail?: string;
}

interface PrayerStats {
  weekOnTimePercent: number; weekMosquePercent: number;
  longestStreak: number; pendingPenalties: number;
}

const PENALTY_TYPES = [
  { key: "surah",   label: "قراءة سورة" },
  { key: "rakaat",  label: "ركعتين نافلة" },
  { key: "dhikr",   label: "ذكر ١٠٠ مرة" },
  { key: "sadaqa",  label: "صدقة" },
  { key: "custom",  label: "مخصص" },
];

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/* ─── Celebration ─────────────────────────────────────────────────────── */

function CelebrationOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="text-center animate-bounce">
        <p className="text-6xl mb-2">🎉</p>
        <p className="text-[#D4AF37] font-black text-xl">أحسنت!</p>
      </div>
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="absolute w-2 h-2 rounded-full"
            style={{
              background: ["#D4AF37", "#2C2C54", "#3D8C5A", "#DC2626", "#0F3460"][i % 5],
              left: `${Math.random() * 100}%`,
              top: `-5%`,
              animation: `confetti-fall ${1.5 + Math.random()}s ease-in forwards`,
              animationDelay: `${Math.random() * 0.5}s`,
            }} />
        ))}
      </div>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─── Prayer Section Component ────────────────────────────────────────── */

function PrayerSection() {
  const [prayerState, setPrayerState] = useState<PrayerState>({});
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [stats, setStats] = useState<PrayerStats | null>(null);
  const [salahTimes, setSalahTimes] = useState<Record<string, string> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [penaltyConfig, setPenaltyConfig] = useState<Record<string, string>>({});
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Load salah times
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api.get(`/api/salah/today?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
          .then(({ data }) => setSalahTimes(data))
          .catch(() => {});
      },
      () => {
        // Default Riyadh
        api.get("/api/salah/today?lat=24.7136&lng=46.6753")
          .then(({ data }) => setSalahTimes(data))
          .catch(() => {});
      }
    );
  }, []);

  // Load today's prayer logs
  const loadToday = useCallback(() => {
    api.get("/api/prayer-tracking/today").then(({ data }) => {
      const state: PrayerState = {};
      for (const log of data as { prayer: string; status: string }[]) {
        state[log.prayer] = log.status as PrayerStatus;
      }
      setPrayerState(state);
    }).catch(() => {});
  }, []);

  const loadPenalties = useCallback(() => {
    api.get("/api/prayer-tracking/penalties").then(({ data }) => {
      setPenalties(data as Penalty[]);
    }).catch(() => {});
  }, []);

  const loadStats = useCallback(() => {
    api.get("/api/prayer-tracking/stats").then(({ data }) => {
      setStats(data as PrayerStats);
    }).catch(() => {});
  }, []);

  const loadSettings = useCallback(() => {
    api.get("/api/prayer-tracking/settings").then(({ data }) => {
      setPenaltyConfig((data as { penaltyConfig: Record<string, string> }).penaltyConfig ?? {});
      setNotifEnabled((data as { notificationsEnabled: boolean }).notificationsEnabled);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadToday(); loadPenalties(); loadStats(); loadSettings(); }, [loadToday, loadPenalties, loadStats, loadSettings]);

  // Check for missed prayers every minute
  useEffect(() => {
    if (!salahTimes) return;
    const check = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const today = now.toISOString().slice(0, 10);

      // Prayer end times (next prayer's adhan = end of current)
      const prayerEndMap: Record<string, number> = {
        Fajr:    toMin(salahTimes.shuruq),
        Duha:    toMin(salahTimes.dhuhr),
        Dhuhr:   toMin(salahTimes.asr),
        Asr:     toMin(salahTimes.maghrib),
        Maghrib: toMin(salahTimes.isha),
        Isha:    23 * 60 + 59,
      };

      for (const p of PRAYERS) {
        const endTime = prayerEndMap[p.key];
        if (endTime && nowMins > endTime && !prayerState[p.key]) {
          // Time passed and no status recorded — mark as missed
          api.post("/api/prayer-tracking/miss", { prayer: p.key, date: today })
            .then(() => { loadToday(); loadPenalties(); })
            .catch(() => {});
        }
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [salahTimes, prayerState, loadToday, loadPenalties]);

  async function markPrayer(prayer: string, status: PrayerStatus) {
    // Optimistic
    setPrayerState(prev => ({ ...prev, [prayer]: status }));
    try {
      await api.post("/api/prayer-tracking/mark", { prayer, status });
      loadPenalties();
      loadStats();
    } catch {
      // revert
      loadToday();
    }
  }

  async function fulfillPenalty(id: string) {
    setPenalties(prev => prev.filter(p => p.id !== id));
    try {
      await api.post(`/api/prayer-tracking/penalties/${id}/fulfill`);
      loadStats();
    } catch { loadPenalties(); }
  }

  async function saveSettings() {
    await api.put("/api/prayer-tracking/settings", {
      penaltyConfig, notificationsEnabled: notifEnabled,
    }).catch(() => {});
    setShowSettings(false);
  }

  // Determine current prayer period
  function getPrayerTimeStatus(prayerKey: string): "past" | "current" | "future" {
    if (!salahTimes) return "future";
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const adhanMap: Record<string, number> = {
      Fajr: toMin(salahTimes.fajr),
      Duha: toMin(salahTimes.shuruq) + 15,
      Dhuhr: toMin(salahTimes.dhuhr),
      Asr: toMin(salahTimes.asr),
      Maghrib: toMin(salahTimes.maghrib),
      Isha: toMin(salahTimes.isha),
    };
    const endMap: Record<string, number> = {
      Fajr: toMin(salahTimes.shuruq),
      Duha: toMin(salahTimes.dhuhr),
      Dhuhr: toMin(salahTimes.asr),
      Asr: toMin(salahTimes.maghrib),
      Maghrib: toMin(salahTimes.isha),
      Isha: 23 * 60 + 59,
    };

    const start = adhanMap[prayerKey];
    const end = endMap[prayerKey];
    if (start === undefined) return "future";
    if (nowMins < start) return "future";
    if (nowMins >= end) return "past";
    return "current";
  }

  function getPrayerTimeStr(prayerKey: string): string {
    if (!salahTimes) return "";
    const map: Record<string, string> = {
      Fajr: salahTimes.fajr, Duha: salahTimes.shuruq,
      Dhuhr: salahTimes.dhuhr, Asr: salahTimes.asr,
      Maghrib: salahTimes.maghrib, Isha: salahTimes.isha,
    };
    return map[prayerKey] ?? "";
  }

  const prayerLabel = (key: string) => PRAYERS.find(p => p.key === key)?.label ?? key;

  const penaltyLabel = (type: string) => PENALTY_TYPES.find(t => t.key === type)?.label ?? type;

  return (
    <>
      {/* ═══ Prayer Cards ═══ */}
      <GeometricDivider label="الصلوات" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {PRAYERS.map(p => {
          const status = prayerState[p.key] as PrayerStatus | undefined;
          const timeStatus = getPrayerTimeStatus(p.key);
          const timeStr = getPrayerTimeStr(p.key);
          const isMissed = status === "Missed";
          const isOnTime = status === "OnTime";
          const isMosque = status === "InMosque";
          const isDone = isOnTime || isMosque;

          return (
            <div key={p.key}
              className="bg-white rounded-xl p-4 border shadow-sm transition-all"
              style={{
                borderColor: isMissed ? "#DC2626" : isDone ? "#3D8C5A" : timeStatus === "current" ? "#D4AF37" : "#E5E7EB",
                opacity: timeStatus === "future" && !isDone && !isMissed ? 0.6 : 1,
                background: isMissed ? "#FEF2F2" : isMosque ? "#F0FDF4" : isOnTime ? "#F0FDF4" : "white",
              }}>
              {/* Prayer name + time */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-[#16213E]">{p.label}</p>
                    {timeStr && <p className="text-[10px] text-[#6B7280]">{timeStr}</p>}
                  </div>
                </div>
                {timeStatus === "current" && !isDone && !isMissed && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
                )}
                {isDone && <span className="text-lg">✅</span>}
                {isMissed && <span className="text-lg">🔴</span>}
              </div>

              {/* Action buttons */}
              {!isDone && !isMissed && (
                <div className="flex gap-1.5">
                  <button onClick={() => markPrayer(p.key, "OnTime")}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "#3D8C5A", color: "white" }}>
                    ✅ في الوقت
                  </button>
                  <button onClick={() => markPrayer(p.key, "InMosque")}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "#2C2C54", color: "white" }}>
                    🕌 في المسجد
                  </button>
                </div>
              )}

              {/* Done label */}
              {isDone && (
                <p className="text-center text-xs font-semibold" style={{ color: "#3D8C5A" }}>
                  {isMosque ? "🕌 صليتها في المسجد" : "✅ صليتها في وقتها"}
                </p>
              )}

              {/* Missed */}
              {isMissed && (
                <div className="space-y-1.5">
                  <p className="text-center text-xs font-semibold text-red-600">فاتت — أضيفت عقوبة</p>
                  <button onClick={() => markPrayer(p.key, "OnTime")}
                    className="w-full py-1.5 rounded-lg text-[10px] font-semibold text-[#3D8C5A] bg-green-50 border border-green-200 hover:bg-green-100 transition">
                    صليتها متأخرة
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Penalties ═══ */}
      {penalties.length > 0 && (
        <div className="mt-4">
          <GeometricDivider label={`العقوبات المتراكمة (${penalties.length})`} />
          <div className="mt-3 space-y-2">
            {penalties.map(pen => (
              <div key={pen.id}
                className="flex items-center gap-3 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">
                    {prayerLabel(pen.prayer)} — {penaltyLabel(pen.penaltyType)}
                  </p>
                  <p className="text-[10px] text-red-500">{pen.date}</p>
                </div>
                <button onClick={() => fulfillPenalty(pen.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-[#3D8C5A] hover:opacity-80 transition">
                  أديت العقوبة ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Stats Toggle ═══ */}
      <div className="flex gap-2 mt-4">
        <button onClick={() => { setShowStats(!showStats); if (!showStats) loadStats(); }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-gray-200 text-[#6B7280] hover:bg-gray-50">
          📊 {showStats ? "إخفاء الإحصائيات" : "إحصائيات الصلاة"}
        </button>
        <button onClick={() => setShowSettings(!showSettings)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-gray-200 text-[#6B7280] hover:bg-gray-50">
          ⚙ إعدادات الصلوات
        </button>
      </div>

      {/* ═══ Stats Panel ═══ */}
      {showStats && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-[10px] text-[#6B7280]">في الوقت (الأسبوع)</p>
            <p className="text-2xl font-black" style={{ color: stats.weekOnTimePercent >= 80 ? "#3D8C5A" : stats.weekOnTimePercent >= 50 ? "#D4AF37" : "#DC2626" }}>
              {stats.weekOnTimePercent}%
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-[10px] text-[#6B7280]">في المسجد (الأسبوع)</p>
            <p className="text-2xl font-black text-[#2C2C54]">{stats.weekMosquePercent}%</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-[10px] text-[#6B7280]">أطول سلسلة أيام</p>
            <p className="text-2xl font-black text-[#D4AF37]">{stats.longestStreak}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-[10px] text-[#6B7280]">عقوبات معلقة</p>
            <p className="text-2xl font-black" style={{ color: stats.pendingPenalties > 0 ? "#DC2626" : "#3D8C5A" }}>
              {stats.pendingPenalties}
            </p>
          </div>
        </div>
      )}

      {/* ═══ Settings Panel ═══ */}
      {showSettings && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 mt-3 space-y-4 fade-up">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-[#16213E]">إعدادات العقوبات</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] bg-gray-100">إلغاء</button>
              <button onClick={saveSettings} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2C2C54" }}>حفظ</button>
            </div>
          </div>
          {PRAYERS.filter(p => p.key !== "Duha").map(p => (
            <div key={p.key} className="flex items-center gap-3">
              <span className="text-sm w-16 text-right font-medium text-[#16213E]">{p.icon} {p.label}</span>
              <div className="flex gap-1 flex-1 flex-wrap">
                {PENALTY_TYPES.map(t => (
                  <button key={t.key} onClick={() => setPenaltyConfig(prev => ({ ...prev, [p.key]: t.key }))}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium transition"
                    style={{
                      background: (penaltyConfig[p.key] ?? "surah") === t.key ? "#2C2C54" : "#F3F4F6",
                      color: (penaltyConfig[p.key] ?? "surah") === t.key ? "#fff" : "#6B7280",
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-gray-100">
            <div onClick={() => setNotifEnabled(!notifEnabled)}
              className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
              style={{ background: notifEnabled ? "#3D8C5A" : "#E5E7EB" }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ right: notifEnabled ? "0.125rem" : "1.25rem" }} />
            </div>
            <span className="text-sm text-[#16213E]">تفعيل التنبيهات</span>
          </label>
        </div>
      )}
    </>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"active" | "ideas">("active");
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("⭐");
  const [newCat, setNewCat] = useState<Habit["category"]>("worship");
  const [showCelebration, setShowCelebration] = useState(false);
  const [counterHabit, setCounterHabit] = useState<Habit | null>(null);
  const [counterValue, setCounterValue] = useState(0);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editCat, setEditCat] = useState<Habit["category"]>("worship");

  // Load — try API first, fallback to localStorage
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/api/habits");
        if (data && data.length >= 0) {
          const mapped: Habit[] = data.map((h: { id: string; title: string; icon?: string; category?: string; isIdea: boolean; streak: number; todayDone?: boolean; lastCompletedDate?: string }) => ({
            id: h.id,
            title: h.title,
            icon: h.icon ?? "⭐",
            streak: h.streak ?? 0,
            todayDone: h.todayDone ?? (h.lastCompletedDate ? h.lastCompletedDate.slice(0, 10) === new Date().toISOString().slice(0, 10) : false),
            category: (h.category as Habit["category"]) ?? "worship",
            isIdea: h.isIdea,
          }));
          setHabits(mapped);
          localStorage.setItem("madar_habits", JSON.stringify(mapped));
          localStorage.setItem("madar_habits_date", new Date().toDateString());
          return;
        }
      } catch {}
      const saved = localStorage.getItem("madar_habits");
      if (saved) { try { setHabits(JSON.parse(saved)); } catch { setHabits(DEFAULT_HABITS); } }
      else setHabits(DEFAULT_HABITS);
    }
    load();
  }, []);

  function saveLocal(updated: Habit[]) {
    setHabits(updated);
    localStorage.setItem("madar_habits", JSON.stringify(updated));
    localStorage.setItem("madar_habits_date", new Date().toDateString());
    window.dispatchEvent(new Event("madar-update"));
  }

  async function toggle(id: string) {
    const habit = habits.find((h) => h.id === id);
    if (habit && !habit.todayDone) setShowCelebration(true);
    const optimistic = habits.map((h) => {
      if (h.id !== id) return h;
      const nowDone = !h.todayDone;
      return { ...h, todayDone: nowDone, streak: nowDone ? h.streak + 1 : Math.max(0, h.streak - 1) };
    });
    saveLocal(optimistic);
    try {
      const { data } = await api.patch(`/api/habits/${id}/toggle`);
      saveLocal(habits.map((h) => h.id !== id ? optimistic.find(x => x.id === h.id) ?? h : {
        ...h, todayDone: data.todayDone ?? !h.todayDone, streak: data.streak ?? h.streak,
      }));
    } catch {}
  }

  async function addHabit() {
    if (!newTitle.trim()) return;
    try {
      const { data } = await api.post("/api/habits", { title: newTitle.trim(), icon: newIcon, category: newCat, isIdea: false });
      const newH: Habit = { id: data.id, title: data.title ?? newTitle.trim(), icon: data.icon ?? newIcon, streak: 0, todayDone: false, category: newCat, isIdea: false };
      saveLocal([...habits, newH]);
    } catch {
      saveLocal([...habits, { id: Date.now().toString(), title: newTitle.trim(), icon: newIcon, streak: 0, todayDone: false, category: newCat, isIdea: false }]);
    }
    setNewTitle(""); setShowAdd(false);
  }

  function removeHabit(id: string) {
    if (!confirm("حذف هذه العادة؟")) return;
    saveLocal(habits.filter((h) => h.id !== id));
    api.delete(`/api/habits/${id}`).catch(() => {});
  }

  function toggleIdea(id: string) {
    saveLocal(habits.map((h) => h.id === id ? { ...h, isIdea: !h.isIdea } : h));
    api.patch(`/api/habits/${id}/idea`).catch(() => {});
  }

  function startEdit(h: Habit) {
    setEditId(h.id); setEditTitle(h.title); setEditIcon(h.icon); setEditCat(h.category);
  }

  function saveEdit() {
    if (!editId || !editTitle.trim()) return;
    saveLocal(habits.map((h) => h.id === editId ? { ...h, title: editTitle.trim(), icon: editIcon, category: editCat } : h));
    setEditId(null);
  }

  function resetStreak(id: string) {
    saveLocal(habits.map((h) => h.id === id ? { ...h, streak: 0 } : h));
  }

  // Tasbih
  const [showTasbih, setShowTasbih] = useState(false);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [tasbihTarget, setTasbihTarget] = useState(33);
  const TASBIH_OPTIONS = ["سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله", "لا حول ولا قوة إلا بالله"];

  function tasbihTap() {
    setTasbihCount(c => c + 1);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; gain.gain.value = 0.05;
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  const activeHabits = habits.filter((h) => !h.isIdea);
  const doneCount = activeHabits.filter((h) => h.todayDone).length;
  const pct = activeHabits.length === 0 ? 0 : Math.round((doneCount / activeHabits.length) * 100);

  const filteredHabits = habits.filter((h) => tab === "ideas" ? h.isIdea : !h.isIdea);
  const grouped = Object.entries(CATEGORIES).map(([key, meta]) => ({
    key, ...meta,
    habits: filteredHabits.filter((h) => h.category === key),
  }));

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {showCelebration && <CelebrationOverlay onDone={() => setShowCelebration(false)} />}

      {/* Tasbih */}
      {showTasbih && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
          style={{ background: "linear-gradient(135deg, #0a1f10 0%, #1A1A2E 100%)" }}
          onClick={tasbihTap}>
          <button onClick={(e) => { e.stopPropagation(); setShowTasbih(false); setTasbihCount(0); }}
            className="absolute top-6 left-6 text-white/40 hover:text-white text-sm z-10">✕ إغلاق</button>
          <div className="w-52 h-52 rounded-full flex items-center justify-center mb-6"
            style={{ background: "linear-gradient(135deg, #D4AF37, #E8C96A)", boxShadow: "0 0 80px rgba(212,175,55,0.25)" }}>
            <span className="text-7xl font-black text-[#0a1f10] select-none">{tasbihCount}</span>
          </div>
          <p className="text-white/20 text-sm mb-4">اضغط في أي مكان للعد</p>
          <div className="w-48 bg-white/10 rounded-full h-2 overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (tasbihCount / tasbihTarget) * 100)}%`, background: "#D4AF37" }} />
          </div>
          <p className="text-white/30 text-[11px]">{tasbihCount} / {tasbihTarget}</p>
          <div className="absolute bottom-8 flex gap-2" onClick={(e) => e.stopPropagation()}>
            {[33, 100, 1000].map((n) => (
              <button key={n} onClick={() => { setTasbihTarget(n); setTasbihCount(0); }}
                className="px-3 py-1.5 rounded-lg text-xs transition"
                style={{ background: tasbihTarget === n ? "#D4AF3730" : "rgba(255,255,255,0.05)", color: tasbihTarget === n ? "#D4AF37" : "rgba(255,255,255,0.3)" }}>
                {n}
              </button>
            ))}
            <button onClick={() => setTasbihCount(0)}
              className="px-3 py-1.5 rounded-lg text-xs text-red-400/50 hover:text-red-400 transition" style={{ background: "rgba(255,255,255,0.05)" }}>
              إعادة
            </button>
          </div>
        </div>
      )}

      {/* Counter overlay */}
      {counterHabit && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #2C2C54 100%)" }}>
          <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
            <button onClick={() => { setCounterHabit(null); setCounterValue(0); }}
              className="absolute top-6 left-6 text-white/40 hover:text-white text-sm">✕ إغلاق</button>
            <span className="text-6xl">{counterHabit.icon}</span>
            <p className="text-white font-bold text-xl text-center">{counterHabit.title}</p>
            <div className="relative">
              <button onClick={() => setCounterValue((v) => v + 1)}
                className="w-48 h-48 rounded-full flex items-center justify-center transition-transform active:scale-95"
                style={{ background: "linear-gradient(135deg, #D4AF37, #E8C96A)", boxShadow: "0 0 60px rgba(212,175,55,0.3)" }}>
                <span className="text-7xl font-black text-[#1A1A2E] select-none">{counterValue}</span>
              </button>
            </div>
            <p className="text-white/40 text-sm">اضغط للعد</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setCounterValue(0)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/50 border border-white/20 hover:bg-white/10 transition">
                إعادة تعيين
              </button>
              <button onClick={() => { toggle(counterHabit.id); setCounterHabit(null); setCounterValue(0); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-[#1A1A2E] transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #D4AF37, #E8C96A)" }}>
                أتممتها ✓
              </button>
            </div>
            {counterHabit.streak > 0 && (
              <p className="text-white/30 text-xs">🔥 سلسلة {counterHabit.streak} يوم</p>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">العادات اليومية</h2>
            <p className="text-[#6B7280] text-xs">{doneCount} من {activeHabits.length} مكتملة اليوم</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTasbih(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={{ background: "linear-gradient(135deg, #3D8C5A, #D4AF37)", color: "#fff" }}>
              📿 مسبحة
            </button>
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              <span>+</span><span>عادة جديدة</span>
            </button>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">
        {/* ═══ Prayer Section (top) ═══ */}
        <PrayerSection />

        {/* Tabs */}
        <div className="flex gap-2 mt-6">
          <button onClick={() => setTab("active")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: tab === "active" ? "#2C2C54" : "#F3F4F6", color: tab === "active" ? "#fff" : "#6B7280" }}>
            عادات نشطة ({habits.filter(h => !h.isIdea).length})
          </button>
          <button onClick={() => setTab("ideas")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: tab === "ideas" ? "#D4AF37" : "#F3F4F6", color: tab === "ideas" ? "#fff" : "#6B7280" }}>
            أفكار عادات ({habits.filter(h => h.isIdea).length})
          </button>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#6B7280]">إنجاز اليوم</span>
            <span className="font-bold text-[#2C2C54]">{pct}%</span>
          </div>
          <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #2C2C54, #D4AF37)" }} />
          </div>
          {pct === 100 && activeHabits.length > 0 && (
            <p className="text-center text-[#3D8C5A] text-xs font-bold mt-2">🎉 أتممت كل العادات اليوم — بارك الله فيك!</p>
          )}
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm fade-up space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-sm text-[#16213E]">عادة جديدة</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={addHabit} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2C2C54" }}>إضافة</button>
              </div>
            </div>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="اسم العادة…"
              onKeyDown={(e) => { if (e.key === "Enter") addHabit(); }}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setNewIcon(ic)}
                  className="w-9 h-9 rounded-lg text-lg" style={{ background: newIcon === ic ? "#D4AF3720" : "#F3F4F6", border: newIcon === ic ? "2px solid #D4AF37" : "none" }}>
                  {ic}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <button key={k} onClick={() => setNewCat(k as Habit["category"])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: newCat === k ? v.color : "#F3F4F6", color: newCat === k ? "#fff" : "#6B7280" }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Habits by category */}
        {grouped.map((cat) => (
          cat.habits.length > 0 && (
            <section key={cat.key}>
              <GeometricDivider label={cat.label} />
              <div className="mt-3 space-y-2">
                {cat.habits.map((h) => (
                  <div key={h.id}>
                    {editId === h.id ? (
                      <div className="bg-white rounded-xl px-5 py-4 border-2 border-[#D4AF37] space-y-3 fade-up">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-xs text-[#16213E]">تعديل العادة</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditId(null)} className="px-3 py-1 rounded-lg text-[10px] font-semibold text-[#6B7280] bg-gray-100">إلغاء</button>
                            <button onClick={saveEdit} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#2C2C54" }}>حفظ</button>
                          </div>
                        </div>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                          autoFocus />
                        <div className="flex gap-1.5 flex-wrap">
                          {ICONS.map((ic) => (
                            <button key={ic} onClick={() => setEditIcon(ic)}
                              className="w-8 h-8 rounded-lg text-base" style={{ background: editIcon === ic ? "#D4AF3720" : "#F3F4F6", border: editIcon === ic ? "2px solid #D4AF37" : "none" }}>
                              {ic}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {Object.entries(CATEGORIES).map(([k, v]) => (
                            <button key={k} onClick={() => setEditCat(k as Habit["category"])}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                              style={{ background: editCat === k ? v.color : "#F3F4F6", color: editCat === k ? "#fff" : "#6B7280" }}>
                              {v.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => { resetStreak(h.id); setEditId(null); }}
                          className="w-full py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition">إعادة تعيين السلسلة</button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-4 bg-white rounded-xl px-5 py-4 border transition-all cursor-pointer hover:shadow-sm ${h.todayDone ? "opacity-60" : ""}`}
                        style={{ borderColor: h.todayDone ? cat.color + "40" : "#E5E7EB" }}
                        onClick={() => toggle(h.id)}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all`}
                          style={{ borderColor: cat.color, background: h.todayDone ? cat.color : "transparent" }}>
                          {h.todayDone && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <span className="text-xl">{h.icon}</span>
                        <span className={`flex-1 text-sm font-medium ${h.todayDone ? "line-through text-[#9CA3AF]" : "text-[#16213E]"}`}>{h.title}</span>
                        {h.streak > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${cat.color}12`, color: cat.color }}>
                            🔥 {h.streak}
                          </span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setCounterHabit(h); setCounterValue(0); }}
                          className="text-[10px] text-[#6B7280] hover:text-[#D4AF37] transition" title="عداد">
                          🔢
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); startEdit(h); }}
                          className="text-[10px] text-[#6B7280] hover:text-[#D4AF37] transition" title="تعديل">
                          ✏️
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleIdea(h.id); }}
                          className="text-[10px] text-[#6B7280] hover:text-[#D4AF37] transition" title={h.isIdea ? "تنشيط" : "نقل للأفكار"}>
                          {h.isIdea ? "▶ تنشيط" : "💡"}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeHabit(h.id); }}
                          className="text-[#9CA3AF] hover:text-red-400 text-xs transition">✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        ))}

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
