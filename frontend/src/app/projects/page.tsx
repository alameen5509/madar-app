"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import EditTaskDialogShared from "@/components/EditTaskDialog";
import { getGoals, getCircles, createGoal, updateGoal, deleteGoal, api, type Goal, type LifeCircle } from "@/lib/api";

/* ============================================================================
   TYPES & INTERFACES
   ============================================================================ */

interface PriorityData {
  gw: number; im: number; ur: number; ld: number; score: number;
}

interface BudgetData {
  total: number;
  expenses: { title: string; amount: number }[];
}

interface ProjectTask {
  id: string;
  seq: number;
  title: string;
  description?: string;
  assignee: string;
  startDate: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "done";
  startedAt?: string;
  priority: number;
  dependency: "sequential" | "parallel";
  cost?: number;
}

interface ProjectMeta {
  tasks: ProjectTask[];
  mode: "sequential" | "parallel";
}

type ViewMode = "kanban" | "list" | "timeline";
type FilterType = "all" | "tech" | "non-tech" | "Active" | "Paused" | "Completed" | "Archived" | "high" | "medium" | "low";
type DetailTab = "tasks" | "team" | "budget" | "timeline" | "activity";

/* ============================================================================
   CONSTANTS
   ============================================================================ */

const STAGES = [
  { key: "ideas", label: "افكار", icon: "lightbulb", desc: "في انتظار التخطيط", color: "#8C6B3D", statuses: ["Archived"] },
  { key: "planning", label: "تخطيط", icon: "clipboard", desc: "يتم تجهيز الخطة", color: "#5E5495", statuses: ["Paused"] },
  { key: "active", label: "تنفيذ", icon: "rocket", desc: "العمل جاري", color: "#2D6B9E", statuses: ["Active"] },
  { key: "done", label: "مكتمل", icon: "check-circle", desc: "تم الانجاز", color: "#3D8C5A", statuses: ["Completed"] },
] as const;

const STATUS_MAP: Record<string, string> = {
  ideas: "Archived", planning: "Paused", active: "Active", done: "Completed",
};

const STATUS_LABEL: Record<string, string> = {
  Active: "نشط", Paused: "متوقف", Completed: "مكتمل", Archived: "مؤرشف",
};

const TECH_KEYWORDS = [
  "تقني", "برمج", "تطوير", "موقع", "تطبيق", "نظام", "سيرفر",
  "api", "قاعدة بيانات", "software", "tech", "dev", "code",
];

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "انتظار", in_progress: "قيد العمل", done: "مكتمل",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "#9CA3AF", in_progress: "#2D6B9E", done: "#3D8C5A",
};

/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

function calcScore(gw: number, im: number, ur: number, ld: number): number {
  return (gw + im + ur + ld) * 3;
}

function getScoreColor(score: number): string {
  if (score <= 15) return "var(--muted)";
  if (score <= 30) return "#3D8C5A";
  if (score <= 45) return "#D4AF37";
  return "#DC2626";
}

function getScoreStatus(score: number): string {
  if (score <= 15) return "مؤجل";
  if (score <= 30) return "عادي";
  if (score <= 45) return "مهم";
  return "عاجل";
}

function getScoreBadgeBg(score: number): string {
  if (score <= 15) return "var(--card-border)";
  if (score <= 30) return "#D1FAE520";
  if (score <= 45) return "#FEF3C720";
  return "#FEE2E220";
}

function getScoreBadgeText(score: number): string {
  if (score <= 15) return "var(--muted)";
  if (score <= 30) return "#3D8C5A";
  if (score <= 45) return "#D4AF37";
  return "#DC2626";
}

