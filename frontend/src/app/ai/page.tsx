"use client";

import { useState } from "react";
import { GeometricDivider, EightPointedStar } from "@/components/IslamicPattern";

const SUGGESTIONS = [
  "ما هي أولوياتي لهذا الأسبوع؟",
  "حلل توازن دوائر حياتي",
  "اقترح جدولاً لتحقيق أهدافي",
  "ما هو أفضل وقت لإنجاز مهامي اليوم؟",
];

type Message = { role: "user" | "ai"; text: string };

const INITIAL: Message[] = [
  {
    role: "ai",
    text: "أهلاً بك في مساعد مدار الذكي ✨\nأنا هنا لمساعدتك في تحقيق التوازن بين دوائر حياتك وإنجاز أهدافك. كيف يمكنني مساعدتك اليوم؟",
  },
];

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "ai", text: "جاري التحليل... سيتم ربط هذا المساعد بـ Claude API قريباً لتقديم توصيات مخصصة بناءً على بياناتك الفعلية. 🌟" },
    ]);
    setInput("");
  };

  return (
    <main className="flex-1 overflow-y-auto flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}>
            <EightPointedStar size={20} color="#2A2542" />
          </div>
          <div>
            <h2 className="text-[#1A1830] font-bold text-lg leading-none">الذكاء الاصطناعي</h2>
            <p className="text-[#7C7A8E] text-xs">مساعد مدار — مدعوم بـ Claude</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 py-6 space-y-4 overflow-y-auto">
        <GeometricDivider label="محادثة ذكية" />

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === "user"
                    ? "bg-white border border-[#E2D5B0] text-[#1A1830]"
                    : "text-white"
                }`}
                style={m.role === "ai" ? { background: "linear-gradient(135deg, #2A2542, #5E5495)" } : {}}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Quick suggestions */}
        <div>
          <p className="text-[#7C7A8E] text-xs mb-2">اقتراحات سريعة:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#C9A84C]/40 text-[#5E5495] hover:bg-[#C9A84C]/10 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t border-[#E2D5B0] bg-white/80 backdrop-blur">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="اكتب سؤالك هنا..."
            className="flex-1 rounded-xl border border-[#E2D5B0] px-4 py-2.5 text-sm outline-none focus:border-[#5E5495] transition bg-white"
            dir="rtl"
          />
          <button
            onClick={() => send(input)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}
          >
            إرسال
          </button>
        </div>
      </div>
    </main>
  );
}
