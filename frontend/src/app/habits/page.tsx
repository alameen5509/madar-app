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

/* ─── Hygiene Habits (النظافة الشخصية) ───────────────────────────── */

interface HygieneHabit { id: string; title: string; icon: string; enabled: boolean; todayDone: boolean; streak: number }

const DEFAULT_HYGIENE: HygieneHabit[] = [
  { id: "h1", title: "الاستحمام", icon: "🚿", enabled: true, todayDone: false, streak: 0 },
  { id: "h2", title: "السواك / تنظيف الأسنان", icon: "🪥", enabled: true, todayDone: false, streak: 0 },
  { id: "h3", title: "غسل الوجه", icon: "🧴", enabled: true, todayDone: false, streak: 0 },
  { id: "h4", title: "تقليم الأظافر", icon: "💅", enabled: false, todayDone: false, streak: 0 },
  { id: "h5", title: "تسريح الشعر", icon: "💇", enabled: true, todayDone: false, streak: 0 },
  { id: "h6", title: "التطيّب / العطر", icon: "🌸", enabled: true, todayDone: false, streak: 0 },
  { id: "h7", title: "غسل اليدين", icon: "🧼", enabled: true, todayDone: false, streak: 0 },
  { id: "h8", title: "تنظيف الأذن", icon: "👂", enabled: false, todayDone: false, streak: 0 },
  { id: "h9", title: "ارتداء ملابس نظيفة", icon: "👕", enabled: true, todayDone: false, streak: 0 },
  { id: "h10", title: "ترتيب الفراش", icon: "🛏️", enabled: true, todayDone: false, streak: 0 },
  { id: "h11", title: "الاستنشاق والاستنثار", icon: "💨", enabled: false, todayDone: false, streak: 0 },
  { id: "h12", title: "غسل القدمين", icon: "🦶", enabled: false, todayDone: false, streak: 0 },
  { id: "h13", title: "إزالة شعر الإبط والعانة", icon: "✂️", enabled: false, todayDone: false, streak: 0 },
  { id: "h14", title: "وضع مزيل العرق", icon: "🧴", enabled: true, todayDone: false, streak: 0 },
  { id: "h15", title: "ترطيب البشرة", icon: "💧", enabled: false, todayDone: false, streak: 0 },
];