function parsePriority(description?: string): PriorityData | null {
  if (!description) return null;
  const m = description.match(/\[priority:(.*?)\]/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function parseBudget(description?: string): BudgetData | null {
  if (!description) return null;
  const m = description.match(/\[budget:(.*?)\]/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function parseTeam(description?: string): string[] {
  if (!description) return [];
  const m = description.match(/\[team:(.*?)\]/);
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch { return []; }
}

function cleanDescription(description?: string): string {
  if (!description) return "";
  return description
    .replace(/\[priority:.*?\]/g, "")
    .replace(/\[budget:.*?\]/g, "")
    .replace(/\[team:.*?\]/g, "")
    .trim();
}

function buildDescription(
  desc: string,
  priority: PriorityData | null,
  budget: BudgetData | null,
  team: string[]
): string {
  let result = desc.trim();
  if (priority) result += ` [priority:${JSON.stringify(priority)}]`;
  if (budget) result += ` [budget:${JSON.stringify(budget)}]`;
  if (team.length > 0) result += ` [team:${JSON.stringify(team)}]`;
  return result.trim();
}

function loadProjectMeta(goalId: string): ProjectMeta {
  if (typeof window === "undefined") return { tasks: [], mode: "parallel" };
  try {
    const raw = localStorage.getItem(`project_meta_${goalId}`);
    return raw ? JSON.parse(raw) : { tasks: [], mode: "parallel" };
  } catch { return { tasks: [], mode: "parallel" }; }
}

function saveProjectMeta(goalId: string, meta: ProjectMeta) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`project_meta_${goalId}`, JSON.stringify(meta));
  }
}

function getElapsedTime(startedAt?: string): string {
  if (!startedAt) return "-";
  const diff = Date.now() - new Date(startedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} يوم`;
  if (hours > 0) return `${hours} ساعة`;
  return "< ساعة";
}

function getDaysRemaining(targetDate?: string): number | null {
  if (!targetDate) return null;
  return Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000);
}

function getInitials(name: string): string {
  return name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

/* ============================================================================
   PRIORITY SLIDER COMPONENT
   ============================================================================ */

function PrioritySlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold w-24 text-right" style={{ color: "var(--text)", fontSize: 16 }}>{label}</span>
      <div className="flex-1 relative">
        <input
          type="range" min={1} max={5} step={1} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: "var(--gold)" }}
        />
        <div className="flex justify-between mt-1">
          {[1,2,3,4,5].map(n => (
            <span key={n} className="text-[10px]" style={{ color: value === n ? "var(--gold)" : "var(--muted)" }}>{n}</span>
          ))}
        </div>
      </div>
      <span className="text-sm font-bold w-8 text-center" style={{ color: "var(--gold)", fontSize: 16 }}>{value}</span>
    </div>
  );
}

/* ============================================================================
   STATISTICS BAR
   ============================================================================ */

function StatsBar({ goals }: { goals: Goal[] }) {
  const total = goals.length;
  const active = goals.filter(g => g.status === "Active").length;
  const completed = goals.filter(g => g.status === "Completed").length;
  const overdue = goals.filter(g => {
    const d = getDaysRemaining(g.targetDate);
    return d !== null && d < 0 && g.status !== "Completed";
  }).length;

  let totalBudget = 0;
  goals.forEach(g => {
    const b = parseBudget(g.description);
    if (b) totalBudget += b.total;
  });

  const stats = [
    { label: "المشاريع", value: total, color: "var(--text)", icon: "folder" },
    { label: "نشط", value: active, color: "#2D6B9E", icon: "play" },
    { label: "مكتمل", value: completed, color: "#3D8C5A", icon: "check" },
    { label: "متأخر", value: overdue, color: "#DC2626", icon: "alert" },
    { label: "الميزانية", value: totalBudget > 0 ? `${(totalBudget / 1000).toFixed(0)}K` : "0", color: "var(--gold)", icon: "dollar" },
  ];

  return (
    <div className="flex gap-3 flex-wrap">
      {stats.map(s => (
        <div
          key={s.label}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: `${s.color}15`, color: s.color }}>
            {typeof s.value === "number" ? s.value : s.value}
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--muted)", fontSize: 14 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   PROJECT CARD (KANBAN)
   ============================================================================ */

function ProjectCard({
  goal, circle, stageColor, onDragStart, onClick,
}: {
  goal: Goal;
  circle?: LifeCircle;
  stageColor: string;
  onDragStart: (e: React.DragEvent, goalId: string) => void;
  onClick: () => void;
}) {
  const priority = parsePriority(goal.description);
  const score = priority?.score ?? goal.priorityWeight * 3;
  const budget = parseBudget(goal.description);
  const team = parseTeam(goal.description);
  const daysLeft = getDaysRemaining(goal.targetDate);
  const meta = useMemo(() => loadProjectMeta(goal.id), [goal.id]);
  const completedTasks = meta.tasks.filter(t => t.status === "done").length;

  const priorityBorderColor = score > 45 ? "#DC2626" : score > 30 ? "#D4AF37" : score > 15 ? "#3D8C5A" : "var(--card-border)";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, goal.id)}
      onClick={onClick}
      className="rounded-xl border cursor-pointer hover:shadow-lg transition-all duration-200 group active:cursor-grabbing"
      style={{
        background: "var(--card)",
        borderColor: "var(--card-border)",
        borderTopWidth: 3,
        borderTopColor: priorityBorderColor,
      }}
    >
      <div className="p-4">
        {/* Title + Score */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-bold leading-snug flex-1" style={{ color: "var(--text)", fontSize: 16 }}>
            {goal.title}
          </h4>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: getScoreBadgeBg(score), color: getScoreBadgeText(score) }}
          >
            {score}
          </span>
        </div>

        {/* Circle */}
        {circle && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: circle.colorHex ?? stageColor }} />
            <span className="text-xs" style={{ color: circle.colorHex ?? "var(--muted)" }}>{circle.name}</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: "var(--card-border)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${goal.progressPercent}%`,
                background: `linear-gradient(90deg, ${stageColor}, ${getScoreColor(score)})`,
              }}
            />
          </div>
          <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{goal.progressPercent}%</span>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
          <div className="flex items-center gap-3">
            {goal.targetDate && (
              <span>
                {new Date(goal.targetDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
              </span>
            )}
            {daysLeft !== null && (
              <span style={{ color: daysLeft < 0 ? "#DC2626" : daysLeft < 7 ? "#D4AF37" : "var(--muted)" }}>
                {daysLeft < 0 ? `متأخر ${Math.abs(daysLeft)} يوم` : `${daysLeft} يوم`}
              </span>
            )}
          </div>

          {meta.tasks.length > 0 && (
            <span>{completedTasks}/{meta.tasks.length} مهمة</span>
          )}
        </div>

        {/* Footer: Team + Budget */}
        <div className="flex items-center justify-between mt-3">
          {/* Team avatars */}
          <div className="flex -space-x-1.5 rtl:space-x-reverse">
            {team.slice(0, 3).map((t, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                style={{
                  background: `hsl(${(i * 80 + 200) % 360}, 45%, 55%)`,
                  color: "#fff",
                  borderColor: "var(--card)",
                }}
                title={t}
              >
                {getInitials(t)}
              </div>
            ))}
            {team.length > 3 && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                style={{ background: "var(--card-border)", color: "var(--muted)", borderColor: "var(--card)" }}
              >
                +{team.length - 3}
              </div>
            )}
          </div>

          {/* Budget indicator */}
          {budget && budget.total > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--card-border)", color: "var(--gold)" }}>
              {(budget.total / 1000).toFixed(0)}K
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   LIST VIEW
   ============================================================================ */

function ListView({
  goals, circleMap, onProjectClick,
}: {
  goals: Goal[];
  circleMap: Map<string, LifeCircle>;
  onProjectClick: (goal: Goal) => void;
}) {
  const columns = ["المشروع", "الاولوية", "الحالة", "التقدم", "الموعد", "الدائرة", "المسؤول", "الميزانية"];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              {columns.map(col => (
                <th key={col} className="px-4 py-3 text-right font-bold whitespace-nowrap" style={{ color: "var(--muted)", fontSize: 13, borderBottom: "1px solid var(--card-border)" }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map(goal => {
              const priority = parsePriority(goal.description);
              const score = priority?.score ?? goal.priorityWeight * 3;
              const budget = parseBudget(goal.description);
              const team = parseTeam(goal.description);
              const circle = goal.lifeCircle ? circleMap.get(goal.lifeCircle.id) : undefined;
              const daysLeft = getDaysRemaining(goal.targetDate);

              return (
                <tr
                  key={goal.id}
                  className="cursor-pointer transition-colors hover:brightness-95"
                  style={{ borderBottom: "1px solid var(--card-border)" }}
                  onClick={() => onProjectClick(goal)}
                >
                  {/* Title */}
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: "var(--text)", fontSize: 15 }}>{goal.title}</span>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: getScoreBadgeBg(score), color: getScoreBadgeText(score) }}
                    >
                      {score} - {getScoreStatus(score)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: goal.status === "Active" ? "#2D6B9E20" : goal.status === "Completed" ? "#3D8C5A20" : "var(--card-border)",
                        color: goal.status === "Active" ? "#2D6B9E" : goal.status === "Completed" ? "#3D8C5A" : "var(--muted)",
                      }}>
                      {STATUS_LABEL[goal.status] ?? goal.status}
                    </span>
                  </td>

                  {/* Progress */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 rounded-full h-1.5 overflow-hidden" style={{ background: "var(--card-border)" }}>
                        <div className="h-full rounded-full" style={{ width: `${goal.progressPercent}%`, background: getScoreColor(score) }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>{goal.progressPercent}%</span>
                    </div>
                  </td>

                  {/* Due date */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {goal.targetDate ? (
                      <span className="text-xs" style={{ color: daysLeft !== null && daysLeft < 0 ? "#DC2626" : "var(--muted)" }}>
                        {new Date(goal.targetDate).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>-</span>
                    )}
                  </td>

                  {/* Circle */}
                  <td className="px-4 py-3">
                    {circle ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${circle.colorHex ?? "#666"}15`, color: circle.colorHex ?? "var(--muted)" }}>
                        {circle.name}
                      </span>
                    ) : <span className="text-xs" style={{ color: "var(--muted)" }}>-</span>}
                  </td>

                  {/* Team */}
                  <td className="px-4 py-3">
                    <div className="flex -space-x-1 rtl:space-x-reverse">
                      {team.slice(0, 2).map((t, i) => (
                        <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border"
                          style={{ background: `hsl(${(i * 80 + 200) % 360}, 45%, 55%)`, color: "#fff", borderColor: "var(--card)" }}
                          title={t}>
                          {getInitials(t)}
                        </div>
                      ))}
                      {team.length === 0 && <span className="text-xs" style={{ color: "var(--muted)" }}>-</span>}
                    </div>
                  </td>

                  {/* Budget */}
                  <td className="px-4 py-3">
                    {budget && budget.total > 0 ? (
                      <span className="text-xs font-semibold" style={{ color: "var(--gold)" }}>
                        {budget.total.toLocaleString("ar-SA")} ر.س
                      </span>
                    ) : <span className="text-xs" style={{ color: "var(--muted)" }}>-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {goals.length === 0 && (
        <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
          <p style={{ fontSize: 16 }}>لا توجد مشاريع</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TIMELINE VIEW
   ============================================================================ */

function TimelineView({
  goals, circleMap, onProjectClick,
}: {
  goals: Goal[];
  circleMap: Map<string, LifeCircle>;
  onProjectClick: (goal: Goal) => void;
}) {
  const now = Date.now();
  const goalsWithDates = goals.filter(g => g.targetDate);

  if (goalsWithDates.length === 0) {
    return (
      <div className="rounded-xl border p-12 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <p style={{ color: "var(--muted)", fontSize: 16 }}>لا توجد مشاريع بتواريخ محددة لعرض الجدول الزمني</p>
      </div>
    );
  }

  // Calculate time range
  const allDates = goalsWithDates.map(g => new Date(g.targetDate!).getTime());
  const minDate = Math.min(now, ...allDates) - 7 * 86400000; // 7 days before earliest
  const maxDate = Math.max(now, ...allDates) + 14 * 86400000; // 14 days after latest
  const totalRange = maxDate - minDate;

  // Generate month markers
  const months: { label: string; position: number }[] = [];
  const startMonth = new Date(minDate);
  startMonth.setDate(1);
  while (startMonth.getTime() < maxDate) {
    const pos = ((startMonth.getTime() - minDate) / totalRange) * 100;
    if (pos >= 0 && pos <= 100) {
      months.push({ label: startMonth.toLocaleDateString("ar-SA", { month: "short", year: "numeric" }), position: pos });
    }
    startMonth.setMonth(startMonth.getMonth() + 1);
  }

  const todayPos = ((now - minDate) / totalRange) * 100;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      {/* Month header */}
      <div className="relative h-10 border-b" style={{ background: "var(--bg)", borderColor: "var(--card-border)" }}>
        {months.map((m, i) => (
          <div key={i} className="absolute top-0 h-full flex items-center text-[11px] font-semibold"
            style={{ right: `${m.position}%`, color: "var(--muted)", paddingRight: 8 }}>
            {m.label}
          </div>
        ))}
        {/* Today indicator */}
        <div className="absolute top-0 h-full w-0.5" style={{ right: `${todayPos}%`, background: "#DC2626" }}>
          <div className="absolute -top-0 -right-2 px-1 py-0.5 rounded text-[8px] font-bold text-white" style={{ background: "#DC2626" }}>
            اليوم
          </div>
        </div>
      </div>

      {/* Project rows */}
      <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
        {goalsWithDates
          .sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime())
          .map(goal => {
            const priority = parsePriority(goal.description);
            const score = priority?.score ?? goal.priorityWeight * 3;
            const circle = goal.lifeCircle ? circleMap.get(goal.lifeCircle.id) : undefined;
            const targetTime = new Date(goal.targetDate!).getTime();

            // Project bar: from ~30 days before target to target date
            const meta = loadProjectMeta(goal.id);
            const estimatedDuration = Math.max(14, meta.tasks.length * 7) * 86400000;
            const startTime = Math.max(minDate, targetTime - estimatedDuration);

            const barStart = ((startTime - minDate) / totalRange) * 100;
            const barEnd = ((targetTime - minDate) / totalRange) * 100;
            const barWidth = Math.max(barEnd - barStart, 2);

            const isOverdue = targetTime < now && goal.status !== "Completed";
            const barColor = goal.status === "Completed" ? "#3D8C5A" : isOverdue ? "#DC2626" : getScoreColor(score);

            return (
              <div key={goal.id} className="relative flex items-center h-14 cursor-pointer hover:brightness-95 transition"
                style={{ borderColor: "var(--card-border)" }}
                onClick={() => onProjectClick(goal)}>
                {/* Project label */}
                <div className="w-48 flex-shrink-0 px-4 flex items-center gap-2 z-10" style={{ background: "var(--card)" }}>
                  {circle && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: circle.colorHex ?? "#666" }} />}
                  <span className="text-xs font-bold truncate" style={{ color: "var(--text)" }}>{goal.title}</span>
                </div>

                {/* Gantt area */}
                <div className="flex-1 relative h-full">
                  <div
                    className="absolute top-3 h-7 rounded-lg transition-all duration-300 flex items-center justify-center"
                    style={{
                      right: `${barStart}%`,
                      width: `${barWidth}%`,
                      background: `${barColor}30`,
                      border: `1px solid ${barColor}60`,
                    }}
                  >
                    <span className="text-[10px] font-bold whitespace-nowrap px-1" style={{ color: barColor }}>
                      {goal.progressPercent}%
                    </span>
                  </div>
                  {/* Today line continuation */}
                  <div className="absolute top-0 h-full w-px opacity-20" style={{ right: `${todayPos}%`, background: "#DC2626" }} />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ============================================================================
   PROJECT DETAIL PANEL
   ============================================================================ */

function ProjectDetailPanel({
  goal, circle, circles, onClose, onRefresh,
}: {
  goal: Goal;
  circle?: LifeCircle;
  circles: LifeCircle[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("tasks");
  const [meta, setMeta] = useState<ProjectMeta>(() => loadProjectMeta(goal.id));
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState(3);
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskCost, setNewTaskCost] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("انا");
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<{id: string; fullName: string; email: string}[]>([]);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [editCircle, setEditCircle] = useState(goal.lifeCircle?.id ?? "");
  const [showEditProject, setShowEditProject] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  // Load platform users for assignee dropdown
  useEffect(() => {
    api.get("/api/users").then(r => setPlatformUsers(r.data)).catch(() => {});
  }, []);
  const [showCircleEdit, setShowCircleEdit] = useState(false);
  const [savingCircle, setSavingCircle] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleChangeCircle() {
    if (!editCircle || editCircle === goal.lifeCircle?.id) { setShowCircleEdit(false); return; }
    setSavingCircle(true);
    try {
      await updateGoal(goal.id, { lifeCircleId: editCircle });
      onRefresh();
      setShowCircleEdit(false);
    } catch { /* silent */ }
    finally { setSavingCircle(false); }
  }

  async function handleDelete() {
    if (!confirm(`هل أنت متأكد من حذف مشروع "${goal.title}"؟`)) return;
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
      if (typeof window !== "undefined") localStorage.removeItem(`project_meta_${goal.id}`);
      onClose();
      onRefresh();
    } catch { alert("فشل حذف المشروع"); }
    finally { setDeleting(false); }
  }

  // Budget state
  const [budgetData, setBudgetData] = useState<BudgetData>(() => parseBudget(goal.description) ?? { total: 0, expenses: [] });
  const [newExpenseTitle, setNewExpenseTitle] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetTotal, setBudgetTotal] = useState(String(budgetData.total));

  // Team state
  const [teamMembers, setTeamMembers] = useState<string[]>(() => parseTeam(goal.description));
  const [newMember, setNewMember] = useState("");

  const priority = parsePriority(goal.description);
  const score = priority?.score ?? goal.priorityWeight * 3;
  const desc = cleanDescription(goal.description);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editDesc, setEditDesc] = useState(desc);
  const [editTargetDate, setEditTargetDate] = useState(goal.targetDate?.split("T")[0] ?? "");
  const daysLeft = getDaysRemaining(goal.targetDate);
  const totalExpenses = budgetData.expenses.reduce((s, e) => s + e.amount, 0);
  const tasksCost = meta.tasks.reduce((s, t) => s + (t.cost ?? 0), 0);
  const totalSpent = totalExpenses + tasksCost;
  const budgetRemaining = budgetData.total - totalSpent;

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "tasks", label: "المهام" },
    { key: "team", label: "الفريق" },
    { key: "budget", label: "الميزانية" },
    { key: "timeline", label: "الجدول" },
    { key: "activity", label: "النشاط" },
  ];

  function persistMeta(updated: ProjectMeta) {
    setMeta(updated);
    saveProjectMeta(goal.id, updated);
  }

  async function persistDescriptionFields(newBudget?: BudgetData, newTeam?: string[]) {
    const b = newBudget ?? budgetData;
    const t = newTeam ?? teamMembers;
    const newDesc = buildDescription(desc, priority, b.total > 0 ? b : null, t);
    try {
      await api.patch(`/api/goals/${goal.id}`, { description: newDesc });
    } catch { /* silent */ }
  }

  function addTask() {
    if (!newTaskTitle.trim()) return;
    const updated = { ...meta, tasks: [...meta.tasks] };
    const seq = updated.tasks.length + 1;
    const costVal = parseFloat(newTaskCost);
    updated.tasks.push({
      id: generateId(),
      seq,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || undefined,
      assignee: newTaskAssignee || "انا",
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: newTaskDueDate || undefined,
      status: "pending",
      priority: newTaskPriority,
      dependency: meta.mode,
      cost: !isNaN(costVal) && costVal > 0 ? costVal : undefined,
    });
    persistMeta(updated);
    setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskPriority(3); setNewTaskDueDate(""); setNewTaskCost(""); setNewTaskAssignee("انا");
    setShowAddTaskForm(false);
  }

  async function handleEditProject() {
    if (!editTitle.trim()) return;
    setSavingProject(true);
    try {
      const priorityData = parsePriority(goal.description);
      const budgetDataCurrent = parseBudget(goal.description);
      const teamCurrent = parseTeam(goal.description);
      const fullDesc = buildDescription(editDesc.trim(), priorityData, budgetDataCurrent, teamCurrent);
      await updateGoal(goal.id, {
        title: editTitle.trim(),
        description: fullDesc,
        targetDate: editTargetDate || undefined,
      });
      onRefresh();
      setShowEditProject(false);
    } catch { /* silent */ }
    finally { setSavingProject(false); }
  }

  function cycleTaskStatus(taskId: string) {
    const updated = { ...meta, tasks: [...meta.tasks] };
    const idx = updated.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const task = { ...updated.tasks[idx] };

    if (updated.mode === "sequential" && idx > 0) {
      const prev = updated.tasks[idx - 1];
      if (prev.status !== "done" && task.status === "pending") return;
    }

    if (task.status === "pending") {
      task.status = "in_progress";
      task.startedAt = new Date().toISOString();
    } else if (task.status === "in_progress") {
      task.status = "done";
    } else {
      task.status = "pending";
      task.startedAt = undefined;
    }
    updated.tasks[idx] = task;
    persistMeta(updated);
  }

  function deleteTask(taskId: string) {
    const updated = { ...meta, tasks: meta.tasks.filter(t => t.id !== taskId) };
    updated.tasks.forEach((t, i) => { t.seq = i + 1; });
    persistMeta(updated);
  }

  function moveTask(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= meta.tasks.length) return;
    const updated = { ...meta, tasks: [...meta.tasks] };
    const [item] = updated.tasks.splice(fromIdx, 1);
    updated.tasks.splice(toIdx, 0, item);
    updated.tasks.forEach((t, i) => { t.seq = i + 1; });
    persistMeta(updated);
  }

  function addExpense() {
    if (!newExpenseTitle.trim() || !newExpenseAmount) return;
    const amt = parseFloat(newExpenseAmount);
    if (isNaN(amt) || amt <= 0) return;
    const updated = { ...budgetData, expenses: [...budgetData.expenses, { title: newExpenseTitle.trim(), amount: amt }] };
    setBudgetData(updated);
    persistDescriptionFields(updated);
    setNewExpenseTitle("");
    setNewExpenseAmount("");
  }

  function removeExpense(idx: number) {
    const updated = { ...budgetData, expenses: budgetData.expenses.filter((_, i) => i !== idx) };
    setBudgetData(updated);
    persistDescriptionFields(updated);
  }

  function saveBudgetTotal() {
    const val = parseFloat(budgetTotal);
    if (isNaN(val) || val < 0) return;
    const updated = { ...budgetData, total: val };
    setBudgetData(updated);
    persistDescriptionFields(updated);
    setBudgetEditing(false);
  }

  function addTeamMember() {
    if (!newMember.trim()) return;
    const updated = [...teamMembers, newMember.trim()];
    setTeamMembers(updated);
    persistDescriptionFields(undefined, updated);
    setNewMember("");
  }

  function removeTeamMember(idx: number) {
    const updated = teamMembers.filter((_, i) => i !== idx);
    setTeamMembers(updated);
    persistDescriptionFields(undefined, updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl overflow-y-auto animate-slide-in-right"
        style={{ background: "var(--bg)", borderRight: "1px solid var(--card-border)" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b px-6 py-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 22 }}>{goal.title}</h3>
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full" style={{ background: getScoreBadgeBg(score), color: getScoreBadgeText(score) }}>
                  {score}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: goal.status === "Active" ? "#2D6B9E20" : goal.status === "Completed" ? "#3D8C5A20" : "var(--card-border)",
                    color: goal.status === "Active" ? "#2D6B9E" : goal.status === "Completed" ? "#3D8C5A" : "var(--muted)",
                  }}>
                  {STATUS_LABEL[goal.status]}
                </span>
                {/* Circle / Role with edit */}
                {!showCircleEdit ? (
                  <button onClick={() => setShowCircleEdit(true)}
                    className="text-xs px-2 py-0.5 rounded-full border hover:opacity-80 transition"
                    style={{
                      background: circle ? `${circle.colorHex ?? "#666"}15` : "var(--card-border)",
                      color: circle?.colorHex ?? "var(--muted)",
                      borderColor: circle?.colorHex ?? "var(--card-border)",
                    }}
                    title="تغيير الدور / الوظيفة"
                  >
                    {circle ? circle.name : "بدون دور"} ✎
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <select value={editCircle} onChange={(e) => setEditCircle(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border focus:outline-none"
                      style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
                      <option value="">اختر الدور / الوظيفة</option>
                      {circles.map(c => (
                        <option key={c.id} value={c.id}>{c.iconKey ?? ""} {c.name} ({c.tier === "Business" ? "وظيفة" : "دور"})</option>
                      ))}
                    </select>
                    <button onClick={handleChangeCircle} disabled={savingCircle}
                      className="text-xs px-2 py-1 rounded-lg font-semibold text-white"
                      style={{ background: "#3D8C5A" }}>
                      {savingCircle ? "..." : "حفظ"}
                    </button>
                    <button onClick={() => setShowCircleEdit(false)} className="text-xs px-2 py-1" style={{ color: "var(--muted)" }}>✕</button>
                  </div>
                )}
                {daysLeft !== null && (
                  <span className="text-xs" style={{ color: daysLeft < 0 ? "#DC2626" : "var(--muted)" }}>
                    {daysLeft < 0 ? `متأخر ${Math.abs(daysLeft)} يوم` : `${daysLeft} يوم متبقي`}
                  </span>
                )}
              </div>
              {desc && <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={onClose} className="text-lg px-2 py-1 rounded-lg hover:opacity-70 transition" style={{ color: "var(--muted)" }}>
                X
              </button>
              <button onClick={() => setShowEditProject(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition"
                style={{ background: "#2D6B9E20", color: "#2D6B9E", border: "1px solid #2D6B9E40" }}>
                ✎ تعديل المشروع
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition"
                style={{ background: "#DC262620", color: "#DC2626", border: "1px solid #DC262640" }}>
                {deleting ? "جارٍ الحذف..." : "🗑 حذف"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4 pb-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors"
                style={{
                  background: activeTab === tab.key ? "var(--bg)" : "transparent",
                  color: activeTab === tab.key ? "var(--text)" : "var(--muted)",
                  borderBottom: activeTab === tab.key ? "2px solid var(--gold)" : "2px solid transparent",
                  fontSize: 14,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">

          {/* ─── TASKS TAB ─── */}
          {activeTab === "tasks" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>المهام ({meta.tasks.length})</h4>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {meta.tasks.filter(t => t.status === "done").length} مكتملة - النمط: {meta.mode === "sequential" ? "تسلسلي" : "متوازي"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const updated = { ...meta, mode: meta.mode === "sequential" ? "parallel" as const : "sequential" as const };
                    persistMeta(updated);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border transition"
                  style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
                >
                  {meta.mode === "sequential" ? "تحويل لمتوازي" : "تحويل لتسلسلي"}
                </button>
              </div>

              {/* Add task button / form */}
              {!showAddTaskForm ? (
                <button onClick={() => setShowAddTaskForm(true)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 mb-4"
                  style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                  + إضافة مهمة
                </button>
              ) : (
                <div className="rounded-xl border p-4 mb-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newTaskTitle.trim()) addTask(); }}
                    placeholder="عنوان المهمة *" autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="وصف المهمة (اختياري)" rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
                    style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>المنفذ</label>
                      <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                        style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
                        <option value="انا">أنا</option>
                        {platformUsers.map(u => (
                          <option key={u.id} value={u.fullName}>{u.fullName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>الأولوية</label>
                      <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                        style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
                        <option value={1}>1 - منخفضة</option>
                        <option value={2}>2 - عادية</option>
                        <option value={3}>3 - متوسطة</option>
                        <option value={4}>4 - عالية</option>
                        <option value={5}>5 - حرجة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>تاريخ التسليم</label>
                      <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                        style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>التكلفة (ر.س)</label>
                      <input type="number" value={newTaskCost} onChange={(e) => setNewTaskCost(e.target.value)}
                        placeholder="0" min="0" step="0.01"
                        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                        style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={addTask} disabled={!newTaskTitle.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                      إضافة المهمة
                    </button>
                    <button onClick={() => setShowAddTaskForm(false)}
                      className="px-4 py-2.5 rounded-xl text-sm" style={{ color: "var(--muted)" }}>
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* Task list */}
              {meta.tasks.map((task, idx) => {
                const isBlocked = meta.mode === "sequential" && idx > 0 && meta.tasks[idx - 1].status !== "done" && task.status === "pending";
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--card-border)",
                      opacity: isBlocked ? 0.5 : 1,
                    }}
                  >
                    {/* Status circle */}
                    <button
                      onClick={() => cycleTaskStatus(task.id)}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                      style={{
                        borderColor: TASK_STATUS_COLORS[task.status],
                        background: task.status === "done" ? "#3D8C5A" : "transparent",
                        color: task.status === "done" ? "#fff" : "transparent",
                        cursor: isBlocked ? "not-allowed" : "pointer",
                      }}
                      disabled={isBlocked}
                    >
                      {task.status === "done" ? "✓" : ""}
                    </button>

                    {/* Seq number */}
                    <span className="text-xs font-bold flex-shrink-0 w-5 text-center" style={{ color: "var(--muted)" }}>{task.seq}</span>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-sm block"
                        style={{
                          color: task.status === "done" ? "var(--muted)" : "var(--text)",
                          textDecoration: task.status === "done" ? "line-through" : "none",
                          fontSize: 15,
                        }}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-xs block mt-0.5 truncate" style={{ color: "var(--muted)" }}>{task.description}</span>
                      )}
                    </div>

                    {/* Cost */}
                    {task.cost && task.cost > 0 && (
                      <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded font-semibold" style={{ background: "#D4AF3715", color: "#D4AF37" }}>
                        {task.cost.toLocaleString()} ر.س
                      </span>
                    )}

                    {/* Assignee */}
                    <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                      {task.assignee}
                    </span>

                    {/* Status label */}
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: TASK_STATUS_COLORS[task.status] }}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>

                    {/* Elapsed time */}
                    <span className="text-[11px] flex-shrink-0" style={{ color: "var(--muted)" }}>
                      {getElapsedTime(task.startedAt)}
                    </span>

                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveTask(idx, idx - 1)} className="text-[10px] leading-none px-1 rounded hover:opacity-70"
                        style={{ color: "var(--muted)" }} disabled={idx === 0}>
                        &#9650;
                      </button>
                      <button onClick={() => moveTask(idx, idx + 1)} className="text-[10px] leading-none px-1 rounded hover:opacity-70"
                        style={{ color: "var(--muted)" }} disabled={idx === meta.tasks.length - 1}>
                        &#9660;
                      </button>
                    </div>

                    {/* Delete */}
                    <button onClick={() => deleteTask(task.id)} className="text-xs flex-shrink-0 hover:opacity-70 transition"
                      style={{ color: "#DC2626" }}>
                      x
                    </button>
                  </div>
                );
              })}

              {meta.tasks.length === 0 && (
                <div className="py-8 text-center rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>لا توجد مهام بعد - اكتب عنوان المهمة بالاعلى واضغط Enter</p>
                </div>
              )}
            </div>
          )}

          {/* ─── TEAM TAB ─── */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <h4 className="font-bold mb-4" style={{ color: "var(--text)", fontSize: 18 }}>فريق العمل ({teamMembers.length})</h4>

              {/* Add member */}
              <div className="flex gap-2">
                <input
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTeamMember(); }}
                  placeholder="اسم او بريد العضو..."
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--text)" }}
                />
                <button onClick={addTeamMember}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                  اضافة
                </button>
              </div>

              {/* Members list */}
              {teamMembers.map((member, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: `hsl(${(idx * 80 + 200) % 360}, 45%, 55%)`, color: "#fff" }}>
                    {getInitials(member)}
                  </div>
                  <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)", fontSize: 15 }}>{member}</span>
                  <button onClick={() => removeTeamMember(idx)} className="text-xs px-2 py-1 rounded-lg hover:opacity-70 transition"
                    style={{ color: "#DC2626" }}>
                    ازالة
                  </button>
                </div>
              ))}

              {teamMembers.length === 0 && (
                <div className="py-8 text-center rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>لم يتم تعيين اعضاء بعد</p>
                </div>
              )}
            </div>
          )}

          {/* ─── BUDGET TAB ─── */}
          {activeTab === "budget" && (
            <div className="space-y-4">
              <h4 className="font-bold mb-4" style={{ color: "var(--text)", fontSize: 18 }}>الميزانية</h4>

              {/* Total budget */}
              <div className="p-4 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--text)", fontSize: 16 }}>اجمالي الميزانية</span>
                  {!budgetEditing ? (
                    <button onClick={() => { setBudgetEditing(true); setBudgetTotal(String(budgetData.total)); }}
                      className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--gold)" }}>
                      تعديل
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input type="number" value={budgetTotal}
                        onChange={(e) => setBudgetTotal(e.target.value)}
                        className="w-32 px-3 py-1 rounded-lg border text-sm text-left"
                        style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                      <button onClick={saveBudgetTotal} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ color: "#3D8C5A" }}>حفظ</button>
                      <button onClick={() => setBudgetEditing(false)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--muted)" }}>الغاء</button>
                    </div>
                  )}
                </div>
                <div className="text-2xl font-bold mb-3" style={{ color: "var(--gold)" }}>
                  {budgetData.total.toLocaleString("ar-SA")} ر.س
                </div>

                {/* Budget progress bar */}
                {budgetData.total > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 rounded-full h-3 overflow-hidden" style={{ background: "var(--card-border)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (totalSpent / budgetData.total) * 100)}%`,
                            background: totalSpent > budgetData.total ? "#DC2626" : totalSpent > budgetData.total * 0.8 ? "#D4AF37" : "#3D8C5A",
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                        {Math.round((totalSpent / budgetData.total) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                      <span>المصروف: {totalSpent.toLocaleString("ar-SA")} ر.س {tasksCost > 0 && `(منها ${tasksCost.toLocaleString("ar-SA")} تكاليف مهام)`}</span>
                      <span style={{ color: budgetRemaining < 0 ? "#DC2626" : "#3D8C5A" }}>
                        المتبقي: {budgetRemaining.toLocaleString("ar-SA")} ر.س
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Add expense */}
              <div className="flex gap-2">
                <input value={newExpenseTitle} onChange={(e) => setNewExpenseTitle(e.target.value)}
                  placeholder="اسم المصروف..."
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--text)" }} />
                <input type="number" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)}
                  placeholder="المبلغ"
                  className="w-28 px-3 py-2.5 rounded-xl border text-sm text-left focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--text)" }}
                  onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }} />
                <button onClick={addExpense}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                  +
                </button>
              </div>

              {/* Expenses list */}
              {budgetData.expenses.map((exp, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: "#DC262610", color: "#DC2626" }}>
                    $
                  </div>
                  <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>{exp.title}</span>
                  <span className="text-sm font-bold" style={{ color: "#DC2626" }}>-{exp.amount.toLocaleString("ar-SA")} ر.س</span>
                  <button onClick={() => removeExpense(idx)} className="text-xs hover:opacity-70" style={{ color: "#DC2626" }}>x</button>
                </div>
              ))}

              {budgetData.expenses.length === 0 && (
                <div className="py-6 text-center rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>لا توجد مصروفات</p>
                </div>
              )}
            </div>
          )}

          {/* ─── TIMELINE TAB ─── */}
          {activeTab === "timeline" && (
            <div className="space-y-3">
              <h4 className="font-bold mb-4" style={{ color: "var(--text)", fontSize: 18 }}>الجدول الزمني للمهام</h4>
              {meta.tasks.length > 0 ? (
                <div className="space-y-2">
                  {meta.tasks.map((task) => {
                    const taskDuration = task.startedAt
                      ? (task.status === "done" ? 1 : (Date.now() - new Date(task.startedAt).getTime()) / 86400000)
                      : 0;
                    const maxDuration = 30;
                    const barWidth = Math.min(100, (taskDuration / maxDuration) * 100);

                    return (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border"
                        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                        <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--muted)" }}>{task.seq}</span>
                        <span className="w-32 text-sm truncate" style={{ color: "var(--text)" }}>{task.title}</span>
                        <div className="flex-1 relative h-6 rounded-lg overflow-hidden" style={{ background: "var(--card-border)" }}>
                          <div
                            className="absolute top-0 right-0 h-full rounded-lg transition-all"
                            style={{
                              width: `${Math.max(barWidth, task.status !== "pending" ? 5 : 0)}%`,
                              background: TASK_STATUS_COLORS[task.status],
                              opacity: 0.6,
                            }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                            style={{ color: task.status !== "pending" ? "#fff" : "var(--muted)" }}>
                            {TASK_STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        <span className="text-[11px] w-16 text-left" style={{ color: "var(--muted)" }}>
                          {getElapsedTime(task.startedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>اضف مهام اولا لعرض الجدول الزمني</p>
                </div>
              )}
            </div>
          )}

          {/* ─── ACTIVITY TAB ─── */}
          {activeTab === "activity" && (
            <div className="space-y-3">
              <h4 className="font-bold mb-4" style={{ color: "var(--text)", fontSize: 18 }}>سجل النشاط</h4>
              <div className="space-y-3">
                {/* Placeholder activity items */}
                {[
                  { text: `تم انشاء المشروع "${goal.title}"`, time: "عند الانشاء", type: "create" },
                  ...(goal.status === "Active" ? [{ text: "تم تحويل المشروع الى حالة التنفيذ", time: "حديثا", type: "status" }] : []),
                  ...(meta.tasks.length > 0 ? [{ text: `تم اضافة ${meta.tasks.length} مهمة`, time: "حديثا", type: "task" }] : []),
                  ...(teamMembers.length > 0 ? [{ text: `تم اضافة ${teamMembers.length} عضو للفريق`, time: "حديثا", type: "team" }] : []),
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        background: activity.type === "create" ? "#3D8C5A15" : activity.type === "status" ? "#2D6B9E15" : "var(--card-border)",
                        color: activity.type === "create" ? "#3D8C5A" : activity.type === "status" ? "#2D6B9E" : "var(--muted)",
                      }}>
                      {activity.type === "create" ? "+" : activity.type === "status" ? "S" : activity.type === "task" ? "T" : "U"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: "var(--text)" }}>{activity.text}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Project Dialog */}
      {showEditProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditProject(false)} />
          <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="px-6 pt-6 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
              <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>تعديل المشروع</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>اسم المشروع</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>الوصف</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>الموعد النهائي</label>
                <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleEditProject} disabled={savingProject || !editTitle.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                  {savingProject ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </button>
                <button onClick={() => setShowEditProject(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in animation style */}
      <style jsx>{`
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================================
   NEW PROJECT DIALOG
   ============================================================================ */

function NewProjectDialog({
  circles, onClose, onCreated,
}: {
  circles: LifeCircle[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const npRef = useRef<HTMLInputElement>(null);
  const [npTitle, setNpTitle] = useState("");
  const [npDesc, setNpDesc] = useState("");
  const [npCircle, setNpCircle] = useState("");
  const [npStartDate, setNpStartDate] = useState("");
  const [npEndDate, setNpEndDate] = useState("");
  const [npGw, setNpGw] = useState(3);
  const [npIm, setNpIm] = useState(3);
  const [npUr, setNpUr] = useState(3);
  const [npLd, setNpLd] = useState(3);
  const [npMode, setNpMode] = useState<"sequential" | "parallel">("parallel");
  const [npBudget, setNpBudget] = useState("");
  const [npTeam, setNpTeam] = useState("");
  const [creating, setCreating] = useState(false);

  const npScore = calcScore(npGw, npIm, npUr, npLd);

  useEffect(() => { setTimeout(() => npRef.current?.focus(), 100); }, []);

  async function handleCreate() {
    if (!npTitle.trim()) return;
    setCreating(true);
    try {
      const priorityData: PriorityData = { gw: npGw, im: npIm, ur: npUr, ld: npLd, score: npScore };
      const budgetVal = parseFloat(npBudget);
      const budgetData: BudgetData | null = !isNaN(budgetVal) && budgetVal > 0 ? { total: budgetVal, expenses: [] } : null;
      const teamArr = npTeam.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

      const fullDesc = buildDescription(npDesc.trim(), priorityData, budgetData, teamArr);

      const newGoal = await createGoal({
        title: npTitle.trim(),
        description: fullDesc,
        targetDate: npEndDate || undefined,
        priorityWeight: Math.round(npScore / 12),
        lifeCircleId: npCircle || undefined,
      });

      saveProjectMeta(newGoal.id, { tasks: [], mode: npMode });
      onCreated();
      onClose();
    } catch { /* silent */ }
    finally { setCreating(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>مشروع جديد</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>X</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 16 }}>
              اسم المشروع <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input ref={npRef} value={npTitle} onChange={(e) => setNpTitle(e.target.value)}
              placeholder="مثال: تطوير الموقع الالكتروني..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 16 }}>وصف</label>
            <textarea value={npDesc} onChange={(e) => setNpDesc(e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          </div>

          {/* Circle / Job */}
          <div>
            <label className="block font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 16 }}>ربط بدور / وظيفة</label>
            <select value={npCircle} onChange={(e) => setNpCircle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }}>
              <option value="">اختر الدور او الوظيفة</option>
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.iconKey ?? ""} {c.name} ({c.tier === "Business" ? "وظيفة" : "دور"})</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>تاريخ البدء</label>
              <input type="date" value={npStartDate} onChange={(e) => setNpStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>تاريخ الانتهاء</label>
              <input type="date" value={npEndDate} onChange={(e) => setNpEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            </div>
          </div>

          {/* Priority sliders */}
          <div className="space-y-3 pt-2">
            <label className="block font-bold" style={{ color: "var(--text)", fontSize: 16 }}>حساب الاولوية</label>
            <PrioritySlider label="وزن الهدف" value={npGw} onChange={setNpGw} />
            <PrioritySlider label="الاثر" value={npIm} onChange={setNpIm} />
            <PrioritySlider label="الالحاح" value={npUr} onChange={setNpUr} />
            <PrioritySlider label="القيادة" value={npLd} onChange={setNpLd} />

            {/* Score display */}
            <div className="flex items-center justify-between p-3 rounded-xl border-2 mt-2"
              style={{ borderColor: getScoreColor(npScore), background: getScoreBadgeBg(npScore) }}>
              <div>
                <span className="text-sm font-bold" style={{ color: getScoreBadgeText(npScore) }}>النتيجة: {npScore} / 60</span>
                <span className="text-sm mr-3" style={{ color: getScoreBadgeText(npScore) }}>- {getScoreStatus(npScore)}</span>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: getScoreColor(npScore) }}>
                {npScore}
              </div>
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 16 }}>الميزانية (ر.س)</label>
            <input type="number" value={npBudget} onChange={(e) => setNpBudget(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-xl border text-sm text-left focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          </div>

          {/* Task dependency mode */}
          <div>
            <label className="block font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 16 }}>نمط تنفيذ المهام</label>
            <div className="flex gap-2">
              {(["parallel", "sequential"] as const).map(mode => (
                <button key={mode} onClick={() => setNpMode(mode)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition"
                  style={{
                    borderColor: npMode === mode ? "var(--gold)" : "var(--card-border)",
                    background: npMode === mode ? "var(--gold)" : "transparent",
                    color: npMode === mode ? "#fff" : "var(--muted)",
                  }}>
                  {mode === "parallel" ? "متوازي" : "تسلسلي"}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {npMode === "sequential" ? "لا تبدأ مهمة قبل انهاء السابقة" : "المهام تعمل بشكل متوازي"}
            </p>
          </div>

          {/* Team */}
          <div>
            <label className="block font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 16 }}>اعضاء الفريق</label>
            <textarea value={npTeam} onChange={(e) => setNpTeam(e.target.value)} rows={2}
              placeholder="user1@email.com, user2@email.com"
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>افصل بين الاعضاء بفاصلة</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--card-border)", color: "var(--muted)" }}>
              الغاء
            </button>
            <button onClick={handleCreate} disabled={creating || !npTitle.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              {creating ? "جاري الانشاء..." : "انشاء المشروع"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   BULK IMPORT DIALOG
   ============================================================================ */

function BulkImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function handleImport() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setLoading(true); setResult("");
    let ok = 0;
    for (const line of lines) {
      const match = line.match(/^(.+?)(?:\s*[-—]\s*(\d+))?\s*$/);
      if (!match) continue;
      const name = match[1].trim();
      const score = match[2] ? parseInt(match[2]) : 30;
      const gw = Math.min(5, Math.max(1, Math.round(score / 12)));
      const desc = `[priority:{"gw":${gw},"im":${gw},"ur":${gw},"ld":${gw},"score":${score}}]`;
      try {
        await createGoal({ title: name, description: desc, priorityWeight: gw });
        ok++;
      } catch { /* skip */ }
    }
    setResult(`تم اضافة ${ok} من ${lines.length} مشروع`);
    setLoading(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-lg" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <div>
            <h3 className="font-bold" style={{ color: "var(--text)", fontSize: 18 }}>استيراد مشاريع</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>مشروع واحد في كل سطر - يمكنك اضافة النتيجة: اسم المشروع - 58</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>X</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10}
            placeholder={"مشروع تطوير الموقع - 55\nمشروع التسويق - 42\nمشروع التدريب - 38"}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
            style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          <p className="text-xs" style={{ color: "var(--muted)" }}>{bulkText.split("\n").filter(l => l.trim()).length} مشروع</p>
          {result && <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>{result}</p>}
          <button onClick={handleImport} disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            {loading ? "جاري الاستيراد..." : "استيراد الكل"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   KANBAN BOARD
   ============================================================================ */

function KanbanBoard({
  goals, circleMap, onProjectClick,
}: {
  goals: Goal[];
  circleMap: Map<string, LifeCircle>;
  onProjectClick: (goal: Goal) => void;
}) {
  const [draggedGoalId, setDraggedGoalId] = useState<string | null>(null);
  const [, setRefreshTrigger] = useState(0);

  function handleDragStart(e: React.DragEvent, goalId: string) {
    setDraggedGoalId(goalId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", goalId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    const goalId = e.dataTransfer.getData("text/plain") || draggedGoalId;
    if (!goalId) return;
    setDraggedGoalId(null);

    const newStatus = STATUS_MAP[stageKey];
    if (!newStatus) return;

    const goal = goals.find(g => g.id === goalId);
    if (!goal || goal.status === newStatus) return;

    // Optimistic
    goal.status = newStatus as Goal["status"];
    setRefreshTrigger(n => n + 1);

    try {
      await api.patch(`/api/goals/${goalId}`, { status: newStatus });
    } catch { /* revert handled by parent refresh */ }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
      {STAGES.map(stage => {
        const stageGoals = goals
          .filter(g => (stage.statuses as readonly string[]).includes(g.status))
          .sort((a, b) => {
            const sa = parsePriority(a.description)?.score ?? a.priorityWeight * 3;
            const sb = parsePriority(b.description)?.score ?? b.priorityWeight * 3;
            return sb - sa;
          });

        return (
          <div key={stage.key} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, stage.key)}>
            {/* Stage header */}
            <div className="rounded-xl px-4 py-3 mb-3 border"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: stage.color }} />
                  <div>
                    <p className="font-bold text-sm" style={{ color: stage.color }}>{stage.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>{stage.desc}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: stage.color }}>
                  {stageGoals.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3 min-h-[120px]">
              {stageGoals.length === 0 && (
                <div className="rounded-xl border-2 border-dashed py-8 text-center" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>اسحب مشروعا هنا</p>
                </div>
              )}
              {stageGoals.map(g => (
                <ProjectCard
                  key={g.id}
                  goal={g}
                  circle={g.lifeCircle ? circleMap.get(g.lifeCircle.id) : undefined}
                  stageColor={stage.color}
                  onDragStart={handleDragStart}
                  onClick={() => onProjectClick(g)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   SKELETON LOADING
   ============================================================================ */

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {STAGES.map(s => (
        <div key={s.key}>
          <div className="h-14 rounded-xl animate-pulse mb-3" style={{ background: "var(--card-border)" }} />
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl p-4 border animate-pulse mb-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex gap-3 mb-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded w-3/4" style={{ background: "var(--card-border)" }} />
                  <div className="h-3 rounded w-1/2" style={{ background: "var(--card-border)" }} />
                </div>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   MAIN PAGE
   ============================================================================ */

export default function ProjectsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [circles, setCircles] = useState<LifeCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [g, c] = await Promise.all([getGoals(), getCircles()]);
      setGoals(g);
      setCircles(c);
    } catch {
      setError("تعذر تحميل المشاريع.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const circleMap = useMemo(() => new Map(circles.map(c => [c.id, c])), [circles]);

  const isTech = useCallback((g: Goal) => {
    const text = `${g.title} ${g.description ?? ""}`.toLowerCase();
    const circle = g.lifeCircle ? circleMap.get(g.lifeCircle.id) : undefined;
    return circle?.tier === "Business" || TECH_KEYWORDS.some(k => text.includes(k));
  }, [circleMap]);

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      if (filter === "all") return true;
      if (filter === "tech") return isTech(g);
      if (filter === "non-tech") return !isTech(g);
      if (filter === "Active" || filter === "Paused" || filter === "Completed" || filter === "Archived") return g.status === filter;
      if (filter === "high") { const s = parsePriority(g.description)?.score ?? g.priorityWeight * 3; return s > 45; }
      if (filter === "medium") { const s = parsePriority(g.description)?.score ?? g.priorityWeight * 3; return s > 15 && s <= 45; }
      if (filter === "low") { const s = parsePriority(g.description)?.score ?? g.priorityWeight * 3; return s <= 15; }
      return true;
    });
  }, [goals, filter, isTech]);

  const viewModes: { key: ViewMode; label: string }[] = [
    { key: "kanban", label: "كانبان" },
    { key: "list", label: "قائمة" },
    { key: "timeline", label: "جدول زمني" },
  ];

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "tech", label: "تقنية" },
    { key: "non-tech", label: "غير تقنية" },
    { key: "Active", label: "نشط" },
    { key: "Paused", label: "متوقف" },
    { key: "Completed", label: "مكتمل" },
    { key: "high", label: "اولوية عالية" },
    { key: "low", label: "اولوية منخفضة" },
  ];

  function handleProjectClick(goal: Goal) {
    setSelectedGoal(goal);
  }

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>

      {/* ─── Header ─── */}
      <header
        className="sticky top-0 z-20 backdrop-blur border-b px-6 py-4"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold" style={{ color: "var(--text)", fontSize: 22 }}>ادارة المشاريع</h2>
            {!loading && (
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                {goals.length} مشروع - {filteredGoals.length} معروض
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulkImport(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition border"
              style={{ background: "var(--bg)", color: "var(--muted)", borderColor: "var(--card-border)" }}>
              استيراد
            </button>
            <button
              onClick={() => setShowNewProject(true)}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
              + مشروع جديد
            </button>
          </div>
        </div>

        {/* View mode tabs + Filters */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* View tabs */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--card-border)" }}>
            {viewModes.map(vm => (
              <button
                key={vm.key}
                onClick={() => setViewMode(vm.key)}
                className="px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  background: viewMode === vm.key ? "#2C2C54" : "var(--bg)",
                  color: viewMode === vm.key ? "#fff" : "var(--muted)",
                  fontSize: 14,
                }}
              >
                {vm.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={{
                  background: filter === f.key ? "#2C2C54" : "var(--card-border)",
                  color: filter === f.key ? "#fff" : "var(--muted)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="px-6 py-5 space-y-5">

        {/* Stats bar */}
        {!loading && !error && <StatsBar goals={goals} />}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{error}</p>
            <button onClick={fetchData} className="text-sm hover:underline" style={{ color: "var(--gold)" }}>اعادة المحاولة</button>
          </div>
        )}

        {/* Views */}
        {!loading && !error && viewMode === "kanban" && (
          <KanbanBoard goals={filteredGoals} circleMap={circleMap} onProjectClick={handleProjectClick} />
        )}

        {!loading && !error && viewMode === "list" && (
          <ListView goals={filteredGoals} circleMap={circleMap} onProjectClick={handleProjectClick} />
        )}

        {!loading && !error && viewMode === "timeline" && (
          <TimelineView goals={filteredGoals} circleMap={circleMap} onProjectClick={handleProjectClick} />
        )}

        <div className="pb-4 mt-6"><GeometricDivider /></div>
      </div>

      {/* ─── Dialogs ─── */}
      {showNewProject && (
        <NewProjectDialog
          circles={circles}
          onClose={() => setShowNewProject(false)}
          onCreated={fetchData}
        />
      )}

      {showBulkImport && (
        <BulkImportDialog
          onClose={() => setShowBulkImport(false)}
          onDone={fetchData}
        />
      )}

      {selectedGoal && (
        <ProjectDetailPanel
          goal={selectedGoal}
          circle={selectedGoal.lifeCircle ? circleMap.get(selectedGoal.lifeCircle.id) : undefined}
          circles={circles}
          onClose={() => setSelectedGoal(null)}
          onRefresh={fetchData}
        />
      )}
    </main>
  );
}
