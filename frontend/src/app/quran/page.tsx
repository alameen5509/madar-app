"use client";

import { useState, useEffect } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";

/* ═══ Constants ════════════════════════════════════════════════════════════ */

const TOTAL_PAGES = 604;
const TOTAL_JUZ = 30;
const TOTAL_HIZB = 60;

/** صفحة بداية كل جزء */
const JUZ_START: number[] = [
  1,22,42,62,82,102,122,142,162,182,
  202,222,242,262,282,302,322,342,362,382,
  402,422,442,462,482,502,522,542,562,582
];

function getJuzNumber(page: number): number {
  for (let j = JUZ_START.length - 1; j >= 0; j--) {
    if (page >= JUZ_START[j]) return j + 1;
  }
  return 1;
}

function getHizbNumber(page: number): number {
  return Math.min(TOTAL_HIZB, Math.ceil((page / TOTAL_PAGES) * TOTAL_HIZB));
}

function getJuzPages(juz: number): { start: number; end: number } {
  const start = JUZ_START[juz - 1] ?? 1;
  const end = juz < 30 ? (JUZ_START[juz] ?? TOTAL_PAGES) - 1 : TOTAL_PAGES;
  return { start, end };
}

/* ═══ Page ═════════════════════════════════════════════════════════════════ */

