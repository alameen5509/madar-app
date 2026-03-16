"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getGoals, type Goal } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GoalSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2D5B0] animate-pulse">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="w-16 h-5 rounded-full bg-[#E2D5B0]" />
                <div className="w-24 h-5 rounded bg-[#E2D5B0]" />
              </div>
              <div className="w-3/4 h-4 rounded bg-[#E2D5B0]" />
            </div>
            <div className="w-10 h-7 rounded bg-[#E2D5B0]" />
          </div>
          <div className="h-2 rounded-full bg-[#E2D5B0]" />
        </div>
      ))}
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: Goal }) {
  const color = goal.lifeCircle?.color ?? "#5E5495";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2D5B0] hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {goal.lifeCircle && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${color}18`, color }}
              >
                {goal.lifeCircle.name}
              </span>
            )}
            <span className="text-[#7C7A8E] text-xs">📅 {formatDate(goal.targetDate)}</span>
            {goal.status !== "Active" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {{
                  Paused:    "موقوف",
                  Completed: "مكتمل",
                  Archived:  "مؤرشف",
                }[goal.status] ?? goal.status}
              </span>
            )}
          </div>
          <h3 className="text-[#1A1830] font-semibold text-sm">{goal.title}</h3>
          {goal.description && (
            <p className="text-[#7C7A8E] text-xs mt-1 leading-relaxed">{goal.description}</p>
          )}
        </div>
        <span className="font-bold text-lg flex-shrink-0" style={{ color }}>
          {goal.progressPercent}٪
        </span>
      </div>
      <div className="mt-3 bg-[#F8F6F0] rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${goal.progressPercent}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals]     = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getGoals();
      setGoals(data);
    } catch {
      setError("تعذّر تحميل الأهداف. تحقق من اتصالك أو سجّل دخولك من جديد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const active    = goals.filter((g) => g.status === "Active").length;
  const completed = goals.filter((g) => g.status === "Completed").length;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg">الأهداف</h2>
            {!loading && !error && (
              <p className="text-[#7C7A8E] text-xs">
                {active} نشط · {completed} مكتمل
              </p>
            )}
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            <span>+</span><span>هدف جديد</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        <section>
          <GeometricDivider label="أهدافي" />
          <div className="mt-4">

            {/* Loading */}
            {loading && <GoalSkeleton />}

            {/* Error */}
            {!loading && error && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button
                  onClick={fetchGoals}
                  className="text-[#C9A84C] text-sm font-medium hover:underline"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && goals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#7C7A8E] text-sm">لا توجد أهداف حتى الآن</p>
              </div>
            )}

            {/* Goals list */}
            {!loading && !error && goals.length > 0 && (
              <div className="space-y-3">
                {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
              </div>
            )}
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
