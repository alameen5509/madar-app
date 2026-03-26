"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "plan" | "meals" | "dishes" | "juices" | "stock" | "shopping";
interface Dish { id:string; name:string; description?:string; imageUrl?:string; category:string; prepTime?:number; servings?:number; ingredients?:{id:string;ingredientName:string;quantity:number;unit:string}[]; }
interface Meal { id:string; name:string; mealTime:string; frequency:string; preferredDays?:string; isDailyFavorite:boolean; isForGuests:boolean; dishes?:{dishId:string;dishName:string;dishImage?:string;category:string}[]; }
interface Ingredient { id:string; name:string; category:string; unit:string; currentStock:number; minStock:number; brands?:{id:string;brandName:string;quality:string;isPreferred:boolean;lastPrice?:number;avgPrice?:number}[]; }
interface Plan { planDate:string; breakfastMealId?:string; lunchMealId?:string; dinnerMealId?:string; snackMealId?:string; breakfastName?:string; lunchName?:string; dinnerName?:string; snackName?:string; }

const MT=[{key:"breakfast",label:"فطور",icon:"🌅"},{key:"lunch",label:"غداء",icon:"🍲"},{key:"dinner",label:"عشاء",icon:"🌙"},{key:"snack",label:"خفيفة",icon:"🍎"}];
const FREQ=[{key:"daily",label:"يومي ⭐"},{key:"weekly",label:"أسبوعي 📅"},{key:"occasional",label:"متناوب 🔀"},{key:"guests",label:"ضيوف 👥"}];
const DAYS=["سبت","أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة"];
const is={background:"var(--bg)",borderColor:"var(--card-border)",color:"var(--text)"} as const;

