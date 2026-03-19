"use client";

import { useState, useEffect } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { logout } from "@/lib/api";

interface Settings {
  userName: string;
  focusDuration: number;
  shortBreak: number;
  longBreak: number;
  habitDuration: number;
  dhikrReminder: boolean;
  dhikrInterval: number;
  dhikrSoundName: string;
  weekendDays: string[];
  theme: "light" | "dark" | "auto";
}

const DEFAULTS: Settings = {
  userName: "محمد",
  focusDuration: 25,
  shortBreak: 5,
  longBreak: 25,
  habitDuration: 30,
  dhikrReminder: true,
  dhikrInterval: 60,
  dhikrSoundName: "",
  weekendDays: ["friday", "saturday"],
  theme: "light",
};

/* ─── Dhikr Sound Upload ───────────────────────────────────────────────── */

function DhikrSoundUpload({ soundName, onUpload, onRemove }: {
  soundName: string;
  onUpload: (name: string) => void;
  onRemove: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // حد أقصى 1 MB
    if (file.size > 1024 * 1024) {
      setError("الملف كبير جداً — الحد الأقصى 1 ميغابايت");
      return;
    }

    if (!file.type.startsWith("audio/")) {
      setError("الرجاء رفع ملف صوتي (mp3, wav, ogg…)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem("madar_dhikr_sound", reader.result as string);
        onUpload(file.name);
      } catch {
        setError("تعذر حفظ الملف — قد يكون كبيراً جداً");
      }
    };
    reader.readAsDataURL(file);
  }

  function preview() {
    try {
      const dataUrl = localStorage.getItem("madar_dhikr_sound");
      if (!dataUrl) return;
      const audio = new Audio(dataUrl);
      setPlaying(true);
      audio.play();
      audio.onended = () => setPlaying(false);
      setTimeout(() => { audio.pause(); setPlaying(false); }, 5000);
    } catch {}
  }

  const hasSaved = !!soundName;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#16213E]">صوت التذكير</span>
        {hasSaved ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#3D8C5A] font-medium truncate max-w-[140px]">{soundName}</span>
            <button onClick={preview} disabled={playing}
              className="text-[10px] px-2 py-1 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37] font-semibold hover:bg-[#D4AF37]/20 transition disabled:opacity-50">
              {playing ? "🔊 يعمل…" : "▶ معاينة"}
            </button>
            <button onClick={onRemove}
              className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-500 font-semibold hover:bg-red-100 transition">
              ✕ حذف
            </button>
          </div>
        ) : (
          <span className="text-xs text-[#9CA3AF]">الافتراضي (إشعار فقط)</span>
        )}
      </div>

      <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-[#D4AF37] transition">
        <span className="text-lg">🔊</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#16213E]">
            {hasSaved ? "تغيير الصوت" : "رفع صوت مخصص"}
          </p>
          <p className="text-[10px] text-[#9CA3AF]">MP3, WAV, OGG — حد أقصى 1 ميغابايت</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-lg bg-[#2C2C54] text-white font-semibold">اختر ملف</span>
        <input type="file" accept="audio/*" onChange={handleFile} className="hidden" />
      </label>

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("madar_settings");
    if (s) { try { setSettings({ ...DEFAULTS, ...JSON.parse(s) }); } catch { /* ignore */ } }
  }, []);

  function update<K extends keyof Settings>(key: K, val: Settings[K]) {
    setSettings((p) => {
      const updated = { ...p, [key]: val };
      localStorage.setItem("madar_settings", JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return updated;
    });
  }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-[#16213E]">{label}</span>
        <div onClick={() => onChange(!value)}
          className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
          style={{ background: value ? "#D4AF37" : "#D1D5DB" }}>
          <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
            style={{ right: value ? "0.125rem" : "1.375rem" }} />
        </div>
      </label>
    );
  }

  function NumberField({ label, value, onChange, min, max, suffix }: {
    label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix: string;
  }) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#16213E]">{label}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-lg bg-gray-100 font-bold hover:bg-gray-200">-</button>
          <span className="text-base font-bold text-[#2C2C54] w-10 text-center">{value}</span>
          <button onClick={() => onChange(Math.min(max, value + 1))} className="w-8 h-8 rounded-lg bg-gray-100 font-bold hover:bg-gray-200">+</button>
          <span className="text-xs text-[#6B7280] w-12">{suffix}</span>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">الإعدادات</h2>
            {saved && <p className="text-[#3D8C5A] text-xs">تم الحفظ ✓</p>}
          </div>
          <button onClick={logout}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition">
            تسجيل خروج
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6 max-w-2xl">

        {/* Profile */}
        <section>
          <GeometricDivider label="الملف الشخصي" />
          <div className="mt-3 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#16213E] mb-1.5">الاسم</label>
              <input value={settings.userName} onChange={(e) => update("userName", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            </div>
          </div>
        </section>

        {/* Focus */}
        <section>
          <GeometricDivider label="جلسات التركيز" />
          <div className="mt-3 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-5">
            <NumberField label="مدة الجلسة" value={settings.focusDuration} onChange={(v) => update("focusDuration", v)} min={5} max={60} suffix="دقيقة" />
            <NumberField label="راحة قصيرة" value={settings.shortBreak} onChange={(v) => update("shortBreak", v)} min={1} max={30} suffix="دقيقة" />
            <NumberField label="راحة طويلة" value={settings.longBreak} onChange={(v) => update("longBreak", v)} min={5} max={60} suffix="دقيقة" />
            <NumberField label="مدة العادات" value={settings.habitDuration} onChange={(v) => update("habitDuration", v)} min={5} max={90} suffix="دقيقة" />
            <p className="text-[10px] text-[#9CA3AF]">المدة المخصصة للعادات اليومية في أول فترة من خطة اليوم</p>
          </div>
        </section>

        {/* Dhikr */}
        <section>
          <GeometricDivider label="تنبيهات الذكر" />
          <div className="mt-3 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-5">
            <Toggle label="تنبيه ذكر الله" value={settings.dhikrReminder} onChange={(v) => update("dhikrReminder", v)} />
            {settings.dhikrReminder && (
              <>
                <NumberField label="كل" value={settings.dhikrInterval} onChange={(v) => update("dhikrInterval", v)} min={15} max={120} suffix="دقيقة" />
                <DhikrSoundUpload
                  soundName={settings.dhikrSoundName}
                  onUpload={(name) => update("dhikrSoundName", name)}
                  onRemove={() => {
                    update("dhikrSoundName", "");
                    try { localStorage.removeItem("madar_dhikr_sound"); } catch {}
                  }}
                />
              </>
            )}
          </div>
        </section>

        {/* Weekend */}
        <section>
          <GeometricDivider label="أيام الإجازة" />
          <div className="mt-3 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "saturday", label: "السبت" },
                { key: "sunday", label: "الأحد" },
                { key: "monday", label: "الاثنين" },
                { key: "tuesday", label: "الثلاثاء" },
                { key: "wednesday", label: "الأربعاء" },
                { key: "thursday", label: "الخميس" },
                { key: "friday", label: "الجمعة" },
              ].map((d) => {
                const active = settings.weekendDays.includes(d.key);
                return (
                  <button key={d.key} onClick={() => {
                    const updated = active
                      ? settings.weekendDays.filter((w) => w !== d.key)
                      : [...settings.weekendDays, d.key];
                    update("weekendDays", updated);
                  }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition"
                    style={{ background: active ? "#2C2C54" : "#F3F4F6", color: active ? "#fff" : "#6B7280" }}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <GeometricDivider label="مظهر الموقع" />
          <div className="mt-3 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "light", label: "نهاري", icon: "☀️", desc: "خلفية فاتحة" },
                { key: "dark",  label: "ليلي",  icon: "🌙", desc: "خلفية داكنة" },
                { key: "auto",  label: "تلقائي", icon: "🔄", desc: "حسب النظام" },
              ] as const).map((t) => (
                <button key={t.key} onClick={() => {
                  update("theme", t.key);
                  document.documentElement.setAttribute("data-theme", t.key);
                }}
                  className="py-4 rounded-xl text-center transition border-2"
                  style={{
                    borderColor: settings.theme === t.key ? "#D4AF37" : "transparent",
                    background: settings.theme === t.key ? "#D4AF3710" : "#F3F4F6",
                  }}>
                  <p className="text-2xl mb-1">{t.icon}</p>
                  <p className="text-sm font-bold text-[#16213E]">{t.label}</p>
                  <p className="text-[10px] text-[#6B7280]">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* App info */}
        <div className="text-center pb-8">
          <p className="text-[#9CA3AF] text-xs">مدار — نظام إدارة الحياة الذكي</p>
          <p className="text-[#D1D5DB] text-[10px] mt-1">الإصدار ٢.٠</p>
        </div>
      </div>
    </main>
  );
}
