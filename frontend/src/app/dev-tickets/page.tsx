"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface Ticket {
  id: string; title: string; userRequest: string; screenshots?: string;
  aiCommand: string | null; status: string; attempts: number;
  notes: string | null; createdAt: string; resolvedAt: string | null;
}

const ST: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: "مفتوح", color: "#3B82F6", icon: "🔵" },
  in_progress: { label: "قيد التنفيذ", color: "#F59E0B", icon: "🟡" },
  resolved: { label: "محلول", color: "#3D8C5A", icon: "🟢" },
  failed: { label: "فشل", color: "#DC2626", icon: "🔴" },
};

export default function DevTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tickets" | "context">("tickets");

  // New ticket
  const [title, setTitle] = useState("");
  const [request, setRequest] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Context
  const [context, setContext] = useState("");
  const [savingCtx, setSavingCtx] = useState(false);
  const [ctxSaved, setCtxSaved] = useState(false);

  // Ticket UI
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryNotes, setRetryNotes] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const pasteRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: t }, { data: c }] = await Promise.all([
        api.get("/api/dev-tickets"),
        api.get("/api/dev-tickets/context"),
      ]);
      setTickets(t ?? []);
      setContext(c?.content ?? "");
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Paste handler for images
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => { if (typeof reader.result === "string") setImages(prev => [...prev, reader.result as string]); };
          reader.readAsDataURL(file);
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  async function handleCreate() {
    if (!request.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/api/dev-tickets", {
        title: title.trim() || undefined,
        userRequest: request.trim(),
        screenshots: images.length > 0 ? images : undefined,
      });
      setTickets(prev => [data, ...prev]);
      setTitle(""); setRequest(""); setImages([]);
      setExpandedId(data.id);
    } catch {}
    setCreating(false);
  }

  async function handleResolve(id: string) {
    try {
      await api.patch(`/api/dev-tickets/${id}/resolve`);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: "resolved", resolvedAt: new Date().toISOString() } : t));
    } catch {}
  }

  async function handleRetry(id: string) {
    if (!retryNotes.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.patch(`/api/dev-tickets/${id}/retry`, { notes: retryNotes.trim() });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, aiCommand: data.aiCommand, status: "open", attempts: data.attempts } : t));
      setRetryingId(null); setRetryNotes("");
    } catch {}
    setCreating(false);
  }

  async function saveContext() {
    setSavingCtx(true);
    try { await api.put("/api/dev-tickets/context", { content: context }); setCtxSaved(true); setTimeout(() => setCtxSaved(false), 2000); } catch {}
    setSavingCtx(false);
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  function parseScreenshots(s?: string): string[] {
    if (!s) return [];
    try { return JSON.parse(s); } catch { return []; }
  }

  const stats = {
    open: tickets.filter(t => t.status === "open" || t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    total: tickets.length,
  };

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🛠️ طلبات التطوير</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{stats.total} طلب</span>
          {stats.open > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#3B82F615", color: "#3B82F6" }}>🔵 {stats.open} مفتوح</span>}
          {stats.resolved > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>🟢 {stats.resolved} محلول</span>}
        </div>
        {/* Tabs */}
        <div className="flex gap-1.5 mt-2">
          {([["tickets", "التذاكر"], ["context", "سياق المشروع"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: tab === k ? "#5E5495" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#5E5495" : "var(--card-border)"}` }}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {/* ═══ Context Tab ═══ */}
        {tab === "context" && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--text)" }}>سياق المشروع</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>أضف معلومات مهمة عن المشروع — تُستخدم تلقائيًا في كل طلب جديد</p>
            <textarea value={context} onChange={e => setContext(e.target.value)}
              rows={10} placeholder={"مثال:\n- نستخدم TiDB وليس PostgreSQL\n- القائمة الجانبية في Sidebar.tsx\n- ألوان المشروع: بنفسجي #5E5495 وذهبي #D4AF37\n- الباكند ينشر على Azure App Service"}
              className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none leading-relaxed"
              style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
            <button onClick={saveContext} disabled={savingCtx}
              className="px-6 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: ctxSaved ? "#3D8C5A" : "#5E5495" }}>
              {ctxSaved ? "✓ تم الحفظ" : savingCtx ? "جارٍ الحفظ..." : "حفظ السياق"}
            </button>
          </div>
        )}

        {/* ═══ Tickets Tab ═══ */}
        {tab === "tickets" && (
          <>
            {/* New ticket form */}
            <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--text)" }}>طلب جديد</p>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="عنوان مختصر (اختياري)..."
                className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              <textarea value={request} onChange={e => setRequest(e.target.value)}
                rows={3} placeholder="اكتب طلبك بالعربي... مثال: أضف زر تصدير PDF في صفحة التقارير"
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none"
                style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />

              {/* Paste area */}
              <div ref={pasteRef}
                className="rounded-xl border-2 border-dashed p-3 text-center min-h-[60px] transition"
                style={{ borderColor: images.length > 0 ? "#D4AF37" : "var(--card-border)", background: images.length > 0 ? "#D4AF3706" : "var(--bg)" }}>
                {images.length === 0 ? (
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>📎 الصق صورة هنا (Ctrl+V) — اختياري</p>
                ) : (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {images.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} alt="" className="h-20 rounded-lg border" style={{ borderColor: "var(--card-border)" }} />
                        <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">✕</button>
                      </div>
                    ))}
                    <p className="text-[9px] self-end" style={{ color: "var(--muted)" }}>الصق المزيد بـ Ctrl+V</p>
                  </div>
                )}
              </div>

              <button onClick={handleCreate} disabled={creating || !request.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>
                {creating ? "🤖 جارٍ التوليد..." : "🤖 توليد الأمر"}
              </button>
            </div>

            {/* Tickets list */}
            {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

            {!loading && tickets.map(ticket => {
              const st = ST[ticket.status] ?? ST.open;
              const isExpanded = expandedId === ticket.id;
              const isRetrying = retryingId === ticket.id;
              const shots = parseScreenshots(ticket.screenshots);

              return (
                <div key={ticket.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    className="w-full px-4 py-3 flex items-center gap-2 text-right transition hover:bg-black/[0.02]">
                    <span className={`text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`} style={{ color: st.color }}>▼</span>
                    <span className="text-xs">{st.icon}</span>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{ticket.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                        {ticket.attempts > 1 && <span className="text-[9px]" style={{ color: "var(--muted)" }}>محاولة {ticket.attempts}</span>}
                        <span className="text-[9px]" style={{ color: "var(--muted)" }}>{new Date(ticket.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                      <div className="mt-3">
                        <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>الطلب الأصلي:</p>
                        <p className="text-xs leading-relaxed p-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--bg)", color: "var(--text)" }}>{ticket.userRequest}</p>
                      </div>

                      {shots.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>صور مرفقة:</p>
                          <div className="flex gap-2 flex-wrap">
                            {shots.map((s, i) => <img key={i} src={s} alt="" className="h-24 rounded-lg border" style={{ borderColor: "var(--card-border)" }} />)}
                          </div>
                        </div>
                      )}

                      {ticket.aiCommand && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold" style={{ color: "#D4AF37" }}>🤖 الأمر المُولَّد:</p>
                            <button onClick={() => copy(ticket.aiCommand!, ticket.id)}
                              className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition"
                              style={{ background: copied === ticket.id ? "#3D8C5A15" : "#D4AF3715", color: copied === ticket.id ? "#3D8C5A" : "#D4AF37" }}>
                              {copied === ticket.id ? "✓ تم النسخ" : "📋 نسخ الأمر"}
                            </button>
                          </div>
                          <pre className="text-xs leading-relaxed p-3 rounded-lg overflow-x-auto whitespace-pre-wrap" dir="rtl"
                            style={{ background: "#1A1830", color: "#E2D5B0", fontFamily: "inherit" }}>
                            {ticket.aiCommand}
                          </pre>
                        </div>
                      )}

                      {ticket.status !== "resolved" && (
                        <div className="flex gap-2">
                          <button onClick={() => handleResolve(ticket.id)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition" style={{ background: "#3D8C5A15", color: "#3D8C5A", border: "1px solid #3D8C5A30" }}>
                            ✅ تم التعديل
                          </button>
                          <button onClick={() => { setRetryingId(isRetrying ? null : ticket.id); setRetryNotes(""); }}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition" style={{ background: "#DC262615", color: "#DC2626", border: "1px solid #DC262630" }}>
                            ❌ لم يتعدل
                          </button>
                        </div>
                      )}

                      {ticket.status === "resolved" && (
                        <p className="text-center py-2 text-xs font-bold" style={{ color: "#3D8C5A" }}>
                          ✅ تم الحل — {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString("ar-SA") : ""}
                        </p>
                      )}

                      {isRetrying && (
                        <div className="space-y-2 p-3 rounded-xl" style={{ background: "#DC262608", border: "1px solid #DC262620" }}>
                          <p className="text-[10px] font-bold" style={{ color: "#DC2626" }}>ما المشكلة؟</p>
                          <textarea value={retryNotes} onChange={e => setRetryNotes(e.target.value)}
                            rows={2} placeholder="مثال: التعديل لم يشمل الصفحة الرئيسية..."
                            className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none"
                            style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                          <button onClick={() => handleRetry(ticket.id)} disabled={creating || !retryNotes.trim()}
                            className="w-full py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40" style={{ background: "#DC2626" }}>
                            {creating ? "جارٍ التوليد..." : "🤖 توليد أمر محسّن"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!loading && tickets.length === 0 && (
              <div className="text-center py-12">
                <p className="text-3xl mb-3">🛠️</p>
                <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد طلبات</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>اكتب طلبك بالعربي وسيُولّد أمر لـ Claude Code</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
