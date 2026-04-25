"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Ticket {
  id: string; title: string; userRequest?: string; aiCommand?: string;
  status: string; attempts: number; notes?: string; createdAt: string; resolvedAt?: string;
}

const ST: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: "مفتوح", color: "#3B82F6", icon: "🔵" },
  in_progress: { label: "قيد التنفيذ", color: "#F59E0B", icon: "🟡" },
  resolved: { label: "محلول", color: "#3D8C5A", icon: "🟢" },
  not_modified: { label: "لم يتعدل", color: "#DC2626", icon: "🔴" },
  failed: { label: "فشل", color: "#DC2626", icon: "🔴" },
};
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function DevTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tickets" | "context">("tickets");

  // New ticket
  const [showNew, setShowNew] = useState(false);
  const [nt, setNt] = useState({ title: "", desc: "", command: "" });
  const [creating, setCreating] = useState(false);

  // Context
  const [context, setContext] = useState("");
  const [savingCtx, setSavingCtx] = useState(false);
  const [ctxSaved, setCtxSaved] = useState(false);

  // Ticket UI
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCmd, setEditCmd] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: t }, { data: c }] = await Promise.all([
        api.get("/api/dev-tickets"),
        api.get("/api/dev-tickets/context"),
      ]);
      setTickets(t ?? []);
      setContext(c?.content ?? "");
    } catch (e: any) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate() {
    if (!nt.title.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/dev-tickets", { title: nt.title.trim(), description: nt.desc.trim() || undefined, command: nt.command.trim() || undefined });
      setNt({ title: "", desc: "", command: "" }); setShowNew(false); fetchData();
    } catch { alert("فشل الإنشاء"); }
    setCreating(false);
  }

  async function handleResolve(id: string) {
    try { await api.patch("/api/dev-tickets/" + id + "/resolve"); fetchData(); } catch { alert("حدث خطأ"); }
  }

  async function handleNotModified(id: string) {
    try { await api.patch("/api/dev-tickets/" + id + "/not-modified"); fetchData(); } catch { alert("حدث خطأ"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف التذكرة؟")) return;
    try { await api.delete("/api/dev-tickets/" + id); fetchData(); } catch { alert("حدث خطأ"); }
  }

  async function updateCommand(id: string) {
    try { await api.put("/api/dev-tickets/" + id, { command: editCmd }); setEditId(null); fetchData(); } catch { alert("حدث خطأ"); }
  }

  async function saveContext() {
    setSavingCtx(true);
    try { await api.put("/api/dev-tickets/context", { content: context }); setCtxSaved(true); setTimeout(() => setCtxSaved(false), 2000); } catch { alert("فشل الحفظ"); }
    setSavingCtx(false);
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
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
        {/* Context Tab */}
        {tab === "context" && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--text)" }}>سياق المشروع</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>ملاحظات عامة عن المشروع (اختياري)</p>
            <textarea value={context} onChange={e => setContext(e.target.value)}
              rows={10} placeholder="معلومات مهمة عن المشروع..."
              className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none leading-relaxed" style={is} />
            <button onClick={saveContext} disabled={savingCtx}
              className="px-6 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: ctxSaved ? "#3D8C5A" : "#5E5495" }}>
              {ctxSaved ? "✓ تم الحفظ" : savingCtx ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        )}

        {/* Tickets Tab */}
        {tab === "tickets" && (<>
          {/* New ticket */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: "var(--text)" }}>التذاكر</span>
            <button onClick={() => setShowNew(!showNew)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#5E5495" }}>+ تذكرة جديدة</button>
          </div>

          {showNew && (
            <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <input value={nt.title} onChange={e => setNt({...nt, title: e.target.value})}
                placeholder="العنوان *" className="w-full px-3 py-2.5 rounded-xl border text-sm font-bold focus:outline-none" style={is} />
              <textarea value={nt.desc} onChange={e => setNt({...nt, desc: e.target.value})}
                rows={3} placeholder="الوصف / التفاصيل (اختياري)"
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none" style={is} />
              <div>
                <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>📋 الأمر (الصقه هنا من Claude أو أي مصدر)</p>
                <textarea value={nt.command} onChange={e => setNt({...nt, command: e.target.value})}
                  rows={6} placeholder="الصق الأمر أو الكود هنا..."
                  className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none font-mono" dir="ltr"
                  style={{ ...is, fontFamily: "monospace" }} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                <button onClick={handleCreate} disabled={creating || !nt.title.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>
                  {creating ? "جارٍ الحفظ..." : "إنشاء التذكرة"}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

          {!loading && tickets.map(ticket => {
            const st = ST[ticket.status] ?? ST.open;
            const isExp = expandedId === ticket.id;
            const isEditing = editId === ticket.id;
            const cmd = ticket.aiCommand ?? "";

            return (
              <div key={ticket.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <button onClick={() => setExpandedId(isExp ? null : ticket.id)}
                  className="w-full px-4 py-3 flex items-center gap-2 text-right transition hover:bg-black/[0.02]">
                  <span className="text-xs">{st.icon}</span>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{ticket.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                      <span className="text-[9px]" style={{ color: "var(--muted)" }}>{new Date(ticket.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] transition-transform ${isExp ? "rotate-180" : ""}`} style={{ color: "var(--muted)" }}>▼</span>
                </button>

                {isExp && (
                  <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                    {ticket.userRequest && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>الوصف:</p>
                        <p className="text-xs leading-relaxed p-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--bg)", color: "var(--text)" }}>{ticket.userRequest}</p>
                      </div>
                    )}

                    {/* Command */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold" style={{ color: "#D4AF37" }}>📋 الأمر</p>
                        <div className="flex gap-1">
                          {cmd && (
                            <button onClick={() => copy(cmd, ticket.id)}
                              className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition"
                              style={{ background: copied === ticket.id ? "#3D8C5A15" : "#D4AF3715", color: copied === ticket.id ? "#3D8C5A" : "#D4AF37" }}>
                              {copied === ticket.id ? "✓ تم النسخ" : "📋 نسخ"}
                            </button>
                          )}
                          <button onClick={() => { setEditId(isEditing ? null : ticket.id); setEditCmd(cmd); }}
                            className="text-[10px] px-2 py-1 rounded-lg font-semibold transition"
                            style={{ background: "#5E549515", color: "#5E5495" }}>
                            {isEditing ? "إلغاء" : "✏️ تعديل"}
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea value={editCmd} onChange={e => setEditCmd(e.target.value)}
                            rows={8} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none font-mono" dir="ltr"
                            style={{ ...is, fontFamily: "monospace" }} />
                          <button onClick={() => updateCommand(ticket.id)} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#5E5495" }}>حفظ</button>
                        </div>
                      ) : cmd ? (
                        <pre className="text-xs leading-relaxed p-3 rounded-lg overflow-x-auto whitespace-pre-wrap" dir="ltr"
                          style={{ background: "#1A1830", color: "#E2D5B0", fontFamily: "monospace" }}>
                          {cmd}
                        </pre>
                      ) : (
                        <p className="text-[10px] py-3 text-center" style={{ color: "var(--muted)" }}>لا يوجد أمر — اضغط "تعديل" للصق الأمر</p>
                      )}
                    </div>

                    {/* Actions */}
                    {ticket.status !== "resolved" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleResolve(ticket.id)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition" style={{ background: "#3D8C5A15", color: "#3D8C5A", border: "1px solid #3D8C5A30" }}>
                          ✅ تم التعديل
                        </button>
                        <button onClick={() => handleNotModified(ticket.id)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition" style={{ background: "#DC262615", color: "#DC2626", border: "1px solid #DC262630" }}>
                          ❌ لم يتعدل
                        </button>
                        <button onClick={() => handleDelete(ticket.id)}
                          className="px-3 py-2 rounded-xl text-xs transition" style={{ color: "#DC2626" }}>🗑️</button>
                      </div>
                    )}

                    {ticket.status === "resolved" && (
                      <div className="flex items-center justify-between py-2">
                        <p className="text-xs font-bold" style={{ color: "#3D8C5A" }}>✅ تم الحل {ticket.resolvedAt ? `— ${new Date(ticket.resolvedAt).toLocaleDateString("ar-SA")}` : ""}</p>
                        <button onClick={() => handleDelete(ticket.id)} className="text-[9px] px-2 py-1 rounded-lg" style={{ color: "#DC2626" }}>🗑️ حذف</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && tickets.length === 0 && !showNew && (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🛠️</p>
              <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد تذاكر</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أنشئ تذكرة والصق الأمر من أي مصدر خارجي</p>
            </div>
          )}
        </>)}
      </div>
    </main>
  );
}
