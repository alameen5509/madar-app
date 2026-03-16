import { GeometricDivider } from "@/components/IslamicPattern";

const SECTIONS = [
  {
    title: "الحساب الشخصي",
    items: [
      { label: "الاسم",          value: "محمد العمري",          type: "text" },
      { label: "البريد الإلكتروني", value: "mohammed@example.com", type: "text" },
      { label: "المنطقة الزمنية",  value: "Asia/Riyadh",          type: "select" },
    ],
  },
  {
    title: "التفضيلات",
    items: [
      { label: "اللغة",        value: "العربية",   type: "select" },
      { label: "السمة",        value: "فاتح",      type: "select" },
      { label: "تنبيهات الصلاة", value: "مفعّل",   type: "toggle" },
      { label: "تنبيهات المهام", value: "مفعّل",   type: "toggle" },
    ],
  },
  {
    title: "الذكاء الاصطناعي",
    items: [
      { label: "مزود الذكاء الاصطناعي", value: "Claude (Anthropic)", type: "text" },
      { label: "مفتاح API",             value: "sk-ant-••••••••",   type: "password" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[#1A1830] font-bold text-lg">الإعدادات</h2>
          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            حفظ التغييرات
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <GeometricDivider label={section.title} />
            <div className="mt-4 bg-white rounded-2xl border border-[#E2D5B0] shadow-sm overflow-hidden">
              {section.items.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i < section.items.length - 1 ? "border-b border-[#F0EAD6]" : ""
                  }`}
                >
                  <span className="text-sm text-[#1A1830] font-medium">{item.label}</span>
                  {item.type === "toggle" ? (
                    <div className="w-10 h-6 rounded-full flex items-center px-1 cursor-pointer"
                      style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
                      <div className="w-4 h-4 rounded-full bg-white ml-auto" />
                    </div>
                  ) : (
                    <span className="text-sm text-[#7C7A8E] bg-[#F8F6F0] px-3 py-1 rounded-lg">
                      {item.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Danger zone */}
        <section>
          <GeometricDivider label="منطقة الخطر" />
          <div className="mt-4 bg-red-50 rounded-2xl border border-red-100 p-6">
            <p className="text-sm text-red-700 mb-4">هذه الإجراءات لا يمكن التراجع عنها.</p>
            <button className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-300 hover:bg-red-100 transition">
              حذف الحساب
            </button>
          </div>
        </section>

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
