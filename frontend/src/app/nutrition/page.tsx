"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "dishes" | "stock" | "plan" | "shopping";

interface Dish { id: string; name: string; description?: string; imageUrl?: string; suitableFor: string; frequency: string; preferredDays?: string; isDailyFavorite: boolean; isForGuests: boolean; prepTime?: number; servings?: number; ingredients?: DishIng[]; }
interface DishIng { id: string; ingredientId: string; ingredientName: string; quantity: number; unit: string; }
interface Ingredient { id: string; name: string; category: string; unit: string; currentStock: number; minStock: number; brands?: Brand[]; }
interface Brand { id: string; brandName: string; quality: string; isPreferred: boolean; lastPrice?: number; avgPrice?: number; }

const MEAL_TYPES = [
  { key: "breakfast", label: "فطور", icon: "🌅" },
  { key: "lunch", label: "غداء", icon: "🍲" },
  { key: "dinner", label: "عشاء", icon: "🌙" },
  { key: "snack", label: "خفيفة", icon: "🍎" },
];
const FREQ = [
  { key: "daily", label: "يومي ⭐" },
  { key: "weekly", label: "أسبوعي 📅" },
  { key: "occasional", label: "متناوب 🔀" },
  { key: "guests", label: "ضيوف 👥" },
];
const DAYS = ["سبت","أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة"];

function parseSuitable(s: string): string[] { try { return JSON.parse(s); } catch { return []; } }

