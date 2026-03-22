"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

export default function SkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [skill, setSkill] = useState("");

  function add() {
    if (!skill.trim() || meta.skills.includes(skill.trim())) return;
    setMeta({ ...meta, skills: [...meta.skills, skill.trim()] });
    setSkill("");
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-5">
        <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>إضافة مهارة</p>
          <div className="flex gap-2">
            <input value={skill} onChange={e => setSkill(e.target.value)} placeholder="اسم المهارة…"
              onKeyDown={e => { if (e.key === "Enter") add(); }}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <button onClick={add} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+</button>
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap">
          {meta.skills.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition hover:shadow-sm"
              style={{ background: "#2D6B9E12", color: "#2D6B9E", border: "1px solid #2D6B9E20" }}>
              💡 {s}
              <button onClick={() => { const arr = [...meta.skills]; arr.splice(i, 1); setMeta({ ...meta, skills: arr }); }}
                className="text-red-300 hover:text-red-500 mr-1 text-xs">✕</button>
            </span>
          ))}
        </div>

        {meta.skills.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد مهارات — أضف المهارات المطلوبة لهذه الوظيفة</p>}
      </div>
    </JobPageShell>
  );
}
