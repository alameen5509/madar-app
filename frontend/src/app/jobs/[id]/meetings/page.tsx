"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

type Meeting = { title: string; date: string; notes: string; attendees?: string; actionItems?: { text: string; done: boolean }[] };

export default function MeetingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [showAdd, setShowAdd] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState("");
  const [fAttendees, setFAttendees] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fActions, setFActions] = useState("");
  const [filter, setFilter] = useState<"all" | "week" | "month">("all");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [newAction, setNewAction] = useState("");

  function add() {
    if (!fTitle.trim()) return;
    const actions = fActions.trim() ? fActions.split("\n").filter(l => l.trim()).map(t => ({ text: t.trim(), done: false })) : [];
    const meeting: Meeting = {
      title: fTitle.trim(),
      date: fDate || new Date().toISOString().slice(0, 10),
      notes: fNotes.trim(),
      attendees: fAttendees.trim() || undefined,
      actionItems: actions.length > 0 ? actions : undefined,
    };
    setMeta({ ...meta, meetings: [meeting, ...meta.meetings] });
    setFTitle(""); setFDate(""); setFAttendees(""); setFNotes(""); setFActions(""); setShowAdd(false);
  }

  function remove(i: number) {
    const arr = [...meta.meetings]; arr.splice(i, 1); setMeta({ ...meta, meetings: arr });
  }

  function toggleAction(mi: number, ai: number) {
    const meetings = [...meta.meetings];
    const m = { ...meetings[mi] };
    const items = [...(m.actionItems ?? [])];
    items[ai] = { ...items[ai], done: !items[ai].done };
    m.actionItems = items;
    meetings[mi] = m;
    setMeta({ ...meta, meetings });
  }

  function addAction(mi: number) {
    if (!newAction.trim()) return;
    const meetings = [...meta.meetings];
    const m = { ...meetings[mi] };
    m.actionItems = [...(m.actionItems ?? []), { text: newAction.trim(), done: false }];
    meetings[mi] = m;
    setMeta({ ...meta, meetings });
    setNewAction("");
  }

  function removeAction(mi: number, ai: number) {
    const meetings = [...meta.meetings];
    const m = { ...meetings[mi] };
    const items = [...(m.actionItems ?? [])];
    items.splice(ai, 1);
    m.actionItems = items;
    meetings[mi] = m;
    setMeta({ ...meta, meetings });
  }

  // Filter
  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const sorted = [...meta.meetings].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = sorted.filter(m => {
    if (filter === "week") return m.date >= weekAgo;
    if (filter === "month") return m.date >= monthStart;
    return true;
  });

  const totalActions = meta.meetings.reduce((s, m) => s + (m.actionItems?.length ?? 0), 0);
  const doneActions = meta.meetings.reduce((s, m) => s + (m.actionItems?.filter(a => a.done).length ?? 0), 0);
  const pendingActions = totalActions - doneActions;

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>الاجتماعات</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
              {meta.meetings.length} اجتماع{pendingActions > 0 ? ` · ${pendingActions} مهمة معلقة` : ""}
            </p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + اجتماع جديد
          </button>
        </div>

        {/* Summary */}
        {meta.meetings.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>الاجتماعات</p>
              <p className="text-xl font-black" style={{ color: "#2D6B9E" }}>{meta.meetings.length}</p>
            </div>
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>مهام ناتجة</p>
              <p className="text-xl font-black" style={{ color: "#D4AF37" }}>{totalActions}</p>
            </div>
            <div className="text-center p-3 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>معلقة</p>
              <p className="text-xl font-black" style={{ color: pendingActions > 0 ? "#DC2626" : "#3D8C5A" }}>{pendingActions}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        {meta.meetings.length > 0 && (
          <div className="flex gap-2">
            {([["all", "الكل"], ["week", "هذا الأسبوع"], ["month", "هذا الشهر"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition"
                style={{ background: filter === k ? "#2D6B9E" : "#F3F4F6", color: filter === k ? "#fff" : "#6B7280" }}>{l}</button>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="rounded-2xl p-5 border-2 space-y-3 fade-up" style={{ borderColor: "#2D6B9E40", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>اجتماع جديد</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={add} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#2D6B9E" }}>إضافة</button>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="موضوع الاجتماع *"
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                className="px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            </div>
            <input value={fAttendees} onChange={e => setFAttendees(e.target.value)}
              placeholder="الحاضرون (مثال: أحمد، سارة، خالد)"
              className="w-full px-4 py-2 rounded-xl border text-xs focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="الملاحظات والمخرجات" rows={3}
              className="w-full px-4 py-2 rounded-xl border text-xs resize-none focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <textarea value={fActions} onChange={e => setFActions(e.target.value)}
              placeholder="المهام الناتجة (كل مهمة في سطر)&#10;مثال:&#10;إرسال التقرير لأحمد&#10;تحديث العرض التقديمي" rows={3}
              className="w-full px-4 py-2 rounded-xl border text-xs resize-none focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          </div>
        )}

        {/* Meetings list */}
        {filtered.map((m, fi) => {
          const realIdx = meta.meetings.indexOf(m);
          const isExpanded = expandedIdx === realIdx;
          const actions = m.actionItems ?? [];
          const doneCnt = actions.filter(a => a.done).length;
          const dayName = new Date(m.date).toLocaleDateString("ar-SA", { weekday: "long" });

          return (
            <div key={fi} className="rounded-2xl border overflow-hidden transition-all"
              style={{ background: "var(--card)", borderColor: isExpanded ? "#2D6B9E40" : "var(--card-border)" }}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedIdx(isExpanded ? null : realIdx)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: "#2D6B9E12" }}>📅</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{m.title}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                    {dayName} · {m.date}
                    {m.attendees && ` · ${m.attendees}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {actions.length > 0 && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: doneCnt === actions.length ? "#3D8C5A15" : "#D4AF3715", color: doneCnt === actions.length ? "#3D8C5A" : "#D4AF37" }}>
                      {doneCnt}/{actions.length}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                  {/* Attendees */}
                  {m.attendees && (
                    <div className="flex items-center gap-2 pt-3">
                      <span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>👥 الحاضرون:</span>
                      <div className="flex gap-1 flex-wrap">
                        {m.attendees.split(/[,،]/).map((a, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#2D6B9E12", color: "#2D6B9E" }}>{a.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {m.notes && (
                    <div className="pt-1">
                      <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>📝 الملاحظات:</p>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap px-3 py-2 rounded-xl"
                        style={{ color: "var(--text)", background: "var(--bg)" }}>{m.notes}</p>
                    </div>
                  )}

                  {/* Action items */}
                  <div>
                    <p className="text-[10px] font-bold mb-2" style={{ color: "var(--muted)" }}>✅ المهام الناتجة ({actions.length}):</p>
                    <div className="space-y-1.5">
                      {actions.map((a, ai) => (
                        <div key={ai} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: a.done ? "#3D8C5A08" : "var(--bg)" }}>
                          <button onClick={() => toggleAction(realIdx, ai)}
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                            style={{ borderColor: a.done ? "#3D8C5A" : "#E5E7EB", background: a.done ? "#3D8C5A" : "transparent" }}>
                            {a.done && <span className="text-white text-[8px]">✓</span>}
                          </button>
                          <span className="text-xs flex-1"
                            style={{ color: a.done ? "var(--muted)" : "var(--text)", textDecoration: a.done ? "line-through" : "none" }}>
                            {a.text}
                          </span>
                          <button onClick={() => removeAction(realIdx, ai)}
                            className="text-red-300 hover:text-red-500 text-[10px] transition">✕</button>
                        </div>
                      ))}
                    </div>
                    {/* Add action inline */}
                    <div className="flex gap-2 mt-2">
                      <input value={newAction} onChange={e => setNewAction(e.target.value)}
                        placeholder="+ مهمة جديدة…"
                        onKeyDown={e => { if (e.key === "Enter") addAction(realIdx); }}
                        className="flex-1 px-3 py-1.5 rounded-lg border text-[10px] focus:outline-none"
                        style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
                      <button onClick={() => addAction(realIdx)}
                        className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
                    </div>
                  </div>

                  {/* Delete meeting */}
                  <button onClick={() => remove(realIdx)}
                    className="w-full py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-50 transition border border-red-100">
                    حذف الاجتماع
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && meta.meetings.length > 0 && (
          <p className="text-center py-6 text-xs" style={{ color: "var(--muted)" }}>لا توجد اجتماعات في هذه الفترة</p>
        )}

        {meta.meetings.length === 0 && !showAdd && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📅</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد اجتماعات</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>سجّل أول اجتماع</p>
          </div>
        )}
      </div>
    </JobPageShell>
  );
}
