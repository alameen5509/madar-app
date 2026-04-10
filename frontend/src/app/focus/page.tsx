"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type SmartTask } from "@/lib/api";

export default function FocusPage() {
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/tasks");
      const all = (data ?? []) as SmartTask[];
      // Filter: pending only, no inbox, no cancelled
      const pending = all.filter(t => t.status !== "Completed" && t.status !== "Inbox" && t.status !== "Cancelled");
      // Sort: overdue first → today → tomorrow → future → no date last
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const todayStr = now.toISOString().slice(0, 10);
      pending.sort((a, b) => {
        const da = a.dueDate?.slice(0, 10) ?? "9999";
        const db = b.dueDate?.slice(0, 10) ?? "9999";
        if (da !== db) return da.localeCompare(db);
        return (b.userPriority ?? 0) - (a.userPriority ?? 0);
      });
      setTasks(pending);
      setIdx(0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function complete() {
    const t = tasks[idx];
    if (!t) return;
    setShowDone(true);
    try { await api.patch(`/api/tasks/${t.id}/status`, { status: "Completed" }); } catch {}
    setTimeout(() => {
      setShowDone(false);
      setTasks(prev => prev.filter((_, i) => i !== idx));
      if (idx >= tasks.length - 1) setIdx(Math.max(0, idx - 1));
    }, 1200);
  }

  async function postponeTo(days: number) {
    const t = tasks[idx];
    if (!t) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    try { await api.post(`/api/tasks/${t.id}/update`, { dueDate: d.toISOString() }); } catch {}
    removeCurrentTask();
  }

  async function postponeHours(hours: number) {
    const t = tasks[idx];
    if (!t) return;
    const d = new Date();
    d.setHours(d.getHours() + hours);
    try { await api.post(`/api/tasks/${t.id}/update`, { dueDate: d.toISOString() }); } catch {}
    removeCurrentTask();
  }

  async function deleteTask() {
    const t = tasks[idx];
    if (!t) return;
    if (!confirm(`حذف "${t.title}"؟`)) return;
    try { await api.delete(`/api/tasks/${t.id}`); } catch {}
    removeCurrentTask();
  }

  function removeCurrentTask() {
    setTasks(prev => prev.filter((_, i) => i !== idx));
    if (idx >= tasks.length - 1) setIdx(Math.max(0, idx - 1));
  }

  function skip() {
    if (idx < tasks.length - 1) setIdx(idx + 1);
    else setIdx(0);
  }

  const task = tasks[idx];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function dateLabel(d?: string): { text: string; color: string } {
    if (!d) return { text: "بلا تاريخ", color: "#9CA3AF" };
    const ds = d.slice(0, 10);
    if (ds < todayStr) {
      const diff = Math.round((now.getTime() - new Date(ds).getTime()) / 86400000);
      return { text: `⚠ متأخرة ${diff} ${diff === 1 ? "يوم" : "أيام"}`, color: "#DC2626" };
    }
    if (ds === todayStr) return { text: "📌 اليوم", color: "#D4AF37" };
    const tom = new Date(now); tom.setDate(tom.getDate() + 1);
    const tomStr = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, "0")}-${String(tom.getDate()).padStart(2, "0")}`;
    if (ds === tomStr) return { text: "غداً", color: "#5E5495" };
    return { text: new Date(ds).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "short" }), color: "#3B82F6" };
  }

  if (loading) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-8 h-8 border-3 border-[#5E5495] border-t-transparent rounded-full animate-spin" />
    </main>
  );

  if (tasks.length === 0) return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6" style={{ background: "var(--bg)" }}>
      <p className="text-5xl">🎉</p>
      <p className="font-black text-lg" style={{ color: "var(--text)" }}>لا توجد مهام!</p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>أتممت جميع مهامك — استمر</p>
      <Link href="/tasks" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#5E5495" }}>← العودة للمهام</Link>
    </main>
  );

  if (!task) return null;
  const dl = dateLabel(task.dueDate);
  const circle = task.lifeCircle;
  const priorityLabel = task.userPriority >= 4 ? "عالية" : task.userPriority >= 3 ? "متوسطة" : "منخفضة";
  const priorityColor = task.userPriority >= 4 ? "#DC2626" : task.userPriority >= 3 ? "#D4AF37" : "#3D8C5A";

  return (
    <main className="flex-1 flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-6 py-4 pr-14 md:pr-6 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
        <div>
          <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🎯 التركيز</h2>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{idx + 1} من {tasks.length} مهمة</p>
        </div>
        <Link href="/tasks" className="text-xs hover:underline" style={{ color: "#5E5495" }}>← المهام</Link>
      </header>

      {/* Progress */}
      <div className="px-6 pt-4">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${((idx + 1) / tasks.length) * 100}%`, background: "linear-gradient(90deg, #5E5495, #D4AF37)" }} />
        </div>
      </div>

      {/* Task Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        {showDone ? (
          <div className="text-center animate-bounce">
            <p className="text-6xl mb-3">✅</p>
            <p className="font-black text-xl" style={{ color: "#3D8C5A" }}>أحسنت!</p>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-3xl border-2 shadow-xl overflow-hidden" style={{ background: "var(--card)", borderColor: dl.color + "40" }}>
            {/* Date badge */}
            <div className="px-6 py-3 text-center" style={{ background: dl.color + "10" }}>
              <span className="text-sm font-black" style={{ color: dl.color }}>{dl.text}</span>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <h1 className="font-black text-xl leading-relaxed text-center" style={{ color: "var(--text)" }}>{task.title}</h1>

              {/* Root breadcrumb */}
              {task.root ? (() => {
                const r = task.root;
                const base = r.kind === "job" ? `/jobs/${r.entityId}` : `/circles/${r.entitySlug ?? r.entityId}`;
                return (
                  <div className="rounded-xl p-3 text-center space-y-1" style={{ background: "var(--bg)" }}>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
                      <Link href={base} className="font-bold hover:underline" style={{ color: "#5E5495" }}>{r.entityName}</Link>
                      <span style={{ color: "var(--muted)" }}>←</span>
                      <Link href={`${base}/dimensions/${r.dimensionId}`} className="hover:underline" style={{ color: "#D4AF37" }}>📁 {r.dimensionName}</Link>
                      <span style={{ color: "var(--muted)" }}>←</span>
                      <Link href={`${base}/goals/${r.goalId}`} className="hover:underline" style={{ color: "#3D8C5A" }}>🎯 {r.goalTitle}</Link>
                    </div>
                  </div>
                );
              })() : (task.goal || circle) && (
                <div className="rounded-xl p-3 text-center space-y-1" style={{ background: "var(--bg)" }}>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
                    {circle && <span className="font-bold" style={{ color: circle.color ?? "#5E5495" }}>{circle.icon ?? "●"} {circle.name}</span>}
                    {circle && task.goal && <span style={{ color: "var(--muted)" }}>←</span>}
                    {task.goal && <span style={{ color: "#D4AF37" }}>🎯 {task.goal.title}</span>}
                  </div>
                </div>
              )}

              {/* Description */}
              {task.description && (
                <p className="text-xs text-center leading-relaxed" style={{ color: "var(--muted)" }}>{task.description}</p>
              )}

              {/* Priority */}
              <div className="flex items-center justify-center">
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{ background: priorityColor + "15", color: priorityColor }}>
                  {priorityLabel}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 pt-0 space-y-3">
              <button onClick={complete}
                className="w-full py-4 rounded-2xl text-base font-black text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #3D8C5A, #2C8C4A)", boxShadow: "0 4px 20px rgba(61,140,90,0.3)" }}>
                أنجزتها ✅
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => postponeTo(1)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>غداً</button>
                <button onClick={() => postponeHours(1)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#3B82F615", color: "#3B82F6", border: "1px solid #3B82F630" }}>بعد ساعة</button>
                <button onClick={() => postponeHours(5)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#5E549515", color: "#5E5495", border: "1px solid #5E549530" }}>بعد 5 ساعات</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => postponeTo(7)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#8B5CF615", color: "#8B5CF6", border: "1px solid #8B5CF630" }}>الأسبوع القادم</button>
                <button onClick={skip} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>تخطي →</button>
                <button onClick={deleteTask} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#DC262610", color: "#DC2626", border: "1px solid #DC262630" }}>حذف 🗑️</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