const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function NutritionPage() {
  const [tab, setTab] = useState<Tab>("dishes");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [plans, setPlans] = useState<{ date: string; meals: Record<string, { id: string; name: string; image?: string }[]> }[]>([]);
  const [loading, setLoading] = useState(true);

  // Dish form
  const [showNew, setShowNew] = useState(false);
  const [nd, setNd] = useState({ name: "", desc: "", img: "", suitable: ["lunch"] as string[], freq: "occasional", days: [] as number[], daily: false, guests: false, prep: "", srv: "4" });
  const [ndIngs, setNdIngs] = useState<{ name: string; qty: string; unit: string; existingId?: string }[]>([]);
  const [ingSearch, setIngSearch] = useState("");

  // Stock (brands/prices)
  const [addBrandId, setAddBrandId] = useState<string | null>(null);
  const [nb, setNb] = useState({ name: "", quality: "جيدة", preferred: false });
  const [recordPriceId, setRecordPriceId] = useState<string | null>(null);
  const [np, setNp] = useState({ brandId: "", price: "", qty: "1", store: "" });

  // Expanded dish
  const [expandedDish, setExpandedDish] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, i, p] = await Promise.all([
        api.get("/api/nutrition/dishes").then(r => r.data ?? []).catch(() => []),
        api.get("/api/nutrition/ingredients").then(r => r.data ?? []).catch(() => []),
        api.get("/api/nutrition/meal-plans").then(r => r.data ?? []).catch(() => []),
      ]);
      setDishes(d); setIngredients(i); setPlans(p);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Create dish with ingredients
  async function createDish() {
    if (!nd.name.trim()) return;
    try {
      const { data } = await api.post("/api/nutrition/dishes", {
        name: nd.name, description: nd.desc || undefined, imageUrl: nd.img || undefined,
        suitableFor: nd.suitable, frequency: nd.guests ? "guests" : nd.freq,
        preferredDays: nd.days.length > 0 ? nd.days : undefined,
        isDailyFavorite: nd.daily, isForGuests: nd.guests,
        prepTime: parseInt(nd.prep) || undefined, servings: parseInt(nd.srv) || 4,
      });
      // Add ingredients
      for (const ing of ndIngs) {
        if (!ing.name.trim()) continue;
        let ingId = ing.existingId;
        // Create ingredient if new
        if (!ingId) {
          const { data: newIng } = await api.post("/api/nutrition/ingredients", { name: ing.name.trim(), category: "بقالة", unit: ing.unit || "جرام" });
          ingId = newIng.id;
        }
        await api.post(`/api/nutrition/dishes/${data.id}/ingredients`, { ingredientId: ingId, quantity: parseFloat(ing.qty) || 1, unit: ing.unit || "جرام" });
      }
      setNd({ name: "", desc: "", img: "", suitable: ["lunch"], freq: "occasional", days: [], daily: false, guests: false, prep: "", srv: "4" });
      setNdIngs([]); setShowNew(false); fetchData();
    } catch {}
  }

  function addIngRow() { setNdIngs([...ndIngs, { name: "", qty: "", unit: "جرام" }]); }
  function removeIngRow(i: number) { setNdIngs(ndIngs.filter((_, j) => j !== i)); }

  async function addBrand() {
    if (!addBrandId || !nb.name.trim()) return;
    try { await api.post(`/api/nutrition/ingredients/${addBrandId}/brands`, { brandName: nb.name, quality: nb.quality, isPreferred: nb.preferred }); setNb({ name: "", quality: "جيدة", preferred: false }); setAddBrandId(null); fetchData(); } catch {}
  }

  async function recordPrice() {
    if (!recordPriceId || !np.price) return;
    try {
      const res = await api.post(`/api/nutrition/ingredients/${recordPriceId}/prices`, { brandId: np.brandId || undefined, price: parseFloat(np.price), quantity: parseFloat(np.qty) || 1, store: np.store || undefined });
      alert(`تم — التصنيف: ${res.data.priceType}`);
      setNp({ brandId: "", price: "", qty: "1", store: "" }); setRecordPriceId(null); fetchData();
    } catch {}
  }

  async function autoGenerate() {
    try { await api.post("/api/nutrition/meal-plans/auto-generate"); alert("تم توليد خطة الأسبوع"); fetchData(); }
    catch { alert("أضف أطباق أولاً"); }
  }

  async function loadDishIngredients(dishId: string) {
    if (expandedDish === dishId) { setExpandedDish(null); return; }
    try {
      const { data } = await api.get(`/api/nutrition/dishes/${dishId}`);
      setDishes(prev => prev.map(d => d.id === dishId ? { ...d, ingredients: data.ingredients ?? [] } : d));
      setExpandedDish(dishId);
    } catch { setExpandedDish(dishId); }
  }

  const dailyDishes = dishes.filter(d => d.isDailyFavorite);
  const weeklyDishes = dishes.filter(d => d.frequency === "weekly" && !d.isDailyFavorite);
  const occasionalDishes = dishes.filter(d => d.frequency === "occasional" && !d.isDailyFavorite && !d.isForGuests);
  const guestDishes = dishes.filter(d => d.isForGuests);
  const lowStock = ingredients.filter(i => i.currentStock <= i.minStock && i.minStock > 0);

  // Ingredient name suggestions for dish form
  const ingSuggestions = ingSearch.length > 0 ? ingredients.filter(i => i.name.includes(ingSearch)) : [];

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🍽️ التغذية المنزلية</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{dishes.length} طبق · {ingredients.length} مادة</span>
          {lowStock.length > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>⚠️ {lowStock.length} ناقصة</span>}
        </div>
        <div className="flex gap-1.5 mt-2">
          {([["dishes","الأطباق","🍽️"],["stock","المخزون","🧺"],["plan","خطة الأسبوع","📅"],["shopping","التسوق","🛒"]] as [Tab,string,string][]).map(([k,l,ic]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: tab === k ? "#5E5495" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#5E5495" : "var(--card-border)"}` }}>
              {ic} {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* ═══ DISHES ═══ */}
        {!loading && tab === "dishes" && (<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>الأطباق</span>
            <button onClick={() => { setShowNew(true); setNdIngs([{ name: "", qty: "", unit: "جرام" }]); }} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#D4AF37" }}>+ طبق جديد</button>
          </div>

          {showNew && (
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <input value={nd.name} onChange={e => setNd({...nd, name: e.target.value})} placeholder="اسم الطبق *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
              <textarea value={nd.desc} onChange={e => setNd({...nd, desc: e.target.value})} placeholder="وصف (اختياري)" rows={2} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={is} />
              <input value={nd.img} onChange={e => setNd({...nd, img: e.target.value})} placeholder="رابط الصورة (اختياري)" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />

              {/* Suitable for */}
              <div>
                <p className="text-[10px] font-bold mb-1" style={{ color: "var(--text)" }}>مناسب لـ:</p>
                <div className="flex gap-1.5">
                  {MEAL_TYPES.map(mt => (
                    <button key={mt.key} onClick={() => setNd({...nd, suitable: nd.suitable.includes(mt.key) ? nd.suitable.filter(s => s !== mt.key) : [...nd.suitable, mt.key]})}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition"
                      style={{ background: nd.suitable.includes(mt.key) ? "#D4AF37" : "var(--bg)", color: nd.suitable.includes(mt.key) ? "#fff" : "var(--muted)", border: `1px solid ${nd.suitable.includes(mt.key) ? "#D4AF37" : "var(--card-border)"}` }}>
                      {mt.icon} {mt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <p className="text-[10px] font-bold mb-1" style={{ color: "var(--text)" }}>التكرار:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {FREQ.map(f => {
                    const active = (nd.daily && f.key==="daily") || (nd.guests && f.key==="guests") || (!nd.daily && !nd.guests && nd.freq===f.key);
                    return (
                      <button key={f.key} onClick={() => setNd({...nd, freq: f.key, daily: f.key==="daily", guests: f.key==="guests"})}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition"
                        style={{ background: active ? "#5E5495" : "var(--bg)", color: active ? "#fff" : "var(--muted)", border: `1px solid var(--card-border)` }}>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {nd.freq === "weekly" && (
                <div className="flex gap-1">{DAYS.map((d, i) => (
                  <button key={i} onClick={() => setNd({...nd, days: nd.days.includes(i) ? nd.days.filter(x => x !== i) : [...nd.days, i]})}
                    className="w-9 h-9 rounded-lg text-[9px] font-bold transition"
                    style={{ background: nd.days.includes(i) ? "#D4AF37" : "var(--bg)", color: nd.days.includes(i) ? "#fff" : "var(--muted)", border: `1px solid var(--card-border)` }}>{d}</button>
                ))}</div>
              )}

              <div className="flex gap-2">
                <input value={nd.prep} onChange={e => setNd({...nd, prep: e.target.value})} placeholder="وقت التحضير (دقيقة)" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is} />
                <input value={nd.srv} onChange={e => setNd({...nd, srv: e.target.value})} placeholder="أشخاص" type="number" className="w-20 px-2 py-1.5 rounded-lg border text-xs" style={is} />
              </div>

              {/* ── المقادير ── */}
              <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "#D4AF3730", background: "#D4AF3706" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold" style={{ color: "#D4AF37" }}>🧺 المقادير:</p>
                  <button onClick={addIngRow} className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#D4AF3715", color: "#D4AF37" }}>+ مادة</button>
                </div>
                {ndIngs.map((ing, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <div className="flex-1 relative">
                      <input value={ing.name} onChange={e => {
                        const val = e.target.value;
                        const updated = [...ndIngs]; updated[idx] = { ...ing, name: val, existingId: undefined };
                        // Check if matches existing
                        const match = ingredients.find(i => i.name === val);
                        if (match) updated[idx].existingId = match.id;
                        setNdIngs(updated); setIngSearch(val);
                      }}
                        onFocus={() => setIngSearch(ing.name)}
                        onBlur={() => setTimeout(() => setIngSearch(""), 200)}
                        placeholder="اسم المادة" className="w-full px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none" style={is} />
                      {/* Suggestions dropdown */}
                      {ingSearch === ing.name && ingSuggestions.length > 0 && ing.name.length > 0 && !ing.existingId && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-0.5 rounded-lg border shadow-lg max-h-24 overflow-y-auto" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                          {ingSuggestions.map(s => (
                            <button key={s.id} onMouseDown={() => {
                              const updated = [...ndIngs]; updated[idx] = { ...ing, name: s.name, existingId: s.id, unit: s.unit };
                              setNdIngs(updated); setIngSearch("");
                            }}
                              className="w-full text-right px-2 py-1.5 text-[10px] hover:bg-black/5 transition" style={{ color: "var(--text)" }}>
                              {s.name} <span style={{ color: "var(--muted)" }}>({s.category})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {ing.existingId && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px]" style={{ color: "#3D8C5A" }}>✓</span>}
                    </div>
                    <input value={ing.qty} onChange={e => { const u = [...ndIngs]; u[idx] = { ...ing, qty: e.target.value }; setNdIngs(u); }}
                      placeholder="الكمية" type="number" className="w-16 px-2 py-1.5 rounded-lg border text-[10px] text-center" style={is} />
                    <select value={ing.unit} onChange={e => { const u = [...ndIngs]; u[idx] = { ...ing, unit: e.target.value }; setNdIngs(u); }}
                      className="px-1 py-1.5 rounded-lg border text-[10px]" style={is}>
                      {["جرام","كيلو","مل","لتر","حبة","ملعقة","كوب"].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <button onClick={() => removeIngRow(idx)} className="text-[10px] px-1 rounded" style={{ color: "#DC2626" }}>✕</button>
                  </div>
                ))}
                {ndIngs.length === 0 && <p className="text-[9px] text-center py-1" style={{ color: "var(--muted)" }}>اضغط "+ مادة" لإضافة مقادير</p>}
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowNew(false); setNdIngs([]); }} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                <button onClick={createDish} disabled={!nd.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>إضافة الطبق</button>
              </div>
            </div>
          )}

          {/* Dish sections */}
          {[{ title: "⭐ يومية مفضلة", items: dailyDishes }, { title: "📅 أسبوعية", items: weeklyDishes }, { title: "🔀 متناوبة", items: occasionalDishes }, { title: "👥 للضيوف", items: guestDishes }]
            .filter(s => s.items.length > 0).map(section => (
            <div key={section.title}>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>{section.title}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.items.map(d => {
                  const suitable = parseSuitable(d.suitableFor);
                  const isExp = expandedDish === d.id;
                  return (
                    <div key={d.id} className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                      {d.imageUrl && <img src={d.imageUrl} alt={d.name} className="w-full h-32 object-cover" />}
                      <div className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="cursor-pointer" onClick={() => loadDishIngredients(d.id)}>
                            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{d.name}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {suitable.map(s => { const mt = MEAL_TYPES.find(m => m.key === s); return mt ? <span key={s} className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: "#D4AF3715", color: "#D4AF37" }}>{mt.icon} {mt.label}</span> : null; })}
                              {d.prepTime && <span className="text-[8px]" style={{ color: "var(--muted)" }}>{d.prepTime}د</span>}
                            </div>
                          </div>
                          <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/nutrition/dishes/${d.id}`); fetchData(); } catch {} } }}
                            className="text-[10px] px-1 rounded" style={{ color: "#DC2626" }}>🗑️</button>
                        </div>
                        {d.description && <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{d.description}</p>}
                        {/* Expanded ingredients */}
                        {isExp && d.ingredients && (
                          <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: "var(--card-border)" }}>
                            <p className="text-[9px] font-bold" style={{ color: "#D4AF37" }}>المقادير:</p>
                            {d.ingredients.length > 0 ? d.ingredients.map(ing => (
                              <div key={ing.id} className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text)" }}>
                                <span>•</span> <span>{ing.ingredientName}</span> <span style={{ color: "var(--muted)" }}>{ing.quantity} {ing.unit}</span>
                              </div>
                            )) : <p className="text-[9px]" style={{ color: "var(--muted)" }}>لا توجد مقادير</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {dishes.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد أطباق — أضف طبقك الأول</p>}
        </>)}

        {/* ═══ STOCK (read-only + brands/prices) ═══ */}
        {!loading && tab === "stock" && (<>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>المخزون والماركات</span>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>المواد تُضاف من خلال الأطباق — هنا تدير المخزون والماركات والأسعار</p>

          {lowStock.length > 0 && (
            <div className="rounded-xl border p-3" style={{ borderColor: "#DC262630", background: "#DC262606" }}>
              <p className="text-[10px] font-bold mb-1" style={{ color: "#DC2626" }}>⚠️ مواد ناقصة:</p>
              <div className="flex flex-wrap gap-1.5">{lowStock.map(i => <span key={i.id} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>{i.name}</span>)}</div>
            </div>
          )}

          {ingredients.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد مواد بعد — أضف أطباق مع مقاديرها أولاً</p>}

          <div className="space-y-2">
            {ingredients.map(ing => {
              const pct = ing.minStock > 0 ? Math.min(100, (ing.currentStock / ing.minStock) * 100) : 100;
              const sc = pct < 30 ? "#DC2626" : pct < 70 ? "#F59E0B" : "#3D8C5A";
              return (
                <div key={ing.id} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><span className="font-bold text-sm" style={{ color: "var(--text)" }}>{ing.name}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg)", color: "var(--muted)" }}>{ing.category}</span></div>
                      <div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: sc }} /></div><span className="text-[9px] font-bold" style={{ color: sc }}>{ing.currentStock} {ing.unit}</span></div>
                    </div>
                    <button onClick={() => setAddBrandId(addBrandId === ing.id ? null : ing.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{ background: "#5E549515", color: "#5E5495" }}>+ ماركة</button>
                    <button onClick={() => setRecordPriceId(recordPriceId === ing.id ? null : ing.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{ background: "#D4AF3715", color: "#D4AF37" }}>💰</button>
                  </div>
                  {(ing.brands ?? []).length > 0 && <div className="mt-2 space-y-1">{(ing.brands??[]).map(b => (
                    <div key={b.id} className="flex items-center gap-2 text-[10px] px-2 py-1 rounded-lg" style={{ background: "var(--bg)" }}>
                      {b.isPreferred && <span style={{ color: "#D4AF37" }}>⭐</span>}
                      <span style={{ color: "var(--text)" }}>{b.brandName}</span>
                      <span style={{ color: "var(--muted)" }}>({b.quality})</span>
                      {b.lastPrice != null && <span className="font-bold" style={{ color: "#D4AF37" }}>{b.lastPrice} ر.س</span>}
                    </div>
                  ))}</div>}
                  {addBrandId === ing.id && (
                    <div className="mt-2 p-2 rounded-lg space-y-1.5" style={{ background: "var(--bg)" }}>
                      <input value={nb.name} onChange={e => setNb({...nb, name: e.target.value})} placeholder="اسم الماركة" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                      <div className="flex gap-2">
                        <select value={nb.quality} onChange={e => setNb({...nb, quality: e.target.value})} className="flex-1 px-2 py-1 rounded-lg border text-[10px]" style={is}><option>ممتازة</option><option>جيدة</option><option>مقبولة</option></select>
                        <label className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text)" }}><input type="checkbox" checked={nb.preferred} onChange={e => setNb({...nb, preferred: e.target.checked})} /> مفضلة</label>
                        <button onClick={addBrand} disabled={!nb.name.trim()} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
                      </div>
                    </div>
                  )}
                  {recordPriceId === ing.id && (
                    <div className="mt-2 p-2 rounded-lg space-y-1.5" style={{ background: "#D4AF3708" }}>
                      <div className="flex gap-2">
                        <select value={np.brandId} onChange={e => setNp({...np, brandId: e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is}><option value="">الماركة</option>{(ing.brands??[]).map(b => <option key={b.id} value={b.id}>{b.brandName}</option>)}</select>
                        <input value={np.price} onChange={e => setNp({...np, price: e.target.value})} placeholder="السعر" type="number" className="w-20 px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                      </div>
                      <div className="flex gap-2">
                        <input value={np.qty} onChange={e => setNp({...np, qty: e.target.value})} placeholder="الكمية" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                        <input value={np.store} onChange={e => setNp({...np, store: e.target.value})} placeholder="المتجر" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                        <button onClick={recordPrice} disabled={!np.price} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>تسجيل</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>)}

        {/* ═══ PLAN ═══ */}
        {!loading && tab === "plan" && (<>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>خطة الأسبوع</span>
            <button onClick={autoGenerate} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>🤖 توليد تلقائي</button>
          </div>
          {plans.length > 0 ? plans.map(p => (
            <div key={p.date} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>{new Date(p.date + "T00:00:00").toLocaleDateString("ar-SA", { weekday: "long", month: "short", day: "numeric" })}</p>
              <div className="grid grid-cols-3 gap-2">
                {["breakfast","lunch","dinner"].map(mt => {
                  const mealDishes = p.meals[mt] ?? [];
                  const mtInfo = MEAL_TYPES.find(m => m.key === mt);
                  return (
                    <div key={mt} className="rounded-lg p-2" style={{ background: "var(--bg)" }}>
                      <p className="text-[9px] text-center mb-1" style={{ color: "var(--muted)" }}>{mtInfo?.icon} {mtInfo?.label}</p>
                      {mealDishes.length > 0 ? mealDishes.map(d => (
                        <div key={d.id} className="text-center mb-1">
                          {d.image && <img src={d.image} alt="" className="w-full h-12 object-cover rounded mb-0.5" />}
                          <p className="text-[9px] font-bold" style={{ color: "var(--text)" }}>{d.name}</p>
                        </div>
                      )) : <p className="text-[9px] text-center" style={{ color: "var(--muted)" }}>—</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )) : <div className="text-center py-8"><p className="text-3xl mb-2">📅</p><p className="text-sm" style={{ color: "var(--muted)" }}>أضف أطباق ثم اضغط "توليد تلقائي"</p></div>}
        </>)}

        {/* ═══ SHOPPING ═══ */}
        {!loading && tab === "shopping" && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>قائمة التسوق</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أطباق بمقاديرها وخطة أسبوعية لتوليد قائمة تسوق</p>
            <button onClick={async () => { try { const { data } = await api.post("/api/nutrition/shopping/generate"); alert(`تم — ${data.itemCount} مادة | ${data.totalEstimatedCost} ر.س`); } catch { alert("أضف خطة أسبوعية أولاً"); } }}
              className="mt-3 px-6 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>
              🛒 توليد قائمة التسوق
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
