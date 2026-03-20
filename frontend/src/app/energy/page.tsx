"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getTasks, getGoals, type SmartTask, type Goal } from "@/lib/api";

/* ─── Focus Report Component ──────────────────────────────────────────── */

function FocusReport() {
  const [log, setLog] = useState<{ date: string; taskId: string | null; durationMin: number; ts: number }[]>([]);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("madar_focus_log") ?? "[]");
      setLog(data);
    } catch {}
  }, []);

  if (log.length === 0) {
    return (
      <>
        <GeometricDivider label="تقرير جلسات التركيز" />
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm text-center py-8">
          <p className="text-[#9CA3AF] text-sm">لم تبدأ أي جلسة تركيز بعد</p>
          <p className="text-[#D1D5DB] text-xs mt-1">ابدأ جلسات التركيز من أعمال اليوم وسيظهر التقرير هنا</p>
        </div>
      </>
    );
  }

  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

  const todaySessions = log.filter((e) => e.date === todayStr);
  const weekSessions = log.filter((e) => e.date >= weekAgo);
  const monthSessions = log.filter((e) => e.date >= monthAgo);

  const todayMins = todaySessions.reduce((s, e) => s + e.durationMin, 0);
  const weekMins = weekSessions.reduce((s, e) => s + e.durationMin, 0);
  const monthMins = monthSessions.reduce((s, e) => s + e.durationMin, 0);

  const avgDailyMins = monthSessions.length > 0
    ? Math.round(monthMins / new Set(monthSessions.map((e) => e.date)).size)
    : 0;

  // Sessions per day of week (last 30 days)
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const dayDist = new Array(7).fill(0);
  monthSessions.forEach((e) => {
    const day = new Date(e.ts).getDay();
    dayDist[day] += e.durationMin;
  });
  const maxDayMins = Math.max(...dayDist, 1);

  // Most productive day
  const bestDay = dayDist.indexOf(Math.max(...dayDist));

  // Streak (consecutive days with sessions)
  const uniqueDays = [...new Set(log.map((e) => e.date))].sort().reverse();
  let streak = 0;
  const checkDate = new Date();
  for (const day of uniqueDays) {
    const expected = checkDate.toISOString().slice(0, 10);
    if (day === expected) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else if (day < expected) break;
  }

  function fmtHM(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} دقيقة`;
    return m > 0 ? `${h} ساعة و ${m} دقيقة` : `${h} ساعة`;
  }

  return (
    <>
      <GeometricDivider label="تقرير جلسات التركيز" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">اليوم</p>
          <p className="text-lg font-black text-[#5E5495]">{fmtHM(todayMins)}</p>
          <p className="text-[9px] text-[#9CA3AF]">{todaySessions.length} جلسة</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">هذا الأسبوع</p>
          <p className="text-lg font-black text-[#2C2C54]">{fmtHM(weekMins)}</p>
          <p className="text-[9px] text-[#9CA3AF]">{weekSessions.length} جلسة</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">هذا الشهر</p>
          <p className="text-lg font-black text-[#D4AF37]">{fmtHM(monthMins)}</p>
          <p className="text-[9px] text-[#9CA3AF]">{monthSessions.length} جلسة</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">المعدل اليومي</p>
          <p className="text-lg font-black text-[#3D8C5A]">{fmtHM(avgDailyMins)}</p>
          <p className="text-[9px] text-[#9CA3AF]">🔥 سلسلة {streak} يوم</p>
        </div>
      </div>

      {/* Day distribution */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
        <p className="text-sm font-bold text-[#16213E] mb-2">توزيع التركيز حسب أيام الأسبوع</p>
        {dayNames.map((name, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-[#6B7280] w-14 text-left">{name}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.round((dayDist[i] / maxDayMins) * 100)}%`,
                background: i === bestDay ? "#D4AF37" : "#5E5495",
              }} />
            </div>
            <span className="text-xs font-bold w-12 text-left" style={{ color: i === bestDay ? "#D4AF37" : "#5E5495" }}>
              {dayDist[i] > 0 ? fmtHM(dayDist[i]) : "—"}
            </span>
          </div>
        ))}
        <p className="text-[10px] text-[#9CA3AF] text-center mt-2">
          أفضل يوم: <span className="font-bold text-[#D4AF37]">{dayNames[bestDay]}</span>
        </p>
      </div>
    </>
  );
}

