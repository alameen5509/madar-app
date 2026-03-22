"use client";

import { useState } from "react";
import { api } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface JobDim {
  id: string; jobId: string; parentDimensionId: string | null;
  name: string; icon: string | null; color: string | null; priority: number;
}

export interface JobGoalData {
  id: string; jobId: string; dimensionId: string; parentGoalId: string | null;
  title: string; description: string | null; dueDate: string | null;
  progress: number; status: string; priority: number; timeframe: string | null;
  projects: string[]; tasks: string[];
}

interface DimNodeProps {
  dim: JobDim;
  allDims: JobDim[];
  allGoals: JobGoalData[];
  level: number;
  onRefresh: () => void;
}

interface GoalNodeProps {
  goal: JobGoalData;
  allGoals: JobGoalData[];
  level: number;
  onRefresh: () => void;
  projectNames: Record<string, string>;
  taskNames: Record<string, string>;
}

const DIM_COLORS = ["#2D6B9E", "#5E5495", "#D4AF37", "#3D8C5A", "#DC2626", "#0F3460"];
const DIM_ICONS = ["📁", "📊", "🎯", "📋", "💡", "🔧", "📈", "🏗️", "🤝", "📐"];

/* ─── JobDimensionNode ──────────────────────────────────────────────── */

export function JobDimensionNode({ dim, allDims, allGoals, level, onRefresh }: DimNodeProps) {
  const [open, setOpen] = useState(level === 0);
  const [showAdd, setShowAdd] = useState<null | "dim" | "goal">(null);
  const [addName, setAddName] = useState("");

  const children = allDims.filter(d => d.parentDimensionId === dim.id);
  const goals = allGoals.filter(g => g.dimensionId === dim.id && !g.parentGoalId);
  const hasContent = children.length > 0 || goals.length > 0;

  // Calculate progress: average of direct goals progress
  const dimGoals = allGoals.filter(g => g.dimensionId === dim.id);
  const avgProgress = dimGoals.length > 0
    ? Math.round(dimGoals.reduce((s, g) => s + g.progress, 0) / dimGoals.length)
    : 0;

  async function addChild() {
    if (!addName.trim()) return;
    await api.post(`/api/job-dimensions/${dim.id}/child`, { name: addName.trim() }).catch(() => {});
    setAddName(""); setShowAdd(null); onRefresh();
  }

  async function addGoal() {
    if (!addName.trim()) return;
    await api.post(`/api/job-dimensions/${dim.id}/goal`, { title: addName.trim() }).catch(() => {});
    setAddName(""); setShowAdd(null); onRefresh();
  }

  async function handleDelete() {
    if (!confirm(`حذف "${dim.name}"؟`)) return;
    await api.delete(`/api/job-dimensions/${dim.id}`).catch(() => {});
    onRefresh();
  }

  const color = dim.color || DIM_COLORS[level % DIM_COLORS.length];

  return (
    <div style={{ marginRight: level > 0 ? 16 : 0 }}>
      {/* Header */}
      <div className="flex items-center gap-2 py-2 group">
        <button onClick={() => setOpen(!open)}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] transition flex-shrink-0"
          style={{ color, background: `${color}15` }}>
          {hasContent ? (open ? "▼" : "◀") : "●"}
        </button>
        <span className="text-base">{dim.icon || "📁"}</span>
        <span className="text-sm font-bold flex-1 truncate" style={{ color: "var(--text)" }}>{dim.name}</span>

        {/* Progress */}
        <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: `${color}20` }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${avgProgress}%`, background: color }} />
        </div>
        <span className="text-[10px] font-bold w-8 text-left flex-shrink-0" style={{ color }}>{avgProgress}%</span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => setShowAdd(showAdd ? null : "dim")}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-gray-100 transition"
            style={{ color: "var(--muted)" }} title="إضافة">+</button>
          <button onClick={handleDelete}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-red-50 text-red-300 hover:text-red-500 transition">✕</button>
        </div>
      </div>

      {/* Add menu */}
      {showAdd && (
        <div className="mr-7 mb-2 bg-white rounded-lg border border-gray-200 p-3 space-y-2 fade-up" style={{ marginRight: level > 0 ? 16 : 0 }}>
          {!showAdd || showAdd === "dim" || showAdd === "goal" ? (
            <>
              {showAdd !== "goal" && showAdd !== "dim" && (
                <div className="flex gap-2">
                  <button onClick={() => setShowAdd("dim")} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: color }}>📁 جانب فرعي</button>
                  <button onClick={() => setShowAdd("goal")} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>🎯 هدف</button>
                </div>
              )}
              {(showAdd === "dim" || showAdd === "goal") && (
                <div className="flex gap-2">
                  <div className="flex gap-1 mb-1">
                    <button onClick={() => setShowAdd("dim")} className="px-2 py-1 rounded text-[9px] font-bold"
                      style={{ background: showAdd === "dim" ? color : "#F3F4F6", color: showAdd === "dim" ? "#fff" : "#6B7280" }}>📁 جانب فرعي</button>
                    <button onClick={() => setShowAdd("goal")} className="px-2 py-1 rounded text-[9px] font-bold"
                      style={{ background: showAdd === "goal" ? "#D4AF37" : "#F3F4F6", color: showAdd === "goal" ? "#fff" : "#6B7280" }}>🎯 هدف</button>
                  </div>
                </div>
              )}
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
            </>
          ) : null}
        </div>
      )}

      {/* Children */}
      {open && (
        <div>
          {children.map(c => (
            <JobDimensionNode key={c.id} dim={c} allDims={allDims} allGoals={allGoals}
              level={level + 1} onRefresh={onRefresh} />
          ))}
          {goals.map(g => (
            <JobGoalNode key={g.id} goal={g} allGoals={allGoals}
              level={level + 1} onRefresh={onRefresh} projectNames={{}} taskNames={{}} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── JobGoalNode ───────────────────────────────────────────────────── */

export function JobGoalNode({ goal, allGoals, level, onRefresh, projectNames, taskNames }: GoalNodeProps) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState<null | "subgoal" | "project" | "task">(null);
  const [addVal, setAddVal] = useState("");

  const subGoals = allGoals.filter(g => g.parentGoalId === goal.id);
  const hasContent = subGoals.length > 0 || goal.projects.length > 0 || goal.tasks.length > 0;

  const statusColor = goal.status === "Completed" ? "#3D8C5A" : goal.status === "Active" ? "#2D6B9E" : "#6B7280";

  async function addSubGoal() {
    if (!addVal.trim()) return;
    await api.post(`/api/job-goals/${goal.id}/subgoal`, { title: addVal.trim() }).catch(() => {});
    setAddVal(""); setShowAdd(null); onRefresh();
  }

  async function linkProject() {
    if (!addVal.trim()) return;
    await api.post(`/api/job-goals/${goal.id}/link-project`, { id: addVal.trim() }).catch(() => {});
    setAddVal(""); setShowAdd(null); onRefresh();
  }

  async function linkTask() {
    if (!addVal.trim()) return;
    await api.post(`/api/job-goals/${goal.id}/link-task`, { id: addVal.trim() }).catch(() => {});
    setAddVal(""); setShowAdd(null); onRefresh();
  }

  async function handleDelete() {
    if (!confirm(`حذف "${goal.title}"؟`)) return;
    await api.delete(`/api/job-goals/${goal.id}`).catch(() => {});
    onRefresh();
  }

  async function updateProgress(p: number) {
    await api.put(`/api/job-goals/${goal.id}`, { progress: p }).catch(() => {});
    onRefresh();
  }

  const priorityBadge = goal.priority >= 4 ? { label: "عالية", bg: "#DC262615", color: "#DC2626" }
    : goal.priority >= 2 ? { label: "متوسطة", bg: "#D4AF3715", color: "#D4AF37" }
    : { label: "منخفضة", bg: "#3D8C5A15", color: "#3D8C5A" };

  return (
    <div style={{ marginRight: level > 0 ? 16 : 0 }}>
      {/* Header */}
      <div className="flex items-center gap-2 py-2 group">
        <button onClick={() => setOpen(!open)}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] transition flex-shrink-0"
          style={{ color: statusColor, background: `${statusColor}15` }}>
          {hasContent ? (open ? "▼" : "◀") : "○"}
        </button>
        <span className="text-sm font-medium flex-1 truncate" style={{ color: goal.status === "Completed" ? "var(--muted)" : "var(--text)", textDecoration: goal.status === "Completed" ? "line-through" : "none" }}>
          🎯 {goal.title}
        </span>

        {/* Priority badge */}
        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
          style={{ background: priorityBadge.bg, color: priorityBadge.color }}>{priorityBadge.label}</span>

        {/* Timeframe */}
        {goal.timeframe && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex-shrink-0">{goal.timeframe}</span>
        )}

        {/* Progress */}
        <div className="w-12 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: `${statusColor}20` }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, background: statusColor }} />
        </div>
        <span className="text-[10px] font-bold w-8 text-left flex-shrink-0" style={{ color: statusColor }}>{goal.progress}%</span>

        {/* Due date */}
        {goal.dueDate && (
          <span className="text-[8px] text-[#6B7280] flex-shrink-0">{new Date(goal.dueDate).toLocaleDateString("ar-SA")}</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => setShowAdd(showAdd ? null : "subgoal")}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-gray-100 transition"
            style={{ color: "var(--muted)" }}>+</button>
          <button onClick={handleDelete}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-red-50 text-red-300 hover:text-red-500 transition">✕</button>
        </div>
      </div>

      {/* Progress buttons (when expanded) */}
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

      {/* Add menu */}
      {showAdd && (
        <div className="mr-7 mb-2 bg-white rounded-lg border border-gray-200 p-3 space-y-2 fade-up">
          <div className="flex gap-1">
            {(["subgoal", "project", "task"] as const).map(t => (
              <button key={t} onClick={() => setShowAdd(t)}
                className="px-2 py-1 rounded text-[9px] font-bold"
                style={{ background: showAdd === t ? "#2D6B9E" : "#F3F4F6", color: showAdd === t ? "#fff" : "#6B7280" }}>
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
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>إضافة</button>
            <button onClick={() => { setShowAdd(null); setAddVal(""); }}
              className="px-2 py-1.5 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">✕</button>
          </div>
        </div>
      )}

      {/* Children */}
      {open && (
        <div>
          {subGoals.map(sg => (
            <JobGoalNode key={sg.id} goal={sg} allGoals={allGoals}
              level={level + 1} onRefresh={onRefresh} projectNames={projectNames} taskNames={taskNames} />
          ))}
          {goal.projects.length > 0 && (
            <div style={{ marginRight: 16 }} className="py-1">
              {goal.projects.map(pid => (
                <div key={pid} className="flex items-center gap-2 py-1 text-xs">
                  <span>📦</span>
                  <span style={{ color: "var(--text)" }}>{projectNames[pid] || pid.slice(0, 8) + "…"}</span>
                  <button onClick={async () => { await api.delete(`/api/job-goals/${goal.id}/projects/${pid}`).catch(() => {}); onRefresh(); }}
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
                  <button onClick={async () => { await api.delete(`/api/job-goals/${goal.id}/tasks/${tid}`).catch(() => {}); onRefresh(); }}
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
