"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { GeometricDivider } from "@/components/IslamicPattern";

type Tab = "dashboard" | "log" | "triggers" | "zones" | "goal";

interface Goal { id:string; currentDailyHours:number; targetDailyHours:number; weeklyReductionMinutes:number; whyMotivation?:string; startDate:string; targetDate?:string; status:string }
interface DayLog { id:string; date:string; actualMinutes:number; targetMinutes:number; mood?:string; topApps?:string; note?:string }
interface Trigger { id:string; triggerName:string; category:string; alternative?:string; frequency:number }
interface FreeZone { id:string; zoneName:string; startTime:string; endTime:string; daysOfWeek:string; isActive:boolean; streakDays:number }

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
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function PhoneAddictionPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [goal, setGoal] = useState<Goal|null>(null);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [zones, setZones] = useState<FreeZone[]>([]);
  const [stats, setStats] = useState<{streakDays:number;triggerCount:number;activeZones:number;last7Days:{date:string;actualMinutes:number;targetMinutes:number}[];todayLog?:DayLog|null}|null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, t, z] = await Promise.all([
        api.get("/api/phone-addiction/stats").then(r => r.data).catch(() => null),
        api.get("/api/phone-addiction/logs?days=30").then(r => r.data ?? []).catch(() => []),
        api.get("/api/phone-addiction/triggers").then(r => r.data ?? []).catch(() => []),
        api.get("/api/phone-addiction/free-zones").then(r => r.data ?? []).catch(() => []),
      ]);
      if (s?.goal) setGoal(s.goal);
      setStats(s);
      setLogs(l);
      setTriggers(t);
      setZones(z);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ═══ Today's target based on gradual reduction ═══
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
  const todayLog = stats?.todayLog as DayLog | null | undefined;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>📵 إدارة إدمان الجوال</h2>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>العلاج المعرفي السلوكي — وعي + تخفيض تدريجي + استبدال</p>
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {([["dashboard","لوحة التحكم","📊"],["log","التسجيل اليومي","📝"],["triggers","المحفزات","⚡"],["zones","فترات بلا جوال","🔕"],["goal","الهدف","🎯"]] as [Tab,string,string][]).map(([k,l,ic]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{ background: tab === k ? "#DC2626" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#DC2626" : "var(--card-border)"}` }}>
              {ic} {l}
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
            {/* Today card */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>📱 اليوم</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#DC262615", color: "#DC2626" }}>هدف: {Math.floor(todayTgt/60)}س {todayTgt%60}د</span>
              </div>
              {todayLog ? (
                <div>
                  <div className="flex items-end gap-3 mb-2">
                    <span className="text-3xl font-black" style={{ color: todayLog.actualMinutes <= todayTgt ? "#3D8C5A" : "#DC2626" }}>
                      {Math.floor(todayLog.actualMinutes/60)}:{String(todayLog.actualMinutes%60).padStart(2,"0")}
                    </span>
                    <span className="text-xs mb-1" style={{ color: "var(--muted)" }}>ساعة</span>
                    {todayLog.mood && <span className="text-lg mb-0.5">{MOODS[todayLog.mood]?.icon ?? "😐"}</span>}
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (todayLog.actualMinutes/todayTgt)*100)}%`, background: todayLog.actualMinutes <= todayTgt ? "#3D8C5A" : "#DC2626" }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: todayLog.actualMinutes <= todayTgt ? "#3D8C5A" : "#DC2626" }}>
                    {todayLog.actualMinutes <= todayTgt ? `✅ أقل من الهدف بـ ${todayTgt - todayLog.actualMinutes} دقيقة` : `⚠️ تجاوزت الهدف بـ ${todayLog.actualMinutes - todayTgt} دقيقة`}
                  </p>
                </div>
              ) : (
                <button onClick={() => setTab("log")} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#DC2626" }}>📝 سجّل استخدامك اليوم</button>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border p-3 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <p className="text-2xl font-black" style={{ color: "#3D8C5A" }}>{stats?.streakDays ?? 0}</p>
                <p className="text-[9px]" style={{ color: "var(--muted)" }}>أيام ملتزم 🔥</p>
              </div>
              <div className="rounded-xl border p-3 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <p className="text-2xl font-black" style={{ color: "#D4AF37" }}>{stats?.triggerCount ?? 0}</p>
                <p className="text-[9px]" style={{ color: "var(--muted)" }}>محفز محدد ⚡</p>
              </div>
              <div className="rounded-xl border p-3 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <p className="text-2xl font-black" style={{ color: "#5E5495" }}>{stats?.activeZones ?? 0}</p>
                <p className="text-[9px]" style={{ color: "var(--muted)" }}>فترة آمنة 🔕</p>
              </div>
            </div>

            {/* 7-day chart */}
            <div className="rounded-2xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "var(--text)" }}>📈 آخر 7 أيام</p>
              <div className="flex items-end gap-1 h-24">
                {(stats?.last7Days ?? []).map((d, i) => {
                  const maxM = Math.max(...(stats?.last7Days ?? []).map(x => Math.max(x.actualMinutes, x.targetMinutes)), 1);
                  const h = Math.max(4, (d.actualMinutes / maxM) * 90);
                  const ok = d.actualMinutes <= d.targetMinutes;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[7px] font-bold" style={{ color: ok ? "#3D8C5A" : "#DC2626" }}>{Math.round(d.actualMinutes/60)}س</span>
                      <div className="w-full rounded-t-lg transition-all" style={{ height: `${h}%`, background: ok ? "#3D8C5A" : "#DC2626" }} />
                      <span className="text-[7px]" style={{ color: "var(--muted)" }}>{new Date(d.date).toLocaleDateString("ar-SA", { weekday: "narrow" })}</span>
                    </div>
                  );
                })}
                {(stats?.last7Days ?? []).length === 0 && <p className="text-center w-full text-[10px] py-8" style={{ color: "var(--muted)" }}>لا توجد بيانات بعد</p>}
              </div>
            </div>

            {/* Why motivation */}
            {goal.whyMotivation && (
              <div className="rounded-xl p-4" style={{ background: "#D4AF3708", border: "1px solid #D4AF3720" }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>💡 لماذا أفعل هذا؟</p>
                <p className="text-xs" style={{ color: "var(--text)" }}>{goal.whyMotivation}</p>
              </div>
            )}
          </>)}
        </>)}

        {/* ═══ DAILY LOG ═══ */}
        {!loading && tab === "log" && (<DailyLogTab todayTarget={todayTgt} logs={logs} onSave={load} />)}

        {/* ═══ TRIGGERS ═══ */}
        {!loading && tab === "triggers" && (<TriggersTab triggers={triggers} onUpdate={load} />)}

        {/* ═══ FREE ZONES ═══ */}
        {!loading && tab === "zones" && (<FreeZonesTab zones={zones} onUpdate={load} />)}

        {/* ═══ GOAL SETUP ═══ */}
        {!loading && tab === "goal" && (<GoalTab goal={goal} onSave={() => { load(); setTab("dashboard"); }} />)}
      </div>
    </main>
  );
}

// ═══ DAILY LOG TAB ═══════════════════════════════════════════════════════════
function DailyLogTab({ todayTarget, logs, onSave }: { todayTarget: number; logs: DayLog[]; onSave: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const todayLog = logs.find(l => l.date?.startsWith(today));
  const [hours, setHours] = useState(todayLog ? String(Math.floor(todayLog.actualMinutes/60)) : "");
  const [mins, setMins] = useState(todayLog ? String(todayLog.actualMinutes%60) : "");
  const [mood, setMood] = useState(todayLog?.mood ?? "");
  const [apps, setApps] = useState(todayLog?.topApps ?? "");
  const [note, setNote] = useState(todayLog?.note ?? "");

  async function save() {
    const actual = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    if (actual === 0) return;
    try {
      await api.post("/api/phone-addiction/logs", { date: today, actualMinutes: actual, targetMinutes: todayTarget, mood: mood || undefined, topApps: apps || undefined, note: note || undefined });
      onSave();
    } catch { alert("فشل الحفظ"); }
  }

  return (
    <div className="space-y-4">
      <GeometricDivider label="تسجيل اليوم" />
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <p className="text-xs font-bold" style={{ color: "#DC2626" }}>📝 كم ساعة استخدمت الجوال اليوم؟</p>
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>ساعات</label>
            <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="0" min="0" max="24"
              className="w-full px-3 py-2.5 rounded-xl border text-center text-lg font-bold focus:outline-none" style={is} />
          </div>
          <span className="text-lg font-bold mt-4" style={{ color: "var(--muted)" }}>:</span>
          <div className="flex-1">
            <label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>دقائق</label>
            <input type="number" value={mins} onChange={e => setMins(e.target.value)} placeholder="0" min="0" max="59"
              className="w-full px-3 py-2.5 rounded-xl border text-center text-lg font-bold focus:outline-none" style={is} />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text)" }}>كيف مزاجك؟</p>
          <div className="flex gap-2">
            {Object.entries(MOODS).map(([k, v]) => (
              <button key={k} onClick={() => setMood(k)} className="flex-1 py-2 rounded-xl text-center transition"
                style={{ background: mood === k ? "#DC262615" : "var(--bg)", border: `1px solid ${mood === k ? "#DC2626" : "var(--card-border)"}` }}>
                <span className="text-lg block">{v.icon}</span>
                <span className="text-[8px]" style={{ color: mood === k ? "#DC2626" : "var(--muted)" }}>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        <input value={apps} onChange={e => setApps(e.target.value)} placeholder="أكثر التطبيقات استخداماً (مثال: تويتر، يوتيوب)"
          className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={is} />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة (اختياري)"
          className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={is} />

        <button onClick={save} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#DC2626" }}>
          {todayLog ? "تحديث تسجيل اليوم" : "حفظ تسجيل اليوم"}
        </button>
      </div>

      {/* Previous logs */}
      <GeometricDivider label={`السجل (${logs.length})`} />
      <div className="space-y-2">
        {logs.slice(0, 14).map(l => {
          const ok = l.actualMinutes <= l.targetMinutes;
          return (
            <div key={l.id} className="rounded-xl border px-4 py-2.5 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <span className="text-sm">{ok ? "✅" : "⚠️"}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold" style={{ color: ok ? "#3D8C5A" : "#DC2626" }}>{Math.floor(l.actualMinutes/60)}س {l.actualMinutes%60}د</span>
                <span className="text-[9px] mx-2" style={{ color: "var(--muted)" }}>هدف: {Math.floor(l.targetMinutes/60)}س {l.targetMinutes%60}د</span>
                {l.mood && <span className="text-sm">{MOODS[l.mood]?.icon}</span>}
              </div>
              <span className="text-[9px] flex-shrink-0" style={{ color: "var(--muted)" }}>{new Date(l.date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ TRIGGERS TAB ════════════════════════════════════════════════════════════
function TriggersTab({ triggers, onUpdate }: { triggers: Trigger[]; onUpdate: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ name: "", cat: "boredom", alt: "" });

  async function add() {
    if (!nf.name.trim()) return;
    try { await api.post("/api/phone-addiction/triggers", { triggerName: nf.name, category: nf.cat, alternative: nf.alt || undefined }); setNf({ name: "", cat: "boredom", alt: "" }); setShowNew(false); onUpdate(); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#F59E0B08", border: "1px solid #F59E0B20" }}>
        <p className="text-xs font-bold mb-1" style={{ color: "#F59E0B" }}>⚡ ما هي المحفزات؟</p>
        <p className="text-[10px]" style={{ color: "var(--text)" }}>المحفز هو الشعور أو الموقف الذي يجعلك تمسك الجوال تلقائياً. حدد محفزاتك واكتب بديلاً صحياً لكل واحد.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: "var(--text)" }}>محفزاتي ({triggers.length})</span>
        <button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#F59E0B" }}>+ محفز</button>
      </div>

      {showNew && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <input value={nf.name} onChange={e => setNf({...nf, name: e.target.value})} placeholder="المحفز (مثال: أنتظر في الطابور)" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
          <div>
            <p className="text-[9px] font-bold mb-1" style={{ color: "var(--muted)" }}>التصنيف:</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TRIGGER_CATS).map(([k, v]) => (
                <button key={k} onClick={() => setNf({...nf, cat: k})} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
                  style={{ background: nf.cat === k ? `${v.color}20` : "var(--bg)", color: v.color, border: `1px solid ${nf.cat === k ? v.color : "var(--card-border)"}` }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
          <input value={nf.alt} onChange={e => setNf({...nf, alt: e.target.value})} placeholder="البديل الصحي (مثال: قراءة كتاب، ذكر، مشي)" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
            <button onClick={add} disabled={!nf.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#F59E0B" }}>إضافة</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {triggers.map(t => {
          const cat = TRIGGER_CATS[t.category] ?? TRIGGER_CATS.habit;
          return (
            <div key={t.id} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.triggerName}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                </div>
                <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/phone-addiction/triggers/${t.id}`); onUpdate(); } catch {} } }}
                  className="text-[9px] px-1" style={{ color: "#DC2626" }}>🗑️</button>
              </div>
              {t.alternative && (
                <div className="mt-2 px-3 py-1.5 rounded-lg" style={{ background: "#3D8C5A08", border: "1px solid #3D8C5A15" }}>
                  <span className="text-[9px] font-bold" style={{ color: "#3D8C5A" }}>✅ البديل: </span>
                  <span className="text-[10px]" style={{ color: "var(--text)" }}>{t.alternative}</span>
                </div>
              )}
            </div>
          );
        })}
        {triggers.length === 0 && !showNew && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">⚡</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>حدد المحفزات التي تجعلك تمسك الجوال</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ FREE ZONES TAB ══════════════════════════════════════════════════════════
function FreeZonesTab({ zones, onUpdate }: { zones: FreeZone[]; onUpdate: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [nz, setNz] = useState({ name: "", start: "22:00", end: "07:00", days: "all" });

  async function add() {
    if (!nz.name.trim()) return;
    try { await api.post("/api/phone-addiction/free-zones", { zoneName: nz.name, startTime: nz.start, endTime: nz.end, daysOfWeek: nz.days }); setNz({ name: "", start: "22:00", end: "07:00", days: "all" }); setShowNew(false); onUpdate(); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
        <p className="text-xs font-bold mb-1" style={{ color: "#5E5495" }}>🔕 فترات بلا جوال</p>
        <p className="text-[10px]" style={{ color: "var(--text)" }}>حدد أوقات ثابتة تلتزم فيها بعدم استخدام الجوال. تعديل البيئة من أقوى أساليب CBT.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: "var(--text)" }}>فتراتي ({zones.length})</span>
        <button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#5E5495" }}>+ فترة</button>
      </div>

      {showNew && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <input value={nz.name} onChange={e => setNz({...nz, name: e.target.value})} placeholder="اسم الفترة (مثال: وقت النوم، صلاة الفجر)" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>من</label>
              <input type="time" value={nz.start} onChange={e => setNz({...nz, start: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] block mb-1" style={{ color: "var(--muted)" }}>إلى</label>
              <input type="time" value={nz.end} onChange={e => setNz({...nz, end: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
            </div>
          </div>
          <select value={nz.days} onChange={e => setNz({...nz, days: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-xs" style={is}>
            <option value="all">كل الأيام</option>
            <option value="weekdays">أيام العمل</option>
            <option value="weekends">عطلة نهاية الأسبوع</option>
          </select>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
            <button onClick={add} disabled={!nz.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {zones.map(z => (
          <div key={z.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--card-border)", opacity: z.isActive ? 1 : 0.5 }}>
            <span className="text-lg">🔕</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{z.zoneName}</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>{z.startTime} — {z.endTime} · {z.daysOfWeek === "all" ? "كل يوم" : z.daysOfWeek === "weekdays" ? "أيام العمل" : "العطلة"}</p>
            </div>
            <button onClick={async () => { try { await api.patch(`/api/phone-addiction/free-zones/${z.id}`, { isActive: !z.isActive }); onUpdate(); } catch {} }}
              className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: z.isActive ? "#3D8C5A15" : "#6B728015", color: z.isActive ? "#3D8C5A" : "#6B7280" }}>
              {z.isActive ? "✓ مفعّل" : "معطّل"}
            </button>
            <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/phone-addiction/free-zones/${z.id}`); onUpdate(); } catch {} } }}
              className="text-[9px]" style={{ color: "#DC2626" }}>🗑️</button>
          </div>
        ))}
        {zones.length === 0 && !showNew && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">🔕</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>أضف فترات زمنية تلتزم فيها بعدم استخدام الجوال</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ GOAL TAB ════════════════════════════════════════════════════════════════
function GoalTab({ goal, onSave }: { goal: Goal|null; onSave: () => void }) {
  const [cur, setCur] = useState(goal ? String(goal.currentDailyHours) : "");
  const [tgt, setTgt] = useState(goal ? String(goal.targetDailyHours) : "2");
  const [red, setRed] = useState(goal ? String(goal.weeklyReductionMinutes) : "15");
  const [why, setWhy] = useState(goal?.whyMotivation ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate?.split("T")[0] ?? "");

  async function save() {
    if (!cur) return;
    try {
      await api.post("/api/phone-addiction/goal", {
        currentDailyHours: Number(cur), targetDailyHours: Number(tgt) || 2,
        weeklyReductionMinutes: Number(red) || 15, whyMotivation: why || undefined,
        targetDate: targetDate || undefined,
      });
      onSave();
    } catch { alert("فشل الحفظ"); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#DC262608", border: "1px solid #DC262620" }}>
        <p className="text-xs font-bold mb-1" style={{ color: "#DC2626" }}>🎯 كيف يعمل التخفيض التدريجي؟</p>
        <p className="text-[10px]" style={{ color: "var(--text)" }}>
          حدد واقعك الحالي (مثلاً 6 ساعات) وهدفك (مثلاً ساعتين). النظام يخفّض هدفك اليومي تدريجياً كل أسبوع حتى تصل للهدف بدون صدمة.
        </p>
      </div>

      <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div>
          <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>📱 كم ساعة تستخدم الجوال حالياً يومياً؟</label>
          <input type="number" value={cur} onChange={e => setCur(e.target.value)} placeholder="مثلاً: 6" step="0.5" min="0"
            className="w-full px-4 py-3 rounded-xl border text-lg font-bold text-center focus:outline-none" style={is} />
        </div>
        <div>
          <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>🎯 هدفك النهائي (ساعات يومياً)</label>
          <input type="number" value={tgt} onChange={e => setTgt(e.target.value)} placeholder="2" step="0.5" min="0"
            className="w-full px-4 py-3 rounded-xl border text-lg font-bold text-center focus:outline-none" style={is} />
        </div>
        <div>
          <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>⬇️ التخفيض الأسبوعي (دقائق)</label>
          <input type="number" value={red} onChange={e => setRed(e.target.value)} placeholder="15"
            className="w-full px-4 py-2.5 rounded-xl border text-center focus:outline-none" style={is} />
          <p className="text-[9px] mt-1" style={{ color: "var(--muted)" }}>كل أسبوع ينخفض هدفك اليومي بهذا المقدار</p>
        </div>
        <div>
          <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>💡 لماذا تريد التقليل؟ (دافعك العميق)</label>
          <textarea value={why} onChange={e => setWhy(e.target.value)} rows={3} placeholder="مثال: أريد وقتاً أكثر مع أطفالي، أريد التركيز في عملي، أريد نوماً أفضل..."
            className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is} />
        </div>
        <div>
          <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>📅 تاريخ الوصول للهدف (اختياري)</label>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none" style={is} />
        </div>

        {cur && tgt && (
          <div className="rounded-xl p-3" style={{ background: "#3D8C5A08", border: "1px solid #3D8C5A15" }}>
            <p className="text-[10px] font-bold" style={{ color: "#3D8C5A" }}>📊 الخطة:</p>
            <p className="text-[10px]" style={{ color: "var(--text)" }}>
              من {cur} ساعة → {tgt} ساعة · تخفيض {red} دقيقة أسبوعياً · يستغرق تقريباً {Math.ceil(((Number(cur) - Number(tgt)) * 60) / (Number(red) || 15))} أسبوع
            </p>
          </div>
        )}

        <button onClick={save} disabled={!cur} className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#DC2626" }}>
          {goal ? "تحديث الهدف" : "🚀 ابدأ الرحلة"}
        </button>
      </div>
    </div>
  );
}
