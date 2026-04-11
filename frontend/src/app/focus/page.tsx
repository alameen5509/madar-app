"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type SmartTask } from "@/lib/api";
import { NewTaskDialog, EditTaskDialog } from "@/app/tasks/page";

function localDateStr(d?: Date): string {
  const dt = d ?? new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function FocusPage() {
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdxRaw] = useState(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(sessionStorage.getItem("focus_idx") ?? "0") || 0;
  });
  function setIdx(n: number) { setIdxRaw(n); sessionStorage.setItem("focus_idx", String(n)); }
  const [showDone, setShowDone] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [timerSecs, setTimerSecs] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = sessionStorage.getItem("focus_timer");
    return saved ? parseInt(saved) || 0 : 0;
  });
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0 });
  const [sessionCtx, setSessionCtx] = useState<"office" | "outside" | "haram">("outside");
  const [nextPrayer, setNextPrayer] = useState<{ name: string; mins: number } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickTime, setPickTime] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/tasks");
      const all = (data ?? []) as SmartTask[];
      const nowTime = new Date();
      const completed = all.filter(t => t.status === "Completed").length;
      const cancelled = all.filter(t => t.status === "Cancelled").length;
      // Filter: pending, hide postponed-by-hours, apply session context
      const pending = all.filter(t => {
        if (t.status === "Completed" || t.status === "Inbox" || t.status === "Cancelled") return false;
        if (t.dueDate) {
          const due = new Date(t.dueDate);
          const h = due.getUTCHours(), m = due.getUTCMinutes();
          if ((h !== 0 || m !== 0) && due > nowTime) return false;
        }
        // Session context filter
        const ctx = (t.contextNote ?? "").match(/ctx:(\w+)/)?.[1] ?? "Anywhere";
        const ctxMap: Record<string, string[]> = {
          outside: ["Outside", "Phone", "Anywhere", "Haram", "Home"],
          office: ["Office", "Computer", "Anywhere"],
          haram: ["Haram", "Anywhere"],
        };
        if (!ctxMap[sessionCtx]?.includes(ctx)) return false;
        return true;
      });
      setStats({ total: all.length, completed, cancelled });
      // Sort: overdue first → today → tomorrow → future → no date last
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
  }, [sessionCtx]);

  useEffect(() => { load(); }, [load]);

  // Next prayer countdown
  useEffect(() => {
    function calcNext() {
      api.get("/api/salah/today?lat=24.7136&lng=46.6753").then(({ data }) => {
        if (!data) return;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const prayers = [
          { name: "الفجر", time: data.fajr },
          { name: "الظهر", time: data.dhuhr },
          { name: "العصر", time: data.asr },
          { name: "المغرب", time: data.maghrib },
          { name: "العشاء", time: data.isha },
        ];
        for (const p of prayers) {
          if (!p.time) continue;
          const [h, m] = p.time.split(":").map(Number);
          const pMins = h * 60 + m;
          if (pMins > nowMins) {
            setNextPrayer({ name: p.name, mins: pMins - nowMins });
            return;
          }
        }
        // All prayers passed — next is Fajr tomorrow
        if (prayers[0]?.time) {
          const [h, m] = prayers[0].time.split(":").map(Number);
          setNextPrayer({ name: "الفجر", mins: (24 * 60 - nowMins) + h * 60 + m });
        }
      }).catch(() => {});
    }
    calcNext();
    const iv = setInterval(calcNext, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Auto-start timer when task changes (only reset if different task)
  const [lastTaskId, setLastTaskId] = useState("");
  useEffect(() => {
    const currentId = tasks[idx]?.id ?? "";
    if (currentId && currentId !== lastTaskId) {
      // New task — check if we had a saved timer for it
      const savedId = sessionStorage.getItem("focus_task_id");
      if (savedId === currentId) {
        // Same task as before refresh — keep timer
      } else {
        setTimerSecs(0);
        sessionStorage.setItem("focus_timer", "0");
      }
      setLastTaskId(currentId);
      sessionStorage.setItem("focus_task_id", currentId);
    }
  }, [idx, tasks, lastTaskId]);

  // Timer always running — save every 5 seconds
  useEffect(() => {
    if (tasks.length === 0) return;
    const t = setInterval(() => {
      setTimerSecs(s => {
        const next = s + 1;
        if (next % 5 === 0) sessionStorage.setItem("focus_timer", String(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [tasks.length]);

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
    const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    try { await api.post(`/api/tasks/${t.id}/update`, { dueDate: d.toISOString() }); } catch {}
    alert(`⏰ المهمة مؤجلة حتى ${timeStr}`);
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
    setTimerSecs(0); sessionStorage.setItem("focus_timer", "0");
    sessionStorage.removeItem("focus_task_id");
    setTasks(prev => prev.filter((_, i) => i !== idx));
    if (idx >= tasks.length - 1) setIdx(Math.max(0, idx - 1));
  }

  async function markFrog() {
    const t = tasks[idx];
    if (!t) return;
    // 1. Set priority to 5 (highest)
    try { await api.post(`/api/tasks/${t.id}/update`, { userPriority: 5 }); } catch {}
    // 2. Update pulse of linked entity to "red" (critical)
    if (t.root?.entityId && t.root.kind !== "legacy") {
      try {
        const { data: allRoles } = await api.get("/api/war-room/roles");
        const roles = Array.isArray(allRoles) ? allRoles : [];
        const role = roles.find((r: { workId?: string }) => r.workId === t.root?.entityId);
        if (role) await api.patch(`/api/war-room/roles/${role.id}/pulse`, { status: "red", note: `🐸 مهمة حرجة: ${t.title}` });
      } catch {}
    }
    // 3. Update locally: move to top, mark as priority 5
    setTasks(prev => {
      const updated = prev.map((tk, i) => i === idx ? { ...tk, userPriority: 5 } : tk);
      const frogTask = updated[idx];
      const rest = updated.filter((_, i) => i !== idx);
      return [frogTask, ...rest];
    });
    setIdx(0);
    alert("🐸 تم تحويلها لمهمة ضفدع — أولوية قصوى ونبض حرج!");
  }


  async function setTaskTime() {
    const t = tasks[idx];
    if (!t || !pickTime) return;
    const [h, m] = pickTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    // If time is past today, set for tomorrow
    if (d < new Date()) d.setDate(d.getDate() + 1);
    try {
      await api.post(`/api/tasks/${t.id}/update`, { dueDate: d.toISOString() });
      setTasks(prev => prev.map((tk, i) => i === idx ? { ...tk, dueDate: d.toISOString() } : tk));
    } catch {}
    setShowTimePicker(false); setPickTime("");
  }

  function openEdit() { setShowEdit(true); }

  function skip() {
    if (idx < tasks.length - 1) setIdx(idx + 1);
    else setIdx(0);
  }

  function skipToAfterNext() {
    // Move current task to position idx+2 (after the next one)
    if (tasks.length <= 1) return;
    setTasks(prev => {
      const current = prev[idx];
      const without = prev.filter((_, i) => i !== idx);
      const insertAt = Math.min(idx + 1, without.length);
      return [...without.slice(0, insertAt), current, ...without.slice(insertAt)];
    });
    // idx stays same, which now points to what was the next task
  }

  const task = tasks[idx];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayStr = localDateStr();

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
      <header className="px-6 py-3 pr-14 md:pr-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🎯 التركيز</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>{idx + 1} من {tasks.length} نشطة</span>
              {stats.completed > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✅ {stats.completed}</span>}
              {nextPrayer && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: nextPrayer.mins <= 15 ? "#DC262615" : "#D4AF3715", color: nextPrayer.mins <= 15 ? "#DC2626" : "#D4AF37" }}>
                  🕌 {nextPrayer.name} بعد {nextPrayer.mins >= 60 ? `${Math.floor(nextPrayer.mins / 60)} س ${nextPrayer.mins % 60} د` : `${nextPrayer.mins} د`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowAddTask(true)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold" style={{ background: "#5E549515", color: "#5E5495" }}>+ مهمة</button>
            <Link href="/tasks" className="text-[9px] hover:underline" style={{ color: "#5E5495" }}>← المهام</Link>
          </div>
        </div>
        {/* Session context */}
        <div className="flex gap-1.5">
          {([
            { key: "outside", label: "غير مكتبي", icon: "🚶" },
            { key: "office", label: "مكتبي", icon: "💻" },
            { key: "haram", label: "الحرم", icon: "🕌" },
          ] as const).map(s => (
            <button key={s.key} onClick={() => { setSessionCtx(s.key); load(); }}
              className="flex-1 py-2 rounded-lg text-[10px] font-bold transition"
              style={{ background: sessionCtx === s.key ? "#5E5495" : "var(--bg)", color: sessionCtx === s.key ? "#fff" : "var(--muted)", border: `1px solid ${sessionCtx === s.key ? "#5E5495" : "var(--card-border)"}` }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </header>

      {/* Full task dialog — same as أعمال اليوم */}
      {showAddTask && (
        <NewTaskDialog goals={[]} onClose={() => setShowAddTask(false)}
          onCreated={(t) => {
            setTasks(prev => [...prev.slice(0, idx + 1), { ...t, id: t.id } as unknown as SmartTask, ...prev.slice(idx + 1)]);
            setShowAddTask(false);
            load(); // reload to get full task data
          }} />
      )}

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
            {/* Date + Time badge */}
            <div className="px-6 py-3 text-center" style={{ background: dl.color + "10" }}>
              <span className="text-sm font-black" style={{ color: dl.color }}>{dl.text}</span>
              {task.dueDate && (() => {
                const due = new Date(task.dueDate);
                const h = due.getUTCHours(), m = due.getUTCMinutes();
                if (h !== 0 || m !== 0) {
                  const localDue = new Date(task.dueDate);
                  return <span className="text-xs font-bold mr-2" style={{ color: dl.color }}> ⏰ {localDue.getHours().toString().padStart(2,"0")}:{localDue.getMinutes().toString().padStart(2,"0")}</span>;
                }
                return null;
              })()}
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <h1 className="font-black text-xl leading-relaxed text-center" style={{ color: "var(--text)" }}>{task.title}</h1>

              {/* Root breadcrumb — always show context */}
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg)" }}>
                {task.root ? (() => {
                  const r = task.root;
                  if (r.kind === "legacy") {
                    // Old system: show circle + goal without dimension
                    return (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
                        {r.entityName && <span className="font-bold" style={{ color: "#5E5495" }}>{r.entityName}</span>}
                        {r.entityName && r.goalTitle && <span style={{ color: "var(--muted)" }}>←</span>}
                        {r.goalTitle && <span style={{ color: "#D4AF37" }}>🎯 {r.goalTitle}</span>}
                      </div>
                    );
                  }
                  const base = r.kind === "job" ? `/jobs/${r.entityId}` : `/circles/${r.entitySlug ?? r.entityId}`;
                  return (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
                      <Link href={base} className="font-bold hover:underline" style={{ color: "#5E5495" }}>{r.entityName}</Link>
                      {r.dimensionName && <>
                        <span style={{ color: "var(--muted)" }}>←</span>
                        <Link href={`${base}/dimensions/${r.dimensionId}`} className="hover:underline" style={{ color: "#D4AF37" }}>📁 {r.dimensionName}</Link>
                      </>}
                      {r.goalTitle && <>
                        <span style={{ color: "var(--muted)" }}>←</span>
                        <Link href={`${base}/goals/${r.goalId}`} className="hover:underline" style={{ color: "#3D8C5A" }}>🎯 {r.goalTitle}</Link>
                      </>}
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
                    <span className="text-[10px]" style={{ color: "var(--muted)" }}>📋 مهمة مستقلة</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-center leading-relaxed" style={{ color: "var(--muted)" }}>{task.description}</p>
              )}

              {/* Priority + Task context */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{ background: priorityColor + "15", color: priorityColor }}>
                  {priorityLabel}
                </span>
                {(() => {
                  const ctx = (task.contextNote ?? "").match(/ctx:(\w+)/)?.[1] ?? "Anywhere";
                  const ctxLabels: Record<string, { label: string; icon: string; color: string }> = {
                    Office: { label: "مكتبي", icon: "💻", color: "#2D6B9E" },
                    Computer: { label: "حاسوب", icon: "🖥️", color: "#5E5495" },
                    Home: { label: "منزلي", icon: "🏠", color: "#D4AF37" },
                    Outside: { label: "خارجي", icon: "🚶", color: "#3D8C5A" },
                    Haram: { label: "الحرم", icon: "🕌", color: "#2C8C4A" },
                    Phone: { label: "جوال", icon: "📱", color: "#F59E0B" },
                    Anywhere: { label: "أي مكان", icon: "📋", color: "#9CA3AF" },
                  };
                  const c = ctxLabels[ctx] ?? ctxLabels.Anywhere;
                  return <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{ background: c.color + "15", color: c.color }}>{c.icon} {c.label}</span>;
                })()}
              </div>
              {/* Change task context */}
              <div className="flex items-center justify-center gap-2">
                {[
                  { key: "Office", icon: "💻", label: "مكتبي" },
                  { key: "Anywhere", icon: "🚶", label: "غير مكتبي" },
                  { key: "Haram", icon: "🕌", label: "الحرم" },
                ].map(c => {
                  const current = (task.contextNote ?? "").match(/ctx:(\w+)/)?.[1] ?? "Anywhere";
                  return (
                    <button key={c.key} onClick={async () => {
                      try { await api.post(`/api/tasks/${task.id}/update`, { taskContext: c.key }); } catch {}
                      setTasks(prev => prev.map((t, i) => i === idx ? { ...t, contextNote: (t.contextNote ?? "").replace(/ctx:\w+/, "") + `|ctx:${c.key}` } : t));
                    }}
                      className="px-3 py-2 rounded-xl text-[10px] font-bold transition"
                      style={{ background: current === c.key ? "#5E5495" : "var(--bg)", color: current === c.key ? "#fff" : "var(--muted)", border: `1px solid ${current === c.key ? "#5E5495" : "var(--card-border)"}` }}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timer (auto-start) + Actions */}
            <div className="p-6 pt-0 space-y-3">
              <div className="rounded-xl p-2 text-center" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
                <p className="text-xl font-black font-mono" style={{ color: "#5E5495" }}>
                  {`${Math.floor(timerSecs / 3600).toString().padStart(2, "0")}:${Math.floor((timerSecs % 3600) / 60).toString().padStart(2, "0")}:${(timerSecs % 60).toString().padStart(2, "0")}`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={complete}
                  className="py-4 rounded-2xl text-sm font-black text-white transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #3D8C5A, #2C8C4A)" }}>
                  أنجزتها ✅ {timerSecs >= 60 ? `(${Math.floor(timerSecs / 60)} د)` : ""}
                </button>
                <button onClick={markFrog}
                  className="py-4 rounded-2xl text-sm font-black transition-all active:scale-95"
                  style={{ background: "#F59E0B15", color: "#F59E0B", border: "2px solid #F59E0B40" }}>
                  🐸 ضفدع
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => postponeTo(1)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>غداً</button>
                <button onClick={() => postponeHours(1)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#3B82F615", color: "#3B82F6", border: "1px solid #3B82F630" }}>بعد ساعة</button>
                <button onClick={() => postponeHours(5)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#5E549515", color: "#5E5495", border: "1px solid #5E549530" }}>بعد 5 ساعات</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => postponeTo(7)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#8B5CF615", color: "#8B5CF6", border: "1px solid #8B5CF630" }}>الأسبوع القادم</button>
                <button onClick={skipToAfterNext} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#D4AF3710", color: "#D4AF37", border: "1px solid #D4AF3730" }}>بعد التالية</button>
                <button onClick={skip} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>تخطي →</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setShowTimePicker(!showTimePicker)} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#3B82F610", color: "#3B82F6", border: "1px solid #3B82F630" }}>⏰ وقت</button>
                <button onClick={openEdit} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#5E549510", color: "#5E5495", border: "1px solid #5E549530" }}>✏️ تعديل</button>
                <button onClick={deleteTask} className="py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95" style={{ background: "#DC262610", color: "#DC2626", border: "1px solid #DC262630" }}>حذف 🗑️</button>
              </div>

              {/* Time picker */}
              {showTimePicker && (
                <div className="rounded-xl border p-3 flex items-center gap-2" style={{ background: "var(--bg)", borderColor: "#3B82F630" }}>
                  <span className="text-xs font-bold" style={{ color: "#3B82F6" }}>⏰</span>
                  <input type="time" value={pickTime} onChange={e => setPickTime(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                  <button onClick={setTaskTime} disabled={!pickTime} className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40" style={{ background: "#3B82F6" }}>تعيين</button>
                  <button onClick={() => { setShowTimePicker(false); setPickTime(""); }} className="text-xs" style={{ color: "var(--muted)" }}>✕</button>
                </div>
              )}

              {/* Full Edit Dialog */}
              {showEdit && (
                <EditTaskDialog
                  task={{
                    id: task.id, title: task.title, description: task.description,
                    circle: task.lifeCircle?.name ?? "—", circleColor: task.lifeCircle?.color,
                    circleOrder: 0, done: false, isInbox: false, isRecurring: task.isRecurring ?? false,
                    recurrenceRule: task.recurrenceRule, isWork: (task.contextNote ?? "").includes("work"),
                    isUrgent: (task.contextNote ?? "").includes("urgent"),
                    waitingFor: (task.contextNote ?? "").match(/waiting:([^|]+)/)?.[1],
                    dueDate: task.dueDate, hasSubtasks: false,
                    context: (task.contextNote ?? "").match(/ctx:(\w+)/)?.[1] ?? "Anywhere",
                    suitablePeriod: (task.contextNote ?? "").match(/period:(\w+)/)?.[1] ?? "all",
                    priority: task.userPriority >= 4 ? "عالية" : task.userPriority >= 3 ? "متوسطة" : "منخفضة",
                    goalId: task.goal?.id, goalTitle: task.goal?.title,
                  }}
                  onClose={() => setShowEdit(false)}
                  onSaved={() => { setShowEdit(false); load(); }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
