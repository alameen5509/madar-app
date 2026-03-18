"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { GeometricDivider } from "@/components/IslamicPattern";
import {
  getCircles, getCircleTasks, createTask, createGoal, updateCircle,
  type LifeCircle, type CircleTask,
} from "@/lib/api";

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [circle, setCircle] = useState<LifeCircle | null>(null);
  const [tasks, setTasks]   = useState<CircleTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [circles, circleTasks] = await Promise.all([getCircles(), getCircleTasks(id)]);
      setCircle(circles.find((c) => c.id === id) ?? null);
      setTasks(circleTasks);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Quick add
  const [newTask, setNewTask] = useState("");
  const [newProject, setNewProject] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [addingProject, setAddingProject] = useState(false);

  async function handleAddTask() {
    if (!newTask.trim()) return;
    setAddingTask(true);
    try { await createTask({ title: newTask.trim(), lifeCircleId: id }); setNewTask(""); fetchData(); }
    catch { /* ignore */ }
    finally { setAddingTask(false); }
  }

  async function handleAddProject() {
    if (!newProject.trim()) return;
    setAddingProject(true);
    try { await createGoal({ title: newProject.trim(), lifeCircleId: id }); setNewProject(""); fetchData(); }
    catch { /* ignore */ }
    finally { setAddingProject(false); }
  }

  // Rename
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  async function saveName() {
    if (editName.trim() && editName !== circle?.name) {
      await updateCircle(id, { name: editName.trim() });
      fetchData();
    }
    setEditing(false);
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="px-8 py-16 text-center text-[#6B7280] animate-pulse">جارٍ التحميل...</div>
      </main>
    );
  }

  if (!circle) {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="px-8 py-16 text-center text-[#6B7280]">لم يتم العثور على هذا الدور</div>
      </main>
    );
  }

  const color = circle.colorHex ?? "#2C2C54";
  const icon = circle.iconKey ?? "⭕";

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${color}15` }}>
            {icon}
          </div>
          <div className="flex-1">
            {editing ? (
              <input ref={editRef} value={editName} onChange={(e) => setEditName(e.target.value)}
                onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                className="text-xl font-bold bg-transparent border-b-2 outline-none" style={{ color, borderColor: color }} />
            ) : (
              <h2 className="text-xl font-bold cursor-pointer hover:opacity-70" style={{ color }}
                onClick={() => { setEditName(circle.name); setEditing(true); }}>
                {circle.name} ✏️
              </h2>
            )}
            <p className="text-[#6B7280] text-xs mt-0.5">{circle.description}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-[#6B7280]">{circle.goalCount} مشروع</span>
              <span className="text-xs text-[#6B7280]">{circle.taskCount} مهمة</span>
              <span className="text-xs font-bold" style={{ color }}>{circle.progressPercent}% إنجاز</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${circle.progressPercent}%`, background: color }} />
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Projects */}
        <section>
          <GeometricDivider label="المشاريع" />
          <div className="mt-3 space-y-2">
            {circle.goals.map((g) => {
              const meta = { Active: "نشط", Paused: "تخطيط", Completed: "مكتمل", Archived: "فكرة" };
              return (
                <div key={g.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-[#16213E]">{g.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}12`, color }}>
                      {meta[g.status as keyof typeof meta] ?? g.status}
                    </span>
                  </div>
                  {g.description && <p className="text-[#6B7280] text-xs mb-2">{g.description}</p>}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${g.progressPercent}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color }}>{g.progressPercent}%</span>
                  </div>
                </div>
              );
            })}
            {/* Add project */}
            <div className="flex gap-2">
              <input value={newProject} onChange={(e) => setNewProject(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProject(); }}
                placeholder="مشروع جديد…"
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#D4AF37]" />
              <button onClick={handleAddProject} disabled={addingProject}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: color }}>
                {addingProject ? "..." : "+ مشروع"}
              </button>
            </div>
          </div>
        </section>

        {/* Tasks */}
        <section>
          <GeometricDivider label="المهام" />
          <div className="mt-3 space-y-1">
            {tasks.map((t) => {
              const done = t.status === "Completed";
              return (
                <div key={t.id} className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200 ${done ? "opacity-40" : ""}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done ? "border-[#2C2C54] bg-[#2C2C54]" : "border-gray-300"}`}>
                    {done && <span className="text-white text-[9px]">✓</span>}
                  </div>
                  <span className={`flex-1 text-sm ${done ? "line-through text-[#9CA3AF]" : "text-[#16213E]"}`}>{t.title}</span>
                  {t.dueDate && <span className="text-[10px] text-[#6B7280]">{new Date(t.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                </div>
              );
            })}
            {tasks.length === 0 && <p className="text-[#6B7280] text-xs text-center py-4">لا توجد مهام</p>}
            {/* Add task */}
            <div className="flex gap-2 mt-2">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                placeholder="مهمة جديدة…"
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#D4AF37]" />
              <button onClick={handleAddTask} disabled={addingTask}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: color }}>
                {addingTask ? "..." : "+ مهمة"}
              </button>
            </div>
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