function HygieneSection() {
  const STORAGE_KEY = "madar_hygiene";
  const DATE_KEY = "madar_hygiene_date";

  const [habits, setHabits] = useState<HygieneHabit[]>(() => {
    if (typeof window === "undefined") return DEFAULT_HYGIENE;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as HygieneHabit[] | null;
      if (!saved) return DEFAULT_HYGIENE;
      // Merge: keep saved + add any new defaults
      const savedIds = new Set(saved.map(h => h.id));
      const newDefaults = DEFAULT_HYGIENE.filter(d => !savedIds.has(d.id));
      return [...saved, ...newDefaults];
    } catch { return DEFAULT_HYGIENE; }
  });
  const [showManage, setShowManage] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  // Reset todayDone at start of new day
  useEffect(() => {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem(DATE_KEY);
    if (lastDate !== today) {
      setHabits(prev => {
        const reset = prev.map(h => ({ ...h, todayDone: false }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
        localStorage.setItem(DATE_KEY, today);
        return reset;
      });
    }
  }, []);

  function save(updated: HygieneHabit[]) {
    setHabits(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function toggle(id: string) {
    save(habits.map(h => {
      if (h.id !== id) return h;
      const done = !h.todayDone;
      return { ...h, todayDone: done, streak: done ? h.streak + 1 : Math.max(0, h.streak - 1) };
    }));
  }

  function toggleEnabled(id: string) {
    save(habits.map(h => h.id === id ? { ...h, enabled: !h.enabled } : h));
  }

  function addCustom() {
    if (!customTitle.trim()) return;
    const newH: HygieneHabit = { id: "hc_" + Date.now(), title: customTitle.trim(), icon: "✨", enabled: true, todayDone: false, streak: 0 };
    save([...habits, newH]);
    setCustomTitle(""); setShowAddCustom(false);
  }

  function removeCustom(id: string) {
    if (!id.startsWith("hc_")) return; // only custom ones
    save(habits.filter(h => h.id !== id));
  }

  const active = habits.filter(h => h.enabled);
  const doneCount = active.filter(h => h.todayDone).length;
  const pct = active.length === 0 ? 0 : Math.round((doneCount / active.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧼</span>
          <span className="text-sm font-bold" style={{ color: "var(--text, #16213E)" }}>النظافة الشخصية</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#0F346015", color: "#0F3460" }}>{doneCount}/{active.length}</span>
        </div>
        <button onClick={() => setShowManage(!showManage)} className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition"
          style={{ background: showManage ? "#0F3460" : "#0F346010", color: showManage ? "#fff" : "#0F3460" }}>
          {showManage ? "تم" : "إدارة"}
        </button>
      </div>

      {/* Progress */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#0F346015" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#0F3460" }} />
      </div>

      {/* Manage mode */}
      {showManage && (
        <div className="rounded-xl border p-3 space-y-1" style={{ background: "var(--bg, #FDFAF6)", borderColor: "#0F346020" }}>
          <p className="text-[10px] font-bold mb-2" style={{ color: "var(--muted, #6B7280)" }}>فعّل أو أخفِ العادات:</p>
          {habits.map(h => (
            <div key={h.id} className="flex items-center gap-2 py-1">
              <button onClick={() => toggleEnabled(h.id)}
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition"
                style={{ background: h.enabled ? "#0F3460" : "#E5E7EB" }}>
                {h.enabled && <span className="text-white text-[9px]">✓</span>}
              </button>
              <span className="text-sm">{h.icon}</span>
              <span className="flex-1 text-xs" style={{ color: h.enabled ? "var(--text, #16213E)" : "var(--muted, #9CA3AF)" }}>{h.title}</span>
              {h.id.startsWith("hc_") && (
                <button onClick={() => { if (confirm("حذف؟")) removeCustom(h.id); }} className="text-[9px]" style={{ color: "#DC2626" }}>🗑️</button>
              )}
            </div>
          ))}
          {/* Add custom */}
          {showAddCustom ? (
            <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: "1px solid #0F346015" }}>
              <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="عادة جديدة..."
                onKeyDown={e => { if (e.key === "Enter") addCustom(); }}
                className="flex-1 px-2 py-1.5 rounded-lg border text-xs focus:outline-none" style={{ background: "var(--card, #fff)", borderColor: "var(--card-border, #E5E7EB)", color: "var(--text)" }} autoFocus />
              <button onClick={addCustom} disabled={!customTitle.trim()} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#0F3460" }}>+</button>
              <button onClick={() => { setShowAddCustom(false); setCustomTitle(""); }} className="text-[10px]" style={{ color: "var(--muted)" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddCustom(true)} className="w-full mt-2 pt-2 text-[10px] font-bold text-center" style={{ color: "#0F3460", borderTop: "1px solid #0F346015" }}>
              + إضافة عادة مخصصة
            </button>
          )}
        </div>
      )}

      {/* Active habits */}
      {!showManage && (
        <div className="space-y-1.5">
          {active.map(h => (
            <div key={h.id} onClick={() => toggle(h.id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all cursor-pointer hover:shadow-sm ${h.todayDone ? "opacity-60" : ""}`}
              style={{ background: "var(--card, #fff)", borderColor: h.todayDone ? "#0F346040" : "var(--card-border, #E5E7EB)" }}>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                style={{ borderColor: "#0F3460", background: h.todayDone ? "#0F3460" : "transparent" }}>
                {h.todayDone && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className="text-lg">{h.icon}</span>
              <span className={`flex-1 text-sm font-medium ${h.todayDone ? "line-through" : ""}`} style={{ color: h.todayDone ? "var(--muted, #9CA3AF)" : "var(--text, #16213E)" }}>{h.title}</span>
              {h.streak > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#0F346012", color: "#0F3460" }}>🔥 {h.streak}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Prayer Types ────────────────────────────────────────────────────── */

const PRAYERS = [
  { key: "Fajr",    label: "الفجر",   icon: "🌅" },
  { key: "Dhuhr",   label: "الظهر",   icon: "🌤️" },
  { key: "Asr",     label: "العصر",   icon: "🌇" },
  { key: "Maghrib", label: "المغرب",  icon: "🌆" },
  { key: "Isha",    label: "العشاء",  icon: "🌙" },
] as const;

type PrayerKey = typeof PRAYERS[number]["key"];

interface PrayerLogState { onTime: boolean; inMosque: boolean; expired: boolean; }
interface PrayerState { [key: string]: PrayerLogState; }

interface Penalty {
  id: string; date: string; prayer: string; reason: string;
  penaltyType: string; penaltyDetail?: string;
}

interface PrayerStats {
  weekOnTimePercent: number; weekMosquePercent: number;
  longestStreak: number; pendingPenalties: number;
}

const PENALTY_TYPES = [
  { key: "quran",   label: "ورد من القرآن" },
  { key: "nafila",  label: "صلاة نافلة" },
  { key: "istighfar", label: "استغفار ١٠٠ مرة" },
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

const CITIES: Record<string, { label: string; lat: string; lng: string }> = {
  riyadh: { label: "الرياض", lat: "24.7136", lng: "46.6753" },
  madinah: { label: "المدينة المنورة", lat: "24.4672", lng: "39.6024" },
  makkah: { label: "مكة المكرمة", lat: "21.4225", lng: "39.8262" },
  jeddah: { label: "جدة", lat: "21.5433", lng: "39.1728" },
  dammam: { label: "الدمام", lat: "26.4207", lng: "50.0888" },
  tabuk: { label: "تبوك", lat: "28.3838", lng: "36.5550" },
  abha: { label: "أبها", lat: "18.2164", lng: "42.5053" },
};

function TasbihCounter({ target, label, onComplete, onClose }: { target: number; label: string; onComplete: () => void; onClose: () => void }) {
  const [count, setCount] = useState(0);
  const pct = Math.min(100, Math.round((count / target) * 100));

  function tap() {
    const next = count + 1;
    setCount(next);
    if (next >= target) {
      setTimeout(() => { onComplete(); }, 400);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl text-center" dir="rtl" style={{ background: "linear-gradient(180deg, #1A1830, #2C2C54)" }}>
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <button onClick={onClose} className="text-white/40 text-lg hover:text-white/70 transition">✕</button>
            <p className="text-white/60 text-xs font-medium">{label}</p>
            <span className="text-white/40 text-xs">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: count >= target ? "#3D8C5A" : "linear-gradient(90deg, #D4AF37, #C9A84C)" }} />
          </div>
        </div>

        <div className="pb-8">
          <button onClick={tap} disabled={count >= target}
            className="w-40 h-40 rounded-full mx-auto flex flex-col items-center justify-center transition-all active:scale-95 disabled:opacity-50"
            style={{ background: count >= target ? "linear-gradient(135deg, #3D8C5A, #2C8C4A)" : "linear-gradient(135deg, #D4AF37, #5E5495)", boxShadow: "0 0 40px rgba(212,175,55,0.3)" }}>
            <span className="text-5xl font-black text-white">{count}</span>
            <span className="text-white/70 text-xs mt-1">{count >= target ? "✓ تم" : `من ${target}`}</span>
          </button>
          <p className="text-white/50 text-[10px] mt-4">📿 اضغط للتسبيح</p>
          {count > 0 && count < target && (
            <p className="text-white/30 text-[10px] mt-1">باقي {target - count}</p>
          )}
          {count >= target && (
            <p className="text-[#3D8C5A] text-sm font-bold mt-3 animate-pulse">بارك الله فيك ✓</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PrayerSection() {
  const [prayerState, setPrayerState] = useState<PrayerState>({});
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [stats, setStats] = useState<PrayerStats | null>(null);
  const [salahTimes, setSalahTimes] = useState<Record<string, string> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tasbih, setTasbih] = useState<{ penaltyId: string } | null>(null);
  const [penaltyConfig, setPenaltyConfig] = useState<Record<string, string>>({});
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [city, setCity] = useState<string>(() => {
    if (typeof window === "undefined") return "riyadh";
    return localStorage.getItem("madar_prayer_city") ?? "auto";
  });

  // Interactive question flow state — persisted in localStorage
  const WIZARD_KEY = "madar_prayer_wizard";
  const WIZARD_DATE_KEY = "madar_prayer_wizard_date";

  function loadWizardState() {
    if (typeof window === "undefined") return { steps: {}, waiting: {}, waitingS: {}, answers: {} };
    try {
      const today = new Date().toDateString();
      if (localStorage.getItem(WIZARD_DATE_KEY) !== today) {
        localStorage.removeItem(WIZARD_KEY);
        localStorage.setItem(WIZARD_DATE_KEY, today);
        return { steps: {}, waiting: {}, waitingS: {}, answers: {} };
      }
      return JSON.parse(localStorage.getItem(WIZARD_KEY) ?? "null") ?? { steps: {}, waiting: {}, waitingS: {}, answers: {} };
    } catch { return { steps: {}, waiting: {}, waitingS: {}, answers: {} }; }
  }

  const initial = loadWizardState();
  const [prayerSteps, setPrayerSteps] = useState<Record<string, number>>(initial.steps);
  const [waitingPrayed, setWaitingPrayed] = useState<Record<string, boolean>>(initial.waiting);
  const [waitingSunnah, setWaitingSunnah] = useState<Record<string, boolean>>(initial.waitingS);
  const [prayerAnswers, setPrayerAnswers] = useState<Record<string, { inMosque: boolean; onTime: boolean }>>(initial.answers);

  // Save wizard state to localStorage on every change
  useEffect(() => {
    localStorage.setItem(WIZARD_KEY, JSON.stringify({ steps: prayerSteps, waiting: waitingPrayed, waitingS: waitingSunnah, answers: prayerAnswers }));
  }, [prayerSteps, waitingPrayed, waitingSunnah, prayerAnswers]);

  const loadSalahTimes = useCallback((selectedCity: string) => {
    if (selectedCity === "auto") {
      if (!navigator.geolocation) {
        api.get("/api/salah/today?lat=24.7136&lng=46.6753").then(({ data }) => setSalahTimes(data)).catch(() => {});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => { api.get(`/api/salah/today?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`).then(({ data }) => setSalahTimes(data)).catch(() => {}); },
        () => { api.get("/api/salah/today?lat=24.7136&lng=46.6753").then(({ data }) => setSalahTimes(data)).catch(() => {}); }
      );
    } else {
      const c = CITIES[selectedCity];
      if (c) api.get(`/api/salah/today?lat=${c.lat}&lng=${c.lng}`).then(({ data }) => setSalahTimes(data)).catch(() => {});
    }
  }, []);

  useEffect(() => { loadSalahTimes(city); }, [city, loadSalahTimes]);

  function changeCity(newCity: string) {
    setCity(newCity);
    localStorage.setItem("madar_prayer_city", newCity);
    loadSalahTimes(newCity);
  }

  // Load today's prayer logs
  const loadToday = useCallback(() => {
    api.get("/api/prayer-tracking/today").then(({ data }) => {
      const state: PrayerState = {};
      for (const log of data as { prayer: string; prayedOnTime: boolean; prayedInMosque: boolean }[]) {
        state[log.prayer] = { onTime: log.prayedOnTime, inMosque: log.prayedInMosque, expired: false };
      }
      setPrayerState(state);
    }).catch(() => {});
  }, []);

  const loadPenalties = useCallback(() => {
    api.get("/api/prayer-tracking/penalties").then(({ data }) => {
      setPenalties((data?.penalties ?? data ?? []) as Penalty[]);
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

  // Check for expired prayers every minute
  useEffect(() => {
    if (!salahTimes) return;
    const check = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

      const prayerEndMap: Record<string, number> = {
        Fajr:    toMin(salahTimes.shuruq),
        Dhuhr:   toMin(salahTimes.asr),
        Asr:     toMin(salahTimes.maghrib),
        Maghrib: toMin(salahTimes.isha),
        Isha:    23 * 60 + 59,
      };

      for (const p of PRAYERS) {
        const endTime = prayerEndMap[p.key];
        if (endTime && nowMins > endTime) {
          const cur = prayerState[p.key];
          if (!cur || (!cur.onTime && !cur.inMosque && !cur.expired)) {
            // Time passed — call expire to create penalties for unchecked fields
            api.post("/api/prayer-tracking/expire", { prayer: p.key, date: today })
              .then(() => { loadToday(); loadPenalties(); loadStats(); })
              .catch(() => {});
            // Mark as expired locally so we don't re-call
            setPrayerState(prev => ({
              ...prev,
              [p.key]: { ...(prev[p.key] ?? { onTime: false, inMosque: false }), expired: true },
            }));
          }
        }
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [salahTimes, prayerState, loadToday, loadPenalties, loadStats]);

  async function togglePrayer(prayer: string, field: "onTime" | "inMosque") {
    const cur = prayerState[prayer] ?? { onTime: false, inMosque: false, expired: false };
    const newVal = !(field === "onTime" ? cur.onTime : cur.inMosque);
    // Optimistic
    setPrayerState(prev => ({
      ...prev,
      [prayer]: { ...cur, [field]: newVal },
    }));
    try {
      await api.post("/api/prayer-tracking/toggle", { prayer, field, value: newVal });
      loadPenalties();
      loadStats();
    } catch {
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
      Dhuhr: toMin(salahTimes.dhuhr),
      Asr: toMin(salahTimes.asr),
      Maghrib: toMin(salahTimes.maghrib),
      Isha: toMin(salahTimes.isha),
    };
    const endMap: Record<string, number> = {
      Fajr: toMin(salahTimes.shuruq),
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
      Fajr: salahTimes.fajr,
      Dhuhr: salahTimes.dhuhr, Asr: salahTimes.asr,
      Maghrib: salahTimes.maghrib, Isha: salahTimes.isha,
    };
    return map[prayerKey] ?? "";
  }

  const prayerLabel = (key: string) => PRAYERS.find(p => p.key === key)?.label ?? key;
  const penaltyLabel = (type: string) => PENALTY_TYPES.find(t => t.key === type)?.label ?? type;
  const reasonLabel = (r: string) => r === "not_on_time" ? "لم تُصلَّ في الوقت" : "لم تُصلَّ في المسجد";

  function setStep(pk: string, s: number) { setPrayerSteps(prev => ({ ...prev, [pk]: s })); }

  async function finalizePrayer(pk: string, ans: { inMosque: boolean; onTime: boolean }) {
    setPrayerState(prev => ({ ...prev, [pk]: { onTime: ans.onTime, inMosque: ans.inMosque, expired: false } }));
    try { await api.post("/api/prayer-tracking/toggle", { prayer: pk, field: "onTime", value: ans.onTime }); await api.post("/api/prayer-tracking/toggle", { prayer: pk, field: "inMosque", value: ans.inMosque }); loadPenalties(); loadStats(); } catch { loadToday(); }
    setStep(pk, 5);
  }

  function renderPrayerCard(p: typeof PRAYERS[number]) {
    const timeStr = getPrayerTimeStr(p.key);
    const isCurrent = getPrayerTimeStatus(p.key) === "current";
    const isPast = getPrayerTimeStatus(p.key) === "past";
    const step = prayerSteps[p.key] ?? 0;
    const isW = waitingPrayed[p.key] ?? false;
    const isWS = waitingSunnah[p.key] ?? false;
    const ans = prayerAnswers[p.key] ?? { inMosque: false, onTime: false };
    if (step === 5) return null;
    return (
      <div key={p.key} className="rounded-xl p-4 border-2 shadow-sm space-y-3" style={{ borderColor: isCurrent ? "#D4AF37" : isPast && step === 0 ? "#DC2626" : "#D4AF3780", background: isPast && step === 0 ? "#FEF2F2" : "var(--card, #fff)" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{p.icon}</span>
          <div className="flex-1"><p className="text-sm font-bold" style={{ color: "#16213E" }}>{p.label}</p>{timeStr && <p className="text-[10px]" style={{ color: "#6B7280" }}>{timeStr}</p>}</div>
          {isCurrent && <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />}
          {isPast && step === 0 && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#FEE2E2", color: "#DC2626" }}>انتهى الوقت</span>}
          {step > 0 && step < 5 && <div className="flex gap-1">{[1,2,3,4].map(s => <div key={s} className="w-1.5 h-1.5 rounded-full" style={{ background: s <= step ? "#D4AF37" : "#E5E7EB" }} />)}</div>}
        </div>
        {step === 0 && (<div className="space-y-2"><p className="text-sm font-bold text-center" style={{ color: "#16213E" }}>هل صليت {p.label}؟</p>
          {isW ? (<><button onClick={() => { setWaitingPrayed(prev => ({ ...prev, [p.key]: false })); setStep(p.key, 2); }} className="w-full py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #3D8C5A, #2C8C4A)", color: "#fff" }}>صليت ✅</button><p className="text-xs text-center animate-pulse" style={{ color: "#D4AF37" }}>بانتظارك...</p></>) : (
            <div className="flex gap-2"><button onClick={() => setStep(p.key, 2)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #3D8C5A, #2C8C4A)", color: "#fff" }}>نعم صليت ✅</button><button onClick={() => setWaitingPrayed(prev => ({ ...prev, [p.key]: true }))} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #5E5495, #2C2C54)", color: "#fff" }}>لا — سأصلي الآن</button></div>)}
        </div>)}
        {step === 2 && (<div className="space-y-2"><p className="text-sm font-bold text-center" style={{ color: "#16213E" }}>هل صليت في المسجد؟</p><div className="flex gap-2"><button onClick={() => { setPrayerAnswers(prev => ({ ...prev, [p.key]: { ...ans, inMosque: true } })); setStep(p.key, 3); }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #2C2C54, #5E5495)", color: "#fff" }}>نعم — في المسجد 🕌</button><button onClick={() => { setPrayerAnswers(prev => ({ ...prev, [p.key]: { ...ans, inMosque: false } })); setStep(p.key, 3); }} className="flex-1 py-3 rounded-xl text-sm font-bold border-2" style={{ background: "transparent", borderColor: "#2C2C54", color: "#2C2C54" }}>لا</button></div></div>)}
        {step === 3 && (<div className="space-y-2"><p className="text-sm font-bold text-center" style={{ color: "#16213E" }}>هل صليت في الوقت؟</p><div className="flex gap-2"><button onClick={() => { setPrayerAnswers(prev => ({ ...prev, [p.key]: { ...ans, onTime: true } })); setStep(p.key, 4); }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #D4AF37, #B8912A)", color: "#fff" }}>نعم — في الوقت ⏰</button><button onClick={() => { setPrayerAnswers(prev => ({ ...prev, [p.key]: { ...ans, onTime: false } })); setStep(p.key, 4); }} className="flex-1 py-3 rounded-xl text-sm font-bold border-2" style={{ background: "transparent", borderColor: "#D4AF37", color: "#B8912A" }}>لا — بعد الوقت</button></div></div>)}
        {step === 4 && (<div className="space-y-2">
          <p className="text-sm font-semibold text-center" style={{ color: "#D4AF37" }}>💡 السنن الرواتب (اختيارية)</p>
          <p className="text-[10px] text-center" style={{ color: "#9CA3AF" }}>«من صلى ١٢ ركعة في يوم بُني له بيت في الجنة» — مسلم</p>
          {isWS ? (<>
            <button onClick={() => { setWaitingSunnah(prev => ({ ...prev, [p.key]: false })); finalizePrayer(p.key, ans); }} className="w-full py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #3D8C5A, #2C8C4A)", color: "#fff" }}>أديتها ✅</button>
            <button onClick={() => { setWaitingSunnah(prev => ({ ...prev, [p.key]: false })); finalizePrayer(p.key, ans); }} className="w-full py-2 rounded-xl text-xs font-medium" style={{ color: "#9CA3AF" }}>تخطي ←</button>
            <p className="text-xs text-center animate-pulse" style={{ color: "#D4AF37" }}>بانتظارك...</p>
          </>) : (
            <div className="flex gap-2">
              <button onClick={() => finalizePrayer(p.key, ans)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #3D8C5A, #2C8C4A)", color: "#fff" }}>أديتها ✅</button>
              <button onClick={() => setWaitingSunnah(prev => ({ ...prev, [p.key]: true }))} className="flex-1 py-3 rounded-xl text-sm font-bold border" style={{ background: "transparent", borderColor: "#D4AF3740", color: "#D4AF37" }}>سأؤديها الآن</button>
            </div>
          )}
          <button onClick={() => finalizePrayer(p.key, ans)} className="w-full py-2 rounded-xl text-xs font-medium transition hover:bg-gray-50" style={{ color: "#9CA3AF" }}>تخطي — لن أصليها الآن ←</button>
        </div>)}
      </div>
    );
  }

  return (
    <>
      <GeometricDivider label="الصلوات" />
      {(() => {
        const visible = PRAYERS.filter(p => {
          const step = prayerSteps[p.key] ?? 0;
          if (step === 5) return false;
          const timeStatus = getPrayerTimeStatus(p.key);
          if (timeStatus === "future") return false;
          if (timeStatus === "past") {
            // الماضية: تظهر فقط إذا لم تُسجّل بعد
            const cur = prayerState[p.key];
            if (!cur || (!cur.onTime && !cur.inMosque && !cur.expired)) return true; // لم تُسجّل
            if (cur.onTime && cur.inMosque) return false; // مكتملة
            return true; // سُجّل جزئياً
          }
          const cur = prayerState[p.key];
          if (cur && cur.onTime && cur.inMosque) return false;
          return true;
        });
        const done = PRAYERS.length - visible.length;
        return (<>
          {done > 0 && <div className="flex items-center gap-2 mt-3 px-1"><span className="text-sm">🌟</span><p className="text-xs text-[#3D8C5A] font-semibold">{done === PRAYERS.length ? "بارك الله فيك — أتممت جميع الصلوات اليوم" : `${done} من ${PRAYERS.length} صلوات مكتملة`}</p></div>}
          {visible.length > 0 && (
              <div className="space-y-3 mt-3">
                {visible.map(p => renderPrayerCard(p))}
              </div>
            )}
          </>);
      })()}

      {/* ═══ Penalties — all shown, sorted oldest first ═══ */}
      {penalties.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2"><span className="text-lg">⚠️</span><span className="text-sm font-bold text-red-800">لديك {penalties.length} عقوبة متراكمة</span></div>
          {[...penalties].sort((a, b) => a.date.localeCompare(b.date)).map(pen => {
            const pIcon = PRAYERS.find(pr => pr.key === pen.prayer)?.icon ?? "🕌";
            return (
              <div key={pen.id} className="rounded-xl p-5 border-2 border-red-300 shadow-sm" style={{ background: "#fff" }}>
                <div className="flex items-center gap-3 mb-4"><span className="text-3xl">{pIcon}</span><div><p className="text-base font-bold" style={{ color: "#16213E" }}>{prayerLabel(pen.prayer)}</p><p className="text-xs text-red-500">{reasonLabel(pen.reason)} — {pen.date}</p></div></div>
                <p className="text-xs font-semibold mb-2" style={{ color: "#6B7280" }}>اختر عقوبتك وأدِّها:</p>
                <div className="grid grid-cols-3 gap-2">
                  {PENALTY_TYPES.map(t => (
                    <button key={t.key} onClick={() => {
                      if (t.key === "istighfar") { setTasbih({ penaltyId: pen.id }); }
                      else { fulfillPenalty(pen.id); }
                    }} className="py-3.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 border-2" style={{ background: "linear-gradient(135deg, #2C2C54, #5E5495)", color: "white", borderColor: "#2C2C54" }}>
                      {t.key === "quran" ? "📖" : t.key === "nafila" ? "🕌" : "📿"}<br /><span className="text-[10px] font-medium opacity-90">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ City + Stats & Settings buttons ═══ */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <select value={city} onChange={e => changeCity(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-[#6B7280] focus:outline-none"
          style={{ background: "var(--card, #fff)" }}>
          <option value="auto">📍 تلقائي (GPS)</option>
          {Object.entries(CITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => { setShowStats(!showStats); if (!showStats) loadStats(); }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-gray-200 text-[#6B7280] hover:bg-gray-50">
          📊 {showStats ? "إخفاء" : "إحصائيات"}
        </button>
        <button onClick={() => setShowSettings(!showSettings)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-gray-200 text-[#6B7280] hover:bg-gray-50">
          ⚙ إعدادات
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
          {PRAYERS.map(p => (
            <div key={p.key} className="space-y-1.5">
              <p className="text-xs font-bold text-[#16213E]">{p.icon} {p.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#6B7280] w-14">⏰ الوقت:</span>
                <div className="flex gap-1 flex-1 flex-wrap">
                  {PENALTY_TYPES.map(t => (
                    <button key={t.key} onClick={() => setPenaltyConfig(prev => ({ ...prev, [`${p.key}_time`]: t.key }))}
                      className="px-2 py-0.5 rounded-lg text-[9px] font-medium transition"
                      style={{
                        background: (penaltyConfig[`${p.key}_time`] ?? "quran") === t.key ? "#2C2C54" : "#F3F4F6",
                        color: (penaltyConfig[`${p.key}_time`] ?? "quran") === t.key ? "#fff" : "#6B7280",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#6B7280] w-14">🕌 المسجد:</span>
                <div className="flex gap-1 flex-1 flex-wrap">
                  {PENALTY_TYPES.map(t => (
                    <button key={t.key} onClick={() => setPenaltyConfig(prev => ({ ...prev, [`${p.key}_mosque`]: t.key }))}
                      className="px-2 py-0.5 rounded-lg text-[9px] font-medium transition"
                      style={{
                        background: (penaltyConfig[`${p.key}_mosque`] ?? "quran") === t.key ? "#2C2C54" : "#F3F4F6",
                        color: (penaltyConfig[`${p.key}_mosque`] ?? "quran") === t.key ? "#fff" : "#6B7280",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
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

      {tasbih && (
        <TasbihCounter
          target={100}
          label="استغفر الله ١٠٠ مرة"
          onComplete={() => { fulfillPenalty(tasbih.penaltyId); setTasbih(null); }}
          onClose={() => setTasbih(null)}
        />
      )}
    </>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>(() => {
    if (typeof window === "undefined") return DEFAULT_HABITS;
    try { const s = localStorage.getItem("madar_habits"); return s ? JSON.parse(s) : DEFAULT_HABITS; } catch { return DEFAULT_HABITS; }
  });
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

  // Reset todayDone at start of new day
  useEffect(() => {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem("madar_habits_date");
    if (lastDate && lastDate !== today) {
      setHabits(prev => {
        const reset = prev.map(h => ({ ...h, todayDone: false }));
        localStorage.setItem("madar_habits", JSON.stringify(reset));
        localStorage.setItem("madar_habits_date", today);
        return reset;
      });
    } else if (!lastDate) {
      localStorage.setItem("madar_habits_date", today);
    }
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
  const [tasbihTarget, setTasbihTarget] = useState(100);
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
            <h2 className="text-[#16213E] font-bold text-lg">عبادات وعادات</h2>
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

        {/* ═══ Hygiene Section ═══ */}
        <GeometricDivider label="النظافة الشخصية" />
        <HygieneSection />

        {/* ═══ Habits ═══ */}
        <GeometricDivider label="العادات" />

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
