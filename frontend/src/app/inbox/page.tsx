"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getInbox, markMessageRead, markAllRead, getTasks, acceptRejectTask, type InboxMessage, type SmartTask } from "@/lib/api";

function formatTime(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `منذ ${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr  < 24)  return `منذ ${diffHr} س`;
  return `منذ ${Math.floor(diffHr / 24)} ي`;
}

const TAG_COLORS: Record<string, string> = {
  نظام:   "bg-[#2C2C54]/10 text-[#2C2C54]",
  ذكاء:   "bg-[#D4AF37]/10 text-[#D4AF37]",
  صلاة:   "bg-green-100 text-green-700",
  أهداف:  "bg-blue-100 text-blue-700",
  أسرة:   "bg-orange-100 text-orange-700",
};

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [inboxTasks, setInboxTasks] = useState<SmartTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [tab, setTab]           = useState<"tasks" | "messages">("tasks");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [msgs, tasks] = await Promise.all([
        getInbox().catch(() => [] as InboxMessage[]),
        getTasks(),
      ]);
      setMessages(msgs);
      setInboxTasks(tasks.filter((t) => t.status === "Inbox"));
    } catch {
      setError("تعذّر تحميل صندوق الوارد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAccept(id: string) {
    try { await acceptRejectTask(id, true); setInboxTasks((p) => p.filter((t) => t.id !== id)); } catch {}
  }
  async function handleReject(id: string) {
    try { await acceptRejectTask(id, false); setInboxTasks((p) => p.filter((t) => t.id !== id)); } catch {}
  }
  async function handleMarkRead(id: string) {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true } : m));
    try { await markMessageRead(id); } catch {}
  }
  async function handleMarkAllRead() {
    setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
    try { await markAllRead(); } catch {}
  }

  const unreadCount = messages.filter((m) => !m.isRead).length;
  const totalBadge = inboxTasks.length + unreadCount;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[#16213E] font-bold text-lg">صندوق الوارد</h2>
            {totalBadge > 0 && (
              <span className="w-6 h-6 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center">
                {totalBadge}
              </span>
            )}
          </div>
          {tab === "messages" && unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-sm text-[#2C2C54] font-medium hover:underline">
              تحديد الكل كمقروء
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("tasks")}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
            style={{ background: tab === "tasks" ? "#2C2C54" : "transparent", color: tab === "tasks" ? "#fff" : "#6B7280" }}>
            مهام واردة ({inboxTasks.length})
          </button>
          <button onClick={() => setTab("messages")}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
            style={{ background: tab === "messages" ? "#2C2C54" : "transparent", color: tab === "messages" ? "#fff" : "#6B7280" }}>
            رسائل ({unreadCount})
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-4">
        {loading && (
          <div className="space-y-2">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 animate-pulse">
                <div className="h-4 rounded bg-gray-200 w-2/3 mb-2" />
                <div className="h-3 rounded bg-gray-200 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="text-[#D4AF37] text-sm hover:underline">إعادة المحاولة</button>
          </div>
        )}

        {/* ── Incoming Tasks ── */}
        {!loading && !error && tab === "tasks" && (
          <section>
            <GeometricDivider label="مهام تحتاج موافقتك" />
            <div className="mt-4 space-y-3">
              {inboxTasks.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3 text-2xl">✅</div>
                  <p className="text-[#6B7280] text-sm">لا توجد مهام واردة</p>
                </div>
              )}
              {inboxTasks.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold text-[#16213E]">{t.title}</p>
                      {t.description && <p className="text-[#6B7280] text-xs mt-1 leading-relaxed">{t.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {t.lifeCircle && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-[#6B7280]">{t.lifeCircle.name}</span>}
                        {t.dueDate && <span className="text-[10px] text-[#6B7280]">📅 {new Date(t.dueDate).toLocaleDateString("ar-SA")}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">بانتظار الموافقة</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAccept(t.id)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#3D8C5A] hover:opacity-90 transition">
                      ✓ قبول
                    </button>
                    <button onClick={() => handleReject(t.id)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#DC2626] bg-red-50 border border-red-200 hover:bg-red-100 transition">
                      ✕ رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Messages ── */}
        {!loading && !error && tab === "messages" && (
          <section>
            <GeometricDivider label="الرسائل والتنبيهات" />
            <div className="mt-4 space-y-2">
              {messages.length === 0 && (
                <div className="text-center py-12"><p className="text-[#6B7280] text-sm">لا توجد رسائل</p></div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} onClick={() => !msg.isRead && handleMarkRead(msg.id)}
                  className={`flex items-start gap-4 bg-white rounded-2xl p-5 border cursor-pointer hover:shadow-md transition-all ${
                    !msg.isRead ? "border-[#D4AF37]/40 shadow-sm" : "border-gray-200"
                  }`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${!msg.isRead ? "bg-[#D4AF37]" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-[#16213E]">{msg.from}</span>
                      {msg.tag && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[msg.tag] ?? "bg-gray-100 text-gray-600"}`}>
                          {msg.tag}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${!msg.isRead ? "text-[#16213E] font-medium" : "text-[#6B7280]"}`}>{msg.subject}</p>
                  </div>
                  <span className="text-[#6B7280] text-xs flex-shrink-0">{formatTime(msg.receivedAt)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
