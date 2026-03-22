"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

export default function AchievementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  function add() {
    if (!title.trim()) return;
    setMeta({ ...meta, achievements: [{ title: title.trim(), date: date || new Date().toISOString().slice(0, 10) }, ...meta.achievements] });
    setTitle(""); setDate("");
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>تسجيل إنجاز</p>
          <div className="flex gap-2 flex-wrap">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ماذا أنجزت؟"
              onKeyDown={e => { if (e.key === "Enter") add(); }}
              className="flex-1 min-w-[180px] px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <button onClick={add} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ إضافة</button>
          </div>
        </div>

        {meta.achievements.map((a, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl px-5 py-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <span className="text-2xl">🏆</span>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{a.title}</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>{a.date}</p>
            </div>
            <button onClick={() => { const arr = [...meta.achievements]; arr.splice(i, 1); setMeta({ ...meta, achievements: arr }); }}
              className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
          </div>
        ))}

        {meta.achievements.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد إنجازات — سجّل أول إنجاز</p>}
      </div>
    </JobPageShell>
  );
}
