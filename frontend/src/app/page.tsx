"use client";

import { useState, useEffect, useCallback } from "react";
import { EightPointedStar, GeometricDivider } from "@/components/IslamicPattern";
import { getTasks, getSalahToday, type SmartTask, type SalahTimesResponse } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrayerRow {
  name: string;
  time: string;
  passed: boolean;
}

interface TaskRow {
  id: string;
  title: string;
  circle: string;
  priority: "عالية" | "متوسطة" | "منخفضة";
  done: boolean;
}

// ─── Static data (circles – no API yet) ───────────────────────────────────────

const CIRCLES = [
  { name: "النفس",     emoji: "🌿", color: "#5E5495", light: "#EAE8F5" },
  { name: "الأسرة",   emoji: "🏡", color: "#C9A84C", light: "#FBF4E2" },
  { name: "العلاقات", emoji: "🤝", color: "#3D8C8C", light: "#E0F2F2" },
  { name: "العمل",    emoji: "💼", color: "#8C4A3D", light: "#F5E8E6" },
];

const PRIORITY_COLORS: Record<string, string> = {
  "عالية":  "bg-red-100 text-red-700",
  "متوسطة": "bg-yellow-100 text-yellow-700",
  "منخفضة": "bg-green-100 text-green-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityLabel(p: number): "عالية" | "متوسطة" | "منخفضة" {
  if (p >= 4) return "عالية";
  if (p === 3) return "متوسطة";
  return "منخفضة";
}

function isPassed(timeStr: string): boolean {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() > m);
}

function salahToRows(s: SalahTimesResponse): PrayerRow[] {
  return [
    { name: "الفجر",  time: s.fajr,    passed: isPassed(s.fajr) },
    { name: "الشروق", time: s.shuruq,  passed: isPassed(s.shuruq) },
    { name: "الظهر",  time: s.dhuhr,   passed: isPassed(s.dhuhr) },
    { name: "العصر",  time: s.asr,     passed: isPassed(s.asr) },
    { name: "المغرب", time: s.maghrib, passed: isPassed(s.maghrib) },
    { name: "العشاء", time: s.isha,    passed: isPassed(s.isha) },
  ];
}