/* ─── Task Analysis Report ─────────────────────────────────────────────── */

function TaskAnalysisReport({ tasks }: { tasks: SmartTask[] }) {
  const completed = tasks.filter((t) => t.status === "Completed" && t.actualDurationMinutes);
  const deferred = tasks.filter((t) => t.contextNote?.includes("defers:"));

  if (completed.length === 0 && deferred.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm text-center py-8">
        <p className="text-[#9CA3AF] text-sm">لا توجد بيانات كافية — أكمل بعض المهام لتظهر التحليلات</p>
      </div>
    );
  }

  // متوسط مدة الإنجاز بالأيام
  const avgDurationDays = completed.length > 0
    ? Math.round(completed.reduce((s, t) => s + (t.actualDurationMinutes ?? 0), 0) / completed.length / 1440)
    : 0;

  // نسبة المهام المكتملة في الوقت
  const onTime = completed.filter((t) => t.wasCompletedOnTime).length;
  const onTimePct = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 0;

  // المهام الأكثر تأجيلاً
  const deferredWithCount = deferred.map((t) => {
    const match = t.contextNote?.match(/defers:(\d+)/);
    return { title: t.title, count: match ? parseInt(match[1]) : 0, status: t.status };
  }).sort((a, b) => b.count - a.count).slice(0, 5);

  // توزيع المدة حسب مستوى التركيز
  const durationByLoad: Record<string, { total: number; count: number }> = {};
  completed.forEach((t) => {
    const key = t.cognitiveLoad;
    if (!durationByLoad[key]) durationByLoad[key] = { total: 0, count: 0 };
    durationByLoad[key].total += t.actualDurationMinutes ?? 0;
    durationByLoad[key].count++;
  });

  const loadLabels: Record<string, string> = { Low: "خفيف", Medium: "متوسط", High: "مرتفع", Deep: "عميق" };

  // أبطأ المهام (أطول مدة)
  const slowest = [...completed]
    .sort((a, b) => (b.actualDurationMinutes ?? 0) - (a.actualDurationMinutes ?? 0))
    .slice(0, 5);

  // مقارنة المقدر vs الفعلي
  const withEstimate = completed.filter((t) => t.estimatedDurationMinutes && t.estimatedDurationMinutes > 0);
  const accuracyPct = withEstimate.length > 0
    ? Math.round(withEstimate.filter((t) => {
        const diff = Math.abs((t.actualDurationMinutes ?? 0) - (t.estimatedDurationMinutes ?? 0));
        return diff <= (t.estimatedDurationMinutes ?? 1) * 0.3; // ±30% يعتبر دقيق
      }).length / withEstimate.length * 100)
    : -1;
  const overEstimated = withEstimate.filter((t) => (t.actualDurationMinutes ?? 0) < (t.estimatedDurationMinutes ?? 0)).length;
  const underEstimated = withEstimate.filter((t) => (t.actualDurationMinutes ?? 0) > (t.estimatedDurationMinutes ?? 0)).length;

  // أكثر أنواع المهام استهلاكاً هذا الأسبوع
  const weekAgo = Date.now() - 7 * 86400000;
  const weekTasks = completed.filter((t) => t.completedAt && new Date(t.completedAt).getTime() > weekAgo);
  const weekByCircle = new Map<string, number>();
  weekTasks.forEach((t) => {
    const c = t.lifeCircle?.name ?? "أخرى";
    weekByCircle.set(c, (weekByCircle.get(c) ?? 0) + (t.actualDurationMinutes ?? 0));
  });
  const topCirclesWeek = [...weekByCircle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  function fmtDuration(mins: number): string {
    if (mins < 60) return `${mins} د`;
    const h = Math.floor(mins / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d} يوم`;
    return `${h} س`;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">متوسط مدة الإنجاز</p>
          <p className="text-xl font-black text-[#5E5495]">{avgDurationDays} يوم</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">نسبة الالتزام بالموعد</p>
          <p className="text-xl font-black" style={{ color: onTimePct >= 70 ? "#3D8C5A" : "#DC2626" }}>{onTimePct}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">مهام مكتملة بتتبع</p>
          <p className="text-xl font-black text-[#2C2C54]">{completed.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">مهام تم تأجيلها</p>
          <p className="text-xl font-black text-[#D4AF37]">{deferred.length}</p>
        </div>
      </div>

      {/* Duration by cognitive load */}
      {Object.keys(durationByLoad).length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
          <p className="text-sm font-bold text-[#16213E]">متوسط الوقت حسب مستوى التركيز</p>
          {Object.entries(durationByLoad).map(([key, val]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-[#6B7280] w-14">{loadLabels[key] ?? key}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="h-full rounded-full bg-[#5E5495]"
                  style={{ width: `${Math.min(100, Math.round((val.total / val.count) / (Math.max(...Object.values(durationByLoad).map(v => v.total / v.count)) || 1) * 100))}%` }} />
              </div>
              <span className="text-[11px] font-bold text-[#5E5495] w-16 text-left">{fmtDuration(Math.round(val.total / val.count))}</span>
              <span className="text-[9px] text-[#9CA3AF]">({val.count} مهمة)</span>
            </div>
          ))}
        </div>
      )}

      {/* Most deferred tasks */}
      {deferredWithCount.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-[#16213E] mb-3">المهام الأكثر تأجيلاً</p>
          <div className="space-y-2">
            {deferredWithCount.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-[10px] w-4 text-[#9CA3AF]">{i + 1}</span>
                <span className="text-xs text-[#16213E] flex-1 truncate">{t.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">{t.count}x تأجيل</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slowest tasks */}
      {slowest.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-[#16213E] mb-3">أكثر المهام استهلاكاً للوقت</p>
          <div className="space-y-2">
            {slowest.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-[10px] w-4 text-[#9CA3AF]">{i + 1}</span>
                <span className="text-xs text-[#16213E] flex-1 truncate">{t.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold">{fmtDuration(t.actualDurationMinutes ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* مقارنة المقدر vs الفعلي */}
      {accuracyPct >= 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-[#16213E] mb-3">دقة التقدير (المقدر vs الفعلي)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-3 rounded-xl" style={{ background: accuracyPct >= 60 ? "#ECFDF5" : "#FEF3C7" }}>
              <p className="text-2xl font-black" style={{ color: accuracyPct >= 60 ? "#065F46" : "#92400E" }}>{accuracyPct}%</p>
              <p className="text-[10px]" style={{ color: accuracyPct >= 60 ? "#065F46" : "#92400E" }}>دقة التقدير</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-50">
              <p className="text-2xl font-black text-blue-700">{overEstimated}</p>
              <p className="text-[10px] text-blue-600">أقل من المقدر</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-red-50">
              <p className="text-2xl font-black text-red-700">{underEstimated}</p>
              <p className="text-[10px] text-red-600">أكثر من المقدر</p>
            </div>
          </div>
          {withEstimate.slice(0, 5).map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="text-[#9CA3AF] w-4">{i+1}</span>
              <span className="flex-1 truncate text-[#16213E]">{t.title}</span>
              <span className="text-blue-600 w-14 text-left">📐 {fmtDuration(t.estimatedDurationMinutes ?? 0)}</span>
              <span className="text-green-600 w-14 text-left">⏱️ {fmtDuration(t.actualDurationMinutes ?? 0)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                (t.actualDurationMinutes ?? 0) <= (t.estimatedDurationMinutes ?? 0) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {(t.actualDurationMinutes ?? 0) <= (t.estimatedDurationMinutes ?? 0) ? "✓" : `+${fmtDuration((t.actualDurationMinutes ?? 0) - (t.estimatedDurationMinutes ?? 0))}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* أكثر المجالات استهلاكاً هذا الأسبوع */}
      {topCirclesWeek.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-[#16213E] mb-3">أكثر المجالات استهلاكاً هذا الأسبوع</p>
          {topCirclesWeek.map(([name, mins], i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <span className="text-[10px] text-[#9CA3AF] w-4">{i+1}</span>
              <span className="text-xs text-[#16213E] flex-1">{name}</span>
              <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${Math.round(mins / (topCirclesWeek[0]?.[1] || 1) * 100)}%` }} />
              </div>
              <span className="text-[11px] font-bold text-[#D4AF37] w-16 text-left">{fmtDuration(mins)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, g] = await Promise.all([getTasks(), getGoals()]);
      setTasks(t); setGoals(g);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total     = tasks.length;
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const pending   = tasks.filter((t) => t.status === "Todo" || t.status === "InProgress").length;
  const overdue   = tasks.filter((t) => {
    if (t.status === "Completed") return false;
    if (t.dueDate && new Date(t.dueDate) < new Date()) return true;
    if (t.createdAt && Date.now() - new Date(t.createdAt).getTime() > 24 * 60 * 60 * 1000) return true;
    return false;
  }).length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
  const workTasks = tasks.filter((t) => t.contextNote === "work").length;
  const personalTasks = total - workTasks;
  const recurring = tasks.filter((t) => t.isRecurring).length;

  // Priority distribution
  const highP = tasks.filter((t) => t.userPriority >= 4).length;
  const medP  = tasks.filter((t) => t.userPriority === 3).length;
  const lowP  = tasks.filter((t) => t.userPriority <= 2).length;

  // Cognitive load distribution
  const loadDist = { Low: 0, Medium: 0, High: 0, Deep: 0 };
  tasks.forEach((t) => { if (t.cognitiveLoad in loadDist) loadDist[t.cognitiveLoad as keyof typeof loadDist]++; });

  // Goals stats
  const activeGoals = goals.filter((g) => g.status === "Active").length;
  const completedGoals = goals.filter((g) => g.status === "Completed").length;
  const avgGoalProgress = goals.length === 0 ? 0 : Math.round(goals.reduce((s, g) => s + g.progressPercent, 0) / goals.length);

  function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <p className="text-[#6B7280] text-xs mb-1">{label}</p>
        <p className="text-3xl font-black" style={{ color }}>{value}</p>
        {sub && <p className="text-[#9CA3AF] text-[11px] mt-1">{sub}</p>}
      </div>
    );
  }

  function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max === 0 ? 0 : Math.round((value / max) * 100);
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#6B7280] w-16 text-left">{label}</span>
        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs font-bold w-8" style={{ color }}>{value}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="px-8 py-16 text-center text-[#6B7280] animate-pulse">جارٍ تحميل الإحصائيات...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4 pr-16 md:pr-8">
        <h2 className="text-[#16213E] font-bold text-lg">الإحصائيات</h2>
        <p className="text-[#6B7280] text-xs">نظرة شاملة على إنتاجيتك</p>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="إجمالي المهام" value={total} color="#2C2C54" />
          <StatCard label="مكتملة" value={completed} sub={`${completionRate}% نسبة الإنجاز`} color="#3D8C5A" />
          <StatCard label="قيد التنفيذ" value={pending} color="#D4AF37" />
          <StatCard label="متأخرة" value={overdue} color="#DC2626" />
        </div>

        {/* Task types */}
        <GeometricDivider label="توزيع المهام" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <p className="text-sm font-bold text-[#16213E] mb-2">حسب الأولوية</p>
            <Bar label="عالية" value={highP} max={total} color="#DC2626" />
            <Bar label="متوسطة" value={medP} max={total} color="#D4AF37" />
            <Bar label="منخفضة" value={lowP} max={total} color="#3D8C5A" />
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <p className="text-sm font-bold text-[#16213E] mb-2">حسب مستوى التركيز</p>
            <Bar label="خفيف" value={loadDist.Low} max={total} color="#3D8C5A" />
            <Bar label="متوسط" value={loadDist.Medium} max={total} color="#D4AF37" />
            <Bar label="مرتفع" value={loadDist.High} max={total} color="#E8631A" />
            <Bar label="عميق" value={loadDist.Deep} max={total} color="#DC2626" />
          </div>
        </div>

        {/* Work vs Personal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="مهام عمل 💼" value={workTasks} color="#0F3460" />
          <StatCard label="مهام شخصية" value={personalTasks} color="#2C2C54" />
          <StatCard label="مهام متكررة 🔄" value={recurring} color="#5E5495" />
          <StatCard label="مشاريع نشطة" value={activeGoals} sub={`${completedGoals} مكتمل`} color="#D4AF37" />
        </div>

        {/* Goals progress */}
        <GeometricDivider label="تقدم المشاريع" />
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#6B7280]">متوسط تقدم المشاريع</span>
            <span className="font-bold text-[#2C2C54]">{avgGoalProgress}%</span>
          </div>
          <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-4">
            <div className="h-full rounded-full" style={{ width: `${avgGoalProgress}%`, background: "linear-gradient(90deg, #2C2C54, #D4AF37)" }} />
          </div>
          {goals.length > 0 && (
            <div className="space-y-2">
              {goals.slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <span className="text-xs text-[#16213E] flex-1 truncate">{g.title}</span>
                  <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${g.progressPercent}%`, background: g.lifeCircle?.color ?? "#D4AF37" }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#2C2C54] w-8">{g.progressPercent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completion rate insight */}
        <GeometricDivider label="تقرير التطوير" />
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl" style={{ background: completionRate >= 70 ? "#ECFDF5" : completionRate >= 40 ? "#FEF3C7" : "#FEF2F2" }}>
              <p className="text-3xl font-black" style={{ color: completionRate >= 70 ? "#065F46" : completionRate >= 40 ? "#92400E" : "#991B1B" }}>{completionRate}%</p>
              <p className="text-xs mt-1" style={{ color: completionRate >= 70 ? "#065F46" : completionRate >= 40 ? "#92400E" : "#991B1B" }}>
                {completionRate >= 70 ? "ممتاز! استمر" : completionRate >= 40 ? "جيد، يمكنك أكثر" : "تحتاج تركيز أكبر"}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50">
              <p className="text-3xl font-black text-[#2C2C54]">{overdue}</p>
              <p className="text-xs text-[#6B7280] mt-1">مهام متأخرة تحتاج متابعة</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50">
              <p className="text-3xl font-black text-[#D4AF37]">{recurring}</p>
              <p className="text-xs text-[#6B7280] mt-1">عادات/مهام متكررة</p>
            </div>
          </div>
        </div>

        {/* Self-development report - Focus sessions */}
        <FocusReport />

        {/* Advanced Task Analysis */}
        <GeometricDivider label="تحليل المهام المتقدم" />
        <TaskAnalysisReport tasks={tasks} />

        {/* ── Streak Heatmap — المهام والعادات ── */}
        <GeometricDivider label="خريطة الإنجاز (آخر 4 أشهر)" />
        {(() => {
          // Build completion map from tasks
          const dayMap = new Map<string, number>();
          tasks.filter(t => t.completedAt).forEach(t => {
            const d = t.completedAt!.slice(0, 10);
            dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
          });
          // Add habits from focus log
          try {
            const log = JSON.parse(localStorage.getItem("madar_focus_log") ?? "[]");
            log.forEach((e: { date: string }) => dayMap.set(e.date, (dayMap.get(e.date) ?? 0) + 1));
          } catch {}

          // Generate last 120 days
          const days: { date: string; count: number; dayOfWeek: number }[] = [];
          for (let i = 119; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const ds = d.toISOString().slice(0, 10);
            days.push({ date: ds, count: dayMap.get(ds) ?? 0, dayOfWeek: d.getDay() });
          }
          const maxCount = Math.max(...days.map(d => d.count), 1);

          // Best streak
          let bestStreak = 0, currentStreak = 0, bestStart = "", bestEnd = "";
          let csStart = "";
          for (const d of days) {
            if (d.count > 0) {
              if (currentStreak === 0) csStart = d.date;
              currentStreak++;
              if (currentStreak > bestStreak) { bestStreak = currentStreak; bestStart = csStart; bestEnd = d.date; }
            } else { currentStreak = 0; }
          }

          // Current streak (from today backwards)
          let nowStreak = 0;
          for (let i = days.length - 1; i >= 0; i--) {
            if (days[i].count > 0) nowStreak++; else break;
          }

          // Weeks for grid
          const weeks: typeof days[] = [];
          let week: typeof days = [];
          for (const d of days) {
            week.push(d);
            if (d.dayOfWeek === 6) { weeks.push(week); week = []; }
          }
          if (week.length > 0) weeks.push(week);

          const dayLabels = ["أحد", "", "ثلا", "", "خمي", "", "سبت"];

          function getColor(count: number): string {
            if (count === 0) return "var(--card-border, #E5E7EB)";
            const intensity = Math.min(1, count / maxCount);
            if (intensity < 0.25) return "#9B8FD450";
            if (intensity < 0.5) return "#9B8FD480";
            if (intensity < 0.75) return "#5E5495";
            return "#D4AF37";
          }

          return (
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
              {/* Streak stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-purple-50">
                  <p className="text-2xl font-black text-[#5E5495]">{nowStreak}</p>
                  <p className="text-[10px] text-[#5E5495]">🔥 سلسلة حالية</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50">
                  <p className="text-2xl font-black text-[#D4AF37]">{bestStreak}</p>
                  <p className="text-[10px] text-[#D4AF37]">أفضل سلسلة</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-50">
                  <p className="text-2xl font-black text-[#3D8C5A]">{days.filter(d => d.count > 0).length}</p>
                  <p className="text-[10px] text-[#3D8C5A]">أيام نشطة / 120</p>
                </div>
              </div>
              {bestStreak > 1 && bestStart && (
                <p className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
                  أفضل سلسلة: {bestStreak} يوم ({new Date(bestStart).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })} — {new Date(bestEnd).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })})
                </p>
              )}

              {/* Heatmap grid */}
              <div className="overflow-x-auto">
                <div className="flex gap-0.5" style={{ direction: "ltr", minWidth: "fit-content" }}>
                  {/* Day labels */}
                  <div className="flex flex-col gap-0.5 mr-1">
                    {dayLabels.map((l, i) => (
                      <div key={i} className="h-3 flex items-center">
                        <span className="text-[8px]" style={{ color: "var(--muted)" }}>{l}</span>
                      </div>
                    ))}
                  </div>
                  {weeks.map((w, wi) => (
                    <div key={wi} className="flex flex-col gap-0.5">
                      {Array.from({ length: 7 }, (_, di) => {
                        const d = w.find(x => x.dayOfWeek === di);
                        if (!d) return <div key={di} className="w-3 h-3" />;
                        return (
                          <div key={di} className="w-3 h-3 rounded-sm transition-all" title={`${d.date}: ${d.count} إنجاز`}
                            style={{ background: getColor(d.count) }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-1 mt-2">
                <span className="text-[8px]" style={{ color: "var(--muted)" }}>أقل</span>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ background: getColor(i === 0 ? 0 : (i / 4) * maxCount) }} />
                ))}
                <span className="text-[8px]" style={{ color: "var(--muted)" }}>أكثر</span>
              </div>

              {/* Month labels */}
              <div className="flex justify-between px-4">
                {(() => {
                  const months: string[] = [];
                  for (let i = 3; i >= 0; i--) {
                    const d = new Date(); d.setMonth(d.getMonth() - i);
                    months.push(d.toLocaleDateString("ar-SA", { month: "short" }));
                  }
                  return months.map((m, i) => <span key={i} className="text-[9px]" style={{ color: "var(--muted)" }}>{m}</span>);
                })()}
              </div>
            </div>
          );
        })()}

        {/* ── Frequency by Day of Week ── */}
        <GeometricDivider label="تردد الإنجاز حسب اليوم" />
        {(() => {
          const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
          const dayCounts = new Array(7).fill(0);
          tasks.filter(t => t.completedAt).forEach(t => {
            dayCounts[new Date(t.completedAt!).getDay()]++;
          });
          try {
            const log = JSON.parse(localStorage.getItem("madar_focus_log") ?? "[]");
            log.forEach((e: { ts: number }) => dayCounts[new Date(e.ts).getDay()]++);
          } catch {}
          const maxDay = Math.max(...dayCounts, 1);
          const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));

          return (
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
              {dayNames.map((name, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs w-14 text-left" style={{ color: i === bestDayIdx ? "#D4AF37" : "var(--muted)", fontWeight: i === bestDayIdx ? 700 : 400 }}>{name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.round((dayCounts[i] / maxDay) * 100)}%`,
                      background: i === bestDayIdx ? "#D4AF37" : "#5E5495",
                    }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-left" style={{ color: i === bestDayIdx ? "#D4AF37" : "#5E5495" }}>{dayCounts[i]}</span>
                </div>
              ))}
              <p className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
                أكثر يوم إنتاجية: <span className="font-bold" style={{ color: "#D4AF37" }}>{dayNames[bestDayIdx]}</span> ({dayCounts[bestDayIdx]} إنجاز)
              </p>
            </div>
          );
        })()}

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
