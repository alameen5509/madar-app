"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

export default function LessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [lesson, setLesson] = useState("");

  function add() {
    if (!lesson.trim()) return;
    setMeta({ ...meta, lessons: [lesson.trim(), ...meta.lessons] });
    setLesson("");
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>إضافة درس مستفاد</p>
          <div className="flex gap-2">
            <input value={lesson} onChange={e => setLesson(e.target.value)} placeholder="ما الدرس الذي تعلمته؟"
              onKeyDown={e => { if (e.key === "Enter") add(); }}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <button onClick={add} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ إضافة</button>
          </div>
        </div>

        {meta.lessons.map((l, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl px-5 py-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <span className="text-lg mt-0.5">📝</span>
            <p className="text-sm flex-1 leading-relaxed" style={{ color: "var(--text)" }}>{l}</p>
            <button onClick={() => { const arr = [...meta.lessons]; arr.splice(i, 1); setMeta({ ...meta, lessons: arr }); }}
              className="text-red-300 hover:text-red-500 text-xs transition flex-shrink-0">✕</button>
          </div>
        ))}

        {meta.lessons.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد دروس — سجّل أول درس مستفاد</p>}
      </div>
    </JobPageShell>
  );
}
