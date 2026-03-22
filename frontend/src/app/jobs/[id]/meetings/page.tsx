"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

export default function MeetingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  function add() {
    if (!title.trim()) return;
    setMeta({ ...meta, meetings: [{ title: title.trim(), date: date || new Date().toISOString().slice(0, 10), notes: notes.trim() }, ...meta.meetings] });
    setTitle(""); setDate(""); setNotes("");
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>تسجيل اجتماع</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الاجتماع"
                onKeyDown={e => { if (e.key === "Enter" && !notes) add(); }}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            </div>
            <div className="flex gap-2">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات ومخرجات الاجتماع (اختياري)" rows={2}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
              <button onClick={add} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white self-end" style={{ background: "#2D6B9E" }}>+ إضافة</button>
            </div>
          </div>
        </div>

        {meta.meetings.map((m, i) => (
          <div key={i} className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>📅 {m.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>{m.date}</span>
                <button onClick={() => { const arr = [...meta.meetings]; arr.splice(i, 1); setMeta({ ...meta, meetings: arr }); }}
                  className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
              </div>
            </div>
            {m.notes && <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{m.notes}</p>}
          </div>
        ))}

        {meta.meetings.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد اجتماعات — سجّل أول اجتماع</p>}
      </div>
    </JobPageShell>
  );
}
