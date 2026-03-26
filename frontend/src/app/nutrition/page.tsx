"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "plan" | "meals" | "ingredients" | "shopping";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface Meal { id: string; name: string; description?: string; mealType: string; prepTime?: number; calories?: number; servings?: number; }
interface Ingredient { id: string; name: string; category: string; unit: string; currentStock: number; minStock: number; brands?: Brand[]; }
interface Brand { id: string; brandName: string; quality: string; isPreferred: boolean; lastPrice?: number; avgPrice?: number; }
interface MealPlan { planDate: string; breakfastName?: string; lunchName?: string; dinnerName?: string; snack1Name?: string; snack2Name?: string; breakfastMealId?: string; lunchMealId?: string; dinnerMealId?: string; }

const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: "breakfast", label: "فطور", icon: "🌅" },
  { key: "lunch", label: "غداء", icon: "🍲" },
  { key: "dinner", label: "عشاء", icon: "🌙" },
  { key: "snack", label: "وجبة خفيفة", icon: "🍎" },
];

const CATEGORIES = ["خضار", "فواكه", "لحوم", "دجاج", "أسماك", "ألبان", "بقالة", "توابل", "مجمدات", "مشروبات", "أخرى"];
const PRICE_COLORS: Record<string, string> = { "مخفض": "#3D8C5A", "عادي": "#D4AF37", "غالي": "#DC2626" };

