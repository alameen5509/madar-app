import { EightPointedStar, GeometricDivider, SidebarPattern } from "@/components/IslamicPattern";

// ── Data ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: "⊙", label: "لوحة التحكم",  active: true  },
  { icon: "◎", label: "دوائر الحياة", active: false },
  { icon: "◈", label: "الأهداف",       active: false },
  { icon: "◻", label: "المهام",         active: false },
  { icon: "✦", label: "صندوق الوارد", active: false },
  { icon: "◑", label: "الطاقة",        active: false },
  { icon: "◆", label: "الذكاء الاصطناعي", active: false },
  { icon: "◉", label: "الإعدادات",     active: false },
];

const PRAYERS = [
  { name: "الفجر",   time: "04:47", passed: true  },
  { name: "الشروق",  time: "06:05", passed: true  },
  { name: "الظهر",   time: "12:03", passed: false },
  { name: "العصر",   time: "15:26", passed: false },
  { name: "المغرب",  time: "18:01", passed: false },
  { name: "العشاء",  time: "20:01", passed: false },
];

const CIRCLES = [
  { name: "النفس",      emoji: "🌿", color: "#5E5495", light: "#EAE8F5", tasks: 4, progress: 72 },
  { name: "الأسرة",     emoji: "🏡", color: "#C9A84C", light: "#FBF4E2", tasks: 2, progress: 45 },
  { name: "العلاقات",  emoji: "🤝", color: "#3D8C8C", light: "#E0F2F2", tasks: 3, progress: 60 },
  { name: "العمل",      emoji: "💼", color: "#8C4A3D", light: "#F5E8E6", tasks: 7, progress: 38 },
];

const TASKS = [
  { title: "مراجعة أهداف الربع الثاني",    circle: "العمل",      priority: "عالية", done: false },
  { title: "قراءة كتاب العادات الذرية",    circle: "النفس",      priority: "متوسطة", done: true  },
  { title: "التواصل مع فريق التطوير",      circle: "العمل",      priority: "عالية", done: false },
  { title: "التخطيط لرحلة عائلية",         circle: "الأسرة",     priority: "منخفضة", done: false },
  { title: "تمرين رياضي ٣٠ دقيقة",         circle: "النفس",      priority: "متوسطة", done: true  },
];

