"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HistoryRecord {
  id: string; year: number; month?: number; day?: number;
  hijriYear: number; hijriMonth?: number; hijriDay?: number;
  inputType: string;
  title: string; description?: string; figure?: string; location?: string;
  country?: string; category: string; strategicImportance?: string;
  importance: string; source?: string; tags?: string;
}

interface HistoryFigure {
  id: string; name: string; birthYear?: number; deathYear?: number;
  role?: string; nationality?: string; category?: string; bio?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

// ألوان عشوائية مستقرة للفئات
const CAT_COLORS = ["#DC2626","#7C3AED","#92400E","#059669","#2563EB","#D97706","#6B7280","#0891B2","#BE185D","#4F46E5"];
function catColor(cat: string): string {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = ((h << 5) - h + cat.charCodeAt(i)) | 0;
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

const IMP_COLORS: Record<string, string> = {};
function impColor(imp: string): string {
  if (IMP_COLORS[imp]) return IMP_COLORS[imp];
  const colors = ["#6B7280","#D97706","#DC2626","#059669","#2563EB","#7C3AED"];
  let h = 0;
  for (let i = 0; i < imp.length; i++) h = ((h << 5) - h + imp.charCodeAt(i)) | 0;
  IMP_COLORS[imp] = colors[Math.abs(h) % colors.length];
  return IMP_COLORS[imp];
}

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

interface HistoricalEvent {
  id: string; title: string; gregorianDate?: string; hijriDate?: string;
  location?: string; description?: string; strategicSignificance?: string;
  orderIndex: number; category: string;
}

type PageTab = "timeline" | "events";

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [figures, setFigures] = useState<HistoryFigure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  // Filters
  const [filterCat, setFilterCat] = useState("");
  const [filterImportance, setFilterImportance] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterFigure, setFilterFigure] = useState("");
  const [searchQ, setSearchQ] = useState("");

