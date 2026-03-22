"use client";

import { use, useState } from "react";
import { api } from "@/lib/api";
import JobPageShell, { useJobData } from "@/components/JobPageShell";
import { JobDimensionNode } from "@/components/JobTree";

export default function DimensionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { dims, goals, refresh } = useJobData(id);
  const [addName, setAddName] = useState("");

  const rootDims = dims.filter(d => !d.parentDimensionId);

  async function addRootDim() {
    if (!addName.trim()) return;
    await api.post(`/api/jobs/${id}/dimensions`, { name: addName.trim() }).catch(() => {});
    setAddName("");
    refresh();
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-1">
        {rootDims.map(d => (
          <JobDimensionNode key={d.id} dim={d} allDims={dims} allGoals={goals}
            level={0} onRefresh={refresh} />
        ))}

        <div className="flex items-center gap-2 pt-4 mt-3" style={{ borderTop: "1px dashed var(--card-border)" }}>
          <input value={addName} onChange={e => setAddName(e.target.value)}
            placeholder="اسم جانب رئيسي جديد…"
            onKeyDown={e => { if (e.key === "Enter") addRootDim(); }}
            className="flex-1 px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          <button onClick={addRootDim}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white"
            style={{ background: "#2D6B9E" }}>
            + جانب رئيسي
          </button>
        </div>

        {rootDims.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>
            لا توجد جوانب — أضف أول جانب لهذه الوظيفة
          </p>
        )}
      </div>
    </JobPageShell>
  );
}