const PRIORITY_COLORS: Record<string, string> = {
  "عالية":    "bg-red-100 text-red-700",
  "متوسطة":  "bg-yellow-100 text-yellow-700",
  "منخفضة":  "bg-green-100 text-green-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-islamic", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "var(--font-cairo, Cairo, sans-serif)" }}>

      {/* ── Sidebar ── */}
      <aside className="pattern-zellige relative w-64 flex-shrink-0 flex flex-col overflow-y-auto">
        <SidebarPattern />

        {/* Logo */}
        <div className="relative z-10 px-6 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}>
              <EightPointedStar size={22} color="#2A2542" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-none">مدار</h1>
              <p className="text-white/50 text-xs mt-0.5">نظام إدارة الحياة</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                item.active
                  ? "nav-active text-[#C9A84C] font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="relative z-10 px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5E5495] to-[#C9A84C] flex items-center justify-center text-white font-bold text-sm">
              م
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">محمد العمري</p>
              <p className="text-white/40 text-xs truncate">مشرف النظام</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#7C7A8E] text-xs mb-0.5">{today}</p>
              <h2 className="text-[#1A1830] font-bold text-lg">لوحة التحكم</h2>
            </div>
            {/* Bismillah */}
            <div
              className="text-center"
              style={{ fontFamily: "var(--font-amiri, Amiri, serif)" }}
            >
              <p className="shimmer-text text-xl font-bold tracking-wide">
                بسم الله الرحمن الرحيم
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative w-9 h-9 rounded-full bg-[#F0EDF8] flex items-center justify-center text-[#5E5495] hover:bg-[#E4DFF5] transition">
                🔔
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C9A84C]" />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5E5495] to-[#C9A84C] flex items-center justify-center text-white font-bold text-sm">م</div>
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">

          {/* AI Greeting Banner */}
          <div
            className="fade-up rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #2A2542 0%, #3D3468 60%, #5E5495 100%)" }}
          >
            {/* faint geometric texture */}
            <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" aria-hidden>
              <defs>
                <pattern id="ai-bg" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="white" strokeWidth="0.6"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#ai-bg)" />
            </svg>
            <div className="relative z-10 flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}
              >
                <EightPointedStar size={26} color="#2A2542" />
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">مساعد مدار الذكي</p>
                <p className="text-white font-semibold text-base leading-relaxed">
                  أهلاً بك يا محمد 👋 — لديك <span className="text-[#E8C96A] font-bold">٣ مهام عالية الأولوية</span> اليوم،
                  وأفضل وقت لإنجازها هو فترة <span className="text-[#E8C96A]">ما بعد الفجر</span>. هل تريد مراجعة الجدول؟
                </p>
              </div>
            </div>
          </div>

          {/* Life Circles */}
          <section>
            <GeometricDivider label="دوائر الحياة" />
            <div className="grid grid-cols-4 gap-4 mt-3">
              {CIRCLES.map((c, i) => (
                <div
                  key={c.name}
                  className="fade-up rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={{ background: c.light, animationDelay: `${i * 80}ms` }}
                >
                  {/* Arch shape */}
                  <div
                    className="arch w-16 h-20 mx-auto mb-3 flex items-end justify-center pb-3"
                    style={{ background: `linear-gradient(180deg, ${c.color}22, ${c.color}55)`, border: `2px solid ${c.color}33` }}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                  </div>
                  <p className="text-center font-bold text-sm" style={{ color: c.color }}>{c.name}</p>
                  <p className="text-center text-[#7C7A8E] text-xs mt-0.5">{c.tasks} مهام</p>
                  {/* Progress bar */}
                  <div className="mt-3 bg-white/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${c.progress}%`, background: c.color }}
                    />
                  </div>
                  <p className="text-center text-[10px] mt-1" style={{ color: c.color }}>{c.progress}%</p>
                </div>
              ))}
            </div>
          </section>

          {/* Prayer Times + Tasks side-by-side */}
          <div className="grid grid-cols-5 gap-5">

            {/* Prayer Times */}
            <section className="col-span-2">
              <GeometricDivider label="أوقات الصلاة" />
              <div className="mt-3 rounded-2xl overflow-hidden shadow-sm"
                style={{ background: "linear-gradient(160deg, #2A2542, #3D3468)" }}>
                <div className="grid grid-cols-3 gap-3 p-4">
                  {PRAYERS.map((p) => (
                    <div key={p.name} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`octagon w-14 h-14 flex flex-col items-center justify-center transition-all ${
                          p.passed
                            ? "bg-white/10"
                            : "bg-gradient-to-br from-[#C9A84C] to-[#E8C96A]"
                        }`}
                      >
                        <span className={`text-[10px] font-bold ${p.passed ? "text-white/40" : "text-[#2A2542]"}`}>
                          {p.name}
                        </span>
                        <span className={`text-xs font-black tabular-nums ${p.passed ? "text-white/30" : "text-[#2A2542]"}`}>
                          {p.time}
                        </span>
                      </div>
                      {!p.passed && (
                        <span className="text-[#C9A84C] text-[9px] font-semibold">قادمة</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Tasks scroll */}
            <section className="col-span-3">
              <GeometricDivider label="مهام اليوم" />
              <div className="scroll-card mt-3 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 space-y-2">
                  {TASKS.map((t, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-2.5 border-b border-[#e2d5b0]/60 last:border-0 ${t.done ? "opacity-50" : ""}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center ${
                          t.done
                            ? "bg-[#5E5495] border-[#5E5495]"
                            : "border-[#C9A84C] bg-transparent"
                        }`}
                      >
                        {t.done && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <p className={`flex-1 text-sm ${t.done ? "line-through text-[#7C7A8E]" : "text-[#1A1830] font-medium"}`}>
                        {t.title}
                      </p>
                      <span className="text-[10px] text-[#7C7A8E] flex-shrink-0">{t.circle}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${PRIORITY_COLORS[t.priority]}`}>
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* Footer divider */}
          <div className="pb-4">
            <GeometricDivider />
            <p className="text-center text-[#7C7A8E] text-xs mt-2">
              مدار — نظام إدارة الحياة الذكي • نسخة ١.٠
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