export default function NutritionPage() {
  const [tab, setTab] = useState<Tab>("meals");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showNewMeal, setShowNewMeal] = useState(false);
  const [showNewIng, setShowNewIng] = useState(false);
  const [mealFilter, setMealFilter] = useState<string | null>(null);

  // New meal form
  const [nm, setNm] = useState({ name: "", desc: "", type: "lunch" as string, prep: "", cal: "", srv: "4" });
  // New ingredient form
  const [ni, setNi] = useState({ name: "", category: "بقالة", unit: "كيلو", stock: "0", min: "0" });
  // New brand
  const [addBrandIngId, setAddBrandIngId] = useState<string | null>(null);
  const [nb, setNb] = useState({ name: "", quality: "جيدة", preferred: false });
  // Record price
  const [recordPriceIngId, setRecordPriceIngId] = useState<string | null>(null);
  const [np, setNp] = useState({ brandId: "", price: "", qty: "1", store: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, i, p] = await Promise.all([
        api.get("/api/nutrition/meals").then(r => r.data ?? []).catch(() => []),
        api.get("/api/nutrition/ingredients").then(r => r.data ?? []).catch(() => []),
        api.get("/api/nutrition/meal-plans").then(r => r.data ?? []).catch(() => []),
      ]);
      setMeals(m); setIngredients(i); setPlans(p);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function createMeal() {
    if (!nm.name.trim()) return;
    try {
      await api.post("/api/nutrition/meals", { name: nm.name, description: nm.desc || undefined, mealType: nm.type, prepTime: parseInt(nm.prep) || undefined, calories: parseInt(nm.cal) || undefined, servings: parseInt(nm.srv) || 4 });
      setNm({ name: "", desc: "", type: "lunch", prep: "", cal: "", srv: "4" }); setShowNewMeal(false); fetchData();
    } catch {}
  }

  async function createIngredient() {
    if (!ni.name.trim()) return;
    try {
      await api.post("/api/nutrition/ingredients", { name: ni.name, category: ni.category, unit: ni.unit, currentStock: parseFloat(ni.stock) || 0, minStock: parseFloat(ni.min) || 0 });
      setNi({ name: "", category: "بقالة", unit: "كيلو", stock: "0", min: "0" }); setShowNewIng(false); fetchData();
    } catch {}
  }

  async function addBrand() {
    if (!addBrandIngId || !nb.name.trim()) return;
    try {
      await api.post(`/api/nutrition/ingredients/${addBrandIngId}/brands`, { brandName: nb.name, quality: nb.quality, isPreferred: nb.preferred });
      setNb({ name: "", quality: "جيدة", preferred: false }); setAddBrandIngId(null); fetchData();
    } catch {}
  }

  async function recordPrice() {
    if (!recordPriceIngId || !np.price) return;
    try {
      const res = await api.post(`/api/nutrition/ingredients/${recordPriceIngId}/prices`, { brandId: np.brandId || undefined, price: parseFloat(np.price), quantity: parseFloat(np.qty) || 1, store: np.store || undefined });
      alert(`تم التسجيل — التصنيف: ${res.data.priceType}`);
      setNp({ brandId: "", price: "", qty: "1", store: "" }); setRecordPriceIngId(null); fetchData();
    } catch {}
  }

  async function deleteMeal(id: string) {
    if (!confirm("حذف الوجبة؟")) return;
    try { await api.delete(`/api/nutrition/meals/${id}`); fetchData(); } catch {}
  }

  const filteredMeals = mealFilter ? meals.filter(m => m.mealType === mealFilter) : meals;
  const lowStock = ingredients.filter(i => i.currentStock <= i.minStock && i.minStock > 0);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "meals", label: "الوجبات", icon: "🍽️" },
    { key: "ingredients", label: "المواد", icon: "🧺" },
    { key: "plan", label: "خطة الأسبوع", icon: "📅" },
    { key: "shopping", label: "التسوق", icon: "🛒" },
  ];

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🍽️ التغذية المنزلية</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{meals.length} وجبة · {ingredients.length} مادة</span>
          {lowStock.length > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>⚠️ {lowStock.length} مادة ناقصة</span>}
        </div>
        <div className="flex gap-1.5 mt-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: tab === t.key ? "#5E5495" : "var(--bg)", color: tab === t.key ? "#fff" : "var(--muted)", border: `1px solid ${tab === t.key ? "#5E5495" : "var(--card-border)"}` }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* ═══ MEALS TAB ═══ */}
        {!loading && tab === "meals" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <button onClick={() => setMealFilter(null)} className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: !mealFilter ? "#5E5495" : "var(--bg)", color: !mealFilter ? "#fff" : "var(--muted)" }}>الكل</button>
                {MEAL_TYPES.map(mt => (
                  <button key={mt.key} onClick={() => setMealFilter(mealFilter === mt.key ? null : mt.key)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: mealFilter === mt.key ? "#D4AF37" : "var(--bg)", color: mealFilter === mt.key ? "#fff" : "var(--muted)" }}>
                    {mt.icon} {mt.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowNewMeal(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#D4AF37" }}>+ وجبة</button>
            </div>

            {showNewMeal && (
              <div className="rounded-xl border p-4 space-y-2" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <input value={nm.name} onChange={e => setNm({...nm, name: e.target.value})} placeholder="اسم الوجبة *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                <textarea value={nm.desc} onChange={e => setNm({...nm, desc: e.target.value})} placeholder="وصف (اختياري)" rows={2} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                <div className="flex gap-2">
                  <select value={nm.type} onChange={e => setNm({...nm, type: e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                    {MEAL_TYPES.map(mt => <option key={mt.key} value={mt.key}>{mt.icon} {mt.label}</option>)}
                  </select>
                  <input value={nm.prep} onChange={e => setNm({...nm, prep: e.target.value})} placeholder="وقت التحضير (دقيقة)" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                  <input value={nm.srv} onChange={e => setNm({...nm, srv: e.target.value})} placeholder="أشخاص" type="number" className="w-16 px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNewMeal(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                  <button onClick={createMeal} disabled={!nm.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>إضافة</button>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredMeals.map(m => {
                const mt = MEAL_TYPES.find(t => t.key === m.mealType);
                return (
                  <div key={m.id} className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{m.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#D4AF3715", color: "#D4AF37" }}>{mt?.icon} {mt?.label}</span>
                          {m.prepTime && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{m.prepTime} د</span>}
                          {m.servings && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{m.servings} أشخاص</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteMeal(m.id)} className="text-[10px] px-1.5 py-1 rounded hover:bg-black/5" style={{ color: "#DC2626" }}>🗑️</button>
                    </div>
                    {m.description && <p className="text-[10px] mt-2" style={{ color: "var(--muted)" }}>{m.description}</p>}
                  </div>
                );
              })}
            </div>
            {filteredMeals.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد وجبات — أضف وجبتك الأولى</p>}
          </>
        )}

        {/* ═══ INGREDIENTS TAB ═══ */}
        {!loading && tab === "ingredients" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>المواد والماركات</span>
              <button onClick={() => setShowNewIng(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#D4AF37" }}>+ مادة</button>
            </div>

            {showNewIng && (
              <div className="rounded-xl border p-4 space-y-2" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <input value={ni.name} onChange={e => setNi({...ni, name: e.target.value})} placeholder="اسم المادة *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                <div className="flex gap-2">
                  <select value={ni.category} onChange={e => setNi({...ni, category: e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={ni.unit} onChange={e => setNi({...ni, unit: e.target.value})} className="px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                    {["كيلو","جرام","لتر","مل","حبة","علبة","كيس"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input value={ni.stock} onChange={e => setNi({...ni, stock: e.target.value})} placeholder="المخزون الحالي" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                  <input value={ni.min} onChange={e => setNi({...ni, min: e.target.value})} placeholder="الحد الأدنى" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNewIng(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                  <button onClick={createIngredient} disabled={!ni.name.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>إضافة</button>
                </div>
              </div>
            )}

            {/* Low stock alert */}
            {lowStock.length > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: "#DC262630", background: "#DC262606" }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: "#DC2626" }}>⚠️ مواد ناقصة:</p>
                <div className="flex flex-wrap gap-1.5">
                  {lowStock.map(i => <span key={i.id} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>{i.name} ({i.currentStock}/{i.minStock} {i.unit})</span>)}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {ingredients.map(ing => {
                const stockPct = ing.minStock > 0 ? Math.min(100, (ing.currentStock / ing.minStock) * 100) : 100;
                const stockColor = stockPct < 30 ? "#DC2626" : stockPct < 70 ? "#F59E0B" : "#3D8C5A";
                return (
                  <div key={ing.id} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{ing.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg)", color: "var(--muted)" }}>{ing.category}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                            <div className="h-full rounded-full" style={{ width: `${stockPct}%`, background: stockColor }} />
                          </div>
                          <span className="text-[9px] font-bold" style={{ color: stockColor }}>{ing.currentStock} {ing.unit}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setAddBrandIngId(addBrandIngId === ing.id ? null : ing.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{ background: "#5E549515", color: "#5E5495" }}>+ ماركة</button>
                        <button onClick={() => setRecordPriceIngId(recordPriceIngId === ing.id ? null : ing.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{ background: "#D4AF3715", color: "#D4AF37" }}>💰 سعر</button>
                      </div>
                    </div>

                    {/* Brands */}
                    {ing.brands && ing.brands.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ing.brands.map(b => (
                          <div key={b.id} className="flex items-center gap-2 text-[10px] px-2 py-1 rounded-lg" style={{ background: "var(--bg)" }}>
                            {b.isPreferred && <span style={{ color: "#D4AF37" }}>⭐</span>}
                            <span style={{ color: "var(--text)" }}>{b.brandName}</span>
                            <span style={{ color: "var(--muted)" }}>({b.quality})</span>
                            {b.lastPrice != null && <span className="font-bold" style={{ color: PRICE_COLORS["عادي"] }}>{b.lastPrice} ر.س</span>}
                            {b.avgPrice != null && <span style={{ color: "var(--muted)" }}>متوسط: {Number(b.avgPrice).toFixed(1)}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add brand form */}
                    {addBrandIngId === ing.id && (
                      <div className="mt-2 p-2 rounded-lg space-y-1.5" style={{ background: "var(--bg)" }}>
                        <input value={nb.name} onChange={e => setNb({...nb, name: e.target.value})} placeholder="اسم الماركة" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                        <div className="flex gap-2">
                          <select value={nb.quality} onChange={e => setNb({...nb, quality: e.target.value})} className="flex-1 px-2 py-1 rounded-lg border text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }}>
                            <option value="ممتازة">ممتازة</option><option value="جيدة">جيدة</option><option value="مقبولة">مقبولة</option>
                          </select>
                          <label className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text)" }}>
                            <input type="checkbox" checked={nb.preferred} onChange={e => setNb({...nb, preferred: e.target.checked})} /> مفضلة
                          </label>
                          <button onClick={addBrand} disabled={!nb.name.trim()} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
                        </div>
                      </div>
                    )}

                    {/* Record price form */}
                    {recordPriceIngId === ing.id && (
                      <div className="mt-2 p-2 rounded-lg space-y-1.5" style={{ background: "#D4AF3708" }}>
                        <div className="flex gap-2">
                          <select value={np.brandId} onChange={e => setNp({...np, brandId: e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }}>
                            <option value="">اختر الماركة</option>
                            {(ing.brands ?? []).map(b => <option key={b.id} value={b.id}>{b.brandName}</option>)}
                          </select>
                          <input value={np.price} onChange={e => setNp({...np, price: e.target.value})} placeholder="السعر" type="number" className="w-20 px-2 py-1.5 rounded-lg border text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                        </div>
                        <div className="flex gap-2">
                          <input value={np.qty} onChange={e => setNp({...np, qty: e.target.value})} placeholder="الكمية" type="number" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input value={np.store} onChange={e => setNp({...np, store: e.target.value})} placeholder="المتجر" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <button onClick={recordPrice} disabled={!np.price} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>تسجيل</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {ingredients.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد مواد — أضف مادتك الأولى</p>}
          </>
        )}

        {/* ═══ MEAL PLAN TAB ═══ */}
        {!loading && tab === "plan" && (
          <>
            <p className="text-xs font-bold" style={{ color: "var(--text)" }}>خطة الأسبوع</p>
            {plans.length > 0 ? (
              <div className="space-y-2">
                {plans.map(p => (
                  <div key={p.planDate} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>{new Date(p.planDate).toLocaleDateString("ar-SA", { weekday: "long", month: "short", day: "numeric" })}</p>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg)" }}>
                        <span style={{ color: "var(--muted)" }}>🌅 فطور</span>
                        <p className="font-bold mt-0.5" style={{ color: p.breakfastName ? "var(--text)" : "var(--muted)" }}>{p.breakfastName ?? "—"}</p>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg)" }}>
                        <span style={{ color: "var(--muted)" }}>🍲 غداء</span>
                        <p className="font-bold mt-0.5" style={{ color: p.lunchName ? "var(--text)" : "var(--muted)" }}>{p.lunchName ?? "—"}</p>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg)" }}>
                        <span style={{ color: "var(--muted)" }}>🌙 عشاء</span>
                        <p className="font-bold mt-0.5" style={{ color: p.dinnerName ? "var(--text)" : "var(--muted)" }}>{p.dinnerName ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>لا توجد خطة لهذا الأسبوع — أضف وجبات أولاً</p>
              </div>
            )}
          </>
        )}

        {/* ═══ SHOPPING TAB ═══ */}
        {!loading && tab === "shopping" && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>قائمة التسوق</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف وجبات وخطة أسبوعية أولاً لتوليد قائمة التسوق تلقائيًا</p>
            <button onClick={async () => {
              try { const { data } = await api.post("/api/nutrition/shopping/generate"); alert(`تم توليد القائمة — ${data.itemCount} مادة`); } catch { alert("أضف خطة أسبوعية أولاً"); }
            }} className="mt-3 px-6 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>
              🛒 توليد قائمة التسوق
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
