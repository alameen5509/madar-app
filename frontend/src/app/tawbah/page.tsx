"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "new" | "log" | "actions" | "reflections" | "stats";
interface Tawbah { id:string; title:string; category:string; rootCause?:string; repentanceText?:string; fixPlan?:string; hasPersonRight:boolean; personRightStatus?:string; personName?:string; recurrenceCount:number; status:string; createdAt:string; repentedAt?:string; actionsCount?:number; completedActions?:number; reflectionsCount?:number; actions?:Action[]; reflections?:Reflection[]; }
interface Action { id:string; title:string; actionType:string; taskId?:string; isCompleted:boolean; }
interface Reflection { id:string; question:string; answer?:string; createdAt:string; }
interface Stats { total:number; active:number; repented:number; relapsed:number; topRecurring:{title:string;recurrenceCount:number}[]; }

const CATS = [{ key: "حق الله", icon: "🕌" }, { key: "حق الآدمي", icon: "👤" }, { key: "حق النفس", icon: "💭" }];
const STATUS_MAP: Record<string,{label:string;color:string}> = { active: {label:"قيد المتابعة",color:"#F59E0B"}, repented: {label:"تائب",color:"#3D8C5A"}, relapsed: {label:"انتكس",color:"#DC2626"} };
const QUESTIONS = ["لماذا وقعت فيه؟", "ما الظروف التي أدت إليه؟", "ما الحاجة التي كنت تبحث عنها؟", "هل هناك نمط متكرر؟"];
const is = { background:"var(--bg)", borderColor:"var(--card-border)", color:"var(--text)" } as const;