function toRow(t: SmartTask): TaskRow {
  return {
    id:       t.id,
    title:    t.title,
    circle:   t.lifeCircle?.name ?? "—",
    priority: priorityLabel(t.userPriority),
    done:     t.status === "Completed",
  };
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PrayerSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {[1,2,3,4,5,6].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 animate-pulse">
          <div className="octagon w-14 h-14 bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="px-5 py-3 space-y-2">
      {[1,2,3,4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 animate-pulse">
          <div className="w-5 h-5 rounded-full bg-[#E2D5B0] flex-shrink-0" />
          <div className="flex-1 h-3 rounded bg-[#E2D5B0]" />
          <div className="w-10 h-3 rounded bg-[#E2D5B0]" />
          <div className="w-12 h-4 rounded-full bg-[#E2D5B0]" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-islamic", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const [prayers, setPrayers]           = useState<PrayerRow[]>([]);
  const [prayersLoading, setPrayersLoading] = useState(true);
  const [prayersError, setPrayersError]     = useState(false);

  const [tasks, setTasks]             = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError]     = useState(false);

  const fetchPrayers = useCallback(async () => {
    setPrayersLoading(true);
    setPrayersError(false);
    try {
      const data = await getSalahToday();
      setPrayers(salahToRows(data));
    } catch {
      setPrayersError(true);
    } finally {
      setPrayersLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(false);
    try {
      const data = await getTasks();
      setTasks(data.slice(0, 5).map(toRow));
    } catch {
      setTasksError(true);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrayers();
    fetchTasks();
  }, [fetchPrayers, fetchTasks]);

  const highPriority = tasks.filter((t) => t.priority === "عالية" && !t.done).length;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#7C7A8E] text-xs mb-0.5">{today}</p>
            <h2 className="text-[#1A1830] font-bold text-lg">لوحة التحكم</h2>
          </div>
          <div className="text-center" style={{ fontFamily: "var(--font-amiri, Amiri, serif)" }}>
            <p className="shimmer-text text-xl font-bold tracking-wide">بسم الله الرحمن الرحيم</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-full bg-[#F0EDF8] flex items-center justify-center text-[#5E5495] hover:bg-[#E4DFF5] transition">
              🔔
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C9A84C]" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5E5495] to-[#C9A84C] flex items-center justify-center text-white font-bold text-sm">م</div>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* AI Greeting Banner */}
        <div
          className="fade-up rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #2A2542 0%, #3D3468 60%, #5E5495 100%)" }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" aria-hidden>
            <defs>
              <pattern id="ai-bg" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="white" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ai-bg)" />
          </svg>
          <div className="relative z-10 flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}
            >
              <EightPointedStar size={26} color="#2A2542" />
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">مساعد مدار الذكي</p>
              {tasksLoading ? (
                <div className="h-5 w-64 rounded bg-white/10 animate-pulse" />
              ) : (
                <p className="text-white font-semibold text-base leading-relaxed">
                  أهلاً بك 👋 —{" "}
                  {highPriority > 0 ? (
                    <>لديك <span className="text-[#E8C96A] font-bold">{highPriority} مهام عالية الأولوية</span> اليوم</>
                  ) : (
                    <span className="text-[#E8C96A]">أنجزت كل مهامك العالية الأولوية، أحسنت! 🌟</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Life Circles – static until /api/circles is ready */}
        <section>
          <GeometricDivider label="دوائر الحياة" />
          <div className="grid grid-cols-4 gap-4 mt-3">
            {CIRCLES.map((c, i) => (
              <div
                key={c.name}
                className="fade-up rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                style={{ background: c.light, animationDelay: `${i * 80}ms` }}
              >
                <div
                  className="arch w-16 h-20 mx-auto mb-3 flex items-end justify-center pb-3"
                  style={{ background: `linear-gradient(180deg, ${c.color}22, ${c.color}55)`, border: `2px solid ${c.color}33` }}
                >
                  <span className="text-2xl">{c.emoji}</span>
                </div>
                <p className="text-center font-bold text-sm" style={{ color: c.color }}>{c.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Prayer Times + Tasks */}
        <div className="grid grid-cols-5 gap-5">

          {/* Prayer Times */}
          <section className="col-span-2">
            <GeometricDivider label="أوقات الصلاة" />
            <div
              className="mt-3 rounded-2xl overflow-hidden shadow-sm"
              style={{ background: "linear-gradient(160deg, #2A2542, #3D3468)" }}
            >
              {prayersLoading && <PrayerSkeleton />}

              {!prayersLoading && prayersError && (
                <div className="text-center py-6">
                  <p className="text-white/40 text-xs mb-2">تعذّر تحميل الأوقات</p>
                  <button onClick={fetchPrayers} className="text-[#C9A84C] text-xs hover:underline">
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {!prayersLoading && !prayersError && prayers.length > 0 && (
                <div className="grid grid-cols-3 gap-3 p-4">
                  {prayers.map((p) => (
                    <div key={p.name} className="flex flex-col items-center gap-1.5">
                      <div className={`octagon w-14 h-14 flex flex-col items-center justify-center transition-all ${
                        p.passed
                          ? "bg-white/10"
                          : "bg-gradient-to-br from-[#C9A84C] to-[#E8C96A]"
                      }`}>
                        <span className={`text-[10px] font-bold ${p.passed ? "text-white/40" : "text-[#2A2542]"}`}>{p.name}</span>
                        <span className={`text-xs font-black tabular-nums ${p.passed ? "text-white/30" : "text-[#2A2542]"}`}>{p.time}</span>
                      </div>
                      {!p.passed && <span className="text-[#C9A84C] text-[9px] font-semibold">قادمة</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Today's Tasks */}
          <section className="col-span-3">
            <GeometricDivider label="مهام اليوم" />
            <div className="scroll-card mt-3 rounded-2xl overflow-hidden shadow-sm min-h-[120px]">

              {tasksLoading && <TasksSkeleton />}

              {!tasksLoading && tasksError && (
                <div className="text-center py-8 px-5">
                  <p className="text-red-400 text-xs mb-2">تعذّر تحميل المهام</p>
                  <button onClick={fetchTasks} className="text-[#C9A84C] text-xs hover:underline">
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {!tasksLoading && !tasksError && tasks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[#7C7A8E] text-sm">لا توجد مهام اليوم</p>
                </div>
              )}

              {!tasksLoading && !tasksError && tasks.length > 0 && (
                <div className="px-5 py-3 space-y-2">
                  {tasks.map((t, i) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 py-2.5 border-b border-[#e2d5b0]/60 last:border-0 ${t.done ? "opacity-50" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center ${
                        t.done ? "bg-[#5E5495] border-[#5E5495]" : "border-[#C9A84C] bg-transparent"
                      }`}>
                        {t.done && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <p className={`flex-1 text-sm ${t.done ? "line-through text-[#7C7A8E]" : "text-[#1A1830] font-medium"}`}>
                        {t.title}
                      </p>
                      <span className="text-[10px] text-[#7C7A8E] flex-shrink-0">{t.circle}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${PRIORITY_COLORS[t.priority]}`}>
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="pb-4">
          <GeometricDivider />
          <p className="text-center text-[#7C7A8E] text-xs mt-2">مدار — نظام إدارة الحياة الذكي • نسخة ١.٠</p>
        </div>

      </div>
    </main>
  );
}
