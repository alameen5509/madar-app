"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "habits" | "today" | "stats";
interface BH { id:string; name:string; category:string; triggerText?:string; reward?:string; replacement?:string; motivation?:string; islamicContext?:string; relapsePlan?:string; targetDays:number; status:string; currentStreak:number; longestStreak:number; relapseCount:number; startDate?:string; cleanDays?:number; resistedDays?:number; todayStatus?:string; logs?:Log[]; strategies?:Strat[]; }
interface Log { id:string; logDate:string; status:string; triggerOccurred:boolean; replacementUsed:boolean; urgeLevel:number; notes?:string; }
interface Strat { id:string; strategy:string; strategyType:string; isActive:boolean; }
interface Stats { cleanDays:number; resistedDays:number; relapsedDays:number; triggerDays:number; replacementUsedDays:number; avgUrgeLevel:number; currentStreak:number; longestStreak:number; }

const CATS = ["سلوكية","فكرية","اجتماعية","جسدية","رقمية"];
const is = {background:"var(--bg)",borderColor:"var(--card-border)",color:"var(--text)"} as const;

export default function QuitHabitsPage() {
  const [tab,setTab]=useState<Tab>("habits");
  const [habits,setHabits]=useState<BH[]>([]);
  const [loading,setLoading]=useState(true);
  const [showNew,setShowNew]=useState(false);
  const [step,setStep]=useState(1);
  const [n,setN]=useState({name:"",cat:"سلوكية",trigger:"",reward:"",replacement:"",motivation:"",islamic:"",relapsePlan:"",target:"66",strategies:[{s:"",t:"replacement"}] as {s:string;t:string}[]});
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [statsId,setStatsId]=useState<string|null>(null);
  const [statsData,setStatsData]=useState<Stats|null>(null);

  const fetchData=useCallback(async()=>{
    setLoading(true);
    try{const{data}=await api.get("/api/bad-habits");setHabits(data??[]);}catch{}
    setLoading(false);
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  function resetForm(){setStep(1);setN({name:"",cat:"سلوكية",trigger:"",reward:"",replacement:"",motivation:"",islamic:"",relapsePlan:"",target:"66",strategies:[{s:"",t:"replacement"}]});}

  async function create(){
    if(!n.name.trim())return;
    try{
      await api.post("/api/bad-habits",{name:n.name,category:n.cat,trigger:n.trigger||undefined,reward:n.reward||undefined,replacement:n.replacement||undefined,motivation:n.motivation||undefined,islamicContext:n.islamic||undefined,relapsePlan:n.relapsePlan||undefined,targetDays:parseInt(n.target)||66,
        strategies:n.strategies.filter(s=>s.s.trim()).map(s=>({strategy:s.s,type:s.t}))});
      resetForm();setShowNew(false);fetchData();
    }catch{}
  }

  async function logDay(id:string,status:string,urge?:number){
    try{await api.post(`/api/bad-habits/${id}/log`,{status,urgeLevel:urge??0,replacementUsed:status==="urge_resisted"});fetchData();}catch{}
  }

  async function loadDetails(id:string){
    if(expandedId===id){setExpandedId(null);return;}
    try{const{data}=await api.get(`/api/bad-habits/${id}`);setHabits(p=>p.map(h=>h.id===id?{...h,...data}:h));setExpandedId(id);}catch{setExpandedId(id);}
  }

  async function loadStats(id:string){
    try{const{data}=await api.get(`/api/bad-habits/${id}/stats`);setStatsData(data);setStatsId(id);}catch{}
  }

  const active=habits.filter(h=>h.status==="active");

  return(
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{background:"var(--bg)"}}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
        <h2 className="font-bold text-lg" style={{color:"var(--text)"}}>🚫 ترك العادات السيئة</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{color:"var(--muted)"}}>{active.length} عادة نشطة</span>
          {active.some(h=>(h.todayStatus??"")==="") && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{background:"#F59E0B15",color:"#F59E0B"}}>📝 سجّل يومك</span>}
        </div>
        <div className="flex gap-1.5 mt-2">
          {([["habits","عاداتي","🚫"],["today","تسجيل اليوم","📝"],["stats","إحصائيات","📊"]] as [Tab,string,string][]).map(([k,l,ic])=>(
            <button key={k} onClick={()=>setTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{background:tab===k?"#5E5495":"var(--bg)",color:tab===k?"#fff":"var(--muted)",border:`1px solid ${tab===k?"#5E5495":"var(--card-border)"}`}}>{ic} {l}</button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-2xl mx-auto">
        {loading&&<p className="text-center py-8 animate-pulse text-sm" style={{color:"var(--muted)"}}>جارٍ التحميل...</p>}

        {/* ═══ HABITS TAB ═══ */}
        {!loading&&tab==="habits"&&(<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{color:"var(--text)"}}>عاداتي</span>
            <button onClick={()=>{resetForm();setShowNew(true);}} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{background:"#DC2626"}}>+ عادة للترك</button>
          </div>

          {/* Wizard */}
          {showNew&&(
            <div className="rounded-2xl border p-5 space-y-4" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <div className="flex items-center gap-1">{[1,2,3,4,5,6].map(s=>(<div key={s} className="flex-1 h-1.5 rounded-full" style={{background:s<=step?"#DC2626":"var(--card-border)"}}/>))}</div>
              <p className="text-[10px] text-center" style={{color:"#DC2626"}}>المرحلة {step} من 6</p>

              {step===1&&(<div className="space-y-3">
                <p className="font-bold text-sm" style={{color:"var(--text)"}}>١. فهم العادة</p>
                <input value={n.name} onChange={e=>setN({...n,name:e.target.value})} placeholder="اسم العادة السيئة..." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none" style={is}/>
                <div className="flex gap-1.5 flex-wrap">{CATS.map(c=>(<button key={c} onClick={()=>setN({...n,cat:c})} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition"
                  style={{background:n.cat===c?"#DC2626":"var(--bg)",color:n.cat===c?"#fff":"var(--muted)",border:`1px solid var(--card-border)`}}>{c}</button>))}</div>
              </div>)}

              {step===2&&(<div className="space-y-3">
                <p className="font-bold text-sm" style={{color:"var(--text)"}}>٢. كسر الحلقة</p>
                <div><p className="text-[10px] font-bold mb-1" style={{color:"#DC2626"}}>ما المحفز؟ (متى/أين/كيف تشعر)</p>
                  <textarea value={n.trigger} onChange={e=>setN({...n,trigger:e.target.value})} rows={2} placeholder="مثال: عندما أكون وحدي ليلاً وأشعر بالملل..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is}/></div>
                <div><p className="text-[10px] font-bold mb-1" style={{color:"#F59E0B"}}>ما المكافأة التي يبحث عنها دماغك؟</p>
                  <textarea value={n.reward} onChange={e=>setN({...n,reward:e.target.value})} rows={2} placeholder="مثال: الراحة والهروب من الضغط..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is}/></div>
              </div>)}

              {step===3&&(<div className="space-y-3">
                <p className="font-bold text-sm" style={{color:"var(--text)"}}>٣. البديل الصحي</p>
                <p className="text-[10px]" style={{color:"var(--muted)"}}>اختر بديلاً يحقق نفس المكافأة بطريقة صحيحة</p>
                <textarea value={n.replacement} onChange={e=>setN({...n,replacement:e.target.value})} rows={2} placeholder="مثال: 5 دقائق ذكر + مشي قصير..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is}/>
              </div>)}

              {step===4&&(<div className="space-y-3">
                <p className="font-bold text-sm" style={{color:"var(--text)"}}>٤. تغيير البيئة</p>
                {n.strategies.map((s,i)=>(<div key={i} className="flex gap-2">
                  <select value={s.t} onChange={e=>{const u=[...n.strategies];u[i]={...s,t:e.target.value};setN({...n,strategies:u});}} className="px-2 py-1.5 rounded-lg border text-[10px]" style={is}>
                    <option value="environment">تغيير بيئة</option><option value="replacement">استبدال</option><option value="mindfulness">وعي</option><option value="islamic">شرعي</option></select>
                  <input value={s.s} onChange={e=>{const u=[...n.strategies];u[i]={...s,s:e.target.value};setN({...n,strategies:u});}} placeholder="الاستراتيجية..." className="flex-1 px-2 py-1.5 rounded-lg border text-xs focus:outline-none" style={is}/>
                  <button onClick={()=>setN({...n,strategies:n.strategies.filter((_,j)=>j!==i)})} className="text-[10px]" style={{color:"#DC2626"}}>✕</button>
                </div>))}
                <button onClick={()=>setN({...n,strategies:[...n.strategies,{s:"",t:"replacement"}]})} className="text-[10px] px-3 py-1 rounded-lg" style={{background:"#5E549515",color:"#5E5495"}}>+ استراتيجية</button>
              </div>)}

              {step===5&&(<div className="space-y-3">
                <p className="font-bold text-sm" style={{color:"var(--text)"}}>٥. الدافع الداخلي</p>
                <div><p className="text-[10px] font-bold mb-1" style={{color:"var(--text)"}}>لماذا تريد الترك؟ (دافع شخصي عميق)</p>
                  <textarea value={n.motivation} onChange={e=>setN({...n,motivation:e.target.value})} rows={2} placeholder="مثال: أريد أن أكون قدوة لأبنائي..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is}/></div>
                <div><p className="text-[10px] font-bold mb-1" style={{color:"#5E5495"}}>البُعد الشرعي (آية أو حديث)</p>
                  <textarea value={n.islamic} onChange={e=>setN({...n,islamic:e.target.value})} rows={2} placeholder="اختياري..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is}/></div>
              </div>)}

              {step===6&&(<div className="space-y-3">
                <p className="font-bold text-sm" style={{color:"var(--text)"}}>٦. خطة الانتكاسة</p>
                <p className="text-[10px]" style={{color:"var(--muted)"}}>الانتكاسة طبيعية — ليست فشلاً. ماذا ستفعل إذا حدثت؟</p>
                <textarea value={n.relapsePlan} onChange={e=>setN({...n,relapsePlan:e.target.value})} rows={3} placeholder="مثال: سأتوضأ وأصلي ركعتين ثم أكتب ما حدث..." className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none" style={is}/>
                <div className="flex gap-2 items-center"><span className="text-[10px]" style={{color:"var(--text)"}}>الهدف:</span>
                  <input value={n.target} onChange={e=>setN({...n,target:e.target.value})} type="number" className="w-16 px-2 py-1 rounded-lg border text-[10px] text-center" style={is}/><span className="text-[10px]" style={{color:"var(--muted)"}}>يوم (66 يوم = عادة جديدة)</span></div>
              </div>)}

              <div className="flex gap-2">
                {step>1&&<button onClick={()=>setStep(step-1)} className="px-4 py-2 rounded-xl text-xs" style={{background:"var(--bg)",color:"var(--muted)"}}>السابق</button>}
                <div className="flex-1"/>
                {step<6?(<button onClick={()=>setStep(step+1)} disabled={step===1&&!n.name.trim()} className="px-6 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{background:"#DC2626"}}>التالي</button>)
                :(<button onClick={create} disabled={!n.name.trim()} className="px-8 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{background:"linear-gradient(135deg,#DC2626,#D4AF37)"}}>🚫 بدء الترك</button>)}
              </div>
            </div>
          )}

          {/* Habit cards */}
          {habits.map(h=>{
            const pct=h.targetDays>0?Math.min(100,Math.round((h.currentStreak/h.targetDays)*100)):0;
            const isExp=expandedId===h.id;
            const today=h.todayStatus;
            return(<div key={h.id} className="rounded-2xl border overflow-hidden" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <div className="px-4 py-3 cursor-pointer" onClick={()=>loadDetails(h.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚫</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="font-bold text-sm truncate" style={{color:"var(--text)"}}>{h.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"var(--bg)",color:"var(--muted)"}}>{h.category}</span>
                      {today==="clean"&&<span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"#3D8C5A15",color:"#3D8C5A"}}>✅ نظيف</span>}
                      {today==="urge_resisted"&&<span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"#5E549515",color:"#5E5495"}}>💪 قاومت</span>}
                      {today==="relapsed"&&<span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"#DC262615",color:"#DC2626"}}>😔 انتكاسة</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:"var(--card-border)"}}><div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:pct>=100?"#3D8C5A":pct>=50?"#D4AF37":"#DC2626"}}/></div>
                      <span className="text-[10px] font-black" style={{color:pct>=100?"#3D8C5A":"var(--text)"}}>{h.currentStreak}🔥</span>
                      <span className="text-[9px]" style={{color:"var(--muted)"}}>{pct}% من {h.targetDays} يوم</span>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                    {!today&&<button onClick={()=>logDay(h.id,"clean")} className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{background:"#3D8C5A15",color:"#3D8C5A"}}>✅</button>}
                    {!today&&<button onClick={()=>logDay(h.id,"urge_resisted",5)} className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{background:"#5E549515",color:"#5E5495"}}>💪</button>}
                    <button onClick={()=>loadStats(h.id)} className="text-[9px] px-1.5 py-1 rounded-lg" style={{background:"var(--bg)",color:"var(--muted)"}}>📊</button>
                    <button onClick={async()=>{if(confirm("حذف؟")){try{await api.delete(`/api/bad-habits/${h.id}`);fetchData();}catch{}}}} className="text-[9px] px-1 rounded" style={{color:"#DC2626"}}>🗑️</button>
                  </div>
                </div>
              </div>
              {isExp&&(<div className="border-t px-4 py-3 space-y-2" style={{borderColor:"var(--card-border)"}}>
                {h.motivation&&<p className="text-xs" style={{color:"#D4AF37"}}>💪 {h.motivation}</p>}
                {h.islamicContext&&<p className="text-xs" style={{color:"#5E5495"}}>🕌 {h.islamicContext}</p>}
                {h.replacement&&<p className="text-xs" style={{color:"#3D8C5A"}}>🔄 البديل: {h.replacement}</p>}
                {h.triggerText&&<p className="text-xs" style={{color:"#F59E0B"}}>⚡ المحفز: {h.triggerText}</p>}
                {h.relapseCount>0&&<p className="text-[10px]" style={{color:"#DC2626"}}>انتكاسات: {h.relapseCount} | أطول سلسلة: {h.longestStreak}🔥</p>}
                {(h.strategies??[]).length>0&&<div><p className="text-[9px] font-bold" style={{color:"#5E5495"}}>الاستراتيجيات:</p>
                  {(h.strategies??[]).map(s=><p key={s.id} className="text-[10px]" style={{color:"var(--text)"}}>• {s.strategy} <span style={{color:"var(--muted)"}}>({s.strategyType})</span></p>)}</div>}
              </div>)}
            </div>);
          })}
          {habits.length===0&&!showNew&&<div className="text-center py-12"><p className="text-3xl mb-2">🚫</p><p className="text-sm" style={{color:"var(--muted)"}}>ابدأ رحلة ترك العادات السيئة</p></div>}
        </>)}

        {/* ═══ TODAY TAB ═══ */}
        {!loading&&tab==="today"&&(<>
          <span className="text-xs font-bold" style={{color:"var(--text)"}}>📝 تسجيل اليوم</span>
          {active.length===0?<p className="text-center py-8 text-sm" style={{color:"var(--muted)"}}>لا توجد عادات نشطة</p>:
            active.map(h=>{
              const today=h.todayStatus;
              return(<div key={h.id} className="rounded-xl border p-4 space-y-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
                <div className="flex items-center gap-2"><span className="text-lg">🚫</span><span className="font-bold text-sm" style={{color:"var(--text)"}}>{h.name}</span>
                  <span className="text-[10px] font-black" style={{color:"#D4AF37"}}>{h.currentStreak}🔥</span></div>
                {today?(<div className="text-center py-2"><span className="text-xs font-bold" style={{color:today==="clean"?"#3D8C5A":today==="urge_resisted"?"#5E5495":"#DC2626"}}>
                  {today==="clean"?"✅ سجّلت يومك نظيفاً":today==="urge_resisted"?"💪 قاومت الرغبة — أحسنت!":"😔 انتكاسة — لا تيأس، غداً أفضل"}</span></div>):(
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button onClick={()=>logDay(h.id,"clean")} className="flex-1 py-3 rounded-xl text-xs font-bold text-white" style={{background:"#3D8C5A"}}>✅ يوم نظيف</button>
                      <button onClick={()=>logDay(h.id,"urge_resisted",5)} className="flex-1 py-3 rounded-xl text-xs font-bold text-white" style={{background:"#5E5495"}}>💪 قاومت رغبة</button>
                      <button onClick={async()=>{const note=prompt("ماذا حدث؟ (اختياري)");try{await api.post(`/api/bad-habits/${h.id}/relapse`,{notes:note,urgeLevel:7});fetchData();}catch{}}}
                        className="flex-1 py-3 rounded-xl text-xs font-bold" style={{background:"#DC262615",color:"#DC2626",border:"1px solid #DC262630"}}>😔 انتكاسة</button>
                    </div>
                    {h.replacement&&<p className="text-[10px] text-center p-2 rounded-lg" style={{background:"#3D8C5A08",color:"#3D8C5A"}}>💡 تذكر البديل: {h.replacement}</p>}
                    {h.motivation&&<p className="text-[10px] text-center" style={{color:"#D4AF37"}}>💪 {h.motivation}</p>}
                  </div>
                )}
              </div>);
            })
          }
        </>)}

        {/* ═══ STATS TAB ═══ */}
        {!loading&&tab==="stats"&&(<>
          <span className="text-xs font-bold" style={{color:"var(--text)"}}>📊 اختر عادة لعرض إحصائياتها</span>
          <div className="flex gap-1.5 flex-wrap">{habits.map(h=>(<button key={h.id} onClick={()=>loadStats(h.id)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition" style={{background:statsId===h.id?"#DC2626":"var(--bg)",color:statsId===h.id?"#fff":"var(--muted)",border:`1px solid var(--card-border)`}}>{h.name}</button>))}</div>
          {statsData&&(<div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[{l:"أيام نظيفة",v:statsData.cleanDays,c:"#3D8C5A"},{l:"قاومت",v:statsData.resistedDays,c:"#5E5495"},{l:"انتكاسات",v:statsData.relapsedDays,c:"#DC2626"},{l:"أطول سلسلة",v:statsData.longestStreak,c:"#D4AF37"}].map(s=>(
                <div key={s.l} className="rounded-xl border p-3 text-center" style={{background:"var(--card)",borderColor:"var(--card-border)"}}><p className="text-2xl font-black" style={{color:s.c}}>{s.v}</p><p className="text-[10px]" style={{color:"var(--muted)"}}>{s.l}</p></div>
              ))}
            </div>
            {statsData.cleanDays+statsData.resistedDays>0&&(
              <div className="rounded-xl border p-4 text-center" style={{background:"#3D8C5A06",borderColor:"#3D8C5A30"}}>
                <p className="text-3xl font-black" style={{color:"#3D8C5A"}}>{Math.round(((statsData.cleanDays+statsData.resistedDays)/(statsData.cleanDays+statsData.resistedDays+statsData.relapsedDays))*100)}%</p>
                <p className="text-xs" style={{color:"#3D8C5A"}}>نسبة النظافة</p></div>)}
            <div className="rounded-xl border p-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <p className="text-[10px]" style={{color:"var(--muted)"}}>متوسط الرغبة: <span className="font-bold" style={{color:"#F59E0B"}}>{statsData.avgUrgeLevel}/10</span></p>
              <p className="text-[10px]" style={{color:"var(--muted)"}}>ظهر المحفز: <span className="font-bold">{statsData.triggerDays} يوم</span> | استخدم البديل: <span className="font-bold" style={{color:"#3D8C5A"}}>{statsData.replacementUsedDays} يوم</span></p>
            </div>
          </div>)}
          {!statsData&&habits.length>0&&<p className="text-center py-4 text-sm" style={{color:"var(--muted)"}}>اختر عادة أعلاه</p>}
        </>)}
      </div>
    </main>
  );
}