export default function TawbahPage() {
  const [tab, setTab] = useState<Tab>("log");
  const [records, setRecords] = useState<Tawbah[]>([]);
  const [stats, setStats] = useState<Stats|null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string|null>(null);

  // Wizard
  const [step, setStep] = useState(1);
  const [w, setW] = useState({ title:"", category:"حق الله", rootCause:"", repentanceText:"", fixPlan:"", hasPersonRight:false, personName:"", recurrence:0,
    reflections: QUESTIONS.map(q => ({ question: q, answer: "" })),
    actions: [{ title: "", type: "task", createTask: true }] as {title:string;type:string;createTask:boolean}[]
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.get("/api/tawbah").then(r => r.data ?? []),
        api.get("/api/tawbah/stats").then(r => r.data).catch(() => null),
      ]);
      setRecords(r); setStats(s);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function resetWizard() {
    setStep(1);
    setW({ title:"", category:"حق الله", rootCause:"", repentanceText:"", fixPlan:"", hasPersonRight:false, personName:"", recurrence:0,
      reflections: QUESTIONS.map(q => ({ question: q, answer: "" })),
      actions: [{ title: "", type: "task", createTask: true }]
    });
  }

  async function submitTawbah() {
    if (!w.title.trim()) return;
    try {
      await api.post("/api/tawbah", {
        title: w.title, category: w.category, rootCause: w.rootCause || undefined,
        repentanceText: w.repentanceText || undefined, fixPlan: w.fixPlan || undefined,
        hasPersonRight: w.hasPersonRight, personName: w.personName || undefined,
        recurrenceCount: w.recurrence,
        reflections: w.reflections.filter(r => r.answer?.trim()).map(r => ({ question: r.question, answer: r.answer })),
        actions: w.actions.filter(a => a.title?.trim()).map(a => ({ title: a.title, actionType: a.type, createTask: a.createTask })),
      });
      resetWizard(); setTab("log"); fetchData();
    } catch {}
  }

  async function loadDetails(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    try { const { data } = await api.get(`/api/tawbah/${id}`); setRecords(prev => prev.map(r => r.id === id ? { ...r, ...data } : r)); setExpandedId(id); } catch { setExpandedId(id); }
  }

  const allActions = records.flatMap(r => (r.actions ?? []).map(a => ({ ...a, tawbahTitle: r.title })));
  const allReflections = records.flatMap(r => (r.reflections ?? []).map(rf => ({ ...rf, tawbahTitle: r.title })));

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🤲 التوبة</h2>
        <div className="flex items-center gap-3 mt-1">
          {stats && (<>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{stats.total} سجل</span>
            {stats.active > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F59E0B15", color: "#F59E0B" }}>🔄 {stats.active} قيد المتابعة</span>}
            {stats.repented > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✅ {stats.repented} تائب</span>}
          </>)}
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-0.5">
          {([["new","توبة جديدة","🤲"],["log","السجل","📋"],["actions","أعمال الإصلاح","⚡"],["reflections","التأملات","💭"],["stats","الإحصائيات","📊"]] as [Tab,string,string][]).map(([k,l,ic]) => (
            <button key={k} onClick={() => setTab(k)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap flex-shrink-0"
              style={{ background: tab === k ? "#5E5495" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#5E5495" : "var(--card-border)"}` }}>
              {ic} {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-2xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* ═══ NEW — WIZARD ═══ */}
        {!loading && tab === "new" && (
          <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            {/* Progress */}
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(s => (
                <div key={s} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: s <= step ? "#5E5495" : "var(--card-border)" }} />
              ))}
            </div>
            <p className="text-[10px] text-center" style={{ color: "#5E5495" }}>المرحلة {step} من 5</p>

            {/* Step 1: الاعتراف */}
            {step === 1 && (<div className="space-y-3">
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>١. الاعتراف بالذنب</p>
              <input value={w.title} onChange={e => setW({...w, title: e.target.value})} placeholder="اكتب الذنب أو الزلل..." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none" style={is} />
              <div><p className="text-[10px] font-bold mb-1" style={{ color: "var(--text)" }}>التصنيف:</p>
                <div className="flex gap-1.5">{CATS.map(c => (
                  <button key={c.key} onClick={() => setW({...w, category: c.key, hasPersonRight: c.key === "حق الآدمي"})}
                    className="flex-1 py-2 rounded-xl text-[10px] font-semibold transition"
                    style={{ background: w.category === c.key ? "#5E5495" : "var(--bg)", color: w.category === c.key ? "#fff" : "var(--muted)", border: `1px solid var(--card-border)` }}>
                    {c.icon} {c.key}
                  </button>
                ))}</div>
              </div>
              {w.hasPersonRight && <input value={w.personName} onChange={e => setW({...w, personName: e.target.value})} placeholder="اسم صاحب الحق..." className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={is} />}
              <div><p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>هل تكرر من قبل؟</p>
                <div className="flex gap-1">{[0,1,2,3,5,10].map(n => (
                  <button key={n} onClick={() => setW({...w, recurrence: n})} className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                    style={{ background: w.recurrence === n ? "#DC2626" : "var(--bg)", color: w.recurrence === n ? "#fff" : "var(--muted)", border: `1px solid var(--card-border)` }}>
                    {n === 0 ? "أول مرة" : `${n} مرات`}
                  </button>
                ))}</div>
              </div>
            </div>)}

            {/* Step 2: التأمل */}
            {step === 2 && (<div className="space-y-3">
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>٢. التأمل في أصل المشكلة</p>
              {w.reflections.map((r, i) => (
                <div key={i}>
                  <p className="text-[10px] font-bold mb-1" style={{ color: "#5E5495" }}>{r.question}</p>
                  <textarea value={r.answer} onChange={e => { const u = [...w.reflections]; u[i] = {...r, answer: e.target.value}; setW({...w, reflections: u}); }}
                    rows={2} placeholder="تأمّل وأجب..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is} />
                </div>
              ))}
            </div>)}

            {/* Step 3: الندم والعزم */}
            {step === 3 && (<div className="space-y-3">
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>٣. الندم والعزم</p>
              <div><p className="text-[10px] font-bold mb-1" style={{ color: "var(--text)" }}>اكتب ندمك:</p>
                <textarea value={w.repentanceText} onChange={e => setW({...w, repentanceText: e.target.value})} rows={3} placeholder="أندم على ما فعلت لأن..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is} />
              </div>
              <div><p className="text-[10px] font-bold mb-1" style={{ color: "var(--text)" }}>عزمك على عدم العودة:</p>
                <textarea value={w.rootCause} onChange={e => setW({...w, rootCause: e.target.value})} rows={2} placeholder="أعزم أن لا أعود إلى هذا الذنب بإذن الله..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is} />
              </div>
              {w.hasPersonRight && (
                <div className="rounded-xl p-3" style={{ background: "#F59E0B08", border: "1px solid #F59E0B20" }}>
                  <p className="text-[10px] font-bold" style={{ color: "#F59E0B" }}>👤 حق آدمي — كيف ستُعيد الحق أو تستسمح؟</p>
                  <textarea value={w.fixPlan} onChange={e => setW({...w, fixPlan: e.target.value})} rows={2} placeholder="سأتصل بـ..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none mt-1" style={is} />
                </div>
              )}
            </div>)}

            {/* Step 4: خطة الإصلاح */}
            {step === 4 && (<div className="space-y-3">
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>٤. خطة الإصلاح العملية</p>
              {w.actions.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={a.type} onChange={e => { const u = [...w.actions]; u[i] = {...a, type: e.target.value}; setW({...w, actions: u}); }}
                    className="px-2 py-1.5 rounded-lg border text-[10px]" style={is}>
                    <option value="task">مهمة</option><option value="habit">عادة</option><option value="dhikr">ذكر</option>
                  </select>
                  <input value={a.title} onChange={e => { const u = [...w.actions]; u[i] = {...a, title: e.target.value}; setW({...w, actions: u}); }}
                    placeholder="عنوان العمل..." className="flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none" style={is} />
                  <label className="flex items-center gap-1 text-[9px] whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    <input type="checkbox" checked={a.createTask} onChange={e => { const u = [...w.actions]; u[i] = {...a, createTask: e.target.checked}; setW({...w, actions: u}); }} /> مهمة
                  </label>
                  <button onClick={() => setW({...w, actions: w.actions.filter((_,j) => j !== i)})} className="text-[10px]" style={{ color: "#DC2626" }}>✕</button>
                </div>
              ))}
              <button onClick={() => setW({...w, actions: [...w.actions, { title: "", type: "task", createTask: true }]})}
                className="text-[10px] px-3 py-1.5 rounded-lg font-bold" style={{ background: "#5E549515", color: "#5E5495" }}>+ عمل إصلاح</button>
            </div>)}

            {/* Step 5: تأكيد */}
            {step === 5 && (<div className="space-y-3">
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>٥. التأكيد والتوبة</p>
              <div className="rounded-xl p-4 space-y-2" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
                <p className="text-xs font-bold" style={{ color: "var(--text)" }}>🤲 {w.title}</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>{w.category} {w.hasPersonRight ? `— حق ${w.personName}` : ""} {w.recurrence > 0 ? `— تكرر ${w.recurrence} مرات` : ""}</p>
                {w.repentanceText && <p className="text-[10px]" style={{ color: "var(--text)" }}>💔 {w.repentanceText}</p>}
                {w.actions.filter(a => a.title).length > 0 && <p className="text-[10px]" style={{ color: "#3D8C5A" }}>⚡ {w.actions.filter(a => a.title).length} عمل إصلاح</p>}
              </div>
              <p className="text-center text-[10px]" style={{ color: "var(--muted)" }}>بالضغط على "توبة" تتوب إلى الله توبة نصوحاً</p>
            </div>)}

            {/* Navigation */}
            <div className="flex gap-2">
              {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--bg)", color: "var(--muted)" }}>السابق</button>}
              <div className="flex-1" />
              {step < 5 ? (
                <button onClick={() => setStep(step + 1)} disabled={step === 1 && !w.title.trim()}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>التالي</button>
              ) : (
                <button onClick={submitTawbah} disabled={!w.title.trim()}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>🤲 توبة</button>
              )}
            </div>
          </div>
        )}

        {/* ═══ LOG ═══ */}
        {!loading && tab === "log" && (<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>سجل التوبة</span>
            <button onClick={() => { resetWizard(); setTab("new"); }} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#5E5495" }}>+ توبة جديدة</button>
          </div>
          {records.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-2">🤲</p><p className="text-sm" style={{ color: "var(--muted)" }}>لا توجد سجلات — ابدأ توبة جديدة</p></div>}
          {records.map(r => {
            const st = STATUS_MAP[r.status] ?? STATUS_MAP.active;
            const isExp = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="px-4 py-3 cursor-pointer" onClick={() => loadDetails(r.id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CATS.find(c => c.key === r.category)?.icon ?? "🤲"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{r.title}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px]" style={{ color: "var(--muted)" }}>{r.category}</span>
                        {r.recurrenceCount > 0 && <span className="text-[9px] font-bold" style={{ color: "#DC2626" }}>تكرر {r.recurrenceCount}×</span>}
                        <span className="text-[9px]" style={{ color: "var(--muted)" }}>{new Date(r.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {r.status === "active" && <button onClick={async () => { try { await api.post(`/api/tawbah/${r.id}/repent`); fetchData(); } catch {} }}
                        className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✅ تبت</button>}
                      {(r.status === "repented" || r.status === "relapsed") && <button onClick={async () => { const note = prompt("ماذا حدث؟"); try { await api.post(`/api/tawbah/${r.id}/relapse`, { note }); fetchData(); } catch {} }}
                        className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#DC262615", color: "#DC2626" }}>انتكاسة</button>}
                      {r.status === "relapsed" && <button onClick={async () => { try { await api.post(`/api/tawbah/${r.id}/reactivate`); fetchData(); } catch {} }}
                        className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#F59E0B15", color: "#F59E0B" }}>أجدد</button>}
                      <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/tawbah/${r.id}`); fetchData(); } catch {} } }}
                        className="text-[9px] px-1 rounded" style={{ color: "#DC2626" }}>🗑️</button>
                    </div>
                  </div>
                </div>
                {isExp && (
                  <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: "var(--card-border)" }}>
                    {r.repentanceText && <p className="text-xs" style={{ color: "var(--text)" }}>💔 {r.repentanceText}</p>}
                    {r.rootCause && <p className="text-xs" style={{ color: "var(--text)" }}>🔍 {r.rootCause}</p>}
                    {r.fixPlan && <p className="text-xs" style={{ color: "var(--text)" }}>📋 {r.fixPlan}</p>}
                    {(r.actions??[]).length > 0 && <div><p className="text-[9px] font-bold" style={{ color: "#5E5495" }}>أعمال الإصلاح:</p>
                      {(r.actions??[]).map(a => <p key={a.id} className="text-[10px]" style={{ color: a.isCompleted ? "#3D8C5A" : "var(--text)" }}>{a.isCompleted ? "✅" : "⬜"} {a.title}</p>)}</div>}
                    {(r.reflections??[]).length > 0 && <div><p className="text-[9px] font-bold" style={{ color: "#D4AF37" }}>التأملات:</p>
                      {(r.reflections??[]).map(rf => <div key={rf.id} className="text-[10px] mb-1"><span style={{ color: "var(--muted)" }}>{rf.question}</span><br/><span style={{ color: "var(--text)" }}>{rf.answer}</span></div>)}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </>)}

        {/* ═══ ACTIONS ═══ */}
        {!loading && tab === "actions" && (<>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>⚡ أعمال الإصلاح</span>
          {allActions.length === 0 ? <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد أعمال إصلاح</p> :
            <div className="space-y-1.5">{allActions.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                <span className={`text-[10px] ${a.isCompleted ? "text-green-500" : ""}`}>{a.isCompleted ? "✅" : "⬜"}</span>
                <span className="text-xs flex-1" style={{ color: a.isCompleted ? "var(--muted)" : "var(--text)" }}>{a.title}</span>
                <span className="text-[9px]" style={{ color: "#D4AF37" }}>{a.tawbahTitle}</span>
              </div>
            ))}</div>}
        </>)}

        {/* ═══ REFLECTIONS ═══ */}
        {!loading && tab === "reflections" && (<>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>💭 التأملات</span>
          {allReflections.length === 0 ? <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد تأملات</p> :
            <div className="space-y-2">{allReflections.map(rf => (
              <div key={rf.id} className="rounded-xl border px-3 py-2.5" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <p className="text-[10px] font-bold" style={{ color: "#5E5495" }}>{rf.question}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text)" }}>{rf.answer}</p>
                <p className="text-[8px] mt-1" style={{ color: "var(--muted)" }}>{rf.tawbahTitle}</p>
              </div>
            ))}</div>}
        </>)}

        {/* ═══ STATS ═══ */}
        {!loading && tab === "stats" && stats && (<>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>📊 الإحصائيات</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{l:"الإجمالي",v:stats.total,c:"#5E5495"},{l:"قيد المتابعة",v:stats.active,c:"#F59E0B"},{l:"تائب",v:stats.repented,c:"#3D8C5A"},{l:"انتكس",v:stats.relapsed,c:"#DC2626"}].map(s => (
              <div key={s.l} className="rounded-xl border p-3 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <p className="text-2xl font-black" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>{s.l}</p>
              </div>
            ))}
          </div>
          {stats.repented > 0 && stats.total > 0 && (
            <div className="rounded-xl border p-4 text-center" style={{ background: "#3D8C5A06", borderColor: "#3D8C5A30" }}>
              <p className="text-3xl font-black" style={{ color: "#3D8C5A" }}>{Math.round((stats.repented / stats.total) * 100)}%</p>
              <p className="text-xs" style={{ color: "#3D8C5A" }}>نسبة الاستقامة</p>
            </div>
          )}
          {stats.topRecurring.length > 0 && (
            <div className="rounded-xl border p-3" style={{ background: "#DC262606", borderColor: "#DC262620" }}>
              <p className="text-[10px] font-bold mb-2" style={{ color: "#DC2626" }}>⚠️ الأكثر تكراراً — تحتاج علاجاً جذرياً:</p>
              {stats.topRecurring.map((t,i) => <p key={i} className="text-xs" style={{ color: "var(--text)" }}>• {t.title} <span className="font-bold" style={{ color: "#DC2626" }}>({t.recurrenceCount}×)</span></p>)}
            </div>
          )}
        </>)}
      </div>
    </main>
  );
}
