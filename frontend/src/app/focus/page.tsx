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
    return parseInt(localStorage.getItem("focus_idx") ?? "0") || 0;
  });
  function setIdx(n: number) { setIdxRaw(n); localStorage.setItem("focus_idx", String(n)); }
  const [showDone, setShowDone] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0 });
  const [sessionCtx, setSessionCtx] = useState<"office" | "outside" | "haram" | "mobile" | "dev" | "home">("outside");
  const [nextPrayer, setNextPrayer] = useState<{ name: string; mins: number } | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [inactiveTasks, setInactiveTasks] = useState<SmartTask[]>([]);
  const [showInactive, setShowInactive] = useState(false);
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
      // Clean up old skipped entries (keep only today's)
      const todayStr = localDateStr();
      const skippedRaw = JSON.parse(localStorage.getItem("focus_skipped") ?? "{}");
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const cleanSkipped: Record<string, number> = {};
      for (const [id, ts] of Object.entries(skippedRaw)) {
        if (typeof ts === "number" && ts >= todayStart.getTime()) cleanSkipped[id] = ts;
      }
      localStorage.setItem("focus_skipped", JSON.stringify(cleanSkipped));

      // Filter: overdue + today + no date only (not future), hide hour-postponed, skipped, apply session
      const pending = all.filter(t => {
        // Hide skipped tasks
        if (cleanSkipped[t.id]) return false;
        if (t.status === "Completed" || t.status === "Cancelled") return false;
        // Only show: overdue + today — exclude future and no-date
        if (!t.dueDate) return false; // no date — not due now
        const ds = t.dueDate.slice(0, 10);
        if (ds > todayStr) return false; // future — not due yet
        {
          // Hide hour-postponed tasks (today with specific future time)
          const due = new Date(t.dueDate);
          const h = due.getHours(), m = due.getMinutes();
          if ((h !== 0 || m !== 0) && due > nowTime) return false;
        }
        // Session context filter — check explicit session tag first, then fall back to context
        const note = t.contextNote ?? "";
        const taskSessionTag = note.match(/session:(\w+)/)?.[1];
        const ctx = note.match(/ctx:(\w+)/)?.[1] ?? "Anywhere";
        if (taskSessionTag) {
          // Task has explicit session — only show in that session or عام
          if (sessionCtx !== "outside" && taskSessionTag !== sessionCtx) return false;
        } else {
          // No session tag — filter by context
          const ctxMap: Record<string, string[]> = {
            outside: ["Outside", "Phone", "Anywhere", "Haram", "Home"],
            office: ["Office", "Computer"],
            haram: ["Haram"],
            mobile: ["Phone", "Online"],
            dev: ["Computer", "Online"],
            home: ["Home"],
          };
          if (!ctxMap[sessionCtx]?.includes(ctx)) return false;
        }
        return true;
      });
      setStats({ total: all.length, completed, cancelled });
      // Inactive: future + no-date + hour-postponed (same session context)
      const inactive = all.filter(t => {
        if (t.status === "Completed" || t.status === "Cancelled") return false;
        if (pending.some(p => p.id === t.id)) return false; // already in active
        const note2 = t.contextNote ?? "";
        const tSession = note2.match(/session:(\w+)/)?.[1];
        const ctx = note2.match(/ctx:(\w+)/)?.[1] ?? "Anywhere";
        if (tSession) {
          if (sessionCtx !== "outside" && tSession !== sessionCtx) return false;
        } else {
          const ctxMap2: Record<string, string[]> = { outside: ["Outside","Phone","Anywhere","Haram","Home"], office: ["Office","Computer"], haram: ["Haram"], mobile: ["Phone","Online"], dev: ["Computer","Online"], home: ["Home"] };
          if (!ctxMap2[sessionCtx]?.includes(ctx)) return false;
        }
        return true;
      });
      inactive.sort((a, b) => {
        const da = a.dueDate?.slice(0, 10) ?? "9999";
        const db = b.dueDate?.slice(0, 10) ?? "9999";
        return da.localeCompare(db);
      });
      setInactiveTasks(inactive);
      // Count tasks per session (before session filter)
      const allPending = all.filter(t => t.status !== "Completed" && t.status !== "Cancelled");
      const ctxMapAll: Record<string, string[]> = {
        outside: ["Outside", "Phone", "Anywhere", "Haram", "Home"],
        office: ["Office", "Computer"],
        haram: ["Haram"],
        mobile: ["Phone", "Online"],
        dev: ["Computer", "Online"],
        home: ["Home"],
      };
      const counts: Record<string, number> = {};
      for (const s of ["outside", "office", "haram", "mobile", "dev", "home"]) {
        counts[s] = allPending.filter(t => {
          const n = t.contextNote ?? "";
          const ts = n.match(/session:(\w+)/)?.[1];
          const ctx = n.match(/ctx:(\w+)/)?.[1] ?? "Anywhere";
          if (ts) return s === "outside" || ts === s;
          return ctxMapAll[s]?.includes(ctx);
        }).length;
      }
      setSessionCounts(counts);
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

  // Timer: use start timestamp — accurate even after leaving page
  const [lastTaskId, setLastTaskId] = useState("");
  useEffect(() => {
    const currentId = tasks[idx]?.id ?? "";
    if (currentId && currentId !== lastTaskId) {
      const savedId = localStorage.getItem("focus_task_id");
      if (savedId !== currentId) {
        // New task — record start time
        localStorage.setItem("focus_start", String(Date.now()));
      }
      setLastTaskId(currentId);
      localStorage.setItem("focus_task_id", currentId);
    }
  }, [idx, tasks, lastTaskId]);

  // Calculate elapsed from start timestamp every second
  useEffect(() => {
    if (tasks.length === 0) return;
    function calc() {
      const start = parseInt(localStorage.getItem("focus_start") ?? "0");
      if (start > 0) setTimerSecs(Math.floor((Date.now() - start) / 1000));
    }
    calc();
    const t = setInterval(calc, 1000);
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

  async function completeAndRepeat() {
    const t = tasks[idx];
    if (!t) return;
    setShowDone(true);
    try {
      // 1. Mark current task as completed
      await api.patch(`/api/tasks/${t.id}/status`, { status: "Completed" });
      // 2. Create new task for tomorrow with same details
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}T00:00:00`;
      await api.post("/api/tasks", {
        title: t.title,
        description: t.description,
        userPriority: t.userPriority,
        dueDate: tomorrowStr,
        contextNote: t.contextNote,
      });
    } catch {}
    setTimeout(() => {
      setShowDone(false);
      removeCurrentTask();
      load();
    }, 1200);
  }

  async function postponeTo(days: number) {
    const t = tasks[idx];
    if (!t) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    const localISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T00:00:00`;
    try { await api.post(`/api/tasks/${t.id}/update`, { dueDate: localISO }); } catch {}
    removeCurrentTask();
  }

  async function postponeHours(hours: number) {
    const t = tasks[idx];
    if (!t) return;
    const d = new Date();
    d.setHours(d.getHours() + hours);
    // Send as local datetime string (no UTC conversion) so backend stores it as-is
    const localISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:00`;
    try { await api.post(`/api/tasks/${t.id}/update`, { dueDate: localISO }); } catch {}
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
    setTimerSecs(0);
    localStorage.setItem("focus_start", String(Date.now()));
    localStorage.removeItem("focus_task_id");
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
  }


  async function setTaskTime() {
    const t = tasks[idx];
    if (!t || !pickTime) return;
    const [h, m] = pickTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d < new Date()) d.setDate(d.getDate() + 1);
    const localISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:00`;
    try {
      await api.post(`/api/tasks/${t.id}/update`, { dueDate: localISO });
      setTasks(prev => prev.map((tk, i) => i === idx ? { ...tk, dueDate: localISO } : tk));
    } catch {}
    setShowTimePicker(false); setPickTime("");
  }

  function openEdit() { setShowEdit(true); }

  function skip() {
    // Save skipped task ID with timestamp so it stays skipped for this session
    const t = tasks[idx];
    if (t) {
      const skipped = JSON.parse(localStorage.getItem("focus_skipped") ?? "{}");
      skipped[t.id] = Date.now();
      localStorage.setItem("focus_skipped", JSON.stringify(skipped));
    }
    removeCurrentTask();
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

  // Auto-switch to next session with tasks when current session is empty
  useEffect(() => {
    if (tasks.length === 0 && !showInactive && !loading) {
      const order: typeof sessionCtx[] = ["outside", "office", "haram", "mobile", "dev", "home"];
      const next = order.find(s => s !== sessionCtx && (sessionCounts[s] ?? 0) > 0);
      if (next) {
        // Show brief notification then switch
        const toast = document.createElement("div");
        toast.textContent = `✅ أنجزت مهام الجلسة — الانتقال للجلسة التالية`;
        toast.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#3D8C5A;color:#fff;padding:8px 16px;border-radius:12px;font-size:12px;font-weight:bold;z-index:100;transition:opacity 0.3s";
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 1500);
        setSessionCtx(next);
        load();
      }
    }
  }, [tasks.length, showInactive, loading, sessionCtx, sessionCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tasks.length === 0 && !showInactive) {
    // All sessions empty — show completion screen
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6" style={{ background: "var(--bg)" }}>
        <p className="text-5xl">🎉</p>
        <p className="font-black text-lg" style={{ color: "var(--text)" }}>أنجزت جميع المهام المستحقة!</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>لا توجد مهام مستحقة في أي جلسة</p>
        {inactiveTasks.length > 0 && (
          <button onClick={() => { setTasks(inactiveTasks); setShowInactive(true); setIdx(0); }}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition active:scale-95"
            style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>
            📋 عرض المهام القادمة ({inactiveTasks.length} مهمة)
          </button>
        )}
        <Link href="/tasks" className="text-xs hover:underline mt-2" style={{ color: "#5E5495" }}>← العودة للمهام</Link>
      </main>
    );
  }

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
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { key: "outside", label: "عام", icon: "🚶" },
            { key: "office", label: "مكتبي", icon: "💻" },
            { key: "haram", label: "الحرم", icon: "🕌" },
            { key: "mobile", label: "الجوال", icon: "📱" },
            { key: "dev", label: "التطوير", icon: "🛠️" },
            { key: "home", label: "المنزل", icon: "🏠" },
          ] as const).map(s => {
            const count = sessionCounts[s.key] ?? 0;
            return (
              <button key={s.key} onClick={() => { setSessionCtx(s.key); load(); }}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition"
                style={{ background: sessionCtx === s.key ? "#5E5495" : "var(--bg)", color: sessionCtx === s.key ? "#fff" : "var(--muted)", border: `1px solid ${sessionCtx === s.key ? "#5E5495" : "var(--card-border)"}` }}>
                {s.icon} {s.label}
                {count > 0 && <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full text-[8px] font-bold px-1" style={{ background: sessionCtx === s.key ? "rgba(255,255,255,0.25)" : "#5E549520", color: sessionCtx === s.key ? "#fff" : "#5E5495" }}>{count}</span>}
              </button>
            );
          })}
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
              <span className="text-[10px] font-bold ml-2" style={{ color: dl.color + "80" }}>{idx + 1}/{tasks.length}</span>
              <span className="text-sm font-black" style={{ color: dl.color }}>{dl.text}</span>
              {task.dueDate && (() => {
                const due = new Date(task.dueDate);
                const h = due.getHours(), m = due.getMinutes();
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
                    const eid = String(r.entityId ?? "");
                    const gid = String(r.goalId ?? "");
                    return (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
                        {r.entityName && (
                          <Link href={eid ? `/circles/${eid}` : "/circles"} className="font-bold hover:underline" style={{ color: "#5E5495" }}>{r.entityName}</Link>
                        )}
                        {r.entityName && r.goalTitle && <span style={{ color: "var(--muted)" }}>←</span>}
                        {r.goalTitle && (
                          <Link href={gid ? `/projects?id=${gid}` : "/projects"} className="hover:underline" style={{ color: "#D4AF37" }}>🎯 {r.goalTitle}</Link>
                        )}
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
                  const sessionTag = (task.contextNote ?? "").match(/session:(\w+)/)?.[1];
                  const sessionLabels: Record<string, { label: string; icon: string; color: string }> = {
                    outside: { label: "عام", icon: "🚶", color: "#3D8C5A" },
                    office: { label: "مكتبي", icon: "💻", color: "#2D6B9E" },
                    haram: { label: "الحرم", icon: "🕌", color: "#2C8C4A" },
                    mobile: { label: "الجوال", icon: "📱", color: "#F59E0B" },
                    dev: { label: "التطوير", icon: "🛠️", color: "#5E5495" },
                    home: { label: "المنزل", icon: "🏠", color: "#D4AF37" },
                  };
                  const s = sessionLabels[sessionTag ?? "outside"] ?? sessionLabels.outside;
                  return <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold" style={{ background: s.color + "15", color: s.color }}>{s.icon} {s.label}</span>;
                })()}
              </div>
              {/* Change task session */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: "outside", icon: "🚶", label: "عام" },
                  { key: "office", icon: "💻", label: "مكتبي" },
                  { key: "haram", icon: "🕌", label: "الحرم" },
                  { key: "mobile", icon: "📱", label: "الجوال" },
                  { key: "dev", icon: "🛠️", label: "التطوير" },
                  { key: "home", icon: "🏠", label: "المنزل" },
                ].map(c => {
                  const currentSession = (task.contextNote ?? "").match(/session:(\w+)/)?.[1] ?? "outside";
                  return (
                    <button key={c.key} onClick={async () => {
                      try { await api.post(`/api/tasks/${task.id}/update`, { session: c.key === "outside" ? "" : c.key }); } catch {}
                      load();
                    }}
                      className="py-1.5 rounded-xl text-[10px] font-bold transition"
                      style={{ background: currentSession === c.key ? "#5E5495" : "var(--bg)", color: currentSession === c.key ? "#fff" : "var(--muted)", border: `1px solid ${currentSession === c.key ? "#5E5495" : "var(--card-border)"}` }}>
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
                <button onClick={completeAndRepeat}
                  className="py-4 rounded-2xl text-sm font-black transition-all active:scale-95"
                  style={{ background: "#3D8C5A15", color: "#3D8C5A", border: "2px solid #3D8C5A40" }}>
                  أنجز وأعد غداً 🔁
                </button>
              </div>
              <div className="grid grid-cols-1">
                <button onClick={markFrog}
                  className="py-2.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                  style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>
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
