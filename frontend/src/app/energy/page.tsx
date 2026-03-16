import { GeometricDivider } from "@/components/IslamicPattern";

const HOURS = [
  { label: "فجر",   level: 3, time: "04-06" },
  { label: "صباح",  level: 5, time: "06-09" },
  { label: "ضحى",   level: 4, time: "09-12" },
  { label: "ظهر",   level: 3, time: "12-15" },
  { label: "عصر",   level: 5, time: "15-17" },
  { label: "مغرب",  level: 4, time: "17-19" },
  { label: "عشاء",  level: 2, time: "19-21" },
  { label: "ليل",   level: 1, time: "21-23" },
];

const LEVEL_COLOR = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#5E5495"];
const LEVEL_LABEL = ["", "منخفض جداً", "منخفض", "متوسط", "عالٍ", "مرتفع جداً"];

export default function EnergyPage() {
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <h2 className="text-[#1A1830] font-bold text-lg">الطاقة</h2>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Today's energy summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "طاقة الآن",       value: "عالية",   icon: "⚡", color: "#5E5495" },
            { label: "أفضل وقت اليوم",  value: "العصر",   icon: "🌟", color: "#C9A84C" },
            { label: "توصية",           value: "مهام إبداعية", icon: "✦", color: "#3D8C8C" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-[#E2D5B0] shadow-sm text-center">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-bold text-lg mt-2" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[#7C7A8E] text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Energy chart */}
        <section>
          <GeometricDivider label="منحنى الطاقة اليومي" />
          <div className="bg-white rounded-2xl p-6 border border-[#E2D5B0] shadow-sm mt-4">
            <div className="flex items-end gap-3 h-32">
              {HOURS.map((h) => (
                <div key={h.label} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${(h.level / 5) * 100}%`,
                      background: `linear-gradient(180deg, ${LEVEL_COLOR[h.level]}, ${LEVEL_COLOR[h.level]}88)`,
                    }}
                  />
                  <span className="text-[10px] text-[#7C7A8E]">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recommendations */}
        <section>
          <GeometricDivider label="توصيات الذكاء الاصطناعي" />
          <div className="mt-4 space-y-3">
            {HOURS.filter((h) => h.level >= 4).map((h) => (
              <div key={h.label} className="bg-white rounded-xl p-4 border border-[#E2D5B0] flex items-center gap-3">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: LEVEL_COLOR[h.level] }}>
                  {h.level}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#1A1830]">فترة {h.label} ({h.time})</p>
                  <p className="text-xs text-[#7C7A8E]">{LEVEL_LABEL[h.level]} — مثالي للمهام التي تتطلب تركيزاً عالياً</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
