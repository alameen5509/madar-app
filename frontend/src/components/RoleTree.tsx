"use client";

import { useState } from "react";
import { api } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface RoleDim {
  id: string; roleId: string; parentDimensionId: string | null;
  name: string; icon: string | null; color: string | null; priority: number;
}

export interface RoleGoalData {
  id: string; roleId: string; dimensionId: string; parentGoalId: string | null;
  title: string; description: string | null; dueDate: string | null;
  progress: number; status: string; priority: number; timeframe: string | null;
  projects: string[]; tasks: string[];
}

interface DimNodeProps {
  dim: RoleDim;
  allDims: RoleDim[];
  allGoals: RoleGoalData[];
  level: number;
  onRefresh: () => void;
}

interface GoalNodeProps {
  goal: RoleGoalData;
  allGoals: RoleGoalData[];
  level: number;
  onRefresh: () => void;
  projectNames: Record<string, string>;
  taskNames: Record<string, string>;
}

const DIM_COLORS = ["#5E5495", "#2D6B9E", "#D4AF37", "#3D8C5A", "#DC2626", "#0F3460"];

/* ─── Progress Calculation ──────────────────────────────────────────── */

export function calcGoalProgress(goalId: string, allGoals: RoleGoalData[]): number {
  const goal = allGoals.find(g => g.id === goalId);
  if (!goal) return 0;
  const subs = allGoals.filter(g => g.parentGoalId === goalId);
  if (subs.length === 0) return goal.progress;
  const avg = Math.round(subs.reduce((s, sg) => s + calcGoalProgress(sg.id, allGoals), 0) / subs.length);
  return avg;
}

export function calcDimProgress(dimId: string, allDims: RoleDim[], allGoals: RoleGoalData[]): number {
  const directGoals = allGoals.filter(g => g.dimensionId === dimId && !g.parentGoalId);
  const subDims = allDims.filter(d => d.parentDimensionId === dimId);
  const items: number[] = [];
  for (const g of directGoals) items.push(calcGoalProgress(g.id, allGoals));
  for (const d of subDims) items.push(calcDimProgress(d.id, allDims, allGoals));
  if (items.length === 0) return 0;
  return Math.round(items.reduce((s, v) => s + v, 0) / items.length);
}

export function calcRoleProgress(roleId: string, allDims: RoleDim[], allGoals: RoleGoalData[]): number {
  const rootDims = allDims.filter(d => d.roleId === roleId && !d.parentDimensionId);
  if (rootDims.length === 0) return 0;
  return Math.round(rootDims.reduce((s, d) => s + calcDimProgress(d.id, allDims, allGoals), 0) / rootDims.length);
}

/* ─── RoleDimensionNode ─────────────────────────────────────────────── */

