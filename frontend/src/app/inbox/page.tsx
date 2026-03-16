import { GeometricDivider } from "@/components/IslamicPattern";

const INBOX = [
  { from: "مساعد مدار", subject: "تذكير: لديك ٣ مهام للمراجعة اليوم",        time: "منذ ١٠ د", tag: "نظام",   unread: true  },
  { from: "تحليل الطاقة", subject: "مستوى طاقتك اليوم مرتفع — الوقت المثالي للعمل", time: "منذ ٤٥ د", tag: "ذكاء",  unread: true  },
  { from: "تذكير الصلاة", subject: "حان وقت صلاة الظهر",                       time: "منذ ٢ س",  tag: "صلاة",  unread: false },
  { from: "الأهداف",     subject: "تبقّى ٧ أيام على موعد هدف: تعلم لغة برمجية", time: "أمس",      tag: "أهداف", unread: false },
  { from: "دائرة الأسرة", subject: "لم تضف أي مهمة عائلية هذا الأسبوع",        time: "أمس",      tag: "أسرة",  unread: false },
];

const TAG_COLORS: Record<string, string> = {
  "نظام":  "bg-[#5E5495]/10 text-[#5E5495]",
  "ذكاء":  "bg-[#C9A84C]/10 text-[#C9A84C]",
  "صلاة":  "bg-green-100 text-green-700",
  "أهداف": "bg-blue-100 text-blue-700",
  "أسرة":  "bg-orange-100 text-orange-700",
};

export default function InboxPage() {
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[#1A1830] font-bold text-lg">صندوق الوارد</h2>
            <span className="w-5 h-5 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold flex items-center justify-center">٢</span>
          </div>
          <button className="text-sm text-[#5E5495] font-medium hover:underline">تحديد الكل كمقروء</button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-4">
        <section>
          <GeometricDivider label="الرسائل والتنبيهات" />
          <div className="mt-4 space-y-2">
            {INBOX.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 bg-white rounded-2xl p-5 border cursor-pointer hover:shadow-md transition-all ${
                  msg.unread ? "border-[#C9A84C]/40 shadow-sm" : "border-[#E2D5B0]"
                }`}
              >
                {msg.unread && <span className="w-2 h-2 rounded-full bg-[#C9A84C] flex-shrink-0 mt-2" />}
                {!msg.unread && <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0 mt-2" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-[#1A1830]">{msg.from}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[msg.tag]}`}>{msg.tag}</span>
                  </div>
                  <p className={`text-sm truncate ${msg.unread ? "text-[#1A1830] font-medium" : "text-[#7C7A8E]"}`}>{msg.subject}</p>
                </div>
                <span className="text-[#7C7A8E] text-xs flex-shrink-0">{msg.time}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