  // أحداث تاريخية كبرى
  const [pageTab, setPageTab] = useState<PageTab>("events");
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventCatFilter, setEventCatFilter] = useState("");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

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

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const params = eventCatFilter ? `?category=${encodeURIComponent(eventCatFilter)}` : "";
      const { data } = await api.get(`/api/historical-events${params}`);
      setEvents(Array.isArray(data) ? data : []);
    } catch {}
    setEventsLoading(false);
  }, [eventCatFilter]);

  useEffect(() => { fetchData(); fetchEvents(); }, [fetchData, fetchEvents]);

  // Filter records
  const filtered = records.filter(r => {
    if (filterCat && r.category !== filterCat) return false;
    if (filterImportance && r.importance !== filterImportance) return false;
    if (filterCountry && r.country !== filterCountry) return false;
    if (filterFigure && r.figure !== filterFigure) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q) && !(r.figure ?? "").toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  // Unique values from data for filters
  const allCategories = [...new Set(records.map(r => r.category).filter(Boolean))] as string[];
  const allImportances = [...new Set(records.map(r => r.importance).filter(Boolean))] as string[];
  const countries = [...new Set(records.map(r => r.country).filter(Boolean))] as string[];
  const allFigures = [...new Set(records.map(r => r.figure).filter(Boolean))] as string[];

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 xl:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>📜 التاريخ والتوثيق</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{records.length} حدث · {figures.length} شخصية</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            + حدث جديد
          </button>
        </div>
        {/* تبويبات */}
        <div className="flex gap-1.5 mt-2">
          {([["events","⚔️ الأحداث الكبرى"],["timeline","📜 الخط الزمني"]] as [PageTab,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setPageTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{ background: pageTab === k ? "#2C2C54" : "var(--bg)", color: pageTab === k ? "#D4AF37" : "var(--muted)", border: `1px solid ${pageTab === k ? "#2C2C54" : "var(--card-border)"}` }}>
              {l} {k === "events" ? `(${events.length})` : `(${records.length})`}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4">

        {/* ═══ الأحداث الكبرى ═══ */}
        {pageTab === "events" && (
          <div className="space-y-4">
            {eventsLoading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}
            {!eventsLoading && (<>
              {/* فلتر التصنيف */}
              {(() => {
                const cats = [...new Set(events.map(e => e.category).filter(Boolean))];
                return cats.length > 1 ? (
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setEventCatFilter("")} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                      style={{ background: !eventCatFilter ? "#2C2C54" : "var(--card)", color: !eventCatFilter ? "#D4AF37" : "var(--muted)", border: "1px solid var(--card-border)" }}>الكل</button>
                    {cats.map(c => (
                      <button key={c} onClick={() => setEventCatFilter(c)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: eventCatFilter === c ? "#2C2C54" : "var(--card)", color: eventCatFilter === c ? "#D4AF37" : "var(--muted)", border: "1px solid var(--card-border)" }}>{c}</button>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* زر بذر البيانات */}
              {events.length === 0 && (
                <button onClick={async () => {
                  try { await api.post("/api/historical-events/seed-ww1"); fetchEvents(); } catch {}
                }} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                  ⚔️ تحميل أحداث الحرب العالمية الأولى
                </button>
              )}

              {/* قائمة الأحداث */}
              {events.length > 0 ? (
                <div className="relative">
                  {/* خط زمني عمودي */}
                  <div className="absolute top-0 bottom-0 right-[18px] w-0.5" style={{ background: "linear-gradient(to bottom, #D4AF37, #2C2C54)" }} />

                  <div className="space-y-4">
                    {events.map((ev, idx) => {
                      const isOpen = expandedEvent === ev.id;
                      return (
                        <div key={ev.id} className="relative pr-10">
                          {/* نقطة على الخط الزمني */}
                          <div className="absolute right-[11px] top-4 w-4 h-4 rounded-full border-2 z-10"
                            style={{ background: isOpen ? "#D4AF37" : "var(--card)", borderColor: "#D4AF37" }}>
                            <span className="absolute -right-6 top-0 text-[9px] font-bold" style={{ color: "#D4AF37" }}>{ev.orderIndex}</span>
                          </div>

                          <div className="rounded-2xl border overflow-hidden cursor-pointer transition hover:shadow-md"
                            style={{ background: "var(--card)", borderColor: isOpen ? "#D4AF3740" : "var(--card-border)" }}
                            onClick={() => setExpandedEvent(isOpen ? null : ev.id)}>

                            {/* العنوان */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm">⚔️</span>
                                <h3 className="font-bold text-sm flex-1" style={{ color: "var(--text)" }}>{ev.title}</h3>
                                {ev.category && <span className="text-[8px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#2C2C5412", color: "#2C2C54" }}>{ev.category}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {ev.gregorianDate && <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted)" }}>📅 {ev.gregorianDate}</span>}
                                {ev.hijriDate && <span className="text-[10px] flex items-center gap-1" style={{ color: "#D4AF37" }}>🌙 {ev.hijriDate}</span>}
                                {ev.location && <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted)" }}>📍 {ev.location}</span>}
                              </div>
                            </div>

                            {/* التفاصيل (موسّعة) */}
                            {isOpen && (
                              <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--card-border)" }}>
                                {ev.description && (
                                  <div>
                                    <p className="text-[9px] font-bold mb-1" style={{ color: "#2C2C54" }}>📖 الوصف:</p>
                                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{ev.description}</p>
                                  </div>
                                )}
                                {ev.strategicSignificance && (
                                  <div className="rounded-xl p-3" style={{ background: "#D4AF3708", border: "1px solid #D4AF3720" }}>
                                    <p className="text-[9px] font-bold mb-1" style={{ color: "#D4AF37" }}>⚡ الأهمية الاستراتيجية:</p>
                                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{ev.strategicSignificance}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">⚔️</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>لا توجد أحداث تاريخية بعد</p>
                </div>
              )}
            </>)}
          </div>
        )}

        {/* ═══ TIMELINE (الخط الزمني القديم) ═══ */}
        {pageTab === "timeline" && loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {pageTab === "timeline" && !loading && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 بحث..."
                className="px-3 py-2 rounded-xl border text-xs flex-1 min-w-[120px] focus:outline-none"
                style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              {allCategories.length > 0 && (
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الفئات</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {allImportances.length > 0 && (
                <select value={filterImportance} onChange={e => setFilterImportance(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الأهمية</option>
                  {allImportances.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              )}
              {countries.length > 0 && (
                <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الدول</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {allFigures.length > 0 && (
                <select value={filterFigure} onChange={e => setFilterFigure(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الشخصيات</option>
                  {allFigures.map(f => <option key={f} value={f}>{f}</option>)}
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

        <GeometricDivider />
      </div>

      {/* ═══ MODALS ═══ */}
      {showAdd && <AddRecordModal onClose={() => setShowAdd(false)} onSaved={fetchData} figures={figures} allCategories={allCategories} allImportances={allImportances} countries={countries} />}
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
            const cc = catColor(r.category);
            const ic = impColor(r.importance);
            return (
              <div key={r.id} onClick={() => onSelect(r)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:shadow-sm transition"
                style={{ background: "var(--bg)" }}>
                <div className="text-center flex-shrink-0 w-14">
                  <p className="text-xs font-black" style={{ color: "#5E5495" }}>
                    {r.day ? `${r.day}/` : ""}{r.month ? `${r.month}/` : ""}{r.year > 0 ? `${r.year}م` : `${Math.abs(r.year)} ق.م`}
                  </p>
                  {r.hijriYear > 0 && <p className="text-[9px]" style={{ color: "var(--muted)" }}>
                    {r.hijriDay ? `${r.hijriDay}/` : ""}{r.hijriMonth ? `${r.hijriMonth}/` : ""}{r.hijriYear}هـ
                  </p>}
                </div>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cc }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{r.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${cc}15`, color: cc }}>{r.category}</span>
                    {r.importance && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${ic}15`, color: ic }}>{r.importance}</span>
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
  const cc = catColor(r.category);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <div>
            <p className="text-xs" style={{ color: "#5E5495" }}>
              {r.day ? `${r.day}/` : ""}{r.month ? `${r.month}/` : ""}{r.year > 0 ? `${r.year}م` : `${Math.abs(r.year)} ق.م`}
              {r.hijriYear > 0 ? ` / ${r.hijriDay ? `${r.hijriDay}/` : ""}${r.hijriMonth ? `${r.hijriMonth}/` : ""}${r.hijriYear}هـ` : ""}
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
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${cc}15`, color: cc }}>{r.category}</span>
            {r.importance && <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: `${impColor(r.importance)}15`, color: impColor(r.importance) }}>{r.importance}</span>}
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

function AddRecordModal({ onClose, onSaved, figures, allCategories, allImportances, countries }: {
  onClose: () => void; onSaved: () => void; figures: HistoryFigure[];
  allCategories: string[]; allImportances: string[]; countries: string[];
}) {
  const [inputType, setInputType] = useState<"gregorian" | "hijri">("hijri");
  const [yearVal, setYearVal] = useState("");
  const [monthVal, setMonthVal] = useState("");
  const [dayVal, setDayVal] = useState("");
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
      const mo = parseInt(monthVal) || undefined;
      const da = parseInt(dayVal) || undefined;
      await api.post("/api/history/records", {
        year: inputType === "gregorian" ? yearNum : hijriToGreg(yearNum),
        month: inputType === "gregorian" ? mo : undefined,
        day: inputType === "gregorian" ? da : undefined,
        hijriYear: inputType === "hijri" ? yearNum : undefined,
        hijriMonth: inputType === "hijri" ? mo : undefined,
        hijriDay: inputType === "hijri" ? da : undefined,
        inputType, title: title.trim(), description: desc.trim() || undefined,
        figure: figure.trim() || undefined, location: location.trim() || undefined,
        country: country.trim() || undefined, category, importance,
        strategicImportance: strategic.trim() || undefined,
        source: source.trim() || undefined, tags: tags.trim() || undefined,
      });
      onSaved(); onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { title?: string } } })?.response?.data?.title;
      alert(`فشل الحفظ${status ? ` (${status})` : ""}${msg ? `: ${msg}` : ""}`);
      console.error("Save history error:", err);
    } finally { setSaving(false); }
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
          {/* التاريخ: سنة + شهر + يوم */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
              التاريخ {inputType === "hijri" ? "الهجري" : "الميلادي"} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input type="number" value={dayVal} onChange={e => setDayVal(e.target.value)}
                  placeholder="اليوم" min={1} max={30}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none" style={IS} />
                <p className="text-[9px] text-center mt-0.5" style={{ color: "var(--muted)" }}>اليوم</p>
              </div>
              <div>
                <input type="number" value={monthVal} onChange={e => setMonthVal(e.target.value)}
                  placeholder="الشهر" min={1} max={12}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none" style={IS} />
                <p className="text-[9px] text-center mt-0.5" style={{ color: "var(--muted)" }}>الشهر</p>
              </div>
              <div>
                <input type="number" value={yearVal} onChange={e => setYearVal(e.target.value)}
                  placeholder={inputType === "hijri" ? "1445" : "2024"}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none" style={IS} />
                <p className="text-[9px] text-center mt-0.5" style={{ color: "var(--muted)" }}>السنة *</p>
              </div>
            </div>
            {yearVal && (
              <p className="text-[10px] mt-1.5 font-medium" style={{ color: "#5E5495" }}>
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
          {/* Category — free text */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الفئة</label>
            <input value={category} onChange={e => setCategory(e.target.value)} list="cat-list" placeholder="مثال: سياسي، فكري، عسكري..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <datalist id="cat-list">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          {/* Importance — free text with suggestions */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الأهمية</label>
            <input value={importance} onChange={e => setImportance(e.target.value)} list="imp-list" placeholder="مثال: عادي، مهم، فارق..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <datalist id="imp-list">{allImportances.map(i => <option key={i} value={i} />)}</datalist>
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
              <input value={country} onChange={e => setCountry(e.target.value)} list="country-list" placeholder="الدولة..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
              <datalist id="country-list">{countries.map(c => <option key={c} value={c} />)}</datalist>
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

const IS = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" };
