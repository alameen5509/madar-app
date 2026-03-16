"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getTasks, api, type SmartTask } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityLabel(p: number): "عالية" | "متوسطة" | "منخفضة" {
  if (p >= 4) return "عالية";
  if (p === 3) return "متوسطة";
  return "منخفضة";
}

const PRIORITY_COLORS: Record<string, string> = {
  "عالية":  "bg-red-100 text-red-700",
  "متوسطة": "bg-yellow-100 text-yellow-700",
  "منخفضة": "bg-green-100 text-green-700",
};

interface TaskRow {
  id: string;
  title: string;
  circle: string;
  priority: "عالية" | "متوسطة" | "منخفضة";
  done: boolean;
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks]     = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getTasks();
      setTasks(data.map(toRow));
    } catch {
      setError("تعذّر تحميل المهام. تحقق من اتصالك أو سجّل دخولك من جديد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Optimistic toggle → PATCH /api/tasks/{id}/status
  async function toggle(id: string, currentDone: boolean) {
    const newStatus = currentDone ? "Todo" : "Completed";
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    try {
      await api.patch(`/api/tasks/${id}/status`, { status: newStatus });
    } catch {
      // Revert on failure
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: currentDone } : t));
    }
  }

  const done  = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">المهام</h2>
            <p className="text-[#7C7A8E] text-xs">
              {loading ? "جارٍ التحميل…" : `${done} من ${total} مكتملة`}
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            <span>+</span><span>مهمة جديدة</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-4">

        {/* Progress bar */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#7C7A8E]">تقدم اليوم</span>
            <span className="font-bold text-[#5E5495]">{pct}٪</span>
          </div>
          <div className="bg-[#F8F6F0] rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #5E5495, #C9A84C)" }}
            />
          </div>
        </div>

        <section>
          <GeometricDivider label="قائمة المهام" />
          <div className="scroll-card mt-3 rounded-2xl overflow-hidden shadow-sm min-h-[120px]">

            {/* Loading */}
            {loading && <TaskSkeleton />}

            {/* Error */}
            {!loading && error && (
              <div className="text-center py-10 px-5">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button
                  onClick={fetchTasks}
                  className="text-[#C9A84C] text-sm font-medium hover:underline"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && tasks.length === 0 && (
              <div className="text-center py-10 px-5">
                <p className="text-[#7C7A8E] text-sm">لا توجد مهام حتى الآن</p>
              </div>
            )}

            {/* List */}
            {!loading && !error && tasks.length > 0 && (
              <div className="px-5 py-3 space-y-1">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => toggle(t.id, t.done)}
                    className={`flex items-center gap-3 py-3 border-b border-[#e2d5b0]/60 last:border-0
                                cursor-pointer hover:bg-[#C9A84C]/5 rounded-lg px-2 transition-all
                                ${t.done ? "opacity-50" : ""}`}
                  >
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center
                                    justify-center transition-all
                                    ${t.done ? "bg-[#5E5495] border-[#5E5495]" : "border-[#C9A84C] bg-transparent"}`}>
                      {t.done && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <p className={`flex-1 text-sm ${t.done ? "line-through text-[#7C7A8E]" : "text-[#1A1830] font-medium"}`}>
                      {t.title}
                    </p>
                    <span className="text-[10px] text-[#7C7A8E] flex-shrink-0">{t.circle}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0
                                    ${PRIORITY_COLORS[t.priority]}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