export default function QuranPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [showReader, setShowReader] = useState(false);
  const [dailyTarget, setDailyTarget] = useState(5);
  const [todayRead, setTodayRead] = useState(0);
  const [bookmarkPage, setBookmarkPage] = useState(1);
  const [khatmaCount, setKhatmaCount] = useState(0);
  const [showJuzPicker, setShowJuzPicker] = useState(false);
  const [showHizbPicker, setShowHizbPicker] = useState(false);

  // Load state
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("madar_quran3") ?? "{}");
      setBookmarkPage(s.bookmark ?? 1);
      setCurrentPage(s.bookmark ?? 1);
      setDailyTarget(s.dailyTarget ?? 5);
      setKhatmaCount(s.khatmaCount ?? 0);
      const today = new Date().toDateString();
      setTodayRead(s.lastDate === today ? (s.todayRead ?? 0) : 0);
    } catch {}
  }, []);

  function saveState(updates: Record<string, unknown>) {
    const prev = JSON.parse(localStorage.getItem("madar_quran3") ?? "{}");
    const next = { ...prev, ...updates, lastDate: new Date().toDateString() };
    localStorage.setItem("madar_quran3", JSON.stringify(next));
    window.dispatchEvent(new Event("madar-update"));
    // Sync with old format for habits widget
    const pct = Math.round(((next.bookmark ?? 1) / TOTAL_PAGES) * 100);
    const qIdx = Math.floor(((next.bookmark ?? 1) / TOTAL_PAGES) * 240);
    localStorage.setItem("madar_quran2", JSON.stringify({
      currentQuarter: qIdx, wirdUnit: "quarter", todayDone: (next.todayRead ?? 0) >= (next.dailyTarget ?? 5),
      khatmaCount: next.khatmaCount ?? 0, lastDate: new Date().toDateString(),
    }));
  }

  const khatmaPercent = Math.round((bookmarkPage / TOTAL_PAGES) * 100);
  const juz = getJuzNumber(bookmarkPage);
  const hizb = getHizbNumber(bookmarkPage);
  const daysLeft = dailyTarget > 0 ? Math.ceil((TOTAL_PAGES - bookmarkPage) / dailyTarget) : 999;
  const todayDone = todayRead >= dailyTarget;

  function openReader(page?: number) {
    setCurrentPage(page ?? bookmarkPage);
    setShowReader(true);
  }

  function goToPage(p: number) {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, p));
    setCurrentPage(clamped);
  }

  function markPageRead() {
    const newRead = todayRead + 1;
    setTodayRead(newRead);
    const newBookmark = Math.max(bookmarkPage, currentPage + 1);
    setBookmarkPage(newBookmark);
    saveState({ bookmark: newBookmark, todayRead: newRead, dailyTarget, khatmaCount });

    // Check khatma complete
    if (newBookmark >= TOTAL_PAGES) {
      const nc = khatmaCount + 1;
      setKhatmaCount(nc);
      setBookmarkPage(1);
      saveState({ bookmark: 1, todayRead: newRead, dailyTarget, khatmaCount: nc });
    }

    // Mark habit
    try {
      if (newRead >= dailyTarget) {
        const habits = JSON.parse(localStorage.getItem("madar_habits") ?? "[]");
        const updated = habits.map((h: { title: string; todayDone: boolean; streak: number; isIdea: boolean }) => {
          if (!h.isIdea && (h.title.includes("قرآن") || h.title.includes("ختمة") || h.title.includes("ورد")))
            return { ...h, todayDone: true, streak: h.streak + 1 };
          return h;
        });
        localStorage.setItem("madar_habits", JSON.stringify(updated));
        localStorage.setItem("madar_habits_date", new Date().toDateString());
      }
    } catch {}
  }

  /* ── عارض المصحف ── */
  if (showReader) {
    const pageJuz = getJuzNumber(currentPage);
    const pageHizb = getHizbNumber(currentPage);
    return (
      <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#2A2542" }} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <button onClick={() => setShowReader(false)} className="text-white/50 hover:text-white text-sm px-2 py-1">✕</button>
          <div className="text-center">
            <p className="text-white font-bold text-sm">صفحة {currentPage}</p>
            <p className="text-white/40 text-[11px]">الجزء {pageJuz} — الحزب {pageHizb}</p>
          </div>
          <div className="text-center">
            <p className="text-[#D4AF37] text-[11px] font-bold">{todayRead}/{dailyTarget}</p>
            <div className="w-12 bg-white/10 rounded-full h-1 mt-0.5">
              <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${Math.min(100, (todayRead / dailyTarget) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* PDF viewer — مصحف المدينة */}
        <div className="flex-1 overflow-hidden" style={{ background: "#2A2542" }}>
          <iframe
            src={`/mushaf.pdf#page=${currentPage + 1}`}
            className="w-full h-full border-none"
            style={{ background: "#fff" }}
            title={`صفحة ${currentPage}`}
          />
        </div>

        {/* Bottom controls — كبيرة وواضحة */}
        <div className="px-4 py-3 border-t border-white/10 space-y-2" style={{ background: "#1e1b38" }}>
          <div className="flex gap-2">
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= TOTAL_PAGES}
              className="flex-1 py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-30 transition"
              style={{ background: "#2A2542" }}>
              التالية →
            </button>
            <button onClick={() => { markPageRead(); goToPage(currentPage + 1); }}
              className="flex-1 py-3.5 rounded-xl text-base font-bold transition"
              style={{ background: "linear-gradient(135deg, #D4AF37, #E8C96A)", color: "#1e1b38" }}>
              قرأتها ✓
            </button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
              className="flex-1 py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-30 transition"
              style={{ background: "#2A2542" }}>
              ← السابقة
            </button>
          </div>
          {/* Quick jump */}
          <div className="flex items-center justify-center gap-3 text-white/40 text-[11px]">
            <span>صفحة</span>
            <input type="number" min={1} max={TOTAL_PAGES} value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white text-center text-sm border-none focus:outline-none" />
            <span>/ {TOTAL_PAGES}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── الصفحة الرئيسية ── */
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur px-8 py-4" style={{ background: "var(--header-bg, rgba(255,255,255,0.8))", borderBottom: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>ختمة القرآن</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>رواية حفص عن عاصم</p>
          </div>
          <div className="flex items-center gap-2">
            {khatmaCount > 0 && (
              <span className="text-[11px] px-2 py-1 rounded-full font-bold" style={{ background: "var(--gold, #D4AF37)15", color: "var(--gold)" }}>{khatmaCount} ختمة</span>
            )}
            <button onClick={() => openReader()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: todayDone ? "#3D8C5A" : "linear-gradient(135deg, #1A1A2E, #2C2C54)" }}>
              {todayDone ? "📖 أقرأ أكثر" : "📖 ابدأ القراءة"}
            </button>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">

        {/* Khatma progress */}
        <div className="rounded-2xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #2C2C54 100%)" }}>
          <p className="text-white/40 text-xs mb-2">تقدم الختمة</p>
          <p className="text-5xl font-black text-[#D4AF37] mb-1">{khatmaPercent}%</p>
          <div className="w-48 mx-auto bg-white/10 rounded-full h-2.5 overflow-hidden mb-3">
            <div className="h-full rounded-full" style={{ width: `${khatmaPercent}%`, background: "linear-gradient(90deg, #D4AF37, #E8C96A)" }} />
          </div>
          <p className="text-white/50 text-xs">صفحة {bookmarkPage} — الجزء {juz} — الحزب {hizb}</p>
          <p className="text-white/30 text-[11px] mt-1">باقي {daysLeft} يوم بإذن الله</p>
        </div>

        {/* Today's progress */}
        <div className="rounded-2xl p-5 border shadow-sm" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>هدف اليوم</p>
            {todayDone && <span className="text-xs px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold">✅ مكتمل</span>}
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <p className="text-3xl font-black" style={{ color: todayDone ? "#3D8C5A" : "var(--gold)" }}>
                {todayRead} <span className="text-base font-medium" style={{ color: "var(--muted)" }}>/ {dailyTarget} صفحة</span>
              </p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--card-border, #E5E7EB)" strokeWidth="2.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={todayDone ? "#3D8C5A" : "#D4AF37"} strokeWidth="2.5"
                  strokeDasharray={`${Math.min(100, (todayRead / dailyTarget) * 100)}, 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: "var(--text)" }}>
                {Math.min(100, Math.round((todayRead / dailyTarget) * 100))}%
              </span>
            </div>
          </div>
          <button onClick={() => openReader()}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: todayDone ? "linear-gradient(135deg, #3D8C5A, #D4AF37)" : "linear-gradient(135deg, #1A1A2E, #2C2C54)" }}>
            {todayDone ? "📖 أريد أقرأ أكثر" : "📖 افتح المصحف وابدأ"}
          </button>
        </div>

        {/* Daily target selector */}
        <GeometricDivider label="الهدف اليومي" />
        <div className="rounded-2xl p-5 border shadow-sm" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 0].map((n) => (
              <button key={n} onClick={() => {
                if (n === 0) {
                  const custom = prompt("كم صفحة تريد يومياً؟");
                  if (custom) { setDailyTarget(Number(custom)); saveState({ dailyTarget: Number(custom) }); }
                } else {
                  setDailyTarget(n); saveState({ dailyTarget: n });
                }
              }}
                className="py-3 rounded-xl text-center transition"
                style={{ background: dailyTarget === n ? "#2C2C54" : "var(--bg)", color: dailyTarget === n ? "#fff" : "var(--muted)", border: `1px solid ${dailyTarget === n ? "#2C2C54" : "var(--card-border)"}` }}>
                <p className="text-sm font-bold">{n === 0 ? "مخصص" : `${n} صفحة`}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-center mt-3" style={{ color: "var(--muted)" }}>
            {dailyTarget} صفحة يومياً = ختمة كل {Math.ceil(TOTAL_PAGES / dailyTarget)} يوم
          </p>
        </div>

        {/* Quick navigation */}
        <GeometricDivider label="انتقال سريع" />
        <div className="rounded-2xl p-5 border shadow-sm space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          {/* By page */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>الانتقال لصفحة</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { const p = Math.max(1, bookmarkPage - 1); setBookmarkPage(p); saveState({ bookmark: p }); }}
                className="w-8 h-8 rounded-lg font-bold hover:opacity-80" style={{ background: "var(--bg)", color: "var(--text)" }}>-</button>
              <span className="text-lg font-bold w-12 text-center" style={{ color: "var(--primary)" }}>{bookmarkPage}</span>
              <button onClick={() => { const p = Math.min(TOTAL_PAGES, bookmarkPage + 1); setBookmarkPage(p); saveState({ bookmark: p }); }}
                className="w-8 h-8 rounded-lg font-bold hover:opacity-80" style={{ background: "var(--bg)", color: "var(--text)" }}>+</button>
              <span className="text-xs" style={{ color: "var(--muted)" }}>/ {TOTAL_PAGES}</span>
            </div>
          </div>
          {/* By Juz */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>الانتقال لجزء</span>
            <button onClick={() => setShowJuzPicker(!showJuzPicker)} className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}>
              الجزء {juz} ▾
            </button>
          </div>
          {showJuzPicker && (
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 30 }, (_, i) => (
                <button key={i} onClick={() => {
                  const p = JUZ_START[i];
                  setBookmarkPage(p); setCurrentPage(p); saveState({ bookmark: p });
                  setShowJuzPicker(false);
                }}
                  className="py-2 rounded-lg text-xs font-bold transition"
                  style={{ background: juz === i + 1 ? "#D4AF37" : "var(--bg)", color: juz === i + 1 ? "#fff" : "var(--text)", border: `1px solid ${juz === i + 1 ? "#D4AF37" : "var(--card-border)"}` }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          {/* By Hizb */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>الانتقال لحزب</span>
            <button onClick={() => setShowHizbPicker(!showHizbPicker)} className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--card-border)" }}>
              الحزب {hizb} ▾
            </button>
          </div>
          {showHizbPicker && (
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 60 }, (_, i) => (
                <button key={i} onClick={() => {
                  const p = Math.max(1, Math.round(((i) / 60) * TOTAL_PAGES));
                  setBookmarkPage(p); setCurrentPage(p); saveState({ bookmark: p });
                  setShowHizbPicker(false);
                }}
                  className="py-1.5 rounded text-[10px] font-bold transition"
                  style={{ background: hizb === i + 1 ? "#D4AF37" : "var(--bg)", color: hizb === i + 1 ? "#fff" : "var(--muted)" }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
