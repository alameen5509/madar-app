"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ───────────────────────────────────────────────────────────── */

interface UserTask {
  id: string;
  title: string;
  status: string;
  userPriority: number;
  dueDate?: string;
  completedAt?: string;
  contextNote?: string;
  lifeCircle?: { id: string; name: string };
}

interface UserGoal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
}

interface UserHabit {
  id: string;
  title: string;
  icon: string;
  category: string;
  isIdea: boolean;
  streak: number;
  todayDone: boolean;
}

interface UserCircle {
  id: string;
  name: string;
  color?: string;
  tier: string;
  displayOrder: number;
  totalGoals: number;
  completedGoals: number;
  totalTasks: number;
  completedTasks: number;
}

const STATUS_LABELS: Record<string, string> = {
  Todo: "للعمل", InProgress: "قيد التنفيذ", Completed: "مكتملة",
  Deferred: "مؤجلة", Inbox: "وارد", Scheduled: "مجدولة", Cancelled: "ملغاة",
};

const HABIT_CATS: Record<string, { label: string; color: string }> = {
  worship: { label: "عبادة", color: "#2C2C54" },
  health: { label: "صحة", color: "#0F3460" },
  learning: { label: "تعلم", color: "#D4AF37" },
  social: { label: "اجتماعي", color: "#3D8C5A" },
};

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function UserViewPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [habits, setHabits] = useState<UserHabit[]>([]);
  const [circles, setCircles] = useState<UserCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "habits" | "circles" | "goals">("tasks");

  useEffect(() => {
    // Read name from localStorage
    try {
      const v = JSON.parse(localStorage.getItem("madar_viewing_user") ?? "{}");
      if (v.name) setUserName(v.name);
    } catch {}

    // Fetch all user data
    setLoading(true);
    Promise.all([
      api.get<UserTask[]>(`/api/users/${userId}/tasks`).then(r => setTasks(r.data)).catch(() => {}),
      api.get<UserGoal[]>(`/api/users/${userId}/goals`).then(r => setGoals(r.data)).catch(() => {}),
      api.get<UserHabit[]>(`/api/users/${userId}/habits`).then(r => setHabits(r.data)).catch(() => {}),
      api.get<UserCircle[]>(`/api/users/${userId}/circles`).then(r => setCircles(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [userId]);

  function stopViewing() {
    localStorage.removeItem("madar_viewing_user");
    window.dispatchEvent(new Event("storage"));
    router.push("/accounts");
  }

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "Completed").length;
  const pendingTasks = tasks.filter(t => t.status !== "Completed" && t.status !== "Cancelled");
  const overdueTasks = pendingTasks.filter(t => {
    if (t.dueDate && new Date(t.dueDate) < new Date()) return true;
    return false;
  });
  const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeHabits = habits.filter(h => !h.isIdea);
  const doneHabits = activeHabits.filter(h => h.todayDone).length;
  const habitPct = activeHabits.length > 0 ? Math.round((doneHabits / activeHabits.length) * 100) : 0;

  const tabs = [
    { key: "tasks" as const, label: `المهام (${totalTasks})`, color: "#2C2C54" },
    { key: "habits" as const, label: `العادات (${activeHabits.length})`, color: "#2ABFBF" },
    { key: "circles" as const, label: `الأدوار (${circles.length})`, color: "#D4AF37" },
    { key: "goals" as const, label: `الأهداف (${goals.length})`, color: "#3D8C5A" },
  ];

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* شريط الاستعراض */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-6 py-2"
        style={{ background: "#FF6B35", color: "#FFF", direction: "rtl" }}>
        <span className="text-sm font-semibold">جارٍ استعراض صفحة {userName || "المستخدم"}</span>
        <button onClick={stopViewing}
          className="px-4 py-1 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          style={{ background: "rgba(255,255,255,0.25)" }}>
          إيقاف الاستعراض
        </button>
      </div>

      {/* Header */}
      <header className="sticky top-[40px] z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            {userName?.charAt(0) || "؟"}
          </div>
          <div className="flex-1">
            <h2 className="text-[#16213E] font-bold text-lg">{userName || "المستخدم"}</h2>
            <p className="text-[#6B7280] text-xs">عرض مباشر — للقراءة فقط</p>
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-center text-[#6B7280] text-sm py-12 animate-pulse">جارٍ تحميل بيانات المستخدم...</p>
      ) : (
        <div className="px-8 py-6 space-y-5">

          {/* ── ملخص سريع ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">المهام</p>
              <p className="text-2xl font-black text-[#2C2C54]">{completedTasks}/{totalTasks}</p>
              <div className="mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-[#2C2C54]" style={{ width: `${taskPct}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">العادات اليوم</p>
              <p className="text-2xl font-black" style={{ color: habitPct === 100 ? "#3D8C5A" : "#2ABFBF" }}>{doneHabits}/{activeHabits.length}</p>
              <div className="mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-[#2ABFBF]" style={{ width: `${habitPct}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">الأدوار</p>
              <p className="text-2xl font-black text-[#D4AF37]">{circles.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">متأخرة</p>
              <p className="text-2xl font-black" style={{ color: overdueTasks.length > 0 ? "#DC2626" : "#3D8C5A" }}>{overdueTasks.length}</p>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="flex-1 px-3 py-2 text-xs font-semibold transition"
                style={{ background: activeTab === tab.key ? tab.color : "#fff", color: activeTab === tab.key ? "#fff" : "#6B7280" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ TASKS TAB ═══ */}
          {activeTab === "tasks" && (
            <>
              <GeometricDivider label="المهام" />
              {tasks.length === 0 ? (
                <p className="text-center text-[#9CA3AF] text-xs py-6">لا توجد مهام</p>
              ) : (
                <div className="space-y-1.5">
                  {tasks.sort((a, b) => {
                    if (a.status === "Completed" && b.status !== "Completed") return 1;
                    if (a.status !== "Completed" && b.status === "Completed") return -1;
                    return b.userPriority - a.userPriority;
                  }).map(t => (
                    <div key={t.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center ${
                        t.status === "Completed" ? "bg-[#3D8C5A] border-[#3D8C5A]" : "border-[#D4AF37]"
                      }`}>
                        {t.status === "Completed" && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      <span className={`flex-1 text-sm ${t.status === "Completed" ? "line-through text-[#9CA3AF]" : "text-[#16213E]"}`}>{t.title}</span>
                      {t.lifeCircle && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">{t.lifeCircle.name}</span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-[#6B7280]">{STATUS_LABELS[t.status] ?? t.status}</span>
                      {t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">متأخرة</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ═══ HABITS TAB ═══ */}
          {activeTab === "habits" && (
            <>
              <GeometricDivider label="العادات اليومية" />
              {activeHabits.length === 0 ? (
                <p className="text-center text-[#9CA3AF] text-xs py-6">لا توجد عادات</p>
              ) : (
                <div className="space-y-2">
                  {activeHabits.map(h => {
                    const cat = HABIT_CATS[h.category] ?? { label: h.category, color: "#6B7280" };
                    return (
                      <div key={h.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
                        <span className="text-lg">{h.icon || "⭐"}</span>
                        <span className="flex-1 text-sm text-[#16213E] font-medium">{h.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: cat.color + "15", color: cat.color }}>{cat.label}</span>
                        {h.streak > 0 && <span className="text-[10px] text-orange-500 font-bold">🔥 {h.streak}</span>}
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          h.todayDone ? "bg-[#3D8C5A] text-white" : "bg-gray-100 text-gray-400"
                        }`}>
                          {h.todayDone ? "✓" : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {habits.filter(h => h.isIdea).length > 0 && (
                <>
                  <GeometricDivider label="أفكار عادات" />
                  <div className="space-y-1.5">
                    {habits.filter(h => h.isIdea).map(h => (
                      <div key={h.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-gray-200 opacity-60">
                        <span className="text-sm">{h.icon || "💡"}</span>
                        <span className="flex-1 text-sm text-[#6B7280]">{h.title}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══ CIRCLES TAB ═══ */}
          {activeTab === "circles" && (
            <>
              <GeometricDivider label="أدوار الحياة" />
              {circles.length === 0 ? (
                <p className="text-center text-[#9CA3AF] text-xs py-6">لا توجد أدوار</p>
              ) : (
                <div className="space-y-3">
                  {circles.map(c => {
                    const pct = c.totalTasks > 0 ? Math.round((c.completedTasks / c.totalTasks) * 100) : 0;
                    return (
                      <div key={c.id} className="bg-white rounded-xl px-5 py-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: c.color || "#D4AF37" }} />
                            <p className="text-sm font-bold text-[#16213E]">{c.name}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-[#6B7280]">{c.tier}</span>
                          </div>
                          <span className="text-xs font-bold" style={{ color: c.color || "#D4AF37" }}>{pct}%</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color || "#D4AF37" }} />
                        </div>
                        <div className="flex gap-4 text-[10px] text-[#6B7280]">
                          <span>{c.totalTasks} مهمة ({c.completedTasks} مكتملة)</span>
                          <span>{c.totalGoals} هدف ({c.completedGoals} محقق)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══ GOALS TAB ═══ */}
          {activeTab === "goals" && (
            <>
              <GeometricDivider label="الأهداف" />
              {goals.length === 0 ? (
                <p className="text-center text-[#9CA3AF] text-xs py-6">لا توجد أهداف</p>
              ) : (
                <div className="space-y-2">
                  {goals.map(g => (
                    <div key={g.id} className="bg-white rounded-xl px-5 py-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-[#16213E]">{g.title}</p>
                        <span className="text-xs font-bold text-[#D4AF37]">{g.progressPercent}%</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${g.progressPercent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="pb-4"><GeometricDivider /></div>
        </div>
      )}
    </main>
  );
}
