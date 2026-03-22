"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

const ROLES = ["مدير", "شريك", "موظف", "عميل", "مستشار", "مورد"];

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function add() {
    if (!name.trim() || !role) return;
    setMeta({ ...meta, team: [...meta.team, { name: name.trim(), role }] });
    setName(""); setRole("");
  }

  const grouped = ROLES.map(r => ({ role: r, members: meta.team.filter(m => m.role === r) })).filter(g => g.members.length > 0);

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-5">
        {/* Add form */}
        <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>إضافة عضو</p>
          <div className="flex gap-2 flex-wrap">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم"
              onKeyDown={e => { if (e.key === "Enter") add(); }}
              className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <div className="flex gap-1 flex-wrap">
              {ROLES.map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className="px-3 py-2 rounded-xl text-[10px] font-semibold transition"
                  style={{ background: role === r ? "#2D6B9E" : "#F3F4F6", color: role === r ? "#fff" : "#6B7280" }}>{r}</button>
              ))}
            </div>
            <button onClick={add} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ إضافة</button>
          </div>
        </div>

        {/* Grouped by role */}
        {grouped.map(g => (
          <div key={g.role}>
            <p className="text-xs font-bold mb-2" style={{ color: "var(--muted)" }}>{g.role} ({g.members.length})</p>
            <div className="space-y-2">
              {g.members.map((m, i) => {
                const globalIdx = meta.team.indexOf(m);
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#2D6B9E" }}>{m.name[0]}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{m.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.role}</p>
                    </div>
                    <button onClick={() => { const t = [...meta.team]; t.splice(globalIdx, 1); setMeta({ ...meta, team: t }); }}
                      className="text-red-300 hover:text-red-500 text-xs transition">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {meta.team.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا يوجد أعضاء — أضف فريقك</p>}
      </div>
    </JobPageShell>
  );
}
