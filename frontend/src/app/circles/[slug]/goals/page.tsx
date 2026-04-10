"use client";

import { use } from "react";
import Link from "next/link";
import RolePageShell, { useRoleData } from "@/components/RolePageShell";
import { calcGoalProgress } from "@/components/RoleTree";

export default function RoleGoalsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role, dims, goals } = useRoleData(slug);
  const color = role?.color ?? "#5E5495";

  const rootGoals = goals.filter(g => !g.parentGoalId);
  const STATUS_COLORS: Record<string, string> = {
    Active: "#3B82F6", Completed: "#3D8C5A", Paused: "#F59E0B", Draft: "#9CA3AF",
  };

  return (
    <RolePageShell slug={slug}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>الأهداف</p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{rootGoals.length} هدف رئيسي</p>
        </div>
      </div>

      <div className="space-y-3">
        {rootGoals.map(g => {
          const dim = dims.find(d => d.id === g.dimensionId);
          const prog = calcGoalProgress(g.id, goals);
          const subs = goals.filter(sg => sg.parentGoalId === g.id);
          const sc = STATUS_COLORS[g.status] ?? "#6B7280";
          return (
            <Link key={g.id} href={`/circles/${slug}/goals/${g.id}`}
              className="group block rounded-2xl p-5 border transition-all hover:shadow-lg"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">🎯</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{g.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {dim && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: (dim.color || color) + "15", color: dim.color || color }}>{dim.icon || "📁"} {dim.name}</span>}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: sc + "15", color: sc }}>{g.status}</span>
                    {g.timeframe && <span className="text-[9px]" style={{ color: "var(--muted)" }}>⏱ {g.timeframe}</span>}
                  </div>
                </div>
                <span className="text-lg font-black" style={{ color }}>{prog}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: color + "15" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${prog}%`, background: color }} />
              </div>
              {g.description && <p className="text-[10px] truncate mb-1" style={{ color: "var(--muted)" }}>{g.description}</p>}
              <div className="flex items-center gap-3 text-[9px]" style={{ color: "var(--muted)" }}>
                {subs.length > 0 && <span>{subs.length} هدف فرعي</span>}
                {(g.tasks?.length ?? 0) > 0 && <span>{g.tasks.length} مهمة</span>}
                {(g.projects?.length ?? 0) > 0 && <span>{g.projects.length} مشروع</span>}
                {g.dueDate && <span>📅 {new Date(g.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {rootGoals.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">🎯</p>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد أهداف</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>أضف جانباً أولاً ثم أضف أهدافاً داخله</p>
        </div>
      )}
    </RolePageShell>
  );
}
