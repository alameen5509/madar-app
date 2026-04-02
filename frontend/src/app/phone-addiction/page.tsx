"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { GeometricDivider } from "@/components/IslamicPattern";

type Tab = "dashboard" | "log" | "triggers" | "zones" | "goal" | "tasks" | "plan";

interface Goal { id:string; currentDailyHours:number; targetDailyHours:number; weeklyReductionMinutes:number; whyMotivation?:string; startDate:string; targetDate?:string; status:string }
interface DayLog { id:string; date:string; actualMinutes:number; targetMinutes:number; mood?:string; topApps?:string; note?:string }
interface Trigger { id:string; triggerName:string; category:string; alternative?:string; frequency:number }
interface FreeZone { id:string; zoneName:string; startTime:string; endTime:string; daysOfWeek:string; isActive:boolean; streakDays:number }
interface PhoneTask { id:string; title:string; recurringType:string; recurringIntervalHours?:number; lastCompletedAt?:string; nextDueAt?:string; isCompleted:boolean; completedAt?:string; createdAt:string }
interface PlanWeek { week:number; weekStart:string; targetMinutes:number; actualAvgMinutes?:number; achieved:boolean }

const MOODS: Record<string,{label:string;icon:string}> = {
  great: { label: "ممتاز", icon: "😄" }, good: { label: "جيد", icon: "🙂" },
  neutral: { label: "عادي", icon: "😐" }, bad: { label: "سيئ", icon: "😟" }, terrible: { label: "صعب", icon: "😩" },
};
const TRIGGER_CATS: Record<string,{label:string;icon:string;color:string}> = {
  boredom: { label: "ملل", icon: "😑", color: "#6B7280" },
  anxiety: { label: "قلق", icon: "😰", color: "#F59E0B" },
  loneliness: { label: "وحدة", icon: "😔", color: "#3B82F6" },
  habit: { label: "عادة تلقائية", icon: "🔄", color: "#8B5CF6" },
  fomo: { label: "خوف الفوات", icon: "📱", color: "#DC2626" },
  procrastination: { label: "تسويف", icon: "⏳", color: "#D4AF37" },
};
const RECUR_TYPES: Record<string,string> = {
  none: "مرة واحدة", hourly: "كل ساعة", every3hours: "كل 3 ساعات",
  every5hours: "كل 5 ساعات", every10hours: "كل 10 ساعات", daily: "يومي",
};
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

// ═══ LOCAL STORAGE FALLBACK ═══
// Backend may not be deployed yet — use localStorage as fallback
const LS = {
  get: (key: string) => { try { return JSON.parse(localStorage.getItem("pa_" + key) ?? "null"); } catch { return null; } },
  set: (key: string, val: unknown) => { try { localStorage.setItem("pa_" + key, JSON.stringify(val)); } catch {} },
};

