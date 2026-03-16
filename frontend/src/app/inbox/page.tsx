"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getInbox, markMessageRead, markAllRead, type InboxMessage } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `منذ ${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr  < 24)  return `منذ ${diffHr} س`;
  return `منذ ${Math.floor(diffHr / 24)} ي`;
}

const TAG_COLORS: Record<string, string> = {
  نظام:   "bg-[#5E5495]/10 text-[#5E5495]",
  ذكاء:   "bg-[#C9A84C]/10 text-[#C9A84C]",
  صلاة:   "bg-green-100 text-green-700",
  أهداف:  "bg-blue-100 text-blue-700",
  أسرة:   "bg-orange-100 text-orange-700",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InboxSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-[#E2D5B0] animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#E2D5B0] mt-2 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="w-20 h-4 rounded bg-[#E2D5B0]" />
              <div className="w-12 h-4 rounded-full bg-[#E2D5B0]" />
            </div>
            <div className="w-3/4 h-3 rounded bg-[#E2D5B0]" />
          </div>
          <div className="w-12 h-3 rounded bg-[#E2D5B0] flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMessages(await getInbox());
    } catch {
      setError("تعذّر تحميل صندوق الوارد. تحقق من اتصالك أو سجّل دخولك من جديد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  async function handleMarkRead(id: string) {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true } : m));
    try { await markMessageRead(id); } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
    try { await markAllRead(); } catch { /* silent */ }
  }

  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#E2D5B0] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[#1A1830] font-bold text-lg">صندوق الوارد</h2>
            {unreadCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-[#5E5495] font-medium hover:underline"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </div>
      </header>

      <div className="px-8 py-6 space-y-4">
        <section>
          <GeometricDivider label="الرسائل والتنبيهات" />
          <div className="mt-4">

            {/* Loading */}
            {loading && <InboxSkeleton />}

            {/* Error */}
            {!loading && error && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button
                  onClick={fetchInbox}
                  className="text-[#C9A84C] text-sm font-medium hover:underline"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#7C7A8E] text-sm">لا توجد رسائل حتى الآن</p>
              </div>
            )}

            {/* Messages list */}
            {!loading && !error && messages.length > 0 && (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => !msg.isRead && handleMarkRead(msg.id)}
                    className={`flex items-start gap-4 bg-white rounded-2xl p-5 border cursor-pointer hover:shadow-md transition-all ${
                      !msg.isRead ? "border-[#C9A84C]/40 shadow-sm" : "border-[#E2D5B0]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${!msg.isRead ? "bg-[#C9A84C]" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-[#1A1830]">{msg.from}</span>
                        {msg.tag && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[msg.tag] ?? "bg-gray-100 text-gray-600"}`}>
                            {msg.tag}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate ${!msg.isRead ? "text-[#1A1830] font-medium" : "text-[#7C7A8E]"}`}>
                        {msg.subject}
                      </p>
                    </div>
                    <span className="text-[#7C7A8E] text-xs flex-shrink-0">{formatTime(msg.receivedAt)}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>
        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
