"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HistoryRecord {
  id: string; year: number; hijriYear: number; inputType: string;
  title: string; description?: string; figure?: string; location?: string;
  country?: string; category: string; strategicImportance?: string;
  importance: string; source?: string; tags?: string;
}

interface HistoryFigure {
  id: string; name: string; birthYear?: number; deathYear?: number;
  role?: string; nationality?: string; category?: string; bio?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { key: "political", label: "سياسي", color: "#DC2626", icon: "🏛️" },
  { key: "intellectual", label: "فكري", color: "#7C3AED", icon: "📚" },
  { key: "military", label: "عسكري", color: "#92400E", icon: "⚔️" },
  { key: "economic", label: "اقتصادي", color: "#059669", icon: "💰" },
  { key: "religious", label: "ديني", color: "#2563EB", icon: "🕌" },
  { key: "civilizational", label: "حضاري", color: "#D97706", icon: "🏗️" },
  { key: "other", label: "أخرى", color: "#6B7280", icon: "📋" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const IMPORTANCE = [
  { key: "normal", label: "عادي", color: "#6B7280" },
  { key: "important", label: "مهم", color: "#D97706" },
  { key: "critical", label: "فارق", color: "#DC2626" },
];

/* ─── Hijri conversion (client-side for instant preview) ─────────────── */
function hijriToGreg(h: number): number { return Math.round(h * 0.970229 + 621.5709); }
function gregToHijri(g: number): number { return Math.round((g - 621.5709) / 0.970229); }

/* ─── Era helpers ────────────────────────────────────────────────────── */

interface Era { label: string; from: number; to: number; }

function buildEras(): Era[] {
  const eras: Era[] = [];
  // قبل الميلاد
  for (let s = -4000; s < 0; s += 1000)
    eras.push({ label: `${Math.abs(s)} ق.م — ${Math.abs(s + 1000)} ق.م`, from: s, to: s + 999 });
  // بعد الميلاد — قرون
  for (let c = 0; c < 21; c++) {
    const from = c * 100 + 1;
    const to = (c + 1) * 100;
    const names = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر",
      "الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر","التاسع عشر","العشرون","الحادي والعشرون"];
    eras.push({ label: `القرن ${names[c]} (${from}-${to}م)`, from, to });
  }
  return eras;
}

const ALL_ERAS = buildEras();
const CURRENT_CENTURY_IDX = ALL_ERAS.findIndex(e => e.from <= new Date().getFullYear() && e.to >= new Date().getFullYear());

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function HistoryPage() {
  const [tab, setTab] = useState<"timeline" | "figures">("timeline");
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [figures, setFigures] = useState<HistoryFigure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddFigure, setShowAddFigure] = useState(false);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  // Filters
  const [filterCat, setFilterCat] = useState("");
  const [filterImportance, setFilterImportance] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f] = await Promise.all([
        api.get("/api/history/records"),
        api.get("/api/history/figures"),
      ]);
      setRecords(r.data ?? []);
      setFigures(f.data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter records
  const filtered = records.filter(r => {
    if (filterCat && r.category !== filterCat) return false;
    if (filterImportance && r.importance !== filterImportance) return false;
    if (filterCountry && r.country !== filterCountry) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q) && !(r.figure ?? "").toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  // Countries from data
  const countries = [...new Set(records.map(r => r.country).filter(Boolean))] as string[];

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 xl:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>📜 التاريخ والتوثيق</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{records.length} حدث · {figures.length} شخصية</p>
          </div>
          <button onClick={() => tab === "timeline" ? setShowAdd(true) : setShowAddFigure(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            + {tab === "timeline" ? "حدث" : "شخصية"}
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1.5 mt-3">
          {([["timeline", "📅 المحور الزمني"], ["figures", "👤 الشخصيات"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: tab === k ? "#2C2C54" : "transparent", color: tab === k ? "#fff" : "var(--muted)" }}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4">
        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* ═══ TIMELINE TAB ═══ */}
        {!loading && tab === "timeline" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 بحث..."
                className="px-3 py-2 rounded-xl border text-xs flex-1 min-w-[120px] focus:outline-none"
                style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                <option value="">كل الفئات</option>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
              </select>
              <select value={filterImportance} onChange={e => setFilterImportance(e.target.value)}
                className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                <option value="">كل الأهمية</option>
                {IMPORTANCE.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
              </select>
              {countries.length > 0 && (
                <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الدول</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            {/* Eras */}
            <div className="space-y-2">
              {ALL_ERAS.map((era, idx) => {
                const eraRecords = filtered.filter(r => r.year >= era.from && r.year <= era.to);
                if (eraRecords.length === 0 && idx !== CURRENT_CENTURY_IDX) return null;
                return <EraSection key={idx} era={era} records={eraRecords} defaultOpen={idx === CURRENT_CENTURY_IDX} onSelect={setSelected} />;
              })}
            </div>

            {filtered.length === 0 && records.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📜</p>
                <p className="font-bold" style={{ color: "var(--text)" }}>ابدأ بتوثيق التاريخ</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أول حدث تاريخي</p>
              </div>
            )}
          </>
        )}

        {/* ═══ FIGURES TAB ═══ */}
        {!loading && tab === "figures" && (
          <div className="space-y-2">
            {figures.map(f => (
              <div key={f.id} className="rounded-xl border p-4 flex items-start gap-3"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <span className="text-2xl">👤</span>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{f.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] flex-wrap" style={{ color: "var(--muted)" }}>
                    {f.birthYear && <span>{f.birthYear > 0 ? `${f.birthYear}م` : `${Math.abs(f.birthYear)} ق.م`}</span>}
                    {f.birthYear && f.deathYear && <span>—</span>}
                    {f.deathYear && <span>{f.deathYear > 0 ? `${f.deathYear}م` : `${Math.abs(f.deathYear)} ق.م`}</span>}
                    {f.role && <span>· {f.role}</span>}
                    {f.nationality && <span>· {f.nationality}</span>}
                  </div>
                  {f.bio && <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{f.bio}</p>}
                </div>
                <button onClick={async () => { if (confirm(`حذف "${f.name}"؟`)) { await api.delete(`/api/history/figures/${f.id}`).catch(() => {}); fetchData(); } }}
                  className="text-xs text-red-400 hover:text-red-600">🗑</button>
              </div>
            ))}
            {figures.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">👤</p>
                <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد شخصيات</p>
                <button onClick={() => setShowAddFigure(true)} className="text-xs mt-2" style={{ color: "#D4AF37" }}>+ أضف شخصية</button>
              </div>
            )}
          </div>
        )}

        <GeometricDivider />
      </div>

      {/* ═══ MODALS ═══ */}
      {showAdd && <AddRecordModal onClose={() => setShowAdd(false)} onSaved={fetchData} figures={figures} />}
      {showAddFigure && <AddFigureModal onClose={() => setShowAddFigure(false)} onSaved={fetchData} />}
      {selected && <RecordDetail record={selected} onClose={() => setSelected(null)} onDelete={() => { api.delete(`/api/history/records/${selected.id}`).catch(() => {}); setSelected(null); fetchData(); }} />}
    </main>
  );
}

/* ─── Era Section (collapsible) ──────────────────────────────────────── */

function EraSection({ era, records, defaultOpen, onSelect }: {
  era: Era; records: HistoryRecord[]; defaultOpen: boolean; onSelect: (r: HistoryRecord) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-right transition"
        style={{ background: "var(--card)" }}>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--muted)" }}>▼</span>
        <span className="text-xs font-bold flex-1" style={{ color: "var(--text)" }}>{era.label}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#5E549515", color: "#5E5495" }}>
          {records.length}
        </span>
      </button>
      {open && records.length > 0 && (
        <div className="border-t px-4 py-2 space-y-1.5" style={{ borderColor: "var(--card-border)" }}>
          {records.map(r => {
            const cat = CAT_MAP[r.category] ?? CAT_MAP.other;
            const imp = IMPORTANCE.find(i => i.key === r.importance);
            return (
              <div key={r.id} onClick={() => onSelect(r)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:shadow-sm transition"
                style={{ background: "var(--bg)" }}>
                <div className="text-center flex-shrink-0 w-14">
                  <p className="text-xs font-black" style={{ color: "#5E5495" }}>{r.year > 0 ? `${r.year}م` : `${Math.abs(r.year)} ق.م`}</p>
                  {r.hijriYear > 0 && <p className="text-[9px]" style={{ color: "var(--muted)" }}>{r.hijriYear}هـ</p>}
                </div>
                <span className="text-sm">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{r.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                    {r.importance !== "normal" && imp && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${imp.color}15`, color: imp.color }}>{imp.label}</span>
                    )}
                    {r.country && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{r.country}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && records.length === 0 && (
        <div className="border-t px-4 py-4 text-center" style={{ borderColor: "var(--card-border)" }}>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>لا توجد أحداث في هذه الحقبة</p>
        </div>
      )}
    </div>
  );
}

/* ─── Record Detail ──────────────────────────────────────────────────── */

function RecordDetail({ record: r, onClose, onDelete }: { record: HistoryRecord; onClose: () => void; onDelete: () => void }) {
  const cat = CAT_MAP[r.category] ?? CAT_MAP.other;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <div>
            <p className="text-xs" style={{ color: "#5E5495" }}>
              {r.year > 0 ? `${r.year}م` : `${Math.abs(r.year)} ق.م`} {r.hijriYear > 0 ? `/ ${r.hijriYear}هـ` : ""}
            </p>
            <h3 className="font-bold text-sm mt-1" style={{ color: "var(--text)" }}>{r.title}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onDelete} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#DC2626", background: "#DC262610" }}>🗑</button>
            <button onClick={onClose} className="text-lg px-1" style={{ color: "var(--muted)" }}>✕</button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.icon} {cat.label}</span>
            {r.importance !== "normal" && <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: "#DC262615", color: "#DC2626" }}>{IMPORTANCE.find(i => i.key === r.importance)?.label}</span>}
          </div>
          {r.description && <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{r.description}</p>}
          {r.strategicImportance && (
            <div className="rounded-lg p-3" style={{ background: "#D4AF3708", border: "1px solid #D4AF3720" }}>
              <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>الأهمية الاستراتيجية</p>
              <p className="text-xs" style={{ color: "var(--text)" }}>{r.strategicImportance}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {r.figure && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>الشخصية:</span> <b style={{ color: "var(--text)" }}>{r.figure}</b></div>}
            {r.location && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>المكان:</span> <b style={{ color: "var(--text)" }}>{r.location}</b></div>}
            {r.country && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>الدولة:</span> <b style={{ color: "var(--text)" }}>{r.country}</b></div>}
            {r.source && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>المصدر:</span> <b style={{ color: "var(--text)" }}>{r.source}</b></div>}
          </div>
          {r.tags && (
            <div className="flex gap-1 flex-wrap">
              {r.tags.split(",").map(t => <span key={t} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#5E549510", color: "#5E5495" }}>{t.trim()}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Add Record Modal ───────────────────────────────────────────────── */

function AddRecordModal({ onClose, onSaved, figures }: { onClose: () => void; onSaved: () => void; figures: HistoryFigure[] }) {
  const [inputType, setInputType] = useState<"gregorian" | "hijri">("hijri");
  const [yearVal, setYearVal] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [figure, setFigure] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("other");
  const [importance, setImportance] = useState("normal");
  const [strategic, setStrategic] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const yearNum = parseInt(yearVal) || 0;
  const converted = inputType === "hijri" ? hijriToGreg(yearNum) : gregToHijri(yearNum);

  async function save() {
    if (!title.trim() || !yearVal) return;
    setSaving(true);
    try {
      await api.post("/api/history/records", {
        year: inputType === "gregorian" ? yearNum : hijriToGreg(yearNum),
        hijriYear: inputType === "hijri" ? yearNum : undefined,
        inputType, title: title.trim(), description: desc.trim() || undefined,
        figure: figure.trim() || undefined, location: location.trim() || undefined,
        country: country.trim() || undefined, category, importance,
        strategicImportance: strategic.trim() || undefined,
        source: source.trim() || undefined, tags: tags.trim() || undefined,
      });
      onSaved(); onClose();
    } catch {} finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>📜 حدث تاريخي جديد</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={save} disabled={saving || !title.trim() || !yearVal}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "#2C2C54" }}>
              {saving ? "..." : "حفظ"}
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          {/* Date type */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>نوع التاريخ</label>
            <div className="flex gap-1.5">
              {([["hijri", "هجري"], ["gregorian", "ميلادي"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setInputType(k)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
                  style={{ background: inputType === k ? "#5E5495" : "var(--bg)", color: inputType === k ? "#fff" : "var(--muted)", border: `1px solid ${inputType === k ? "#5E5495" : "var(--card-border)"}` }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* Year + conversion */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
              السنة {inputType === "hijri" ? "الهجرية" : "الميلادية"} *
            </label>
            <input type="number" value={yearVal} onChange={e => setYearVal(e.target.value)}
              placeholder={inputType === "hijri" ? "مثال: 1445" : "مثال: 2024"}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            {yearVal && (
              <p className="text-[10px] mt-1 font-medium" style={{ color: "#5E5495" }}>
                = {inputType === "hijri" ? `${converted}م` : `${converted}هـ`}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>العنوان *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الحدث..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الوصف</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="تفاصيل..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={IS} />
          </div>
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الفئة</label>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-medium transition"
                  style={{ background: category === c.key ? c.color : "var(--bg)", color: category === c.key ? "#fff" : "var(--muted)", border: `1px solid ${category === c.key ? c.color : "var(--card-border)"}` }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          {/* Importance */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الأهمية</label>
            <div className="flex gap-1.5">
              {IMPORTANCE.map(i => (
                <button key={i.key} type="button" onClick={() => setImportance(i.key)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
                  style={{ background: importance === i.key ? i.color : "var(--bg)", color: importance === i.key ? "#fff" : "var(--muted)", border: `1px solid ${importance === i.key ? i.color : "var(--card-border)"}` }}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>
          {/* Figure */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الشخصية</label>
            <input value={figure} onChange={e => setFigure(e.target.value)} list="figures-list" placeholder="اسم الشخصية..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <datalist id="figures-list">{figures.map(f => <option key={f.id} value={f.name} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>المكان</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="المدينة..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الدولة</label>
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="الدولة..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الأهمية الاستراتيجية</label>
            <textarea value={strategic} onChange={e => setStrategic(e.target.value)} rows={2} placeholder="لماذا هذا الحدث مهم؟"
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={IS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>المصدر</label>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="اسم الكتاب..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>وسوم</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="حروب, فتوحات"
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Figure Modal ───────────────────────────────────────────────── */

function AddFigureModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [role, setRole] = useState("");
  const [nationality, setNationality] = useState("");
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/history/figures", {
        name: name.trim(),
        birthYear: birthYear ? parseInt(birthYear) : undefined,
        deathYear: deathYear ? parseInt(deathYear) : undefined,
        role: role.trim() || undefined,
        nationality: nationality.trim() || undefined,
        category: category || undefined,
        bio: bio.trim() || undefined,
      });
      onSaved(); onClose();
    } catch {} finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>👤 شخصية جديدة</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={save} disabled={saving || !name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "#2C2C54" }}>{saving ? "..." : "حفظ"}</button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الاسم *</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>سنة الميلاد</label>
              <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="570"
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>سنة الوفاة</label>
              <input type="number" value={deathYear} onChange={e => setDeathYear(e.target.value)} placeholder="632"
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الدور</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="خليفة، عالم..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الجنسية</label>
              <input value={nationality} onChange={e => setNationality(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>الفئة</label>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium transition"
                  style={{ background: category === c.key ? c.color : "var(--bg)", color: category === c.key ? "#fff" : "var(--muted)", border: `1px solid ${category === c.key ? c.color : "var(--card-border)"}` }}>
                  {c.icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>نبذة</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={IS} />
          </div>
        </div>
      </div>
    </div>
  );
}

const IS = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" };