export function RoleDimensionNode({ dim, allDims, allGoals, level, onRefresh }: DimNodeProps) {
  const [open, setOpen] = useState(level === 0);
  const [showAdd, setShowAdd] = useState<null | "dim" | "goal">(null);
  const [addName, setAddName] = useState("");

  const children = allDims.filter(d => d.parentDimensionId === dim.id);
  const goals = allGoals.filter(g => g.dimensionId === dim.id && !g.parentGoalId);
  const hasContent = children.length > 0 || goals.length > 0;

  const avgProgress = calcDimProgress(dim.id, allDims, allGoals);

  async function addChild() {
    if (!addName.trim()) return;
    await api.post(`/api/role-dimensions/${dim.id}/child`, { name: addName.trim() }).catch(() => {});
    setAddName(""); setShowAdd(null); onRefresh();
  }

  async function addGoal() {
    if (!addName.trim()) return;
    await api.post(`/api/role-dimensions/${dim.id}/goal`, { title: addName.trim() }).catch(() => {});
    setAddName(""); setShowAdd(null); onRefresh();
  }

  async function handleDelete() {
    if (!confirm(`حذف "${dim.name}"؟`)) return;
    await api.delete(`/api/role-dimensions/${dim.id}`).catch(() => {});
    onRefresh();
  }

  const color = dim.color || DIM_COLORS[level % DIM_COLORS.length];

  return (
    <div style={{ marginRight: level > 0 ? 16 : 0 }}>
      <div className="flex items-center gap-2 py-2 group">
        <button onClick={() => setOpen(!open)}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] transition flex-shrink-0"
          style={{ color, background: `${color}15` }}>
          {hasContent ? (open ? "▼" : "◀") : "●"}
        </button>
        <span className="text-base">{dim.icon || "📁"}</span>
        <span className="text-sm font-bold flex-1 truncate" style={{ color: "var(--text)" }}>{dim.name}</span>

        <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: `${color}20` }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${avgProgress}%`, background: color }} />
        </div>
        <span className="text-[10px] font-bold w-8 text-left flex-shrink-0" style={{ color }}>{avgProgress}%</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => setShowAdd(showAdd ? null : "dim")}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-gray-100 transition"
            style={{ color: "var(--muted)" }} title="إضافة">+</button>
          <button onClick={handleDelete}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-red-50 text-red-300 hover:text-red-500 transition">✕</button>
        </div>
      </div>

      {showAdd && (
        <div className="mr-7 mb-2 bg-white rounded-lg border border-gray-200 p-3 space-y-2 fade-up" style={{ marginRight: level > 0 ? 16 : 0 }}>
          <div className="flex gap-1 mb-1">
            <button onClick={() => setShowAdd("dim")} className="px-2 py-1 rounded text-[9px] font-bold"
              style={{ background: showAdd === "dim" ? color : "#F3F4F6", color: showAdd === "dim" ? "#fff" : "#6B7280" }}>📁 جانب فرعي</button>
            <button onClick={() => setShowAdd("goal")} className="px-2 py-1 rounded text-[9px] font-bold"
              style={{ background: showAdd === "goal" ? "#D4AF37" : "#F3F4F6", color: showAdd === "goal" ? "#fff" : "#6B7280" }}>🎯 هدف</button>
          </div>
          <div className="flex gap-2">
            <input value={addName} onChange={e => setAddName(e.target.value)}
              placeholder={showAdd === "goal" ? "عنوان الهدف…" : "اسم الجانب الفرعي…"}
              onKeyDown={e => { if (e.key === "Enter") showAdd === "goal" ? addGoal() : addChild(); }}
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" autoFocus />
            <button onClick={showAdd === "goal" ? addGoal : addChild}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white"
              style={{ background: showAdd === "goal" ? "#D4AF37" : color }}>إضافة</button>
            <button onClick={() => { setShowAdd(null); setAddName(""); }}
              className="px-2 py-1.5 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">✕</button>
          </div>
        </div>
      )}

      {open && (
        <div>
          {children.map(c => (
            <RoleDimensionNode key={c.id} dim={c} allDims={allDims} allGoals={allGoals}
              level={level + 1} onRefresh={onRefresh} />
          ))}
          {goals.map(g => (
            <RoleGoalNode key={g.id} goal={g} allGoals={allGoals}
              level={level + 1} onRefresh={onRefresh} projectNames={{}} taskNames={{}} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── RoleGoalNode ──────────────────────────────────────────────────── */

export function RoleGoalNode({ goal, allGoals, level, onRefresh, projectNames, taskNames }: GoalNodeProps) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState<null | "subgoal" | "project" | "task">(null);
  const [addVal, setAddVal] = useState("");

  const subGoals = allGoals.filter(g => g.parentGoalId === goal.id);
  const hasContent = subGoals.length > 0 || goal.projects.length > 0 || goal.tasks.length > 0;

  const statusColor = goal.status === "Completed" ? "#3D8C5A" : goal.status === "Active" ? "#5E5495" : "#6B7280";

  async function addSubGoal() {
    if (!addVal.trim()) return;
    await api.post(`/api/role-goals/${goal.id}/subgoal`, { title: addVal.trim() }).catch(() => {});
    setAddVal(""); setShowAdd(null); onRefresh();
  }
  async function linkProject() {
    if (!addVal.trim()) return;
    await api.post(`/api/role-goals/${goal.id}/link-project`, { id: addVal.trim() }).catch(() => {});
    setAddVal(""); setShowAdd(null); onRefresh();
  }
  async function linkTask() {
    if (!addVal.trim()) return;
    await api.post(`/api/role-goals/${goal.id}/link-task`, { id: addVal.trim() }).catch(() => {});
    setAddVal(""); setShowAdd(null); onRefresh();
  }
  async function handleDelete() {
    if (!confirm(`حذف "${goal.title}"؟`)) return;
    await api.delete(`/api/role-goals/${goal.id}`).catch(() => {});
    onRefresh();
  }
  async function updateProgress(p: number) {
    await api.put(`/api/role-goals/${goal.id}`, { progress: p }).catch(() => {});
    onRefresh();
  }

  const effectiveProgress = calcGoalProgress(goal.id, allGoals);

  const priorityBadge = goal.priority >= 4 ? { label: "عالية", bg: "#DC262615", color: "#DC2626" }
    : goal.priority >= 2 ? { label: "متوسطة", bg: "#D4AF3715", color: "#D4AF37" }
    : { label: "منخفضة", bg: "#3D8C5A15", color: "#3D8C5A" };

  return (
    <div style={{ marginRight: level > 0 ? 16 : 0 }}>
      <div className="flex items-center gap-2 py-2 group">
        <button onClick={() => setOpen(!open)}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] transition flex-shrink-0"
          style={{ color: statusColor, background: `${statusColor}15` }}>
          {hasContent ? (open ? "▼" : "◀") : "○"}
        </button>
        <span className="text-sm font-medium flex-1 truncate" style={{ color: goal.status === "Completed" ? "var(--muted)" : "var(--text)", textDecoration: goal.status === "Completed" ? "line-through" : "none" }}>
          🎯 {goal.title}
        </span>

        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
          style={{ background: priorityBadge.bg, color: priorityBadge.color }}>{priorityBadge.label}</span>

        {goal.timeframe && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex-shrink-0">{goal.timeframe}</span>
        )}

        <div className="w-12 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: `${statusColor}20` }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${effectiveProgress}%`, background: statusColor }} />
        </div>
        <span className="text-[10px] font-bold w-8 text-left flex-shrink-0" style={{ color: statusColor }}>{effectiveProgress}%</span>

        {goal.dueDate && (
          <span className="text-[8px] text-[#6B7280] flex-shrink-0">{new Date(goal.dueDate).toLocaleDateString("ar-SA")}</span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => setShowAdd(showAdd ? null : "subgoal")}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-gray-100 transition"
            style={{ color: "var(--muted)" }}>+</button>
          <button onClick={handleDelete}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-red-50 text-red-300 hover:text-red-500 transition">✕</button>
        </div>
      </div>

      {open && (
        <div className="mr-7 flex items-center gap-1 mb-1">
          <span className="text-[9px] text-[#6B7280]">تقدم:</span>
          {[0, 25, 50, 75, 100].map(p => (
            <button key={p} onClick={() => updateProgress(p)}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold transition"
              style={{ background: goal.progress === p ? statusColor : "#F3F4F6", color: goal.progress === p ? "#fff" : "#6B7280" }}>
              {p}%
            </button>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mr-7 mb-2 bg-white rounded-lg border border-gray-200 p-3 space-y-2 fade-up">
          <div className="flex gap-1">
            {(["subgoal", "project", "task"] as const).map(t => (
              <button key={t} onClick={() => setShowAdd(t)}
                className="px-2 py-1 rounded text-[9px] font-bold"
                style={{ background: showAdd === t ? "#5E5495" : "#F3F4F6", color: showAdd === t ? "#fff" : "#6B7280" }}>
                {t === "subgoal" ? "🎯 هدف فرعي" : t === "project" ? "📦 مشروع" : "✅ مهمة"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={addVal} onChange={e => setAddVal(e.target.value)}
              placeholder={showAdd === "subgoal" ? "عنوان الهدف الفرعي…" : showAdd === "project" ? "معرّف المشروع (ID)" : "معرّف المهمة (ID)"}
              onKeyDown={e => { if (e.key === "Enter") showAdd === "subgoal" ? addSubGoal() : showAdd === "project" ? linkProject() : linkTask(); }}
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" autoFocus />
            <button onClick={showAdd === "subgoal" ? addSubGoal : showAdd === "project" ? linkProject : linkTask}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#5E5495" }}>إضافة</button>
            <button onClick={() => { setShowAdd(null); setAddVal(""); }}
              className="px-2 py-1.5 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">✕</button>
          </div>
        </div>
      )}

      {open && (
        <div>
          {subGoals.map(sg => (
            <RoleGoalNode key={sg.id} goal={sg} allGoals={allGoals}
              level={level + 1} onRefresh={onRefresh} projectNames={projectNames} taskNames={taskNames} />
          ))}
          {goal.projects.length > 0 && (
            <div style={{ marginRight: 16 }} className="py-1">
              {goal.projects.map(pid => (
                <div key={pid} className="flex items-center gap-2 py-1 text-xs">
                  <span>📦</span>
                  <span style={{ color: "var(--text)" }}>{projectNames[pid] || pid.slice(0, 8) + "…"}</span>
                  <button onClick={async () => { await api.delete(`/api/role-goals/${goal.id}/projects/${pid}`).catch(() => {}); onRefresh(); }}
                    className="text-red-300 hover:text-red-500 text-[10px]">✕</button>
                </div>
              ))}
            </div>
          )}
          {goal.tasks.length > 0 && (
            <div style={{ marginRight: 16 }} className="py-1">
              {goal.tasks.map(tid => (
                <div key={tid} className="flex items-center gap-2 py-1 text-xs">
                  <span>✅</span>
                  <span style={{ color: "var(--text)" }}>{taskNames[tid] || tid.slice(0, 8) + "…"}</span>
                  <button onClick={async () => { await api.delete(`/api/role-goals/${goal.id}/tasks/${tid}`).catch(() => {}); onRefresh(); }}
                    className="text-red-300 hover:text-red-500 text-[10px]">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