export default function PhoneAddictionPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [goal, setGoal] = useState<Goal|null>(null);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [zones, setZones] = useState<FreeZone[]>([]);
  const [tasks, setTasks] = useState<PhoneTask[]>([]);
  const [plan, setPlan] = useState<{weeks:PlanWeek[];currentWeek:number}|null>(null);
  const [stats, setStats] = useState<{streakDays:number;triggerCount:number;activeZones:number;dueTaskCount:number;last7Days:{date:string;actualMinutes:number;targetMinutes:number}[];todayLog?:DayLog|null;yesterdayLog?:DayLog|null}|null>(null);
  const [loading, setLoading] = useState(true);
  const [useLocal, setUseLocal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, t, z, tk, p] = await Promise.all([
        api.get("/api/phone-addiction/stats").then(r => r.data).catch(() => null),
        api.get("/api/phone-addiction/logs?days=30").then(r => r.data ?? []).catch(() => []),
        api.get("/api/phone-addiction/triggers").then(r => r.data ?? []).catch(() => []),
        api.get("/api/phone-addiction/free-zones").then(r => r.data ?? []).catch(() => []),
        api.get("/api/phone-addiction/tasks").then(r => r.data ?? []).catch(() => []),
        api.get("/api/phone-addiction/plan").then(r => r.data).catch(() => null),
      ]);
      // If API returned data, use it
      if (s?.goal || (l && l.length > 0)) {
        if (s?.goal) setGoal(s.goal);
        setStats(s);
        setLogs(l); setTriggers(t); setZones(z); setTasks(tk); setPlan(p);
      } else {
        // Fallback to localStorage
        setUseLocal(true);
        setGoal(LS.get("goal"));
        setLogs(LS.get("logs") ?? []);
        setTriggers(LS.get("triggers") ?? []);
        setZones(LS.get("zones") ?? []);
        setTasks(LS.get("tasks") ?? []);
      }
    } catch {
      setUseLocal(true);
      setGoal(LS.get("goal"));
      setLogs(LS.get("logs") ?? []);
      setTriggers(LS.get("triggers") ?? []);
      setZones(LS.get("zones") ?? []);
      setTasks(LS.get("tasks") ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function todayTarget(): number {
    if (!goal) return 120;
    const start = new Date(goal.startDate);
    const weeksElapsed = Math.floor((Date.now() - start.getTime()) / (7 * 86400000));
    const reducedMinutes = weeksElapsed * goal.weeklyReductionMinutes;
    const currentMin = goal.currentDailyHours * 60;
    const targetMin = goal.targetDailyHours * 60;
    return Math.max(targetMin, currentMin - reducedMinutes);
  }

  const todayTgt = Math.round(todayTarget());
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const todayLog = logs.find(l => l.date?.startsWith(today)) ?? (stats?.todayLog as DayLog | null | undefined);
  const yesterdayLog = logs.find(l => l.date?.startsWith(yesterday)) ?? (stats?.yesterdayLog as DayLog | null | undefined);
  const dueTasks = tasks.filter(t => !t.isCompleted && (!t.nextDueAt || new Date(t.nextDueAt) <= new Date()));
  const last7 = stats?.last7Days ?? logs.filter(l => new Date(l.date) >= new Date(Date.now() - 7 * 86400000)).map(l => ({ date: l.date, actualMinutes: l.actualMinutes, targetMinutes: l.targetMinutes }));
  const streakDays = stats?.streakDays ?? logs.filter(l => l.actualMinutes <= l.targetMinutes).length;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>📵 إدارة إدمان الجوال</h2>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>العلاج المعرفي السلوكي — وعي + تخفيض تدريجي + استبدال</p>
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {([["dashboard","لوحة التحكم","📊"],["log","التسجيل","📝"],["tasks","المهام","✅"],["plan","خطة العلاج","📈"],["triggers","المحفزات","⚡"],["zones","فترات آمنة","🔕"],["goal","الهدف","🎯"]] as [Tab,string,string][]).map(([k,l,ic]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{ background: tab === k ? "#DC2626" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#DC2626" : "var(--card-border)"}` }}>
              {ic} {l} {k === "tasks" && dueTasks.length > 0 ? `(${dueTasks.length})` : ""}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-2xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* ═══ DASHBOARD ═══ */}
        {!loading && tab === "dashboard" && (<>
          {!goal ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📵</p>
              <p className="font-bold" style={{ color: "var(--text)" }}>ابدأ رحلة التحرر من إدمان الجوال</p>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--muted)" }}>حدد واقعك الحالي وهدفك ثم تابع التقدم يومياً</p>
              <button onClick={() => setTab("goal")} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #DC2626, #D4AF37)" }}>🎯 حدد هدفك الأول</button>
            </div>
          ) : (<>
            {!yesterdayLog && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#F59E0B10", border: "1px solid #F59E0B30" }}>
                <span className="text-lg">⚠️</span>
                <div className="flex-1"><p className="text-xs font-bold" style={{ color: "#F59E0B" }}>لم تسجّل استخدام الأمس!</p></div>
                <button onClick={() => setTab("log")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#F59E0B" }}>سجّل</button>
              </div>
            )}
            {dueTasks.length > 0 && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#DC262608", border: "1px solid #DC262620" }}>
                <span className="text-lg">✅</span>
                <div className="flex-1"><p className="text-xs font-bold" style={{ color: "#DC2626" }}>{dueTasks.length} مهمة مستحقة</p></div>
                <button onClick={() => setTab("tasks")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#DC2626" }}>عرض</button>
              </div>
            )}
            <div className="rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>📱 اليوم</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#DC262615", color: "#DC2626" }}>هدف: {Math.floor(todayTgt/60)}س {todayTgt%60}د</span>
              </div>
              {todayLog ? (
                <div>
                  <div className="flex items-end gap-3 mb-2">
                    <span className="text-3xl font-black" style={{ color: todayLog.actualMinutes <= todayTgt ? "#3D8C5A" : "#DC2626" }}>{Math.floor(todayLog.actualMinutes/60)}:{String(todayLog.actualMinutes%60).padStart(2,"0")}</span>
                    <span className="text-xs mb-1" style={{ color: "var(--muted)" }}>ساعة</span>
                    {todayLog.mood && <span className="text-lg mb-0.5">{MOODS[todayLog.mood]?.icon ?? "😐"}</span>}
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (todayLog.actualMinutes/todayTgt)*100)}%`, background: todayLog.actualMinutes <= todayTgt ? "#3D8C5A" : "#DC2626" }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: todayLog.actualMinutes <= todayTgt ? "#3D8C5A" : "#DC2626" }}>
                    {todayLog.actualMinutes <= todayTgt ? `✅ أقل من الهدف بـ ${todayTgt - todayLog.actualMinutes} دقيقة` : `⚠️ تجاوزت بـ ${todayLog.actualMinutes - todayTgt} دقيقة`}
                  </p>
                </div>
              ) : (
                <button onClick={() => setTab("log")} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#DC2626" }}>📝 سجّل استخدامك</button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[{ val: streakDays, label: "ملتزم 🔥", color: "#3D8C5A" },{ val: dueTasks.length, label: "مهمة مستحقة", color: "#DC2626" },{ val: triggers.length, label: "محفز ⚡", color: "#D4AF37" },{ val: zones.filter(z => z.isActive).length, label: "فترة آمنة", color: "#5E5495" }].map((s, i) => (
                <div key={i} className="rounded-xl border p-2.5 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[8px]" style={{ color: "var(--muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "var(--text)" }}>📈 آخر 7 أيام</p>
              <div className="flex items-end gap-1 h-24">
                {(last7 ?? []).map((d, i) => {
                  const maxM = Math.max(...(last7 ?? []).map(x => Math.max(x.actualMinutes, x.targetMinutes)), 1);
                  const h = Math.max(4, (d.actualMinutes / maxM) * 90);
                  const ok = d.actualMinutes <= d.targetMinutes;
                  return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className="text-[7px] font-bold" style={{ color: ok ? "#3D8C5A" : "#DC2626" }}>{Math.round(d.actualMinutes/60)}س</span><div className="w-full rounded-t-lg transition-all" style={{ height: `${h}%`, background: ok ? "#3D8C5A" : "#DC2626" }} /><span className="text-[7px]" style={{ color: "var(--muted)" }}>{new Date(d.date).toLocaleDateString("ar-SA", { weekday: "narrow" })}</span></div>);
                })}
                {(last7 ?? []).length === 0 && <p className="text-center w-full text-[10px] py-8" style={{ color: "var(--muted)" }}>لا توجد بيانات</p>}
              </div>
            </div>
            {goal.whyMotivation && (
              <div className="rounded-xl p-4" style={{ background: "#D4AF3708", border: "1px solid #D4AF3720" }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>💡 لماذا أفعل هذا؟</p>
                <p className="text-xs" style={{ color: "var(--text)" }}>{goal.whyMotivation}</p>
              </div>
            )}
          </>)}
        </>)}

        {!loading && tab === "log" && (<DailyLogTab todayTarget={todayTgt} logs={logs} onSave={(newLogs) => { if (useLocal) { LS.set("logs", newLogs); setLogs(newLogs); } else load(); }} useLocal={useLocal} yesterdayLogged={!!yesterdayLog} />)}
        {!loading && tab === "tasks" && (<PhoneTasksTab tasks={tasks} onUpdate={(newTasks) => { if (useLocal) { LS.set("tasks", newTasks); setTasks(newTasks); } else load(); }} useLocal={useLocal} />)}
        {!loading && tab === "plan" && (<TreatmentPlanTab plan={plan} goal={goal} logs={logs} />)}
        {!loading && tab === "triggers" && (<TriggersTab triggers={triggers} onUpdate={(newT) => { if (useLocal) { LS.set("triggers", newT); setTriggers(newT); } else load(); }} useLocal={useLocal} />)}
        {!loading && tab === "zones" && (<FreeZonesTab zones={zones} onUpdate={(newZ) => { if (useLocal) { LS.set("zones", newZ); setZones(newZ); } else load(); }} useLocal={useLocal} />)}
        {!loading && tab === "goal" && (<GoalTab goal={goal} onSave={(g) => { if (useLocal) { LS.set("goal", g); setGoal(g); } else load(); setTab("dashboard"); }} useLocal={useLocal} />)}
      </div>
    </main>
  );
}

// ═══ DAILY LOG ═══
function DailyLogTab({ todayTarget, logs, onSave, useLocal, yesterdayLogged }: { todayTarget: number; logs: DayLog[]; onSave: (logs: DayLog[]) => void; useLocal: boolean; yesterdayLogged: boolean }) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const [logDate, setLogDate] = useState(yesterdayLogged ? today : yesterday);
  const existingLog = logs.find(l => l.date?.startsWith(logDate));
  const [hours, setHours] = useState(existingLog ? String(Math.floor(existingLog.actualMinutes/60)) : "");
  const [mins, setMins] = useState(existingLog ? String(existingLog.actualMinutes%60) : "");
  const [mood, setMood] = useState(existingLog?.mood ?? "");
  const [apps, setApps] = useState(existingLog?.topApps ?? "");
  const [note, setNote] = useState(existingLog?.note ?? "");

  useEffect(() => {
    const ex = logs.find(l => l.date?.startsWith(logDate));
    setHours(ex ? String(Math.floor(ex.actualMinutes/60)) : ""); setMins(ex ? String(ex.actualMinutes%60) : "");
    setMood(ex?.mood ?? ""); setApps(ex?.topApps ?? ""); setNote(ex?.note ?? "");
  }, [logDate, logs]);

  async function save() {
    const actual = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    if (actual === 0) return;
    if (useLocal) {
      const newLog: DayLog = { id: "l_" + Date.now(), date: logDate, actualMinutes: actual, targetMinutes: todayTarget, mood: mood || undefined, topApps: apps || undefined, note: note || undefined };
      const updated = [newLog, ...logs.filter(l => !l.date?.startsWith(logDate))];
      onSave(updated);
    } else {
      try { await api.post("/api/phone-addiction/logs", { date: logDate, actualMinutes: actual, targetMinutes: todayTarget, mood: mood || undefined, topApps: apps || undefined, note: note || undefined }); onSave(logs); } catch { alert("فشل الحفظ"); }
    }
  }

  return (
    <div className="space-y-4">
      <GeometricDivider label={logDate === yesterday ? "تسجيل الأمس" : "تسجيل يوم"} />
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex gap-2 items-center">
          <button type="button" onClick={() => setLogDate(yesterday)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: logDate === yesterday ? "#DC2626" : "var(--bg)", color: logDate === yesterday ? "#fff" : "var(--muted)", border: "1px solid " + (logDate === yesterday ? "#DC2626" : "var(--card-border)") }}>أمس</button>
          <button type="button" onClick={() => setLogDate(today)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: logDate === today ? "#DC2626" : "var(--bg)", color: logDate === today ? "#fff" : "var(--muted)", border: "1px solid " + (logDate === today ? "#DC2626" : "var(--card-border)") }}>اليوم</button>
          <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is} />
        </div>
        <p className="text-xs font-bold" style={{ color: "#DC2626" }}>📝 كم ساعة استخدمت الجوال؟</p>
        <div className="flex gap-3 items-center">
          <div className="flex-1"><label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>ساعات</label><input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="0" min="0" max="24" className="w-full px-3 py-2.5 rounded-xl border text-center text-lg font-bold focus:outline-none" style={is} /></div>
          <span className="text-lg font-bold mt-4" style={{ color: "var(--muted)" }}>:</span>
          <div className="flex-1"><label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>دقائق</label><input type="number" value={mins} onChange={e => setMins(e.target.value)} placeholder="0" min="0" max="59" className="w-full px-3 py-2.5 rounded-xl border text-center text-lg font-bold focus:outline-none" style={is} /></div>
        </div>
        <div><p className="text-[10px] font-bold mb-2" style={{ color: "var(--text)" }}>كيف مزاجك؟</p>
          <div className="flex gap-2">{Object.entries(MOODS).map(([k, v]) => (<button key={k} onClick={() => setMood(k)} className="flex-1 py-2 rounded-xl text-center transition" style={{ background: mood === k ? "#DC262615" : "var(--bg)", border: `1px solid ${mood === k ? "#DC2626" : "var(--card-border)"}` }}><span className="text-lg block">{v.icon}</span><span className="text-[8px]" style={{ color: mood === k ? "#DC2626" : "var(--muted)" }}>{v.label}</span></button>))}</div>
        </div>
        <input value={apps} onChange={e => setApps(e.target.value)} placeholder="أكثر التطبيقات" className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={is} />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة" className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={is} />
        <button onClick={save} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#DC2626" }}>{existingLog ? "تحديث" : "حفظ"}</button>
      </div>
      <GeometricDivider label={`السجل (${logs.length})`} />
      <div className="space-y-2">{logs.slice(0, 14).map(l => { const ok = l.actualMinutes <= l.targetMinutes; return (
        <div key={l.id} className="rounded-xl border px-4 py-2.5 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <span className="text-sm">{ok ? "✅" : "⚠️"}</span>
          <div className="flex-1"><span className="text-xs font-bold" style={{ color: ok ? "#3D8C5A" : "#DC2626" }}>{Math.floor(l.actualMinutes/60)}س {l.actualMinutes%60}د</span><span className="text-[9px] mx-2" style={{ color: "var(--muted)" }}>هدف: {Math.floor(l.targetMinutes/60)}س</span>{l.mood && <span className="text-sm">{MOODS[l.mood]?.icon}</span>}</div>
          <span className="text-[9px]" style={{ color: "var(--muted)" }}>{new Date(l.date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
        </div>); })}</div>
    </div>
  );
}

// ═══ PHONE TASKS ═══
function PhoneTasksTab({ tasks, onUpdate, useLocal }: { tasks: PhoneTask[]; onUpdate: (tasks: PhoneTask[]) => void; useLocal: boolean }) {
  const [showNew, setShowNew] = useState(false);
  const [nt, setNt] = useState({ title: "", type: "none" as string });

  async function add() {
    if (!nt.title.trim()) return;
    if (useLocal) {
      const newTask: PhoneTask = { id: "pt_" + Date.now(), title: nt.title, recurringType: nt.type, isCompleted: false, createdAt: new Date().toISOString(), nextDueAt: new Date().toISOString() };
      onUpdate([newTask, ...tasks]); setNt({ title: "", type: "none" }); setShowNew(false);
    } else {
      try { await api.post("/api/phone-addiction/tasks", { title: nt.title, recurringType: nt.type }); setNt({ title: "", type: "none" }); setShowNew(false); onUpdate(tasks); } catch {}
    }
  }

  async function complete(id: string) {
    if (useLocal) { onUpdate(tasks.map(t => t.id === id ? { ...t, isCompleted: t.recurringType === "none", lastCompletedAt: new Date().toISOString() } : t)); }
    else { try { await api.post("/api/phone-addiction/tasks/" + id + "/complete"); onUpdate(tasks); } catch {} }
  }

  async function del(id: string) {
    if (!confirm("حذف؟")) return;
    if (useLocal) { onUpdate(tasks.filter(t => t.id !== id)); }
    else { try { await api.delete("/api/phone-addiction/tasks/" + id); onUpdate(tasks); } catch {} }
  }

  const due = tasks.filter(t => !t.isCompleted && (!t.nextDueAt || new Date(t.nextDueAt) <= new Date()));
  const upcoming = tasks.filter(t => !t.isCompleted && t.nextDueAt && new Date(t.nextDueAt) > new Date());
  const completed = tasks.filter(t => t.isCompleted);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#DC262608", border: "1px solid #DC262620" }}><p className="text-xs font-bold mb-1" style={{ color: "#DC2626" }}>✅ مهام التحكم</p><p className="text-[10px]" style={{ color: "var(--text)" }}>مهام تساعدك على تقليل الاستخدام — مرة واحدة أو متكررة.</p></div>
      <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>المهام ({tasks.length})</span><button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#DC2626" }}>+ مهمة</button></div>
      {showNew && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <input value={nt.title} onChange={e => setNt({...nt, title: e.target.value})} placeholder="عنوان المهمة" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
          <div><p className="text-[9px] font-bold mb-1" style={{ color: "var(--muted)" }}>التكرار:</p><div className="flex flex-wrap gap-1.5">{Object.entries(RECUR_TYPES).map(([k, v]) => (<button key={k} onClick={() => setNt({...nt, type: k})} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition" style={{ background: nt.type === k ? "#DC262620" : "var(--bg)", color: nt.type === k ? "#DC2626" : "var(--muted)", border: `1px solid ${nt.type === k ? "#DC2626" : "var(--card-border)"}` }}>{v}</button>))}</div></div>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button><button onClick={add} disabled={!nt.title.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#DC2626" }}>إضافة</button></div>
        </div>
      )}
      {due.length > 0 && (<><p className="text-[10px] font-bold" style={{ color: "#DC2626" }}>🔴 مستحقة ({due.length})</p>{due.map(t => (
        <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: "#DC262605", borderColor: "#DC262620" }}>
          <button onClick={() => complete(t.id)} className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 hover:scale-110" style={{ borderColor: "#DC2626" }}><span className="text-[10px]" style={{ color: "#DC2626" }}>✓</span></button>
          <div className="flex-1"><p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.title}</p><span className="text-[9px]" style={{ color: "#DC2626" }}>{RECUR_TYPES[t.recurringType]}</span></div>
          <button onClick={() => del(t.id)} className="text-[9px]" style={{ color: "#DC2626" }}>🗑️</button>
        </div>))}</>)}
      {upcoming.length > 0 && (<><p className="text-[10px] font-bold mt-2" style={{ color: "#5E5495" }}>⏳ قادمة ({upcoming.length})</p>{upcoming.map(t => (
        <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <span className="text-lg">⏳</span><div className="flex-1"><p className="text-sm" style={{ color: "var(--text)" }}>{t.title}</p><span className="text-[9px]" style={{ color: "var(--muted)" }}>{RECUR_TYPES[t.recurringType]}</span></div>
          <button onClick={() => del(t.id)} className="text-[9px]" style={{ color: "#DC2626" }}>🗑️</button>
        </div>))}</>)}
      {completed.length > 0 && (<details className="mt-3"><summary className="text-[10px] cursor-pointer" style={{ color: "var(--muted)" }}>مكتملة ({completed.length})</summary><div className="space-y-1 mt-1">{completed.map(t => (<div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg opacity-50" style={{ background: "var(--card)" }}><span className="text-xs line-through flex-1" style={{ color: "var(--text)" }}>{t.title}</span></div>))}</div></details>)}
      {tasks.length === 0 && !showNew && <div className="text-center py-8"><p className="text-3xl mb-2">✅</p><p className="text-sm" style={{ color: "var(--muted)" }}>أضف مهام للتحكم</p></div>}
    </div>
  );
}

// ═══ TREATMENT PLAN ═══
function TreatmentPlanTab({ plan, goal, logs }: { plan: {weeks:PlanWeek[];currentWeek:number}|null; goal: Goal|null; logs: DayLog[] }) {
  if (!goal) return (<div className="text-center py-12"><p className="text-3xl mb-3">📈</p><p className="font-bold" style={{ color: "var(--text)" }}>حدد هدفك أولاً</p></div>);
  // Build local plan if API plan not available
  const weeks = plan?.weeks ?? (() => {
    const w: PlanWeek[] = [];
    const curMin = goal.currentDailyHours * 60;
    const tgtMin = goal.targetDailyHours * 60;
    const red = goal.weeklyReductionMinutes;
    const start = new Date(goal.startDate);
    let n = 0;
    while (curMin - (n * red) > tgtMin && n < 52) {
      n++;
      const ws = new Date(start.getTime() + (n - 1) * 7 * 86400000);
      const we = new Date(ws.getTime() + 7 * 86400000);
      const weekLogs = logs.filter(l => new Date(l.date) >= ws && new Date(l.date) < we);
      const avg = weekLogs.length > 0 ? weekLogs.reduce((s, l) => s + l.actualMinutes, 0) / weekLogs.length : undefined;
      const target = Math.max(tgtMin, curMin - (n * red));
      w.push({ week: n, weekStart: ws.toISOString().slice(0, 10), targetMinutes: Math.round(target), actualAvgMinutes: avg !== undefined ? Math.round(avg) : undefined, achieved: avg !== undefined && avg <= target });
    }
    return w;
  })();
  const currentWeek = plan?.currentWeek ?? Math.max(1, Math.ceil((Date.now() - new Date(goal.startDate).getTime()) / (7 * 86400000)));

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#3D8C5A08", border: "1px solid #3D8C5A20" }}><p className="text-xs font-bold mb-1" style={{ color: "#3D8C5A" }}>📈 خطة التخفيض</p><p className="text-[10px]" style={{ color: "var(--text)" }}>من {goal.currentDailyHours}س → {goal.targetDailyHours}س · تخفيض {goal.weeklyReductionMinutes}د/أسبوع · {weeks.length} أسبوع</p></div>
      <div className="space-y-2">{weeks.map(w => {
        const isCur = w.week === currentWeek; const isPast = w.week < currentWeek;
        return (<div key={w.week} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: isCur ? "#D4AF3708" : "var(--card)", borderColor: isCur ? "#D4AF3730" : "var(--card-border)", opacity: isPast && !w.achieved ? 0.6 : 1 }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: w.achieved ? "#3D8C5A" : isCur ? "#D4AF37" : isPast ? "#DC2626" : "var(--bg)", color: w.achieved || isCur ? "#fff" : isPast ? "#fff" : "var(--muted)" }}>{w.achieved ? "✓" : w.week}</div>
          <div className="flex-1"><div className="flex items-center gap-2"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>أسبوع {w.week}</span>{isCur && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#D4AF3715", color: "#D4AF37" }}>الحالي</span>}</div><p className="text-[9px]" style={{ color: "var(--muted)" }}>هدف: {Math.floor(w.targetMinutes/60)}س {Math.round(w.targetMinutes%60)}د{w.actualAvgMinutes != null && ` · فعلي: ${Math.floor(w.actualAvgMinutes/60)}س`}</p></div>
          {w.actualAvgMinutes != null && <span className="text-lg">{w.achieved ? "✅" : "❌"}</span>}
        </div>);
      })}{weeks.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>سجّل بيانات لعرض الخطة</p>}</div>
    </div>
  );
}

// ═══ TRIGGERS ═══
function TriggersTab({ triggers, onUpdate, useLocal }: { triggers: Trigger[]; onUpdate: (t: Trigger[]) => void; useLocal: boolean }) {
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ name: "", cat: "boredom", alt: "" });
  async function add() {
    if (!nf.name.trim()) return;
    if (useLocal) { onUpdate([...triggers, { id: "tr_" + Date.now(), triggerName: nf.name, category: nf.cat, alternative: nf.alt || undefined, frequency: 1 }]); }
    else { try { await api.post("/api/phone-addiction/triggers", { triggerName: nf.name, category: nf.cat, alternative: nf.alt || undefined }); onUpdate(triggers); } catch {} }
    setNf({ name: "", cat: "boredom", alt: "" }); setShowNew(false);
  }
  async function del(id: string) { if (!confirm("حذف؟")) return; if (useLocal) { onUpdate(triggers.filter(t => t.id !== id)); } else { try { await api.delete("/api/phone-addiction/triggers/" + id); onUpdate(triggers); } catch {} } }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#F59E0B08", border: "1px solid #F59E0B20" }}><p className="text-xs font-bold mb-1" style={{ color: "#F59E0B" }}>⚡ المحفزات</p><p className="text-[10px]" style={{ color: "var(--text)" }}>الشعور الذي يجعلك تمسك الجوال. حدد محفزاتك واكتب بديلاً صحياً.</p></div>
      <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>محفزاتي ({triggers.length})</span><button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#F59E0B" }}>+ محفز</button></div>
      {showNew && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <input value={nf.name} onChange={e => setNf({...nf, name: e.target.value})} placeholder="المحفز" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
          <div className="flex flex-wrap gap-1.5">{Object.entries(TRIGGER_CATS).map(([k, v]) => (<button key={k} onClick={() => setNf({...nf, cat: k})} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition" style={{ background: nf.cat === k ? `${v.color}20` : "var(--bg)", color: v.color, border: `1px solid ${nf.cat === k ? v.color : "var(--card-border)"}` }}>{v.icon} {v.label}</button>))}</div>
          <input value={nf.alt} onChange={e => setNf({...nf, alt: e.target.value})} placeholder="البديل الصحي" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
          <div className="flex gap-2 justify-end"><button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button><button onClick={add} disabled={!nf.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#F59E0B" }}>إضافة</button></div>
        </div>
      )}
      {triggers.map(t => { const cat = TRIGGER_CATS[t.category] ?? TRIGGER_CATS.habit; return (
        <div key={t.id} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2"><span className="text-lg">{cat.icon}</span><div className="flex-1"><p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.triggerName}</p><span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span></div><button onClick={() => del(t.id)} className="text-[9px]" style={{ color: "#DC2626" }}>🗑️</button></div>
          {t.alternative && <div className="mt-2 px-3 py-1.5 rounded-lg" style={{ background: "#3D8C5A08", border: "1px solid #3D8C5A15" }}><span className="text-[9px] font-bold" style={{ color: "#3D8C5A" }}>✅ البديل: </span><span className="text-[10px]" style={{ color: "var(--text)" }}>{t.alternative}</span></div>}
        </div>); })}
      {triggers.length === 0 && !showNew && <div className="text-center py-8"><p className="text-3xl mb-2">⚡</p><p className="text-sm" style={{ color: "var(--muted)" }}>حدد محفزاتك</p></div>}
    </div>
  );
}

// ═══ FREE ZONES ═══
function FreeZonesTab({ zones, onUpdate, useLocal }: { zones: FreeZone[]; onUpdate: (z: FreeZone[]) => void; useLocal: boolean }) {
  const [showNew, setShowNew] = useState(false);
  const [nz, setNz] = useState({ name: "", start: "22:00", end: "07:00", days: "all" });
  async function add() {
    if (!nz.name.trim()) return;
    if (useLocal) { onUpdate([...zones, { id: "fz_" + Date.now(), zoneName: nz.name, startTime: nz.start, endTime: nz.end, daysOfWeek: nz.days, isActive: true, streakDays: 0 }]); }
    else { try { await api.post("/api/phone-addiction/free-zones", { zoneName: nz.name, startTime: nz.start, endTime: nz.end, daysOfWeek: nz.days }); onUpdate(zones); } catch {} }
    setNz({ name: "", start: "22:00", end: "07:00", days: "all" }); setShowNew(false);
  }
  async function del(id: string) { if (!confirm("حذف؟")) return; if (useLocal) { onUpdate(zones.filter(z => z.id !== id)); } else { try { await api.delete("/api/phone-addiction/free-zones/" + id); onUpdate(zones); } catch {} } }
  async function toggle(id: string) { if (useLocal) { onUpdate(zones.map(z => z.id === id ? { ...z, isActive: !z.isActive } : z)); } else { try { await api.patch("/api/phone-addiction/free-zones/" + id, { isActive: !zones.find(z => z.id === id)?.isActive }); onUpdate(zones); } catch {} } }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#5E549508", border: "1px solid #5E549520" }}><p className="text-xs font-bold mb-1" style={{ color: "#5E5495" }}>🔕 فترات بلا جوال</p><p className="text-[10px]" style={{ color: "var(--text)" }}>أوقات ثابتة تلتزم فيها بعدم الاستخدام.</p></div>
      <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>فتراتي ({zones.length})</span><button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#5E5495" }}>+ فترة</button></div>
      {showNew && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <input value={nz.name} onChange={e => setNz({...nz, name: e.target.value})} placeholder="اسم الفترة" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
          <div className="flex gap-3"><div className="flex-1"><label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>من</label><input type="time" value={nz.start} onChange={e => setNz({...nz, start: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" style={is} /></div><div className="flex-1"><label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>إلى</label><input type="time" value={nz.end} onChange={e => setNz({...nz, end: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" style={is} /></div></div>
          <select value={nz.days} onChange={e => setNz({...nz, days: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-xs" style={is}><option value="all">كل الأيام</option><option value="weekdays">أيام العمل</option><option value="weekends">العطلة</option></select>
          <div className="flex gap-2 justify-end"><button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button><button onClick={add} disabled={!nz.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button></div>
        </div>
      )}
      {zones.map(z => (
        <div key={z.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--card-border)", opacity: z.isActive ? 1 : 0.5 }}>
          <span className="text-lg">🔕</span><div className="flex-1"><p className="text-sm font-medium" style={{ color: "var(--text)" }}>{z.zoneName}</p><p className="text-[10px]" style={{ color: "var(--muted)" }}>{z.startTime} — {z.endTime}</p></div>
          <button onClick={() => toggle(z.id)} className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: z.isActive ? "#3D8C5A15" : "#6B728015", color: z.isActive ? "#3D8C5A" : "#6B7280" }}>{z.isActive ? "✓" : "معطّل"}</button>
          <button onClick={() => del(z.id)} className="text-[9px]" style={{ color: "#DC2626" }}>🗑️</button>
        </div>))}
      {zones.length === 0 && !showNew && <div className="text-center py-8"><p className="text-3xl mb-2">🔕</p><p className="text-sm" style={{ color: "var(--muted)" }}>أضف فترات آمنة</p></div>}
    </div>
  );
}

// ═══ GOAL ═══
function GoalTab({ goal, onSave, useLocal }: { goal: Goal|null; onSave: (g: Goal) => void; useLocal: boolean }) {
  const [cur, setCur] = useState(goal ? String(goal.currentDailyHours) : "");
  const [tgt, setTgt] = useState(goal ? String(goal.targetDailyHours) : "2");
  const [red, setRed] = useState(goal ? String(goal.weeklyReductionMinutes) : "15");
  const [why, setWhy] = useState(goal?.whyMotivation ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate?.split("T")[0] ?? "");

  async function save() {
    if (!cur) return;
    const g: Goal = {
      id: goal?.id ?? "g_" + Date.now(), currentDailyHours: Number(cur), targetDailyHours: Number(tgt) || 2,
      weeklyReductionMinutes: Number(red) || 15, whyMotivation: why || undefined,
      startDate: goal?.startDate ?? new Date().toISOString(), targetDate: targetDate || undefined, status: "active",
    };
    if (useLocal) { onSave(g); }
    else {
      try { await api.post("/api/phone-addiction/goal", { currentDailyHours: Number(cur), targetDailyHours: Number(tgt) || 2, weeklyReductionMinutes: Number(red) || 15, whyMotivation: why || undefined, targetDate: targetDate || undefined }); onSave(g); } catch { alert("فشل الحفظ — تم الحفظ محلياً"); LS.set("goal", g); onSave(g); }
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#DC262608", border: "1px solid #DC262620" }}><p className="text-xs font-bold mb-1" style={{ color: "#DC2626" }}>🎯 التخفيض التدريجي</p><p className="text-[10px]" style={{ color: "var(--text)" }}>حدد واقعك وهدفك. النظام يخفّض تدريجياً كل أسبوع.</p></div>
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div><label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>📱 كم ساعة تستخدم يومياً؟</label><input type="number" value={cur} onChange={e => setCur(e.target.value)} placeholder="6" step="0.5" className="w-full px-4 py-3 rounded-xl border text-lg font-bold text-center focus:outline-none" style={is} /></div>
        <div><label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>🎯 الهدف (ساعات)</label><input type="number" value={tgt} onChange={e => setTgt(e.target.value)} placeholder="2" step="0.5" className="w-full px-4 py-3 rounded-xl border text-lg font-bold text-center focus:outline-none" style={is} /></div>
        <div><label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>⬇️ التخفيض الأسبوعي (دقائق)</label><input type="number" value={red} onChange={e => setRed(e.target.value)} placeholder="15" className="w-full px-4 py-2.5 rounded-xl border text-center focus:outline-none" style={is} /></div>
        <div><label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>💡 لماذا تريد التقليل؟</label><textarea value={why} onChange={e => setWhy(e.target.value)} rows={3} placeholder="دافعك العميق..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is} /></div>
        <div><label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>📅 تاريخ الوصول (اختياري)</label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none" style={is} /></div>
        {cur && tgt && <div className="rounded-xl p-3" style={{ background: "#3D8C5A08", border: "1px solid #3D8C5A15" }}><p className="text-[10px]" style={{ color: "#3D8C5A" }}>📊 من {cur}س → {tgt}س · تخفيض {red}د/أسبوع · ≈{Math.ceil(((Number(cur) - Number(tgt)) * 60) / (Number(red) || 15))} أسبوع</p></div>}
        <button onClick={save} disabled={!cur} className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#DC2626" }}>{goal ? "تحديث الهدف" : "🚀 ابدأ الرحلة"}</button>
      </div>
    </div>
  );
}
