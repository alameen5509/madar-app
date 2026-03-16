"use client";

import { useState } from "react";
import { GeometricDivider, EightPointedStar } from "@/components/IslamicPattern";

const SURAHS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة",
  "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر",
  "النحل", "الإسراء", "الكهف", "مريم", "طه",
];

type Goal = "ربع حزب" | "نصف حزب" | "حزب" | "جزء" | "صفحة";

const GOALS: Goal[] = ["ربع حزب", "نصف حزب", "حزب", "جزء", "صفحة"];

const GOAL_PAGES: Record<Goal, number> = {
  "ربع حزب": 5,
  "نصف حزب": 10,
  "حزب":     20,
  "جزء":     20,
  "صفحة":    1,
};

const AYAH_QUOTE = {
  arabic: "إِنَّ الَّذِينَ يَتْلُونَ كِتَابَ اللَّهِ وَأَقَامُوا الصَّلَاةَ وَأَنفَقُوا مِمَّا رَزَقْنَاهُمْ سِرًّا وَعَلَانِيَةً يَرْجُونَ تِجَارَةً لَّن تَبُورَ",
  ref: "سورة فاطر — ٢٩",
};

export default function QuranPage() {
  const [surah, setSurah]       = useState(18);   // الكهف
  const [ayah, setAyah]         = useState(1);
  const [goal, setGoal]         = useState<Goal>("حزب");
  const [todayPages, setToday]  = useState(8);
  const [streak, setStreak]     = useState(14);
  const [khatmas, setKhatmas]   = useState(2);

  const goalPages   = GOAL_PAGES[goal];
  const progress    = Math.min(100, Math.round((todayPages / goalPages) * 100));
  const circumference = 2 * Math.PI * 44;
  const dashOffset  = circumference - (progress / 100) * circumference;

  const addPages = (n: number) => setToday((p) => Math.min(p + n, goalPages));

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2A2542, #5E5495)" }}>
              <EightPointedStar size={20} color="#C9A84C" />
            </div>
            <div>
              <h2 className="text-[#1A1830] font-bold text-lg leading-none">ورد القرآن</h2>
              <p className="text-[#7C7A8E] text-xs">تتبع قراءتك اليومية</p>
            </div>
          </div>
          <button
            onClick={() => { setKhatmas((k) => k + 1); setToday(0); setSurah(1); setAyah(1); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #2A2542, #5E5495)" }}
          >
            ✓ إتمام ختمة
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Quranic quote */}
        <div
          className="rounded-2xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #2A2542 0%, #3D3468 100%)" }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" aria-hidden>
            <defs>
              <pattern id="quran-bg" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
                <polygon points="25,2 46,13 46,37 25,48 4,37 4,13" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#quran-bg)" />
          </svg>
          <p
            className="relative z-10 text-white text-lg leading-loose font-bold"
            style={{ fontFamily: "var(--font-amiri, Amiri, serif)" }}
          >
            {AYAH_QUOTE.arabic}
          </p>
          <p className="relative z-10 text-[#C9A84C] text-xs mt-3">{AYAH_QUOTE.ref}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm text-center">
            <div className="flex justify-center gap-1 mb-2">
              {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
                <EightPointedStar key={i} size={12} color="#C9A84C" />
              ))}
            </div>
            <p className="font-bold text-2xl text-[#C9A84C]">{streak}</p>
            <p className="text-[#7C7A8E] text-xs">يوم متتالي</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm text-center">
            <p className="font-bold text-2xl text-[#5E5495] mt-2">{khatmas}</p>
            <p className="text-[#7C7A8E] text-xs">ختمة مكتملة</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm text-center">
            <p className="font-bold text-2xl text-[#3D8C8C] mt-2">{todayPages}</p>
            <p className="text-[#7C7A8E] text-xs">صفحات اليوم</p>
          </div>
        </div>

        {/* Progress circle + position */}
        <div className="grid grid-cols-2 gap-5">

          {/* Circular progress */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2D5B0] shadow-sm flex flex-col items-center">
            <GeometricDivider label="هدف اليوم" />
            <div className="relative w-28 h-28 mt-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#F0EDF8" strokeWidth="8"/>
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke="url(#prog-grad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
                <defs>
                  <linearGradient id="prog-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5E5495"/>
                    <stop offset="100%" stopColor="#C9A84C"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-bold text-xl text-[#5E5495]">{progress}٪</span>
                <span className="text-[10px] text-[#7C7A8E]">{todayPages}/{goalPages} ص</span>
              </div>
            </div>

            {/* Goal selector */}
            <div className="mt-4 flex flex-wrap gap-1 justify-center">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className="text-[10px] px-2 py-1 rounded-full transition"
                  style={
                    goal === g
                      ? { background: "linear-gradient(135deg, #5E5495, #C9A84C)", color: "white" }
                      : { background: "#F0EDF8", color: "#5E5495" }
                  }
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Quick add buttons */}
            <div className="mt-4 flex gap-2">
              {[1, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => addPages(n)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
                >
                  +{n} ص
                </button>
              ))}
            </div>
          </div>

          {/* Current position */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2D5B0] shadow-sm">
            <GeometricDivider label="الموضع الحالي" />
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-[#7C7A8E] block mb-1">السورة</label>
                <select
                  value={surah}
                  onChange={(e) => setSurah(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E2D5B0] px-3 py-2 text-sm outline-none focus:border-[#5E5495] bg-[#F8F6F0]"
                >
                  {SURAHS.map((s, i) => (
                    <option key={s} value={i + 1}>{i + 1}. {s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#7C7A8E] block mb-1">الآية</label>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setAyah((a) => Math.max(1, a - 1))}
                    className="w-8 h-8 rounded-lg bg-[#F0EDF8] text-[#5E5495] font-bold text-lg flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center font-bold text-2xl text-[#5E5495]">{ayah}</span>
                  <button
                    onClick={() => setAyah((a) => a + 1)}
                    className="w-8 h-8 rounded-lg bg-[#F0EDF8] text-[#5E5495] font-bold text-lg flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: "linear-gradient(135deg, #2A254210, #5E549520)" }}
              >
                <p className="text-xs text-[#7C7A8E]">وقفت عند</p>
                <p className="font-bold text-[#5E5495] mt-1" style={{ fontFamily: "var(--font-amiri, Amiri, serif)" }}>
                  سورة {SURAHS[surah - 1]} — آية {ayah}
                </p>
              </div>
              <button
                onClick={() => setStreak((s) => s + 1)}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #2A2542, #5E5495)" }}
              >
                حفظ الموضع ✓
              </button>
            </div>
          </div>

        </div>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