export default function NutritionPage() {
  const [tab,setTab]=useState<Tab>("dishes");
  const [dishes,setDishes]=useState<Dish[]>([]);
  const [meals,setMeals]=useState<Meal[]>([]);
  const [ingredients,setIngredients]=useState<Ingredient[]>([]);
  const [plans,setPlans]=useState<Plan[]>([]);
  const [loading,setLoading]=useState(true);

  // Dish form
  const [showNewDish,setShowNewDish]=useState(false);
  const [nd,setNd]=useState({name:"",desc:"",img:"",cat:"أساسي",prep:"",srv:"4"});
  const [ndIngs,setNdIngs]=useState<{name:string;qty:string;unit:string;existingId?:string}[]>([]);
  const [ingSearch,setIngSearch]=useState("");
  const [expDish,setExpDish]=useState<string|null>(null);

  // Meal form
  const [showNewMeal,setShowNewMeal]=useState(false);
  const [nm,setNm]=useState({name:"",time:"lunch",freq:"occasional",days:[] as number[],daily:false,guests:false,dishIds:[] as string[]});

  // Stock
  const [addBrandId,setAddBrandId]=useState<string|null>(null);
  const [nb,setNb]=useState({name:"",quality:"جيدة",preferred:false});
  const [recordPriceId,setRecordPriceId]=useState<string|null>(null);
  const [np,setNp]=useState({brandId:"",price:"",qty:"1",store:""});

  const fetchData=useCallback(async()=>{
    setLoading(true);
    try{
      const [d,m,i,p]=await Promise.all([
        api.get("/api/nutrition/dishes").then(r=>r.data??[]).catch(()=>[]),
        api.get("/api/nutrition/meals").then(r=>r.data??[]).catch(()=>[]),
        api.get("/api/nutrition/ingredients").then(r=>r.data??[]).catch(()=>[]),
        api.get("/api/nutrition/meal-plans").then(r=>r.data??[]).catch(()=>[]),
      ]);
      setDishes(d);setMeals(m);setIngredients(i);setPlans(p);
    }catch{}
    setLoading(false);
  },[]);

  useEffect(()=>{fetchData();},[fetchData]);

  async function createDish(){
    if(!nd.name.trim())return;
    try{
      await api.post("/api/nutrition/dishes",{
        name:nd.name,description:nd.desc||undefined,imageUrl:nd.img||undefined,category:nd.cat,
        prepTime:parseInt(nd.prep)||undefined,servings:parseInt(nd.srv)||4,
        ingredients:ndIngs.filter(i=>i.name.trim()).map(i=>({ingredientId:i.existingId||undefined,name:i.name,quantity:parseFloat(i.qty)||1,unit:i.unit})),
      });
      setNd({name:"",desc:"",img:"",cat:"أساسي",prep:"",srv:"4"});setNdIngs([]);setShowNewDish(false);fetchData();
    }catch{}
  }

  async function createMeal(){
    if(!nm.name.trim())return;
    try{
      await api.post("/api/nutrition/meals",{
        name:nm.name,mealTime:nm.time,frequency:nm.guests?"guests":nm.freq,
        preferredDays:nm.days.length>0?nm.days:undefined,isDailyFavorite:nm.daily,isForGuests:nm.guests,dishIds:nm.dishIds,
      });
      setNm({name:"",time:"lunch",freq:"occasional",days:[],daily:false,guests:false,dishIds:[]});setShowNewMeal(false);fetchData();
    }catch{}
  }

  async function loadDishIngs(id:string){
    if(expDish===id){setExpDish(null);return;}
    try{const{data}=await api.get(`/api/nutrition/dishes/${id}`);setDishes(p=>p.map(d=>d.id===id?{...d,ingredients:data.ingredients??[]}:d));setExpDish(id);}catch{setExpDish(id);}
  }

  const ingSuggestions=ingSearch.length>0?ingredients.filter(i=>i.name.includes(ingSearch)):[];
  const lowStock=ingredients.filter(i=>i.currentStock<=i.minStock&&i.minStock>0);
  const dailyM=meals.filter(m=>m.isDailyFavorite);const weeklyM=meals.filter(m=>m.frequency==="weekly"&&!m.isDailyFavorite);
  const occasionalM=meals.filter(m=>m.frequency==="occasional"&&!m.isDailyFavorite&&!m.isForGuests);const guestM=meals.filter(m=>m.isForGuests);

  return(
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{background:"var(--bg)"}}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
        <h2 className="font-bold text-lg" style={{color:"var(--text)"}}>🍽️ التغذية المنزلية</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{color:"var(--muted)"}}>{dishes.filter(d=>d.category!=="عصير"&&d.category!=="مشروب").length} صحن · {dishes.filter(d=>d.category==="عصير"||d.category==="مشروب").length} عصير · {meals.length} وجبة</span>
          {lowStock.length>0&&<span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:"#DC262615",color:"#DC2626"}}>⚠️ {lowStock.length} ناقصة</span>}
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-0.5">
          {([["plan","خطة الأسبوع","📅"],["meals","الوجبات","🍱"],["dishes","الصحون","🍽️"],["juices","العصيرات","🥤"],["stock","المخزون","🧺"],["shopping","التسوق","🛒"]] as [Tab,string,string][]).map(([k,l,ic])=>(
            <button key={k} onClick={()=>setTab(k)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap flex-shrink-0"
              style={{background:tab===k?"#5E5495":"var(--bg)",color:tab===k?"#fff":"var(--muted)",border:`1px solid ${tab===k?"#5E5495":"var(--card-border)"}`}}>
              {ic} {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {loading&&<p className="text-center py-8 animate-pulse text-sm" style={{color:"var(--muted)"}}>جارٍ التحميل...</p>}

        {/* ═══ PLAN ═══ */}
        {!loading&&tab==="plan"&&(<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{color:"var(--text)"}}>خطة الأسبوع</span>
            <button onClick={async()=>{try{await api.post("/api/nutrition/meal-plans/auto-generate");alert("تم التوليد");fetchData();}catch{alert("أضف وجبات أولاً");}}}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{background:"linear-gradient(135deg,#5E5495,#D4AF37)"}}>🤖 توليد تلقائي</button>
          </div>
          {plans.length>0?plans.map(p=>(
            <div key={p.planDate} className="rounded-xl border p-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <p className="text-xs font-bold mb-2" style={{color:"var(--text)"}}>{new Date(p.planDate+"T00:00:00").toLocaleDateString("ar-SA",{weekday:"long",month:"short",day:"numeric"})}</p>
              <div className="grid grid-cols-3 gap-2">
                {(["breakfast","lunch","dinner"] as const).map(mt=>{
                  const name=mt==="breakfast"?p.breakfastName:mt==="lunch"?p.lunchName:p.dinnerName;
                  const info=MT.find(m=>m.key===mt);
                  return(<div key={mt} className="rounded-lg p-2 text-center" style={{background:"var(--bg)"}}>
                    <p className="text-[9px]" style={{color:"var(--muted)"}}>{info?.icon} {info?.label}</p>
                    <p className="text-[10px] font-bold mt-0.5" style={{color:name?"var(--text)":"var(--muted)"}}>{name??"—"}</p>
                  </div>);
                })}
              </div>
            </div>
          )):<div className="text-center py-8"><p className="text-3xl mb-2">📅</p><p className="text-sm" style={{color:"var(--muted)"}}>أضف وجبات ثم اضغط "توليد تلقائي"</p></div>}
        </>)}

        {/* ═══ MEALS ═══ */}
        {!loading&&tab==="meals"&&(<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{color:"var(--text)"}}>الوجبات</span>
            <button onClick={()=>setShowNewMeal(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{background:"#D4AF37"}}>+ وجبة جديدة</button>
          </div>
          {showNewMeal&&(
            <div className="rounded-xl border p-4 space-y-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <input value={nm.name} onChange={e=>setNm({...nm,name:e.target.value})} placeholder='اسم الوجبة — مثل "غداء الجمعة"' className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is}/>
              <div><p className="text-[10px] font-bold mb-1" style={{color:"var(--text)"}}>وقت الوجبة:</p>
                <div className="flex gap-1.5">{MT.map(mt=>(<button key={mt.key} onClick={()=>setNm({...nm,time:mt.key})} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition" style={{background:nm.time===mt.key?"#D4AF37":"var(--bg)",color:nm.time===mt.key?"#fff":"var(--muted)",border:`1px solid ${nm.time===mt.key?"#D4AF37":"var(--card-border)"}`}}>{mt.icon} {mt.label}</button>))}</div>
              </div>
              <div><p className="text-[10px] font-bold mb-1" style={{color:"var(--text)"}}>التكرار:</p>
                <div className="flex gap-1.5 flex-wrap">{FREQ.map(f=>{const a=(nm.daily&&f.key==="daily")||(nm.guests&&f.key==="guests")||(!nm.daily&&!nm.guests&&nm.freq===f.key);return(
                  <button key={f.key} onClick={()=>setNm({...nm,freq:f.key,daily:f.key==="daily",guests:f.key==="guests"})} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition" style={{background:a?"#5E5495":"var(--bg)",color:a?"#fff":"var(--muted)",border:`1px solid var(--card-border)`}}>{f.label}</button>
                );})}</div>
              </div>
              {nm.freq==="weekly"&&<div className="flex gap-1">{DAYS.map((d,i)=>(<button key={i} onClick={()=>setNm({...nm,days:nm.days.includes(i)?nm.days.filter(x=>x!==i):[...nm.days,i]})} className="w-9 h-9 rounded-lg text-[9px] font-bold transition" style={{background:nm.days.includes(i)?"#D4AF37":"var(--bg)",color:nm.days.includes(i)?"#fff":"var(--muted)",border:`1px solid var(--card-border)`}}>{d}</button>))}</div>}
              <div><p className="text-[10px] font-bold mb-1" style={{color:"var(--text)"}}>اختر الصحون:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">{dishes.map(d=>(<button key={d.id} onClick={()=>setNm({...nm,dishIds:nm.dishIds.includes(d.id)?nm.dishIds.filter(x=>x!==d.id):[...nm.dishIds,d.id]})}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-right transition" style={{background:nm.dishIds.includes(d.id)?"#D4AF3715":"var(--bg)",border:`1px solid ${nm.dishIds.includes(d.id)?"#D4AF37":"var(--card-border)"}`}}>
                  {d.imageUrl&&<img src={d.imageUrl} alt="" className="w-8 h-8 rounded object-cover"/>}
                  <span className="text-[10px] flex-1" style={{color:"var(--text)"}}>{d.name}</span>
                  <span className="text-[9px]" style={{color:"var(--muted)"}}>{d.category}</span>
                  {nm.dishIds.includes(d.id)&&<span className="text-[10px]" style={{color:"#D4AF37"}}>✓</span>}
                </button>))}</div>
                {nm.dishIds.length>0&&<p className="text-[9px] mt-1" style={{color:"#D4AF37"}}>{nm.dishIds.length} صحن محدد</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>setShowNewMeal(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{color:"var(--muted)"}}>إلغاء</button>
                <button onClick={createMeal} disabled={!nm.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{background:"#D4AF37"}}>إضافة</button>
              </div>
            </div>
          )}
          {[{t:"⭐ يومية",items:dailyM},{t:"📅 أسبوعية",items:weeklyM},{t:"🔀 متناوبة",items:occasionalM},{t:"👥 ضيوف",items:guestM}].filter(s=>s.items.length>0).map(s=>(
            <div key={s.t}><p className="text-xs font-bold mb-2" style={{color:"var(--text)"}}>{s.t}</p>
              <div className="space-y-2">{s.items.map(m=>{const mt=MT.find(x=>x.key===m.mealTime);return(
                <div key={m.id} className="rounded-xl border p-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
                  <div className="flex items-center justify-between">
                    <div><p className="font-bold text-sm" style={{color:"var(--text)"}}>{m.name}</p>
                      <div className="flex gap-1.5 mt-0.5"><span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"#D4AF3715",color:"#D4AF37"}}>{mt?.icon} {mt?.label}</span>
                        <span className="text-[9px]" style={{color:"var(--muted)"}}>{(m.dishes??[]).length} صحن</span></div>
                    </div>
                    <button onClick={async()=>{if(confirm("حذف؟")){try{await api.delete(`/api/nutrition/meals/${m.id}`);fetchData();}catch{}}}} className="text-[10px]" style={{color:"#DC2626"}}>🗑️</button>
                  </div>
                  {(m.dishes??[]).length>0&&<div className="flex gap-2 mt-2 overflow-x-auto pb-1">{(m.dishes??[]).map(d=>(
                    <div key={d.dishId} className="flex-shrink-0 text-center w-16">
                      {d.dishImage&&<img src={d.dishImage} alt="" className="w-16 h-12 rounded object-cover"/>}
                      <p className="text-[8px] mt-0.5 truncate" style={{color:"var(--text)"}}>{d.dishName}</p>
                    </div>
                  ))}</div>}
                </div>);})}</div>
            </div>
          ))}
          {meals.length===0&&<p className="text-center py-8 text-sm" style={{color:"var(--muted)"}}>لا توجد وجبات — أضف صحون أولاً ثم أنشئ وجبة</p>}
        </>)}

        {/* ═══ DISHES ═══ */}
        {!loading&&tab==="dishes"&&(<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{color:"var(--text)"}}>الصحون</span>
            <button onClick={()=>{setShowNewDish(true);setNdIngs([{name:"",qty:"",unit:"جرام"}]);}} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{background:"#D4AF37"}}>+ صحن جديد</button>
          </div>
          {showNewDish&&(
            <div className="rounded-xl border p-4 space-y-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <input value={nd.name} onChange={e=>setNd({...nd,name:e.target.value})} placeholder="اسم الصحن *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is}/>
              <input value={nd.img} onChange={e=>setNd({...nd,img:e.target.value})} placeholder="رابط الصورة (اختياري)" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is}/>
              <div className="flex gap-2">
                <select value={nd.cat} onChange={e=>setNd({...nd,cat:e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is}>{["أساسي","جانبي","حلوى","عصير","مشروب","سلطة","شوربة"].map(c=><option key={c}>{c}</option>)}</select>
                <input value={nd.prep} onChange={e=>setNd({...nd,prep:e.target.value})} placeholder="وقت (دقيقة)" type="number" className="w-24 px-2 py-1.5 rounded-lg border text-xs" style={is}/>
                <input value={nd.srv} onChange={e=>setNd({...nd,srv:e.target.value})} placeholder="أشخاص" type="number" className="w-16 px-2 py-1.5 rounded-lg border text-xs" style={is}/>
              </div>
              {/* Ingredients */}
              <div className="rounded-lg border p-3 space-y-2" style={{borderColor:"#D4AF3730",background:"#D4AF3706"}}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold" style={{color:"#D4AF37"}}>🧺 المقادير:</p>
                  <button onClick={()=>setNdIngs([...ndIngs,{name:"",qty:"",unit:"جرام"}])} className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{background:"#D4AF3715",color:"#D4AF37"}}>+ مادة</button>
                </div>
                {ndIngs.map((ing,idx)=>(
                  <div key={idx} className="flex gap-1.5 items-center">
                    <div className="flex-1 relative">
                      <input value={ing.name} onChange={e=>{const u=[...ndIngs];u[idx]={...ing,name:e.target.value,existingId:undefined};const m=ingredients.find(i=>i.name===e.target.value);if(m)u[idx].existingId=m.id;setNdIngs(u);setIngSearch(e.target.value);}}
                        onFocus={()=>setIngSearch(ing.name)} onBlur={()=>setTimeout(()=>setIngSearch(""),200)}
                        placeholder="اسم المادة" className="w-full px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none" style={is}/>
                      {ingSearch===ing.name&&ingSuggestions.length>0&&ing.name.length>0&&!ing.existingId&&(
                        <div className="absolute top-full left-0 right-0 z-10 mt-0.5 rounded-lg border shadow-lg max-h-24 overflow-y-auto" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
                          {ingSuggestions.map(s=>(<button key={s.id} onMouseDown={()=>{const u=[...ndIngs];u[idx]={...ing,name:s.name,existingId:s.id,unit:s.unit};setNdIngs(u);setIngSearch("");}}
                            className="w-full text-right px-2 py-1.5 text-[10px] hover:bg-black/5" style={{color:"var(--text)"}}>{s.name}</button>))}
                        </div>
                      )}
                      {ing.existingId&&<span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px]" style={{color:"#3D8C5A"}}>✓</span>}
                    </div>
                    <input value={ing.qty} onChange={e=>{const u=[...ndIngs];u[idx]={...ing,qty:e.target.value};setNdIngs(u);}} placeholder="الكمية" type="number" className="w-16 px-2 py-1.5 rounded-lg border text-[10px] text-center" style={is}/>
                    <select value={ing.unit} onChange={e=>{const u=[...ndIngs];u[idx]={...ing,unit:e.target.value};setNdIngs(u);}} className="px-1 py-1.5 rounded-lg border text-[10px]" style={is}>{["جرام","كيلو","مل","لتر","حبة","ملعقة","كوب"].map(u=><option key={u}>{u}</option>)}</select>
                    <button onClick={()=>setNdIngs(ndIngs.filter((_,j)=>j!==idx))} className="text-[10px] px-1" style={{color:"#DC2626"}}>✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>{setShowNewDish(false);setNdIngs([]);}} className="px-3 py-1.5 rounded-lg text-[10px]" style={{color:"var(--muted)"}}>إلغاء</button>
                <button onClick={createDish} disabled={!nd.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{background:"#D4AF37"}}>إضافة</button>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {dishes.filter(d=>d.category!=="عصير"&&d.category!=="مشروب").map(d=>(
              <div key={d.id} className="rounded-xl border overflow-hidden" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
                {d.imageUrl&&<img src={d.imageUrl} alt={d.name} className="w-full h-32 object-cover"/>}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="cursor-pointer" onClick={()=>loadDishIngs(d.id)}>
                      <p className="font-bold text-sm" style={{color:"var(--text)"}}>{d.name}</p>
                      <div className="flex gap-1.5 mt-0.5"><span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{background:"#5E549515",color:"#5E5495"}}>{d.category}</span>
                        {d.prepTime&&<span className="text-[8px]" style={{color:"var(--muted)"}}>{d.prepTime}د</span>}</div>
                    </div>
                    <button onClick={async()=>{if(confirm("حذف؟")){try{await api.delete(`/api/nutrition/dishes/${d.id}`);fetchData();}catch{}}}} className="text-[10px]" style={{color:"#DC2626"}}>🗑️</button>
                  </div>
                  {expDish===d.id&&d.ingredients&&(
                    <div className="mt-2 pt-2 border-t space-y-1" style={{borderColor:"var(--card-border)"}}>
                      <p className="text-[9px] font-bold" style={{color:"#D4AF37"}}>المقادير:</p>
                      {d.ingredients.length>0?d.ingredients.map(i=>(<div key={i.id} className="flex gap-2 text-[10px]" style={{color:"var(--text)"}}>
                        <span>•</span><span>{i.ingredientName}</span><span style={{color:"var(--muted)"}}>{i.quantity} {i.unit}</span></div>))
                        :<p className="text-[9px]" style={{color:"var(--muted)"}}>لا توجد مقادير</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {dishes.filter(d=>d.category!=="عصير"&&d.category!=="مشروب").length===0&&<p className="text-center py-8 text-sm" style={{color:"var(--muted)"}}>لا توجد صحون — أضف صحنك الأول</p>}
        </>)}

        {/* ═══ JUICES ═══ */}
        {!loading&&tab==="juices"&&(<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{color:"var(--text)"}}>🥤 العصيرات والمشروبات</span>
            <button onClick={()=>{setShowNewDish(true);setNd({...nd,cat:"عصير"});setNdIngs([{name:"",qty:"",unit:"جرام"}]);setTab("dishes");}} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{background:"#2ABFBF"}}>+ عصير جديد</button>
          </div>
          {(()=>{
            const juices=dishes.filter(d=>d.category==="عصير"||d.category==="مشروب");
            return juices.length>0?(
              <div className="grid gap-3 sm:grid-cols-2">
                {juices.map(d=>(
                  <div key={d.id} className="rounded-xl border overflow-hidden" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
                    {d.imageUrl&&<img src={d.imageUrl} alt={d.name} className="w-full h-32 object-cover"/>}
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="cursor-pointer" onClick={()=>loadDishIngs(d.id)}>
                          <p className="font-bold text-sm" style={{color:"var(--text)"}}>{d.name}</p>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{background:"#2ABFBF15",color:"#2ABFBF"}}>{d.category==="عصير"?"🥤 عصير":"☕ مشروب"}</span>
                            {d.prepTime&&<span className="text-[8px]" style={{color:"var(--muted)"}}>{d.prepTime}د</span>}
                            {d.servings&&<span className="text-[8px]" style={{color:"var(--muted)"}}>{d.servings} أشخاص</span>}
                          </div>
                        </div>
                        <button onClick={async()=>{if(confirm("حذف؟")){try{await api.delete(`/api/nutrition/dishes/${d.id}`);fetchData();}catch{}}}} className="text-[10px]" style={{color:"#DC2626"}}>🗑️</button>
                      </div>
                      {d.description&&<p className="text-[10px] mt-1" style={{color:"var(--muted)"}}>{d.description}</p>}
                      {expDish===d.id&&d.ingredients&&(
                        <div className="mt-2 pt-2 border-t space-y-1" style={{borderColor:"var(--card-border)"}}>
                          <p className="text-[9px] font-bold" style={{color:"#2ABFBF"}}>المقادير:</p>
                          {d.ingredients.length>0?d.ingredients.map(i=>(<div key={i.id} className="flex gap-2 text-[10px]" style={{color:"var(--text)"}}>
                            <span>•</span><span>{i.ingredientName}</span><span style={{color:"var(--muted)"}}>{i.quantity} {i.unit}</span></div>))
                            :<p className="text-[9px]" style={{color:"var(--muted)"}}>لا توجد مقادير</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <div className="text-center py-8"><p className="text-3xl mb-2">🥤</p><p className="text-sm" style={{color:"var(--muted)"}}>لا توجد عصيرات — أضف عصيرك الأول</p></div>
            );
          })()}
        </>)}

        {/* ═══ STOCK ═══ */}
        {!loading&&tab==="stock"&&(<>
          <span className="text-xs font-bold" style={{color:"var(--text)"}}>المخزون والماركات</span>
          <p className="text-[10px]" style={{color:"var(--muted)"}}>المواد تُضاف من خلال الصحون — هنا تدير المخزون والأسعار</p>
          {lowStock.length>0&&<div className="rounded-xl border p-3" style={{borderColor:"#DC262630",background:"#DC262606"}}><p className="text-[10px] font-bold mb-1" style={{color:"#DC2626"}}>⚠️ ناقصة:</p><div className="flex flex-wrap gap-1.5">{lowStock.map(i=><span key={i.id} className="text-[9px] px-2 py-0.5 rounded-full" style={{background:"#DC262615",color:"#DC2626"}}>{i.name}</span>)}</div></div>}
          {ingredients.length===0&&<p className="text-center py-8 text-sm" style={{color:"var(--muted)"}}>أضف صحون بمقاديرها لتظهر المواد هنا</p>}
          <div className="space-y-2">{ingredients.map(ing=>{
            const pct=ing.minStock>0?Math.min(100,(ing.currentStock/ing.minStock)*100):100;const sc=pct<30?"#DC2626":pct<70?"#F59E0B":"#3D8C5A";
            return(<div key={ing.id} className="rounded-xl border p-3" style={{background:"var(--card)",borderColor:"var(--card-border)"}}>
              <div className="flex items-center gap-2">
                <div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold text-sm" style={{color:"var(--text)"}}>{ing.name}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"var(--bg)",color:"var(--muted)"}}>{ing.category}</span></div>
                  <div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:"var(--card-border)"}}><div className="h-full rounded-full" style={{width:`${pct}%`,background:sc}}/></div><span className="text-[9px] font-bold" style={{color:sc}}>{ing.currentStock} {ing.unit}</span></div>
                </div>
                <button onClick={()=>setAddBrandId(addBrandId===ing.id?null:ing.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{background:"#5E549515",color:"#5E5495"}}>+ماركة</button>
                <button onClick={()=>setRecordPriceId(recordPriceId===ing.id?null:ing.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{background:"#D4AF3715",color:"#D4AF37"}}>💰</button>
              </div>
              {(ing.brands??[]).length>0&&<div className="mt-2 space-y-1">{(ing.brands??[]).map(b=>(<div key={b.id} className="flex items-center gap-2 text-[10px] px-2 py-1 rounded-lg" style={{background:"var(--bg)"}}>
                {b.isPreferred&&<span style={{color:"#D4AF37"}}>⭐</span>}<span style={{color:"var(--text)"}}>{b.brandName}</span><span style={{color:"var(--muted)"}}>({b.quality})</span>
                {b.lastPrice!=null&&<span className="font-bold" style={{color:"#D4AF37"}}>{b.lastPrice} ر.س</span>}</div>))}</div>}
              {addBrandId===ing.id&&(<div className="mt-2 p-2 rounded-lg space-y-1.5" style={{background:"var(--bg)"}}>
                <input value={nb.name} onChange={e=>setNb({...nb,name:e.target.value})} placeholder="اسم الماركة" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is}/>
                <div className="flex gap-2"><select value={nb.quality} onChange={e=>setNb({...nb,quality:e.target.value})} className="flex-1 px-2 py-1 rounded-lg border text-[10px]" style={is}><option>ممتازة</option><option>جيدة</option><option>مقبولة</option></select>
                  <label className="flex items-center gap-1 text-[10px]" style={{color:"var(--text)"}}><input type="checkbox" checked={nb.preferred} onChange={e=>setNb({...nb,preferred:e.target.checked})}/> مفضلة</label>
                  <button onClick={async()=>{if(!addBrandId||!nb.name.trim())return;try{await api.post(`/api/nutrition/ingredients/${addBrandId}/brands`,{brandName:nb.name,quality:nb.quality,isPreferred:nb.preferred});setNb({name:"",quality:"جيدة",preferred:false});setAddBrandId(null);fetchData();}catch{}}} disabled={!nb.name.trim()} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{background:"#5E5495"}}>+</button></div>
              </div>)}
              {recordPriceId===ing.id&&(<div className="mt-2 p-2 rounded-lg space-y-1.5" style={{background:"#D4AF3708"}}>
                <div className="flex gap-2"><select value={np.brandId} onChange={e=>setNp({...np,brandId:e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is}><option value="">الماركة</option>{(ing.brands??[]).map(b=><option key={b.id} value={b.id}>{b.brandName}</option>)}</select>
                  <input value={np.price} onChange={e=>setNp({...np,price:e.target.value})} placeholder="السعر" type="number" className="w-20 px-2 py-1.5 rounded-lg border text-[10px]" style={is}/></div>
                <div className="flex gap-2"><input value={np.qty} onChange={e=>setNp({...np,qty:e.target.value})} placeholder="الكمية" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is}/>
                  <input value={np.store} onChange={e=>setNp({...np,store:e.target.value})} placeholder="المتجر" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is}/>
                  <button onClick={async()=>{if(!recordPriceId||!np.price)return;try{const res=await api.post(`/api/nutrition/ingredients/${recordPriceId}/prices`,{brandId:np.brandId||undefined,price:parseFloat(np.price),quantity:parseFloat(np.qty)||1,store:np.store||undefined});alert(`تم — ${res.data.priceType}`);setNp({brandId:"",price:"",qty:"1",store:""});setRecordPriceId(null);fetchData();}catch{}}} disabled={!np.price} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{background:"#D4AF37"}}>تسجيل</button></div>
              </div>)}
            </div>);
          })}</div>
        </>)}

        {/* ═══ SHOPPING ═══ */}
        {!loading&&tab==="shopping"&&(
          <div className="text-center py-8"><p className="text-3xl mb-2">🛒</p><p className="text-sm font-bold" style={{color:"var(--text)"}}>قائمة التسوق</p>
            <p className="text-xs mt-1" style={{color:"var(--muted)"}}>أضف صحون ووجبات وخطة أسبوعية لتوليد القائمة</p>
            <button onClick={async()=>{try{const{data}=await api.post("/api/nutrition/shopping/generate");alert(`تم — ${data.itemCount} مادة | ${data.totalEstimatedCost} ر.س`);}catch{alert("أضف خطة أسبوعية أولاً");}}}
              className="mt-3 px-6 py-2 rounded-xl text-sm font-bold text-white" style={{background:"linear-gradient(135deg,#5E5495,#D4AF37)"}}>🛒 توليد قائمة التسوق</button>
          </div>
        )}
      </div>
    </main>
  );
}
